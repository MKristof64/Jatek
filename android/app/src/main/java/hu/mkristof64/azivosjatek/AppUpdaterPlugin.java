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

    private static final Pattern RELEASE_PATH = Pattern.compile(
        "^/MKristof64/Jatek/releases/tag/v?\\d+\\.\\d+\\.\\d+$"
    );

    @PluginMethod
    public void openReleasePage(PluginCall call) {
        String releaseUrl = call.getString("url");
        Uri uri = parseTrustedReleaseUri(releaseUrl);

        if (uri == null) {
            call.reject("A frissítési oldal címe érvénytelen.", "INVALID_RELEASE_URL");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);

        try {
            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("status", "releaseOpened");
            call.resolve(result);
        } catch (ActivityNotFoundException error) {
            call.reject("A frissítési oldal nem nyitható meg ezen a készüléken.", "BROWSER_UNAVAILABLE", error);
        }
    }

    private Uri parseTrustedReleaseUri(String value) {
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
                !RELEASE_PATH.matcher(uri.getPath()).matches()
            ) {
                return null;
            }
            return uri;
        } catch (Exception error) {
            return null;
        }
    }
}
