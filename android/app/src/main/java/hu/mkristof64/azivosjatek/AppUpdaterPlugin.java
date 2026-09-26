package hu.mkristof64.azivosjatek;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import androidx.core.content.pm.PackageInfoCompat;
import androidx.lifecycle.Lifecycle;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;
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
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private static final String APK_NAME = "Az-ivos-jatek.apk";
    private static final long MAX_APK_BYTES = 100L * 1024L * 1024L;
    private static final Pattern SHA_256_PATTERN = Pattern.compile("^[a-fA-F0-9]{64}$");
    private static final Pattern VERSION_PATTERN = Pattern.compile("^\\d+\\.\\d+\\.\\d+$");
    private static final Pattern APK_DOWNLOAD_PATH = Pattern.compile(
        "^/MKristof64/Jatek/releases/download/v?\\d+\\.\\d+\\.\\d+/Az-ivos-jatek\\.apk$"
    );

    private final ExecutorService downloadExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean downloadInProgress = new AtomicBoolean(false);
    private BroadcastReceiver installStateReceiver;

    @Override
    public void load() {
        installStateReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                Intent confirmation = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                    ? intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class)
                    : getLegacyConfirmation(intent);
                handleInstallState(confirmation);
            }
        };
        ContextCompat.registerReceiver(
            getContext(), installStateReceiver,
            new IntentFilter(AppInstallResultReceiver.ACTION_STATE_CHANGED),
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    @PluginMethod
    public void getInstallState(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            handleInstallState(null);
            call.resolve(readInstallState());
        });
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
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

        getBridge().executeOnMainThread(() -> {
            try {
                SharedPreferences preferences = AppInstallResultReceiver.preferences(getContext());
                String status = preferences.getString("status", "idle");
                int sessionId = preferences.getInt("sessionId", -1);
                if (
                    ("installing".equals(status) || "pending-confirmation".equals(status)) &&
                    getContext().getPackageManager().getPackageInstaller().getSessionInfo(sessionId) != null
                ) {
                    downloadInProgress.set(false);
                    call.reject("A telepítés már folyamatban van.", "UPDATE_IN_PROGRESS");
                    return;
                }
                if (
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
                    !getContext().getPackageManager().canRequestPackageInstalls()
                ) {
                    JSObject state = new JSObject();
                    state.put("status", "permission-required");
                    state.put("version", expectedVersion);
                    notifyListeners("installState", state);
                    Intent permission = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getContext().getPackageName())
                    );
                    startActivityForResult(call, permission, "installPermissionReturned");
                    return;
                }
                beginVerifiedInstall(call);
            } catch (Exception error) {
                downloadInProgress.set(false);
                call.reject("A telepítési engedély ablaka nem nyitható meg.", "INSTALLER_UNAVAILABLE", error);
            }
        });
    }

    @ActivityCallback
    private void installPermissionReturned(PluginCall call, ActivityResult result) {
        if (call == null) {
            downloadInProgress.set(false);
            return;
        }
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !getContext().getPackageManager().canRequestPackageInstalls()
        ) {
            downloadInProgress.set(false);
            call.reject("Az appból történő telepítés nincs engedélyezve.", "INSTALL_PERMISSION_DENIED");
            return;
        }
        beginVerifiedInstall(call);
    }

    private void beginVerifiedInstall(PluginCall call) {
        String downloadUrl = call.getString("url");
        String normalizedSha256 = call.getString("sha256").toLowerCase(Locale.ROOT);
        String expectedVersion = call.getString("version");
        downloadExecutor.execute(() -> {
            File apkFile = null;
            try {
                apkFile = downloadApk(downloadUrl, normalizedSha256);
                PackageInfo packageInfo = validateDownloadedApk(apkFile, expectedVersion);
                stageVerifiedInstall(apkFile, packageInfo);
                deleteQuietly(apkFile);
                getBridge().executeOnMainThread(() -> call.resolve(readInstallState()));
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

    private void stageVerifiedInstall(File apkFile, PackageInfo packageInfo) throws UpdateException {
        PackageInstaller installer = getContext().getPackageManager().getPackageInstaller();
        int sessionId = -1;
        try {
            PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(
                PackageInstaller.SessionParams.MODE_FULL_INSTALL
            );
            params.setAppPackageName(getContext().getPackageName());
            params.setSize(apkFile.length());
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED);
            }
            sessionId = installer.createSession(params);
            try (PackageInstaller.Session session = installer.openSession(sessionId)) {
                try (OutputStream output = session.openWrite("base.apk", 0, apkFile.length())) {
                    copyFile(apkFile, output);
                    session.fsync(output);
                }
                String nonce = UUID.randomUUID().toString();
                boolean saved = AppInstallResultReceiver.preferences(getContext()).edit().clear()
                    .putInt("sessionId", sessionId)
                    .putString("nonce", nonce)
                    .putString("version", packageInfo.versionName)
                    .putString("status", "installing")
                    .commit();
                if (!saved) throw new IOException("Installation state could not be saved.");
                Intent callback = new Intent(getContext(), AppInstallResultReceiver.class)
                    .setAction(AppInstallResultReceiver.ACTION_INSTALL_RESULT)
                    .putExtra(AppInstallResultReceiver.EXTRA_NONCE, nonce);
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
                PendingIntent result = PendingIntent.getBroadcast(getContext(), sessionId, callback, flags);
                session.commit(result.getIntentSender());
            }
        } catch (Exception error) {
            if (sessionId >= 0) {
                try { installer.abandonSession(sessionId); } catch (Exception ignored) { }
                AppInstallResultReceiver.preferences(getContext()).edit().clear().apply();
            }
            throw new UpdateException("A rendszertelepítő nem indítható el.", "INSTALLER_UNAVAILABLE", error);
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

    private JSObject readInstallState() {
        SharedPreferences preferences = AppInstallResultReceiver.preferences(getContext());
        String status = preferences.getString("status", "idle");
        int sessionId = preferences.getInt("sessionId", -1);
        if (
            ("installing".equals(status) || "pending-confirmation".equals(status)) &&
            sessionId >= 0 && !downloadInProgress.get() &&
            getContext().getPackageManager().getPackageInstaller().getSessionInfo(sessionId) == null
        ) {
            try {
                PackageInfo installed = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
                status = installed.versionName.equals(preferences.getString("version", null)) ? "installed" : "cancelled";
                preferences.edit().putString("status", status).remove("confirmation").apply();
            } catch (PackageManager.NameNotFoundException ignored) { }
        }
        JSObject state = new JSObject();
        state.put("status", status);
        state.put("version", preferences.getString("version", null));
        state.put("message", preferences.getString("message", null));
        return state;
    }

    @SuppressWarnings("deprecation")
    private Intent getLegacyConfirmation(Intent intent) {
        return intent.getParcelableExtra(Intent.EXTRA_INTENT);
    }

    private void handleInstallState(Intent confirmation) {
        SharedPreferences preferences = AppInstallResultReceiver.preferences(getContext());
        String status = preferences.getString("status", "idle");
        if (
            "pending-confirmation".equals(status) &&
            getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED)
        ) {
            try {
                if (confirmation == null) {
                    String saved = preferences.getString("confirmation", null);
                    if (saved == null) throw new IOException("Installation confirmation is missing.");
                    confirmation = Intent.parseUri(saved, Intent.URI_INTENT_SCHEME);
                }
                getActivity().startActivity(confirmation);
                preferences.edit().putString("status", "installing").remove("confirmation").apply();
            } catch (Exception error) {
                int sessionId = preferences.getInt("sessionId", -1);
                if (sessionId >= 0) {
                    try { getContext().getPackageManager().getPackageInstaller().abandonSession(sessionId); }
                    catch (Exception ignored) { }
                }
                preferences.edit().putString("status", "error")
                    .remove("confirmation")
                    .putString("message", "Az Android telepítési ablaka nem nyitható meg.").apply();
            }
        }
        notifyListeners("installState", readInstallState());
    }

    @Override
    protected void handleOnResume() {
        getActivity().getWindow().getDecorView().post(() -> handleInstallState(null));
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
        if (installStateReceiver != null) {
            getContext().unregisterReceiver(installStateReceiver);
            installStateReceiver = null;
        }
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
