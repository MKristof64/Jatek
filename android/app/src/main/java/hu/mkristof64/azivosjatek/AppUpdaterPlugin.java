package hu.mkristof64.azivosjatek;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private static final Pattern APK_DOWNLOAD_PATH = Pattern.compile(
        "^/MKristof64/Jatek/releases/download/v?\\d+\\.\\d+\\.\\d+/Az-ivos-jatek\\.apk$"
    );

    @PluginMethod
    public void openUpdateDownload(PluginCall call) {
        String downloadUrl = call.getString("url");
        Uri uri = parseTrustedDownloadUri(downloadUrl);

        if (uri == null) {
            call.reject("A frissítés letöltési címe érvénytelen.", "INVALID_DOWNLOAD_URL");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);

        try {
            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("status", "downloadOpened");
            call.resolve(result);
        } catch (ActivityNotFoundException error) {
            call.reject("A frissítés letöltése nem indítható el ezen a készüléken.", "DOWNLOAD_UNAVAILABLE", error);
        }
    }

    private Uri parseTrustedDownloadUri(String value) {
        if (value == null) return null;

        try {
            Uri uri = Uri.parse(value);
            if (
                !"https".equalsIgnoreCase(uri.getScheme()) ||
                !"github.com".equalsIgnoreCase(uri.getHost()) ||
                uri.getUserInfo() != null ||
                uri.getPort() != -1 ||
                uri.getQuery() != null ||
                uri.getFragment() != null ||
                !APK_DOWNLOAD_PATH.matcher(uri.getPath()).matches()
            ) {
                return null;
            }
            return uri;
        } catch (Exception error) {
            return null;
        }
    }
}
