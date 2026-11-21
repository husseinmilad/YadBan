package ir.yadban.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class YadbanActionReceiver extends BroadcastReceiver {

    public static final String ACTION_COMPLETE = "ir.yadban.app.ACTION_COMPLETE";
    public static final String ACTION_SNOOZE_10 = "ir.yadban.app.ACTION_SNOOZE_10";
    public static final String ACTION_WIDGET_TOGGLE_TASK = "ir.yadban.app.ACTION_WIDGET_TOGGLE_TASK";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        String itemId = intent.getStringExtra("itemId");
        int notifId = intent.getIntExtra("notifId", -1);
        if (action == null || itemId == null || itemId.isEmpty()) return;

        YadbanOfflineDb db = YadbanOfflineDb.getInstance(context);

        if (ACTION_COMPLETE.equals(action)) {
            db.toggleOrCompleteItem(context, itemId, false);
        } else if (ACTION_WIDGET_TOGGLE_TASK.equals(action)) {
            db.toggleOrCompleteItem(context, itemId, true);
        } else if (ACTION_SNOOZE_10.equals(action)) {
            db.snoozeItem(context, itemId, 10);
        }

        if (notifId != -1) {
            NotificationManager nm = context.getSystemService(NotificationManager.class);
            if (nm != null) nm.cancel(notifId);
        }

        YadbanAlarmScheduler.syncAlarms(context, db.getItemsJson(), db.getSettingsJson());
        YadbanWidgetUpdater.updateAllWidgets(context);
    }
}
