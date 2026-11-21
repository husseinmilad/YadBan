package ir.yadban.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;

public class YadbanAlarmScheduler {

    public static final String CHANNEL_ID = "yadban_alarms_v1";
    private static final String PREFS_ALARMS = "yadban_alarm_ids";
    private static final String KEY_REQUEST_CODES = "codes";

    public static void ensureNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = context.getSystemService(NotificationManager.class);
            if (nm == null) return;
            if (nm.getNotificationChannel(CHANNEL_ID) != null) return;

            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes attrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();

            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "آلارم‌ها و یادآورهای یادبان",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("ارسال زنگ هشدار و یادآورهای زمان‌بندی‌شده یادبان");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 260, 120, 260, 120, 320});
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setSound(soundUri, attrs);
            nm.createNotificationChannel(channel);
        }
    }

    public static int syncAlarms(Context context, String itemsJson, String settingsJson) {
        ensureNotificationChannel(context);
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null || itemsJson == null) return 0;

        cancelAllScheduledAlarms(context, am);

        boolean autoRepeatNudge = true;
        int nudgeIntervalMin = 10;
        if (settingsJson != null) {
            try {
                JSONObject sObj = new JSONObject(settingsJson);
                autoRepeatNudge = sObj.optBoolean("autoRepeatNudge", true);
                nudgeIntervalMin = Math.max(5, sObj.optInt("nudgeIntervalMin", 10));
            } catch (Exception ignored) {
            }
        }

        Set<String> newCodes = new HashSet<>();
        int scheduledCount = 0;
        long now = System.currentTimeMillis();
        String todayKey = YadbanOfflineDb.getTodayDateKey();

        try {
            JSONArray arr = new JSONArray(itemsJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject item = arr.getJSONObject(i);
                String id = item.optString("id");
                String title = item.optString("title", "یادآور یادبان");
                String dateStr = item.optString("dateStr", "");
                String timeStr = item.optString("timeStr", "");
                boolean repeatDaily = item.optBoolean("repeatDaily", false);
                int preMinutes = item.optInt("preReminderMinutes", 0);
                long snoozedUntil = item.optLong("snoozedUntil", 0L);

                boolean isDone = false;
                if (repeatDaily) {
                    JSONArray dates = item.optJSONArray("completedDates");
                    if (dates != null) {
                        for (int j = 0; j < dates.length(); j++) {
                            if (todayKey.equals(dates.optString(j))) {
                                isDone = true;
                                break;
                            }
                        }
                    }
                } else {
                    isDone = item.optBoolean("completed", false);
                }

                if (snoozedUntil > now + 2000L && !isDone) {
                    int code = (id + "-snooze").hashCode();
                    scheduleSingleAlarm(
                        context,
                        am,
                        code,
                        snoozedUntil,
                        id,
                        "یادآور تعویقی یادبان",
                        title,
                        false
                    );
                    newCodes.add(String.valueOf(code));
                    scheduledCount++;
                }

                if (timeStr.isEmpty() || !timeStr.contains(":")) continue;
                if (!repeatDaily && isDone) continue;

                String[] hhmm = timeStr.split(":");
                int hour = Integer.parseInt(hhmm[0]);
                int minute = Integer.parseInt(hhmm[1]);

                Calendar cal = Calendar.getInstance();
                cal.set(Calendar.SECOND, 0);
                cal.set(Calendar.MILLISECOND, 0);

                if (repeatDaily) {
                    cal.set(Calendar.HOUR_OF_DAY, hour);
                    cal.set(Calendar.MINUTE, minute);
                    if (isDone || cal.getTimeInMillis() <= now + 2000L) {
                        cal.add(Calendar.DAY_OF_MONTH, 1);
                    }
                } else if (dateStr.contains("-")) {
                    String[] ymd = dateStr.split("-");
                    if (ymd.length != 3) continue;
                    cal.set(
                        Integer.parseInt(ymd[0]),
                        Integer.parseInt(ymd[1]) - 1,
                        Integer.parseInt(ymd[2]),
                        hour,
                        minute,
                        0
                    );
                } else {
                    continue;
                }

                long targetMs = cal.getTimeInMillis();
                if (targetMs > now + 2000L) {
                    int mainCode = (id + "-exact").hashCode();
                    scheduleSingleAlarm(
                        context,
                        am,
                        mainCode,
                        targetMs,
                        id,
                        "یادآور هوشمند یادبان",
                        title,
                        false
                    );
                    newCodes.add(String.valueOf(mainCode));
                    scheduledCount++;

                    if (preMinutes > 0) {
                        long preMs = targetMs - preMinutes * 60_000L;
                        if (preMs > now + 2000L) {
                            int preCode = (id + "-pre").hashCode();
                            scheduleSingleAlarm(
                                context,
                                am,
                                preCode,
                                preMs,
                                id,
                                "پیش‌یادآوری (" + preMinutes + " دقیقه مانده)",
                                title,
                                true
                            );
                            newCodes.add(String.valueOf(preCode));
                            scheduledCount++;
                        }
                    }

                    if (autoRepeatNudge) {
                        long nudgeMs = targetMs + nudgeIntervalMin * 60_000L;
                        int nudgeCode = (id + "-nudge").hashCode();
                        scheduleSingleAlarm(
                            context,
                            am,
                            nudgeCode,
                            nudgeMs,
                            id,
                            "یادآوری مجدد یادبان",
                            "هنوز انجام نشده: " + title,
                            false
                        );
                        newCodes.add(String.valueOf(nudgeCode));
                        scheduledCount++;
                    }
                }
            }
        } catch (Exception ignored) {
        }

        SharedPreferences prefs = context.getApplicationContext()
            .getSharedPreferences(PREFS_ALARMS, Context.MODE_PRIVATE);
        prefs.edit().putStringSet(KEY_REQUEST_CODES, newCodes).apply();
        return scheduledCount;
    }

    private static void cancelAllScheduledAlarms(Context context, AlarmManager am) {
        SharedPreferences prefs = context.getApplicationContext()
            .getSharedPreferences(PREFS_ALARMS, Context.MODE_PRIVATE);
        Set<String> oldCodes = prefs.getStringSet(KEY_REQUEST_CODES, null);
        if (oldCodes == null) return;

        for (String codeStr : oldCodes) {
            try {
                int code = Integer.parseInt(codeStr);
                Intent intent = new Intent(context, YadbanAlarmReceiver.class);
                PendingIntent pi = PendingIntent.getBroadcast(
                    context,
                    code,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                am.cancel(pi);
            } catch (Exception ignored) {
            }
        }
    }

    public static void scheduleSingleAlarm(
        Context context,
        AlarmManager am,
        int requestCode,
        long triggerAtMs,
        String itemId,
        String title,
        String body,
        boolean isPreReminder
    ) {
        Intent intent = new Intent(context, YadbanAlarmReceiver.class);
        intent.putExtra("itemId", itemId);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        intent.putExtra("isPreReminder", isPreReminder);

        PendingIntent pi = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        boolean canExact = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            canExact = am.canScheduleExactAlarms();
        }

        if (canExact) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
        }
    }

    public static void showNotification(
        Context context,
        String itemId,
        String title,
        String body
    ) {
        ensureNotificationChannel(context);
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;

        int notifId = (itemId != null && !itemId.isEmpty())
            ? itemId.hashCode()
            : (int) (System.currentTimeMillis() & 0xFFFFFFF);

        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentPi = PendingIntent.getActivity(
            context,
            notifId,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title != null ? title : "یادآور هوشمند یادبان")
            .setContentText(body != null ? body : "")
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body != null ? body : ""))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(contentPi)
            .setDefaults(NotificationCompat.DEFAULT_ALL);

        if (itemId != null && !itemId.isEmpty() && !"test".equals(itemId)) {
            Intent doneIntent = new Intent(context, YadbanActionReceiver.class);
            doneIntent.setAction(YadbanActionReceiver.ACTION_COMPLETE);
            doneIntent.putExtra("itemId", itemId);
            doneIntent.putExtra("notifId", notifId);
            PendingIntent donePi = PendingIntent.getBroadcast(
                context,
                (itemId + "-done").hashCode(),
                doneIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            Intent snoozeIntent = new Intent(context, YadbanActionReceiver.class);
            snoozeIntent.setAction(YadbanActionReceiver.ACTION_SNOOZE_10);
            snoozeIntent.putExtra("itemId", itemId);
            snoozeIntent.putExtra("notifId", notifId);
            PendingIntent snoozePi = PendingIntent.getBroadcast(
                context,
                (itemId + "-snooze10").hashCode(),
                snoozeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            builder.addAction(0, "انجام شد", donePi);
            builder.addAction(0, "۱۰ دقیقه بعد", snoozePi);
        }

        try {
            nm.notify(notifId, builder.build());
        } catch (SecurityException ignored) {
        }
    }
}
