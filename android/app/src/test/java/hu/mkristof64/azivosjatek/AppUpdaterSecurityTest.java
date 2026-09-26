package hu.mkristof64.azivosjatek;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.content.pm.PackageInstaller;
import java.lang.reflect.Method;
import java.net.URL;
import org.junit.Test;

public class AppUpdaterSecurityTest {
    @Test
    public void installCallbacksRequireBothTheActiveSessionAndNonce() {
        assertTrue(AppInstallResultReceiver.isExpectedResult(17, 17, "nonce", "nonce"));
        assertFalse(AppInstallResultReceiver.isExpectedResult(17, 18, "nonce", "nonce"));
        assertFalse(AppInstallResultReceiver.isExpectedResult(17, 17, "nonce", "other"));
        assertFalse(AppInstallResultReceiver.isExpectedResult(-1, -1, "nonce", "nonce"));
        assertFalse(AppInstallResultReceiver.isExpectedResult(17, 17, null, null));
        assertFalse(AppInstallResultReceiver.isExpectedResult(17, 17, "", ""));
    }

    @Test
    public void installErrorsHaveSpecificSafeMessages() {
        assertTrue(AppInstallResultReceiver.failureMessage(PackageInstaller.STATUS_FAILURE_STORAGE).contains("szabad hely"));
        assertTrue(AppInstallResultReceiver.failureMessage(PackageInstaller.STATUS_FAILURE_BLOCKED).contains("letiltotta"));
        assertTrue(AppInstallResultReceiver.failureMessage(PackageInstaller.STATUS_FAILURE_INCOMPATIBLE).contains("kompatibilis"));
        assertTrue(AppInstallResultReceiver.failureMessage(PackageInstaller.STATUS_FAILURE).contains("Próbáld újra"));
    }

    @Test
    public void onlyVersionedOwnRepositoryApksAreAccepted() throws Exception {
        AppUpdaterPlugin updater = new AppUpdaterPlugin();
        Method check = AppUpdaterPlugin.class.getDeclaredMethod("isTrustedInitialUrl", String.class);
        check.setAccessible(true);
        assertTrue((Boolean) check.invoke(updater, "https://github.com/MKristof64/Jatek/releases/download/v1.2.9/Az-ivos-jatek.apk"));
        for (String url : new String[] {
            "http://github.com/MKristof64/Jatek/releases/download/v1.2.9/Az-ivos-jatek.apk",
            "https://evil.example/MKristof64/Jatek/releases/download/v1.2.9/Az-ivos-jatek.apk",
            "https://github.com/other/Jatek/releases/download/v1.2.9/Az-ivos-jatek.apk",
            "https://github.com/MKristof64/Jatek/releases/latest/download/Az-ivos-jatek.apk",
            "https://token@github.com/MKristof64/Jatek/releases/download/v1.2.9/Az-ivos-jatek.apk",
            "https://github.com/MKristof64/Jatek/releases/download/v1.2.9/Az-ivos-jatek.apk?url=other",
            "https://github.com/MKristof64/Jatek/releases/download/v1.2.9/Az-ivos-jatek.apk#other",
        }) assertFalse(url, (Boolean) check.invoke(updater, url));

        Method redirect = AppUpdaterPlugin.class.getDeclaredMethod("isTrustedRedirectUrl", URL.class);
        redirect.setAccessible(true);
        assertTrue((Boolean) redirect.invoke(updater, new URL("https://release-assets.githubusercontent.com/asset")));
        assertFalse((Boolean) redirect.invoke(updater, new URL("https://githubusercontent.com.evil.example/asset")));
        assertFalse((Boolean) redirect.invoke(updater, new URL("http://release-assets.githubusercontent.com/asset")));
    }
}
