package ir.yadban.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(YadbanNativePlugin.class);
        super.onCreate(savedInstanceState);
        dispatchIntentExtra(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        dispatchIntentExtra(intent);
    }

    private void dispatchIntentExtra(Intent intent) {
        if (intent == null) return;
        String action = intent.getStringExtra("yadban_action");
        String tab = intent.getStringExtra("yadban_tab");
        if (action == null && tab == null) return;

        try {
            JSONObject payload = new JSONObject();
            if (action != null) payload.put("action", action);
            if (tab != null) payload.put("tab", tab);

            String js = "window.dispatchEvent(new CustomEvent('yadban-native-intent', { detail: "
                + payload.toString() + " }));";

            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().postDelayed(() -> {
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().evaluateJavascript(js, null);
                    }
                }, 450);
            }
        } catch (Exception ignored) {
        }
    }
}
