package hu.mkristof64.azivosjatek;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import androidx.core.content.pm.PackageInfoCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private static final String APK_NAME = "Az-ivos-jatek.apk";
    private static final long MAX_APK_BYTES = 100L * 1024L * 1024L;
    private static final Pattern SHA_256_PATTERN = Pattern.compile("^[a-fA-F0-9]{64}$");
    private static final Pattern RELEASE_PATH = Pattern.compile(
        "^/MKristof64/Jatek/releases/download/[^/]+/Az-ivos-jatek\\.apk$"
    );

    private final ExecutorService downloadExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean downloadInProgress = new AtomicBoolean(false);

    @PluginMethod
    public void canInstallPackages(PluginCall call) {
        JSObject result = new JSObject();
        result.put("allowed", canRequestPackageInstalls());
        call.resolve(result);
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String downloadUrl = call.getString("url");
        String expectedSha256 = call.getString("sha256");
        boolean openPermissionSettings = call.getBoolean("openPermissionSettings", true);

        if (!isTrustedInitialUrl(downloadUrl) || expectedSha256 == null || !SHA_256_PATTERN.matcher(expectedSha256).matches()) {
            call.reject("A frissítési adatok érvénytelenek.", "INVALID_UPDATE_REQUEST");
            return;
        }

        if (!canRequestPackageInstalls()) {
            if (openPermissionSettings && openUnknownSourcesSettings()) {
                JSObject result = new JSObject();
                result.put("status", "permissionRequired");
                call.resolve(result);
            } else {
                call.reject("Az alkalmazástelepítési engedély hiányzik.", "INSTALL_PERMISSION_REQUIRED");
            }
            return;
        }

        if (!downloadInProgress.compareAndSet(false, true)) {
            call.reject("A frissítés letöltése már folyamatban van.", "UPDATE_IN_PROGRESS");
            return;
        }

        downloadExecutor.execute(() -> {
            File apkFile = null;
            try {
                apkFile = downloadApk(downloadUrl, expectedSha256.toLowerCase(Locale.ROOT));
                PackageInfo packageInfo = validateDownloadedApk(apkFile);
                File verifiedApk = apkFile;
                getBridge().executeOnMainThread(() -> openInstaller(call, verifiedApk, packageInfo));
            } catch (UpdateException error) {
                deleteQuietly(apkFile);
                rejectOnMainThread(call, error.getMessage(), error.code, error);
            } catch (Exception error) {
                deleteQuietly(apkFile);
                rejectOnMainThread(call, "A frissítés letöltése sikertelen.", "DOWNLOAD_FAILED", error);
            } finally {
                downloadInProgress.set(false);
            }
        });
    }

    private boolean canRequestPackageInstalls() {
        return (
            Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
            getContext().getPackageManager().canRequestPackageInstalls()
        );
    }

    private boolean openUnknownSourcesSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false;

        Intent intent = new Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + getContext().getPackageName())
        );
        try {
            getActivity().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException error) {
            return false;
        }
    }

    private File downloadApk(String downloadUrl, String expectedSha256) throws UpdateException {
        File updateDirectory = new File(getContext().getCacheDir(), "updates");
        if (!updateDirectory.exists() && !updateDirectory.mkdirs()) {
            throw new UpdateException("A frissítési mappa nem hozható létre.", "DOWNLOAD_FAILED");
        }

        File partialFile = new File(updateDirectory, APK_NAME + ".part");
        File apkFile = new File(updateDirectory, APK_NAME);
        deleteQuietly(partialFile);
        deleteQuietly(apkFile);

        URL currentUrl;
        try {
            currentUrl = new URL(downloadUrl);
        } catch (Exception error) {
            throw new UpdateException("A frissítés címe érvénytelen.", "INVALID_UPDATE_REQUEST", error);
        }

        for (int redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) currentUrl.openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(15_000);
                connection.setReadTimeout(35_000);
                connection.setRequestProperty("Accept", "application/octet-stream");
                connection.setRequestProperty("User-Agent", "Az-Ivos-Jatek-Android-Updater");

                int responseCode = connection.getResponseCode();
                if (isRedirect(responseCode)) {
                    String location = connection.getHeaderField("Location");
                    URL redirectUrl = location == null ? null : new URL(currentUrl, location);
                    if (!isTrustedRedirectUrl(redirectUrl)) {
                        throw new UpdateException("A letöltés nem megbízható címre irányított.", "DOWNLOAD_FAILED");
                    }
                    currentUrl = redirectUrl;
                    continue;
                }

                if (responseCode != HttpURLConnection.HTTP_OK) {
                    throw new UpdateException(
                        "A frissítés nem tölthető le (HTTP " + responseCode + ").",
                        "DOWNLOAD_FAILED"
                    );
                }

                long expectedLength = connection.getContentLengthLong();
                if (expectedLength > MAX_APK_BYTES) {
                    throw new UpdateException("A frissítési fájl túl nagy.", "DOWNLOAD_FAILED");
                }

                writeVerifiedDownload(connection, partialFile, expectedLength, expectedSha256);
                if (!partialFile.renameTo(apkFile)) {
                    throw new UpdateException("A letöltött frissítés nem menthető.", "DOWNLOAD_FAILED");
                }
                return apkFile;
            } catch (UpdateException error) {
                deleteQuietly(partialFile);
                throw error;
            } catch (Exception error) {
                deleteQuietly(partialFile);
                throw new UpdateException("A frissítés letöltése megszakadt.", "DOWNLOAD_FAILED", error);
            } finally {
                if (connection != null) connection.disconnect();
            }
        }

        throw new UpdateException("Túl sok átirányítás történt letöltés közben.", "DOWNLOAD_FAILED");
    }

    private void writeVerifiedDownload(
        HttpURLConnection connection,
        File destination,
        long expectedLength,
        String expectedSha256
    ) throws IOException, NoSuchAlgorithmException, UpdateException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long downloadedBytes = 0;
        int lastProgress = -1;
        notifyProgress(0, 0, expectedLength);

        try (
            BufferedInputStream input = new BufferedInputStream(connection.getInputStream());
            FileOutputStream output = new FileOutputStream(destination)
        ) {
            byte[] buffer = new byte[64 * 1024];
            int bytesRead;
            while ((bytesRead = input.read(buffer)) != -1) {
                if (Thread.currentThread().isInterrupted()) {
                    throw new UpdateException("A frissítés letöltése megszakadt.", "DOWNLOAD_FAILED");
                }

                downloadedBytes += bytesRead;
                if (downloadedBytes > MAX_APK_BYTES) {
                    throw new UpdateException("A frissítési fájl túl nagy.", "DOWNLOAD_FAILED");
                }

                digest.update(buffer, 0, bytesRead);
                output.write(buffer, 0, bytesRead);

                int progress = expectedLength > 0
                    ? (int) Math.min(99, (downloadedBytes * 100L) / expectedLength)
                    : 0;
                if (progress >= lastProgress + 2) {
                    lastProgress = progress;
                    notifyProgress(progress, downloadedBytes, expectedLength);
                }
            }
            output.flush();
            output.getFD().sync();
        }

        if (expectedLength > 0 && downloadedBytes != expectedLength) {
            throw new UpdateException("A frissítési fájl hiányosan érkezett meg.", "DOWNLOAD_FAILED");
        }

        String actualSha256 = toHex(digest.digest());
        if (!actualSha256.equals(expectedSha256)) {
            throw new UpdateException("A frissítési fájl ellenőrzése sikertelen.", "HASH_MISMATCH");
        }

        notifyProgress(100, downloadedBytes, expectedLength);
    }

    private PackageInfo validateDownloadedApk(File apkFile) throws UpdateException {
        PackageManager packageManager = getContext().getPackageManager();
        int signatureFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? PackageManager.GET_SIGNING_CERTIFICATES | PackageManager.GET_SIGNATURES
            : PackageManager.GET_SIGNATURES;

        try {
            PackageInfo installed = packageManager.getPackageInfo(getContext().getPackageName(), signatureFlags);
            PackageInfo candidate = packageManager.getPackageArchiveInfo(apkFile.getAbsolutePath(), signatureFlags);
            if (candidate == null) {
                throw new UpdateException("A letöltött telepítő érvénytelen.", "INVALID_APK");
            }
            if (!getContext().getPackageName().equals(candidate.packageName)) {
                throw new UpdateException("A telepítő nem ehhez az alkalmazáshoz tartozik.", "PACKAGE_MISMATCH");
            }
            if (PackageInfoCompat.getLongVersionCode(candidate) <= PackageInfoCompat.getLongVersionCode(installed)) {
                throw new UpdateException("A letöltött kiadás nem újabb a telepített változatnál.", "VERSION_NOT_NEWER");
            }
            if (!getSignerDigests(installed).equals(getSignerDigests(candidate))) {
                throw new UpdateException("A telepítő aláírása nem egyezik az alkalmazáséval.", "SIGNATURE_MISMATCH");
            }
            return candidate;
        } catch (PackageManager.NameNotFoundException error) {
            throw new UpdateException("A telepített alkalmazás nem ellenőrizhető.", "INVALID_APK", error);
        }
    }

    @SuppressWarnings("deprecation")
    private List<String> getSignerDigests(PackageInfo packageInfo) throws UpdateException {
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && packageInfo.signingInfo != null) {
            signatures = packageInfo.signingInfo.getApkContentsSigners();
        } else {
            signatures = packageInfo.signatures;
        }

        if (signatures == null || signatures.length == 0) {
            throw new UpdateException("Az alkalmazás aláírása nem ellenőrizhető.", "INVALID_APK");
        }

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            List<String> fingerprints = new ArrayList<>();
            for (Signature signature : signatures) {
                fingerprints.add(toHex(digest.digest(signature.toByteArray())));
                digest.reset();
            }
            Collections.sort(fingerprints);
            return fingerprints;
        } catch (NoSuchAlgorithmException error) {
            throw new UpdateException("Az alkalmazás aláírása nem ellenőrizhető.", "INVALID_APK", error);
        }
    }

    private void openInstaller(PluginCall call, File apkFile, PackageInfo packageInfo) {
        try {
            Uri apkUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                apkFile
            );
            Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
            intent.setData(apkUri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);

            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("status", "installerOpened");
            result.put("version", packageInfo.versionName);
            result.put("versionCode", PackageInfoCompat.getLongVersionCode(packageInfo));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Az Android telepítője nem nyitható meg.", "INSTALLER_UNAVAILABLE", error);
        }
    }

    private void notifyProgress(int percent, long downloadedBytes, long totalBytes) {
        JSObject progress = new JSObject();
        progress.put("percent", percent);
        progress.put("downloadedBytes", downloadedBytes);
        progress.put("totalBytes", totalBytes);
        getBridge().executeOnMainThread(() -> notifyListeners("downloadProgress", progress));
    }

    private void rejectOnMainThread(PluginCall call, String message, String code, Exception error) {
        getBridge().executeOnMainThread(() -> call.reject(message, code, error));
    }

    private boolean isTrustedInitialUrl(String value) {
        try {
            URL url = new URL(value);
            return (
                isHttps(url) &&
                "github.com".equalsIgnoreCase(url.getHost()) &&
                RELEASE_PATH.matcher(url.getPath()).matches() &&
                url.getUserInfo() == null &&
                (url.getPort() == -1 || url.getPort() == 443)
            );
        } catch (Exception error) {
            return false;
        }
    }

    private boolean isTrustedRedirectUrl(URL url) {
        if (!isHttps(url) || url.getUserInfo() != null || (url.getPort() != -1 && url.getPort() != 443)) return false;
        String host = url.getHost().toLowerCase(Locale.ROOT);
        return host.equals("release-assets.githubusercontent.com") || host.endsWith(".githubusercontent.com");
    }

    private boolean isHttps(URL url) {
        return url != null && "https".equalsIgnoreCase(url.getProtocol());
    }

    private boolean isRedirect(int responseCode) {
        return responseCode == HttpURLConnection.HTTP_MOVED_PERM ||
            responseCode == HttpURLConnection.HTTP_MOVED_TEMP ||
            responseCode == HttpURLConnection.HTTP_SEE_OTHER ||
            responseCode == 307 ||
            responseCode == 308;
    }

    private String toHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) builder.append(String.format(Locale.ROOT, "%02x", value & 0xff));
        return builder.toString();
    }

    private void deleteQuietly(File file) {
        if (file != null && file.exists()) file.delete();
    }

    @Override
    protected void handleOnDestroy() {
        downloadExecutor.shutdownNow();
        super.handleOnDestroy();
    }

    private static class UpdateException extends Exception {
        final String code;

        UpdateException(String message, String code) {
            super(message);
            this.code = code;
        }

        UpdateException(String message, String code, Throwable cause) {
            super(message, cause);
            this.code = code;
        }
    }
}
