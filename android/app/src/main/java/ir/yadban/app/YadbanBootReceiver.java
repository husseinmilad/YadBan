package ir.yadban.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class YadbanBootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        YadbanOfflineDb db = YadbanOfflineDb.getInstance(context);
        if (db.getItemsJson() != null) {
            YadbanAlarmScheduler.syncAlarms(context, db.getItemsJson(), db.getSettingsJson());
        }
        YadbanWidgetUpdater.updateAllWidgets(context);
    }
}
