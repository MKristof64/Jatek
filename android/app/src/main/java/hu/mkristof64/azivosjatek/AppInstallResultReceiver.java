package hu.mkristof64.azivosjatek;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.os.Build;

public class AppInstallResultReceiver extends BroadcastReceiver {
    static final String ACTION_INSTALL_RESULT = "hu.mkristof64.azivosjatek.INSTALL_RESULT";
    static final String ACTION_STATE_CHANGED = "hu.mkristof64.azivosjatek.INSTALL_STATE_CHANGED";
    static final String EXTRA_NONCE = "updateNonce";
    static final String PREFS_NAME = "verified_app_update";

    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_INSTALL_RESULT.equals(intent.getAction())) return;

        SharedPreferences preferences = preferences(context);
        int sessionId = intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1);
        String nonce = preferences.getString("nonce", null);
        if (!isExpectedResult(preferences.getInt("sessionId", -1), sessionId, nonce, intent.getStringExtra(EXTRA_NONCE))) return;

        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        SharedPreferences.Editor editor = preferences.edit().remove("confirmation");
        Intent confirmation = null;
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            confirmation = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                ? intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class)
                : getLegacyConfirmation(intent);
            if (confirmation != null) {
                editor.putString("status", "pending-confirmation")
                    .putString("confirmation", confirmation.toUri(Intent.URI_INTENT_SCHEME))
                    .remove("message");
            } else {
                editor.putString("status", "error")
                    .putString("message", "Az Android telepítési jóváhagyása nem érhető el.");
            }
        } else if (status == PackageInstaller.STATUS_SUCCESS) {
            editor.putString("status", "installed").remove("message");
        } else if (status == PackageInstaller.STATUS_FAILURE_ABORTED) {
            editor.putString("status", "cancelled").remove("message");
        } else {
            editor.putString("status", "error").putString("message", failureMessage(status));
        }
        editor.apply();

        Intent changed = new Intent(ACTION_STATE_CHANGED).setPackage(context.getPackageName());
        if (confirmation != null) changed.putExtra(Intent.EXTRA_INTENT, confirmation);
        context.sendBroadcast(changed);
    }

    @SuppressWarnings("deprecation")
    private Intent getLegacyConfirmation(Intent intent) {
        return intent.getParcelableExtra(Intent.EXTRA_INTENT);
    }

    static boolean isExpectedResult(int expectedSessionId, int sessionId, String expectedNonce, String nonce) {
        return expectedSessionId > 0 && sessionId == expectedSessionId &&
            expectedNonce != null && !expectedNonce.isEmpty() && expectedNonce.equals(nonce);
    }

    static String failureMessage(int status) {
        if (status == PackageInstaller.STATUS_FAILURE_STORAGE) {
            return "Nincs elegendő szabad hely a frissítés telepítéséhez.";
        }
        if (status == PackageInstaller.STATUS_FAILURE_BLOCKED) {
            return "Az Android letiltotta a telepítést. Ellenőrizd a telepítési engedélyt.";
        }
        if (status == PackageInstaller.STATUS_FAILURE_INCOMPATIBLE) {
            return "Ez a kiadás nem kompatibilis a készülékkel.";
        }
        return "Az Android nem tudta telepíteni a frissítést. Próbáld újra.";
    }
}
