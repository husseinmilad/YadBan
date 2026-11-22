package ir.yadban.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

public class YadbanWidgetUpdater {

    private static boolean isCompactWidth(AppWidgetManager mgr, int appWidgetId) {
        try {
            Bundle opts = mgr.getAppWidgetOptions(appWidgetId);
            int minW = opts != null ? opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250) : 250;
            return minW > 0 && minW < 205;
        } catch (Exception ignored) {
            return false;
        }
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        if (mgr == null) return;

        int[] todayIds = mgr.getAppWidgetIds(
            new ComponentName(context, YadbanTodayWidgetProvider.class)
        );
        for (int appWidgetId : todayIds) {
            updateTodayWidget(context, mgr, appWidgetId);
        }

        int[] quickIds = mgr.getAppWidgetIds(
            new ComponentName(context, YadbanQuickWidgetProvider.class)
        );
        for (int appWidgetId : quickIds) {
            updateQuickWidget(context, mgr, appWidgetId);
        }
    }

    public static void updateTodayWidget(
        Context context,
        AppWidgetManager mgr,
        int appWidgetId
    ) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);
        boolean compact = isCompactWidth(mgr, appWidgetId);
        views.setTextViewText(R.id.widget_today_title, compact ? "برنامه امروز" : "یادبان · برنامه امروز");
        views.setTextViewText(R.id.widget_today_add_btn, compact ? "+" : "+ ثبت فوری");

        // Tap header or add button -> launch app (or Quick Capture modal)
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(
            context,
            1001,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_today_title, openPi);

        Intent addIntent = new Intent(context, MainActivity.class);
        addIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        addIntent.putExtra("yadban_action", "quick-add");
        PendingIntent addPi = PendingIntent.getActivity(
            context,
            1002,
            addIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_today_add_btn, addPi);

        int[] rowIds = {R.id.widget_task_1, R.id.widget_task_2, R.id.widget_task_3};
        int[] checkIds = {
            R.id.widget_task_1_check,
            R.id.widget_task_2_check,
            R.id.widget_task_3_check
        };
        int[] textIds = {
            R.id.widget_task_1_text,
            R.id.widget_task_2_text,
            R.id.widget_task_3_text
        };

        for (int r : rowIds) {
            views.setViewVisibility(r, View.GONE);
        }

        String rawPayload = YadbanOfflineDb.getWidgetPayloadJson(context);
        if (rawPayload == null) {
            views.setTextViewText(R.id.widget_today_subtitle, "برنامه‌ریز حافظه آفلاین");
            views.setViewVisibility(R.id.widget_today_empty, View.VISIBLE);
            mgr.updateAppWidget(appWidgetId, views);
            return;
        }

        try {
            JSONObject payload = new JSONObject(rawPayload);
            int done = payload.optInt("doneCount", 0);
            int total = payload.optInt("totalCount", 0);
            String jalali = payload.optString("jalaliLabel", "");
            String subtitle = compact
                ? done + " از " + total + " انجام شد"
                : (jalali.isEmpty() ? "" : jalali + " · ") + done + " از " + total + " انجام شد";
            views.setTextViewText(R.id.widget_today_subtitle, subtitle);

            JSONArray tasks = payload.optJSONArray("tasks");
            int visibleCount = tasks != null ? Math.min(tasks.length(), 3) : 0;
            views.setViewVisibility(R.id.widget_today_empty, visibleCount == 0 ? View.VISIBLE : View.GONE);

            for (int i = 0; i < visibleCount; i++) {
                JSONObject t = tasks.getJSONObject(i);
                String id = t.optString("id", "");
                String title = t.optString("title", "");
                String timeStr = t.optString("timeStr", "");
                boolean isDone = t.optBoolean("done", false);

                views.setViewVisibility(rowIds[i], View.VISIBLE);
                views.setTextViewText(checkIds[i], isDone ? "✓" : "○");
                views.setTextViewText(
                    textIds[i],
                    timeStr.isEmpty() ? title : timeStr + " · " + title
                );

                Intent toggleIntent = new Intent(context, YadbanActionReceiver.class);
                toggleIntent.setAction(YadbanActionReceiver.ACTION_WIDGET_TOGGLE_TASK);
                toggleIntent.putExtra("itemId", id);
                PendingIntent togglePi = PendingIntent.getBroadcast(
                    context,
                    (id + "-widget-toggle").hashCode(),
                    toggleIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                views.setOnClickPendingIntent(rowIds[i], togglePi);
            }
        } catch (Exception ignored) {
            views.setViewVisibility(R.id.widget_today_empty, View.VISIBLE);
        }

        mgr.updateAppWidget(appWidgetId, views);
    }

    public static void updateQuickWidget(
        Context context,
        AppWidgetManager mgr,
        int appWidgetId
    ) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick);
        boolean compact = isCompactWidth(mgr, appWidgetId);
        views.setTextViewText(R.id.widget_quick_text_btn, compact ? "متن" : "ثبت فوری متنی");
        views.setTextViewText(R.id.widget_quick_voice_btn, compact ? "صوت" : "ضبط صوتی آفلاین");

        String rawPayload = YadbanOfflineDb.getWidgetPayloadJson(context);
        if (rawPayload != null) {
            try {
                JSONObject payload = new JSONObject(rawPayload);
                String nextTitle = payload.optString("nextTitle", "همه کارهای امروز انجام شد");
                String nextTime = payload.optString("nextTime", "");
                views.setTextViewText(
                    R.id.widget_quick_next,
                    nextTime.isEmpty() ? nextTitle : "ساعت " + nextTime + " · " + nextTitle
                );
            } catch (Exception ignored) {
            }
        }

        Intent textIntent = new Intent(context, MainActivity.class);
        textIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        textIntent.putExtra("yadban_action", "quick-add");
        PendingIntent textPi = PendingIntent.getActivity(
            context,
            2001,
            textIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_quick_text_btn, textPi);

        Intent voiceIntent = new Intent(context, MainActivity.class);
        voiceIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        voiceIntent.putExtra("yadban_action", "voice-add");
        PendingIntent voicePi = PendingIntent.getActivity(
            context,
            2002,
            voiceIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_quick_voice_btn, voicePi);

        mgr.updateAppWidget(appWidgetId, views);
    }
}
