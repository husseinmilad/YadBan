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
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

@CapacitorPlugin(
    name = "YadbanNative",
    permissions = {
        @Permission(alias = "microphone", strings = {Manifest.permission.RECORD_AUDIO}),
        @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
    }
)
public class YadbanNativePlugin extends Plugin {

    private File pendingBackupTempFile;

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

    @PluginMethod
    public void exportBackupFile(PluginCall call) {
        String rawName = call.getString("fileName", "yadban-backup.json");
        String safeName = sanitizeBackupFileName(rawName);
        String jsonContent = call.getString("jsonContent", "{}");

        Context ctx = getContext();
        File tempFile;
        try {
            tempFile = writeCacheBackupFile(ctx, safeName, jsonContent);
        } catch (Exception ex) {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("error", "خطا در آماده‌سازی فایل پشتیبان");
            call.resolve(ret);
            return;
        }

        pendingBackupTempFile = tempFile;

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, safeName);

        try {
            startActivityForResult(call, intent, "exportBackupResult");
        } catch (ActivityNotFoundException ex) {
            // Fallback to Android share sheet if device has no document picker
            try {
                launchBackupShareChooser(ctx, tempFile, safeName);
                pendingBackupTempFile = null;
                JSObject ret = new JSObject();
                ret.put("ok", true);
                ret.put("method", "android_share_fallback");
                call.resolve(ret);
            } catch (Exception shareEx) {
                pendingBackupTempFile = null;
                JSObject ret = new JSObject();
                ret.put("ok", false);
                ret.put("error", "امکان باز کردن مدیریت فایل یا اشتراک‌گذاری وجود ندارد");
                call.resolve(ret);
            }
        }
    }

    @ActivityCallback
    private void exportBackupResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            pendingBackupTempFile = null;
            return;
        }
        JSObject ret = new JSObject();
        try {
            if (result != null
                    && result.getResultCode() == Activity.RESULT_OK
                    && result.getData() != null
                    && result.getData().getData() != null
                    && pendingBackupTempFile != null
                    && pendingBackupTempFile.exists()) {
                Uri targetUri = result.getData().getData();
                try (InputStream in = new FileInputStream(pendingBackupTempFile);
                     OutputStream out = getContext().getContentResolver().openOutputStream(targetUri)) {
                    if (out == null) {
                        ret.put("ok", false);
                        ret.put("error", "دسترسی نوشتن به فایل انتخاب‌شده برقرار نشد");
                        call.resolve(ret);
                        return;
                    }
                    byte[] buffer = new byte[4096];
                    int len;
                    while ((len = in.read(buffer)) != -1) {
                        out.write(buffer, 0, len);
                    }
                    out.flush();
                }
                ret.put("ok", true);
                ret.put("method", "android_document");
                call.resolve(ret);
                return;
            }

            if (result != null && result.getResultCode() == Activity.RESULT_CANCELED) {
                ret.put("ok", false);
                ret.put("cancelled", true);
                call.resolve(ret);
                return;
            }

            ret.put("ok", false);
            ret.put("error", "ذخیره فایل پشتیبان انجام نشد");
            call.resolve(ret);
        } catch (Exception ex) {
            ret.put("ok", false);
            ret.put("error", "خطا هنگام نوشتن فایل پشتیبان در حافظه");
            call.resolve(ret);
        } finally {
            pendingBackupTempFile = null;
        }
    }

    @PluginMethod
    public void shareBackupFile(PluginCall call) {
        String rawName = call.getString("fileName", "yadban-backup.json");
        String safeName = sanitizeBackupFileName(rawName);
        String jsonContent = call.getString("jsonContent", "{}");

        Context ctx = getContext();
        JSObject ret = new JSObject();
        try {
            File tempFile = writeCacheBackupFile(ctx, safeName, jsonContent);
            launchBackupShareChooser(ctx, tempFile, safeName);
            ret.put("ok", true);
        } catch (Exception ex) {
            ret.put("ok", false);
            ret.put("error", "خطا در اشتراک‌گذاری فایل پشتیبان");
        }
        call.resolve(ret);
    }

    private String sanitizeBackupFileName(String rawName) {
        String cleaned = (rawName == null ? "yadban-backup.json" : rawName)
                .replaceAll("[^a-zA-Z0-9._-]", "_");
        if (cleaned.isEmpty()) cleaned = "yadban-backup.json";
        if (!cleaned.endsWith(".json")) cleaned = cleaned + ".json";
        return cleaned;
    }

    private File writeCacheBackupFile(Context ctx, String safeName, String jsonContent) throws Exception {
        File outFile = new File(ctx.getCacheDir(), safeName);
        try (FileOutputStream fos = new FileOutputStream(outFile, false)) {
            byte[] bytes = (jsonContent != null ? jsonContent : "{}").getBytes(StandardCharsets.UTF_8);
            fos.write(bytes);
            fos.flush();
        }
        return outFile;
    }

    private void launchBackupShareChooser(Context ctx, File tempFile, String safeName) {
        Uri contentUri = FileProvider.getUriForFile(
                ctx,
                ctx.getPackageName() + ".fileprovider",
                tempFile
        );
        Intent sendIntent = new Intent(Intent.ACTION_SEND);
        sendIntent.setType("application/json");
        sendIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
        sendIntent.putExtra(Intent.EXTRA_SUBJECT, safeName);
        sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        Intent chooser = Intent.createChooser(sendIntent, "ارسال یا ذخیره فایل پشتیبان یادبان");
        Activity activity = getActivity();
        if (activity != null) {
            activity.startActivity(chooser);
        } else {
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(chooser);
        }
    }

    private String mapPermissionState(PermissionState state) {
        if (state == PermissionState.GRANTED) return "granted";
        if (state == PermissionState.DENIED) return "denied";
        return "prompt";
    }
}
