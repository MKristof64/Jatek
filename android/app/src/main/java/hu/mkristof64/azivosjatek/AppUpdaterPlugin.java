package hu.mkristof64.azivosjatek;

import android.app.DownloadManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import androidx.annotation.RequiresApi;
import androidx.core.content.pm.PackageInfoCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
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
    private static final String APK_MIME_TYPE = "application/vnd.android.package-archive";
    private static final String DOWNLOADS_SUBDIRECTORY = "Az ivós játék";
    private static final long MAX_APK_BYTES = 100L * 1024L * 1024L;
    private static final Pattern SHA_256_PATTERN = Pattern.compile("^[a-fA-F0-9]{64}$");
    private static final Pattern VERSION_PATTERN = Pattern.compile("^\\d+\\.\\d+\\.\\d+$");
    private static final Pattern APK_DOWNLOAD_PATH = Pattern.compile(
        "^/MKristof64/Jatek/releases/download/v?\\d+\\.\\d+\\.\\d+/Az-ivos-jatek\\.apk$"
    );

    private final ExecutorService downloadExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean downloadInProgress = new AtomicBoolean(false);

    @PluginMethod
    public void downloadAndPrepare(PluginCall call) {
        String downloadUrl = call.getString("url");
        String expectedSha256 = call.getString("sha256");
        String expectedVersion = call.getString("version");

        if (
            !isTrustedInitialUrl(downloadUrl) ||
            expectedSha256 == null ||
            !SHA_256_PATTERN.matcher(expectedSha256).matches() ||
            expectedVersion == null ||
            !VERSION_PATTERN.matcher(expectedVersion).matches()
        ) {
            call.reject("A frissítési adatok érvénytelenek.", "INVALID_UPDATE_REQUEST");
            return;
        }

        if (!downloadInProgress.compareAndSet(false, true)) {
            call.reject("A frissítés letöltése már folyamatban van.", "UPDATE_IN_PROGRESS");
            return;
        }

        String normalizedSha256 = expectedSha256.toLowerCase(Locale.ROOT);
        downloadExecutor.execute(() -> {
            File apkFile = null;
            try {
                apkFile = downloadApk(downloadUrl, normalizedSha256);
                PackageInfo packageInfo = validateDownloadedApk(apkFile, expectedVersion);
                exportVerifiedApk(apkFile, packageInfo);
                deleteQuietly(apkFile);
                getBridge().executeOnMainThread(() -> openSystemDownloads(call, packageInfo));
            } catch (UpdateException error) {
                deleteQuietly(apkFile);
                rejectOnMainThread(call, error.getMessage(), error.code, error);
            } catch (Exception error) {
                deleteQuietly(apkFile);
                rejectOnMainThread(
                    call,
                    "A frissítés letöltése sikertelen.",
                    "DOWNLOAD_FAILED",
                    error
                );
            } finally {
                downloadInProgress.set(false);
            }
        });
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
                connection.setUseCaches(false);
                connection.setConnectTimeout(15_000);
                connection.setReadTimeout(45_000);
                connection.setRequestProperty("Accept", "application/octet-stream");
                connection.setRequestProperty("User-Agent", "Az-Ivos-Jatek-Android-Updater");

                int responseCode = connection.getResponseCode();
                if (isRedirect(responseCode)) {
                    String location = connection.getHeaderField("Location");
                    URL redirectUrl = location == null ? null : new URL(currentUrl, location);
                    if (!isTrustedRedirectUrl(redirectUrl)) {
                        throw new UpdateException(
                            "A letöltés nem megbízható címre irányított.",
                            "DOWNLOAD_FAILED"
                        );
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
                throw new UpdateException(
                    "A frissítés letöltése megszakadt.",
                    "DOWNLOAD_FAILED",
                    error
                );
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
                    throw new UpdateException(
                        "A frissítés letöltése megszakadt.",
                        "DOWNLOAD_FAILED"
                    );
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
            throw new UpdateException(
                "A frissítési fájl hiányosan érkezett meg.",
                "DOWNLOAD_FAILED"
            );
        }

        String actualSha256 = toHex(digest.digest());
        if (!actualSha256.equals(expectedSha256)) {
            throw new UpdateException(
                "A frissítési fájl ellenőrzése sikertelen.",
                "HASH_MISMATCH"
            );
        }

        notifyProgress(100, downloadedBytes, expectedLength);
    }

    private PackageInfo validateDownloadedApk(File apkFile, String expectedVersion)
        throws UpdateException {
        PackageManager packageManager = getContext().getPackageManager();
        int signatureFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? PackageManager.GET_SIGNING_CERTIFICATES | PackageManager.GET_SIGNATURES
            : PackageManager.GET_SIGNATURES;

        try {
            PackageInfo installed = packageManager.getPackageInfo(
                getContext().getPackageName(),
                signatureFlags
            );
            PackageInfo candidate = packageManager.getPackageArchiveInfo(
                apkFile.getAbsolutePath(),
                signatureFlags
            );
            if (candidate == null) {
                throw new UpdateException("A letöltött telepítő érvénytelen.", "INVALID_APK");
            }
            if (!getContext().getPackageName().equals(candidate.packageName)) {
                throw new UpdateException(
                    "A telepítő nem ehhez az alkalmazáshoz tartozik.",
                    "PACKAGE_MISMATCH"
                );
            }
            if (!expectedVersion.equals(candidate.versionName)) {
                throw new UpdateException(
                    "A telepítő verziója nem egyezik a kiadással.",
                    "VERSION_MISMATCH"
                );
            }
            if (
                PackageInfoCompat.getLongVersionCode(candidate) <=
                PackageInfoCompat.getLongVersionCode(installed)
            ) {
                throw new UpdateException(
                    "A letöltött kiadás nem újabb a telepített változatnál.",
                    "VERSION_NOT_NEWER"
                );
            }
            if (!getSignerDigests(installed).equals(getSignerDigests(candidate))) {
                throw new UpdateException(
                    "A telepítő aláírása nem egyezik az alkalmazáséval.",
                    "SIGNATURE_MISMATCH"
                );
            }
            return candidate;
        } catch (PackageManager.NameNotFoundException error) {
            throw new UpdateException(
                "A telepített alkalmazás nem ellenőrizhető.",
                "INVALID_APK",
                error
            );
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
            throw new UpdateException(
                "Az alkalmazás aláírása nem ellenőrizhető.",
                "INVALID_APK"
            );
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
            throw new UpdateException(
                "Az alkalmazás aláírása nem ellenőrizhető.",
                "INVALID_APK",
                error
            );
        }
    }

    private void exportVerifiedApk(File apkFile, PackageInfo packageInfo) throws UpdateException {
        String exportedName = "Az-ivos-jatek-" + packageInfo.versionName + ".apk";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            exportToMediaStore(apkFile, exportedName);
            return;
        }
        exportToLegacyDownloads(apkFile, exportedName);
    }

    @RequiresApi(Build.VERSION_CODES.Q)
    private void exportToMediaStore(File apkFile, String exportedName) throws UpdateException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, exportedName);
        values.put(MediaStore.MediaColumns.MIME_TYPE, APK_MIME_TYPE);
        values.put(
            MediaStore.MediaColumns.RELATIVE_PATH,
            Environment.DIRECTORY_DOWNLOADS + "/" + DOWNLOADS_SUBDIRECTORY
        );
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri downloadUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (downloadUri == null) {
            throw new UpdateException(
                "A frissítés nem menthető a Letöltések közé.",
                "EXPORT_FAILED"
            );
        }

        try (OutputStream output = resolver.openOutputStream(downloadUri, "w")) {
            if (output == null) throw new IOException("The Downloads output stream is unavailable.");
            copyFile(apkFile, output);
        } catch (Exception error) {
            resolver.delete(downloadUri, null, null);
            throw new UpdateException(
                "A frissítés nem menthető a Letöltések közé.",
                "EXPORT_FAILED",
                error
            );
        }

        try {
            ContentValues completed = new ContentValues();
            completed.put(MediaStore.MediaColumns.IS_PENDING, 0);
            if (resolver.update(downloadUri, completed, null, null) != 1) {
                throw new IOException("The verified download could not be published.");
            }
        } catch (Exception error) {
            resolver.delete(downloadUri, null, null);
            throw new UpdateException(
                "A frissítés nem menthető a Letöltések közé.",
                "EXPORT_FAILED",
                error
            );
        }
    }

    @SuppressWarnings("deprecation")
    private void exportToLegacyDownloads(File apkFile, String exportedName)
        throws UpdateException {
        File downloadsDirectory = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (downloadsDirectory == null || (!downloadsDirectory.exists() && !downloadsDirectory.mkdirs())) {
            throw new UpdateException(
                "A frissítés nem menthető a Letöltések közé.",
                "EXPORT_FAILED"
            );
        }

        File exportedFile = new File(downloadsDirectory, exportedName);
        deleteQuietly(exportedFile);
        try (FileOutputStream output = new FileOutputStream(exportedFile)) {
            copyFile(apkFile, output);
            output.getFD().sync();

            DownloadManager downloadManager = (DownloadManager) getContext().getSystemService(
                android.content.Context.DOWNLOAD_SERVICE
            );
            if (downloadManager == null) throw new IOException("Downloads is unavailable.");

            downloadManager.addCompletedDownload(
                exportedName,
                "Ellenőrzött Az ivós játék frissítés",
                false,
                APK_MIME_TYPE,
                exportedFile.getAbsolutePath(),
                exportedFile.length(),
                true
            );
        } catch (Exception error) {
            deleteQuietly(exportedFile);
            throw new UpdateException(
                "A frissítés nem menthető a Letöltések közé.",
                "EXPORT_FAILED",
                error
            );
        }
    }

    private void copyFile(File source, OutputStream output) throws IOException {
        try (FileInputStream input = new FileInputStream(source)) {
            byte[] buffer = new byte[64 * 1024];
            int bytesRead;
            while ((bytesRead = input.read(buffer)) != -1) {
                output.write(buffer, 0, bytesRead);
            }
            output.flush();
        }
    }

    private void openSystemDownloads(PluginCall call, PackageInfo packageInfo) {
        try {
            Intent intent = new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS);
            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("status", "downloadsOpened");
            result.put("version", packageInfo.versionName);
            result.put("versionCode", PackageInfoCompat.getLongVersionCode(packageInfo));
            call.resolve(result);
        } catch (Exception error) {
            call.reject(
                "Az Android Letöltések felülete nem nyitható meg.",
                "DOWNLOADS_UNAVAILABLE",
                error
            );
        }
    }

    private void notifyProgress(int percent, long downloadedBytes, long totalBytes) {
        JSObject progress = new JSObject();
        progress.put("percent", percent);
        progress.put("downloadedBytes", downloadedBytes);
        progress.put("totalBytes", totalBytes);
        getBridge().executeOnMainThread(() -> notifyListeners("downloadProgress", progress));
    }

    private void rejectOnMainThread(
        PluginCall call,
        String message,
        String code,
        Exception error
    ) {
        getBridge().executeOnMainThread(() -> call.reject(message, code, error));
    }

    private boolean isTrustedInitialUrl(String value) {
        try {
            URL url = new URL(value);
            return (
                isHttps(url) &&
                "github.com".equalsIgnoreCase(url.getHost()) &&
                APK_DOWNLOAD_PATH.matcher(url.getPath()).matches() &&
                url.getUserInfo() == null &&
                (url.getPort() == -1 || url.getPort() == 443) &&
                url.getQuery() == null &&
                url.getRef() == null
            );
        } catch (Exception error) {
            return false;
        }
    }

    private boolean isTrustedRedirectUrl(URL url) {
        if (
            !isHttps(url) ||
            url.getUserInfo() != null ||
            (url.getPort() != -1 && url.getPort() != 443)
        ) {
            return false;
        }
        String host = url.getHost().toLowerCase(Locale.ROOT);
        return host.equals("release-assets.githubusercontent.com") ||
            host.endsWith(".githubusercontent.com");
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
        for (byte value : bytes) {
            builder.append(String.format(Locale.ROOT, "%02x", value & 0xff));
        }
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
