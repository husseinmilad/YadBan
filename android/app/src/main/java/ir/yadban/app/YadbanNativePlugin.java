package ir.yadban.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.speech.RecognizerIntent;

import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

@CapacitorPlugin(
    name = "YadbanNative",
    permissions = {
        @Permission(alias = "microphone", strings = {Manifest.permission.RECORD_AUDIO}),
        @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
    }
)
public class YadbanNativePlugin extends Plugin {

    @PluginMethod
    public void saveOfflineSnapshot(PluginCall call) {
        String itemsJson = call.getString("itemsJson");
        String settingsJson = call.getString("settingsJson");
        String widgetPayloadJson = call.getString("widgetPayloadJson");

        Context ctx = getContext();
        YadbanOfflineDb.getInstance(ctx).saveSnapshot(ctx, itemsJson, settingsJson, widgetPayloadJson);
        YadbanWidgetUpdater.updateAllWidgets(ctx);

        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void loadOfflineSnapshot(PluginCall call) {
        YadbanOfflineDb db = YadbanOfflineDb.getInstance(getContext());
        String itemsJson = db.getItemsJson();
        String settingsJson = db.getSettingsJson();

        JSObject ret = new JSObject();
        ret.put("hasSnapshot", itemsJson != null || settingsJson != null);
        if (itemsJson != null) ret.put("itemsJson", itemsJson);
        if (settingsJson != null) ret.put("settingsJson", settingsJson);
        call.resolve(ret);
    }

    @PluginMethod
    public void syncAlarms(PluginCall call) {
        String itemsJson = call.getString("itemsJson");
        String settingsJson = call.getString("settingsJson");
        int count = YadbanAlarmScheduler.syncAlarms(getContext(), itemsJson, settingsJson);

        JSObject ret = new JSObject();
        ret.put("scheduledCount", count);
        call.resolve(ret);
    }

    @PluginMethod
    public void triggerImmediateNativeAlert(PluginCall call) {
        String itemId = call.getString("itemId", "test");
        String title = call.getString("title", "یادآور هوشمند یادبان");
        String body = call.getString("body", "");

        YadbanAlarmScheduler.showNotification(getContext(), itemId, title, body);
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void scheduleDelayedTestAlarm(PluginCall call) {
        int delaySeconds = call.getInt("delaySeconds", 5);
        String title = call.getString("title", "تست آلارم آفلاین یادبان");
        String body = call.getString("body", "آلارم بومی اندروید با موفقیت اجرا شد.");

        Context ctx = getContext();
        YadbanAlarmScheduler.ensureNotificationChannel(ctx);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) {
            long triggerAt = System.currentTimeMillis() + Math.max(2, delaySeconds) * 1000L;
            YadbanAlarmScheduler.scheduleSingleAlarm(
                ctx,
                am,
                998877,
                triggerAt,
                "test",
                title,
                body,
                false
            );
        }

        JSObject ret = new JSObject();
        ret.put("ok", am != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void refreshWidgets(PluginCall call) {
        String widgetPayloadJson = call.getString("widgetPayloadJson");
        if (widgetPayloadJson != null) {
            YadbanOfflineDb.saveWidgetPayloadJson(getContext(), widgetPayloadJson);
        }
        YadbanWidgetUpdater.updateAllWidgets(getContext());
        JSObject ret = new JSObject();
        ret.put("ok", true);
        call.resolve(ret);
    }

    private boolean isMicrophoneGranted(Context ctx) {
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO)
            == PackageManager.PERMISSION_GRANTED
            || getPermissionState("microphone") == PermissionState.GRANTED;
    }

    @Override
    @PluginMethod
    @PermissionCallback
    public void checkPermissions(PluginCall call) {
        Context ctx = getContext();
        String notifStatus = "granted";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            boolean granted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
            notifStatus = granted ? "granted" : mapPermissionState(getPermissionState("notifications"));
        }

        String exactAlarmStatus = "granted";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            exactAlarmStatus = (am != null && am.canScheduleExactAlarms()) ? "granted" : "denied";
        }

        String micStatus = isMicrophoneGranted(ctx)
            ? "granted"
            : mapPermissionState(getPermissionState("microphone"));

        boolean batteryIgnored = true;
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            batteryIgnored = pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
        }

        JSObject ret = new JSObject();
        ret.put("notifications", notifStatus);
        ret.put("exactAlarm", exactAlarmStatus);
        ret.put("microphone", micStatus);
        ret.put("batteryIgnored", batteryIgnored);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            JSObject ret = new JSObject();
            ret.put("status", "granted");
            call.resolve(ret);
            return;
        }
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED
            || getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("status", "granted");
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermCallback");
    }

    @PermissionCallback
    private void notificationPermCallback(PluginCall call) {
        JSObject ret = new JSObject();
        boolean granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED;
        ret.put("status", granted ? "granted" : mapPermissionState(getPermissionState("notifications")));
        call.resolve(ret);
    }

    @PluginMethod
    public void requestExactAlarmPermission(PluginCall call) {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am != null && !am.canScheduleExactAlarms()) {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                    intent.setData(Uri.parse("package:" + ctx.getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    ctx.startActivity(intent);
                } catch (Exception ignored) {
                }
                JSObject ret = new JSObject();
                ret.put("status", "denied");
                call.resolve(ret);
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("status", "granted");
        call.resolve(ret);
    }

    @PluginMethod
    public void requestMicrophonePermission(PluginCall call) {
        if (isMicrophoneGranted(getContext())) {
            JSObject ret = new JSObject();
            ret.put("status", "granted");
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("microphone", call, "microphonePermCallback");
    }

    @PermissionCallback
    private void microphonePermCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put(
            "status",
            isMicrophoneGranted(getContext()) ? "granted" : mapPermissionState(getPermissionState("microphone"))
        );
        call.resolve(ret);
    }

    @PluginMethod
    public void startSpeechToText(PluginCall call) {
        if (!isMicrophoneGranted(getContext())) {
            requestPermissionForAlias("microphone", call, "speechMicPermCallback");
            return;
        }
        launchSpeechRecognizer(call);
    }

    @PermissionCallback
    private void speechMicPermCallback(PluginCall call) {
        if (!isMicrophoneGranted(getContext())) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("reason", "permission_denied");
            call.resolve(ret);
            return;
        }
        launchSpeechRecognizer(call);
    }

    private void launchSpeechRecognizer(PluginCall call) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "fa-IR");
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "fa-IR");
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "صحبت کنید تا به متن تبدیل شود...");
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        try {
            startActivityForResult(call, intent, "speechToTextResult");
        } catch (ActivityNotFoundException ex) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("reason", "no_speech_service");
            call.resolve(ret);
        }
    }

    @ActivityCallback
    private void speechToTextResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject ret = new JSObject();
        if (result != null && result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            ArrayList<String> matches = result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            String text = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
            if (!text.trim().isEmpty()) {
                ret.put("ok", true);
                ret.put("text", text.trim());
                call.resolve(ret);
                return;
            }
        }
        ret.put("ok", false);
        ret.put("reason", "cancelled");
        call.resolve(ret);
    }

    @PluginMethod
    public void requestBatteryOptimizationExemption(PluginCall call) {
        Context ctx = getContext();
        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        boolean ignored = pm == null || pm.isIgnoringBatteryOptimizations(ctx.getPackageName());

        if (!ignored) {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + ctx.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
            } catch (Exception ignoredEx) {
            }
            ignored = pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
        }

        JSObject ret = new JSObject();
        ret.put("batteryIgnored", ignored);
        call.resolve(ret);
    }

    private String mapPermissionState(PermissionState state) {
        if (state == PermissionState.GRANTED) return "granted";
        if (state == PermissionState.DENIED) return "denied";
        return "prompt";
    }
}
