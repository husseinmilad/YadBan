package ir.yadban.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;

public class YadbanAlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wl = null;
        if (pm != null) {
            wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "yadban:AlarmWakeLock");
            wl.acquire(6000L);
        }

        try {
            String itemId = intent.getStringExtra("itemId");
            String title = intent.getStringExtra("title");
            String body = intent.getStringExtra("body");

            YadbanOfflineDb db = YadbanOfflineDb.getInstance(context);
            if (itemId != null && !"test".equals(itemId) && db.isItemDoneToday(itemId)) {
                return;
            }

            YadbanAlarmScheduler.showNotification(context, itemId, title, body);

            // Re-sync alarms so daily repeating reminders roll cleanly to the next day
            if (db.getItemsJson() != null) {
                YadbanAlarmScheduler.syncAlarms(context, db.getItemsJson(), db.getSettingsJson());
            }
        } finally {
            if (wl != null && wl.isHeld()) {
                try {
                    wl.release();
                } catch (Exception ignored) {
                }
            }
        }
    }
}
