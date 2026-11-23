package ir.yadban.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

public class YadbanWidgetUpdater {

    private static class WidgetThemeSpec {
        final int bgRes;
        final int rowRes;
        final int btnRes;
        final int titleColor;
        final int subtitleColor;
        final int accentTextColor;

        WidgetThemeSpec(
            int bgRes,
            int rowRes,
            int btnRes,
            int titleColor,
            int subtitleColor,
            int accentTextColor
        ) {
            this.bgRes = bgRes;
            this.rowRes = rowRes;
            this.btnRes = btnRes;
            this.titleColor = titleColor;
            this.subtitleColor = subtitleColor;
            this.accentTextColor = accentTextColor;
        }
    }

    private static WidgetThemeSpec resolveTheme(String themeName) {
        if ("emerald".equals(themeName)) {
            return new WidgetThemeSpec(
                R.drawable.widget_bg_emerald,
                R.drawable.widget_row_emerald,
                R.drawable.widget_btn_emerald,
                Color.parseColor("#F8FAFC"),
                Color.parseColor("#A7F3D0"),
                Color.parseColor("#6EE7B7")
            );
        }
        if ("midnight".equals(themeName)) {
            return new WidgetThemeSpec(
                R.drawable.widget_bg_midnight,
                R.drawable.widget_row_midnight,
                R.drawable.widget_btn_midnight,
                Color.parseColor("#F8FAFC"),
                Color.parseColor("#C7D2FE"),
                Color.parseColor("#A5B4FC")
            );
        }
        if ("amber".equals(themeName)) {
            return new WidgetThemeSpec(
                R.drawable.widget_bg_amber,
                R.drawable.widget_row_amber,
                R.drawable.widget_btn_amber,
                Color.parseColor("#FFFBEB"),
                Color.parseColor("#FDE68A"),
                Color.parseColor("#FCD34D")
            );
        }
        if ("plum".equals(themeName)) {
            return new WidgetThemeSpec(
                R.drawable.widget_bg_plum,
                R.drawable.widget_row_plum,
                R.drawable.widget_btn_plum,
                Color.parseColor("#FAF5FF"),
                Color.parseColor("#E9D5FF"),
                Color.parseColor("#D8B4FE")
            );
        }
        // Default: ocean non-white theme
        return new WidgetThemeSpec(
            R.drawable.widget_bg_ocean,
            R.drawable.widget_row_ocean,
            R.drawable.widget_btn_ocean,
            Color.parseColor("#F8FAFC"),
            Color.parseColor("#BAE6FD"),
            Color.parseColor("#7DD3FC")
        );
    }

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

        String rawPayload = YadbanOfflineDb.getWidgetPayloadJson(context);
        String themeKey = "ocean";
        if (rawPayload != null) {
            try {
                JSONObject p = new JSONObject(rawPayload);
                themeKey = p.optString("widgetTheme", "ocean");
            } catch (Exception ignored) {
            }
        }
        WidgetThemeSpec theme = resolveTheme(themeKey);

        views.setInt(R.id.widget_today_root, "setBackgroundResource", theme.bgRes);
        views.setInt(R.id.widget_today_add_btn, "setBackgroundResource", theme.btnRes);
        views.setTextColor(R.id.widget_today_title, theme.titleColor);
        views.setTextColor(R.id.widget_today_subtitle, theme.subtitleColor);
        views.setTextColor(R.id.widget_today_empty, theme.subtitleColor);

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

        for (int i = 0; i < rowIds.length; i++) {
            views.setViewVisibility(rowIds[i], View.GONE);
            views.setInt(rowIds[i], "setBackgroundResource", theme.rowRes);
            views.setTextColor(checkIds[i], theme.accentTextColor);
            views.setTextColor(textIds[i], theme.titleColor);
        }

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
        String themeKey = "ocean";
        if (rawPayload != null) {
            try {
                JSONObject payload = new JSONObject(rawPayload);
                themeKey = payload.optString("widgetTheme", "ocean");
                String nextTitle = payload.optString("nextTitle", "همه کارهای امروز انجام شد");
                String nextTime = payload.optString("nextTime", "");
                views.setTextViewText(
                    R.id.widget_quick_next,
                    nextTime.isEmpty() ? nextTitle : "ساعت " + nextTime + " · " + nextTitle
                );
            } catch (Exception ignored) {
            }
        }

        WidgetThemeSpec theme = resolveTheme(themeKey);
        views.setInt(R.id.widget_quick_root, "setBackgroundResource", theme.bgRes);
        views.setInt(R.id.widget_quick_text_btn, "setBackgroundResource", theme.btnRes);
        views.setInt(R.id.widget_quick_voice_btn, "setBackgroundResource", theme.rowRes);
        views.setTextColor(R.id.widget_quick_label, theme.subtitleColor);
        views.setTextColor(R.id.widget_quick_next, theme.titleColor);
        views.setTextColor(R.id.widget_quick_voice_btn, theme.titleColor);

        Intent textIntent = new Intent(context, YadbanQuickCaptureActivity.class);
        textIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
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
