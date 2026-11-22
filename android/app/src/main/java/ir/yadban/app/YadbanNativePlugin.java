package ir.yadban.app;

import android.Manifest;
import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

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

    @Override
    @PluginMethod
    @PermissionCallback
    public void checkPermissions(PluginCall call) {
        Context ctx = getContext();
        String notifStatus = "granted";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notifStatus = mapPermissionState(getPermissionState("notifications"));
        }

        String exactAlarmStatus = "granted";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            exactAlarmStatus = (am != null && am.canScheduleExactAlarms()) ? "granted" : "denied";
        }

        String micStatus = mapPermissionState(getPermissionState("microphone"));

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
        if (getPermissionState("notifications") == PermissionState.GRANTED) {
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
        ret.put("status", mapPermissionState(getPermissionState("notifications")));
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
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
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
        ret.put("status", mapPermissionState(getPermissionState("microphone")));
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
