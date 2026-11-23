package ir.yadban.app;

import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class YadbanOfflineDb extends SQLiteOpenHelper {

    private static final String DB_NAME = "yadban_offline.db";
    private static final int DB_VERSION = 1;
    private static final String TABLE_SNAPSHOT = "snapshot";
    private static final String KEY_ITEMS = "items_json";
    private static final String KEY_SETTINGS = "settings_json";

    private static final String PREFS_WIDGET = "yadban_widget_prefs";
    private static final String PREF_WIDGET_PAYLOAD = "widget_payload";

    private static YadbanOfflineDb instance;

    private YadbanOfflineDb(Context context) {
        super(context.getApplicationContext(), DB_NAME, null, DB_VERSION);
    }

    public static synchronized YadbanOfflineDb getInstance(Context context) {
        if (instance == null) {
            instance = new YadbanOfflineDb(context.getApplicationContext());
        }
        return instance;
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL(
            "CREATE TABLE IF NOT EXISTS " + TABLE_SNAPSHOT + " (" +
            "k TEXT PRIMARY KEY, " +
            "v TEXT NOT NULL, " +
            "updated_at INTEGER NOT NULL)"
        );
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        onCreate(db);
    }

    public synchronized void saveSnapshot(
        Context context,
        String itemsJson,
        String settingsJson,
        String widgetPayloadJson
    ) {
        SQLiteDatabase db = getWritableDatabase();
        long now = System.currentTimeMillis();
        upsert(db, KEY_ITEMS, itemsJson, now);
        upsert(db, KEY_SETTINGS, settingsJson, now);

        if (widgetPayloadJson != null && !widgetPayloadJson.isEmpty()) {
            SharedPreferences prefs = context.getApplicationContext()
                .getSharedPreferences(PREFS_WIDGET, Context.MODE_PRIVATE);
            prefs.edit().putString(PREF_WIDGET_PAYLOAD, widgetPayloadJson).apply();
        }
    }

    private void upsert(SQLiteDatabase db, String key, String value, long now) {
        if (value == null) return;
        ContentValues cv = new ContentValues();
        cv.put("k", key);
        cv.put("v", value);
        cv.put("updated_at", now);
        db.insertWithOnConflict(TABLE_SNAPSHOT, null, cv, SQLiteDatabase.CONFLICT_REPLACE);
    }

    public synchronized String getItemsJson() {
        return readKey(KEY_ITEMS);
    }

    public synchronized String getSettingsJson() {
        return readKey(KEY_SETTINGS);
    }

    private String readKey(String key) {
        SQLiteDatabase db = getReadableDatabase();
        try (Cursor c = db.query(
            TABLE_SNAPSHOT,
            new String[]{"v"},
            "k = ?",
            new String[]{key},
            null,
            null,
            null
        )) {
            if (c.moveToFirst()) {
                return c.getString(0);
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    public static String getWidgetPayloadJson(Context context) {
        SharedPreferences prefs = context.getApplicationContext()
            .getSharedPreferences(PREFS_WIDGET, Context.MODE_PRIVATE);
        return prefs.getString(PREF_WIDGET_PAYLOAD, null);
    }

    public static void saveWidgetPayloadJson(Context context, String payload) {
        if (payload == null) return;
        SharedPreferences prefs = context.getApplicationContext()
            .getSharedPreferences(PREFS_WIDGET, Context.MODE_PRIVATE);
        prefs.edit().putString(PREF_WIDGET_PAYLOAD, payload).apply();
    }

    public static String getTodayDateKey() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    public synchronized boolean toggleOrCompleteItem(Context context, String itemId, boolean toggleMode) {
        String itemsJson = getItemsJson();
        if (itemsJson == null) return false;
        String todayKey = getTodayDateKey();
        boolean changed = false;
        boolean becameDone = false;
        JSONObject completedSource = null;

        try {
            JSONArray arr = new JSONArray(itemsJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                if (!itemId.equals(obj.optString("id"))) continue;

                boolean repeatDaily = obj.optBoolean("repeatDaily", false);
                if (repeatDaily) {
                    JSONArray dates = obj.optJSONArray("completedDates");
                    if (dates == null) dates = new JSONArray();
                    int foundIndex = -1;
                    for (int j = 0; j < dates.length(); j++) {
                        if (todayKey.equals(dates.optString(j))) {
                            foundIndex = j;
                            break;
                        }
                    }
                    if (foundIndex >= 0 && toggleMode) {
                        JSONArray nextDates = new JSONArray();
                        for (int j = 0; j < dates.length(); j++) {
                            if (j != foundIndex) nextDates.put(dates.getString(j));
                        }
                        obj.put("completedDates", nextDates);
                    } else if (foundIndex < 0) {
                        dates.put(todayKey);
                        obj.put("completedDates", dates);
                        becameDone = true;
                        completedSource = obj;
                    }
                } else {
                    boolean currentDone = obj.optBoolean("completed", false);
                    boolean nextDone = toggleMode ? !currentDone : true;
                    obj.put("completed", nextDone);
                    obj.remove("snoozedUntil");
                    if (!currentDone && nextDone) {
                        becameDone = true;
                        completedSource = obj;
                    }
                }
                changed = true;
                break;
            }

            if (becameDone && completedSource != null) {
                String nextStepTitle = completedSource.optString("nextStepTitle", "").trim();
                if (!nextStepTitle.isEmpty()) {
                    JSONObject nextItem = new JSONObject();
                    nextItem.put("id", "mem-" + System.currentTimeMillis() + "-next");
                    nextItem.put("title", nextStepTitle);
                    nextItem.put("category", completedSource.optString("category", "work"));
                    nextItem.put("dateStr", todayKey);
                    nextItem.put("timeStr", "");
                    nextItem.put("timeBlock", completedSource.optString("timeBlock", "morning"));
                    nextItem.put("repeatDaily", false);
                    nextItem.put("completed", false);
                    nextItem.put("completedDates", new JSONArray());
                    nextItem.put("preReminderMinutes", 0);
                    nextItem.put("dependsOnId", itemId);
                    nextItem.put("pinnedToWidget", false);
                    nextItem.put("createdAt", System.currentTimeMillis());

                    JSONArray prepended = new JSONArray();
                    prepended.put(nextItem);
                    for (int k = 0; k < arr.length(); k++) {
                        prepended.put(arr.get(k));
                    }
                    arr = prepended;
                }
            }

            if (changed) {
                String updatedItems = arr.toString();
                String widgetPayload = rebuildWidgetPayload(arr, todayKey);
                saveSnapshot(context, updatedItems, getSettingsJson(), widgetPayload);
            }
        } catch (Exception ignored) {
        }
        return changed;
    }

    public synchronized String appendQuickCapturedItem(
        Context context,
        String title,
        String category,
        String dateStr,
        String timeStr,
        String timeBlock,
        String notes,
        String locationHint
    ) {
        if (title == null || title.trim().isEmpty()) return null;
        String todayKey = getTodayDateKey();
        String existingJson = getItemsJson();
        try {
            JSONArray existing = existingJson != null && !existingJson.isEmpty()
                ? new JSONArray(existingJson)
                : new JSONArray();

            String id = "mem-" + System.currentTimeMillis() + "-native";
            JSONObject item = new JSONObject();
            item.put("id", id);
            item.put("title", title.trim());
            item.put("category", category != null && !category.isEmpty() ? category : "work");
            item.put("dateStr", dateStr != null ? dateStr : "");
            item.put("timeStr", timeStr != null ? timeStr : "");
            item.put("timeBlock", timeBlock != null && !timeBlock.isEmpty() ? timeBlock : "morning");
            item.put("repeatDaily", false);
            item.put("completed", false);
            item.put("completedDates", new JSONArray());
            item.put("preReminderMinutes", (timeStr != null && !timeStr.isEmpty()) ? 10 : 0);
            if (notes != null && !notes.trim().isEmpty()) {
                item.put("notes", notes.trim());
            }
            if (locationHint != null && !locationHint.trim().isEmpty()) {
                item.put("locationHint", locationHint.trim());
            }
            item.put("pinnedToWidget", "anchor".equals(category));
            item.put("createdAt", System.currentTimeMillis());

            JSONArray next = new JSONArray();
            next.put(item);
            for (int i = 0; i < existing.length(); i++) {
                next.put(existing.get(i));
            }

            String updatedItems = next.toString();
            String widgetPayload = rebuildWidgetPayload(next, todayKey);
            saveSnapshot(context, updatedItems, getSettingsJson(), widgetPayload);
            return id;
        } catch (Exception ignored) {
            return null;
        }
    }

    public synchronized boolean snoozeItem(Context context, String itemId, int minutes) {
        String itemsJson = getItemsJson();
        if (itemsJson == null) return false;
        boolean changed = false;
        long snoozeUntil = System.currentTimeMillis() + minutes * 60_000L;

        try {
            JSONArray arr = new JSONArray(itemsJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                if (!itemId.equals(obj.optString("id"))) continue;
                obj.put("snoozedUntil", snoozeUntil);
                changed = true;
                break;
            }
            if (changed) {
                saveSnapshot(context, arr.toString(), getSettingsJson(), null);
            }
        } catch (Exception ignored) {
        }
        return changed;
    }

    public synchronized boolean isItemDoneToday(String itemId) {
        String itemsJson = getItemsJson();
        if (itemsJson == null) return false;
        String todayKey = getTodayDateKey();
        try {
            JSONArray arr = new JSONArray(itemsJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                if (!itemId.equals(obj.optString("id"))) continue;
                if (obj.optBoolean("repeatDaily", false)) {
                    JSONArray dates = obj.optJSONArray("completedDates");
                    if (dates == null) return false;
                    for (int j = 0; j < dates.length(); j++) {
                        if (todayKey.equals(dates.optString(j))) return true;
                    }
                    return false;
                }
                return obj.optBoolean("completed", false);
            }
        } catch (Exception ignored) {
        }
        return false;
    }

    private String rebuildWidgetPayload(JSONArray items, String todayKey) {
        try {
            JSONArray tasks = new JSONArray();
            int total = 0;
            int done = 0;
            String nextTitle = "همه کارهای امروز انجام شد";
            String nextTime = "";
            boolean foundNext = false;

            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.getJSONObject(i);
                boolean repeatDaily = item.optBoolean("repeatDaily", false);
                String dateStr = item.optString("dateStr", "");
                if (!repeatDaily && !todayKey.equals(dateStr)) continue;

                total++;
                boolean isDone;
                if (repeatDaily) {
                    isDone = false;
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
                if (isDone) done++;

                if (!isDone && !foundNext) {
                    nextTitle = item.optString("title", "");
                    nextTime = item.optString("timeStr", "");
                    foundNext = true;
                }

                if (tasks.length() < 4) {
                    JSONObject t = new JSONObject();
                    t.put("id", item.optString("id"));
                    t.put("title", item.optString("title"));
                    t.put("timeStr", item.optString("timeStr", ""));
                    t.put("done", isDone);
                    tasks.put(t);
                }
            }

            JSONObject payload = new JSONObject();
            payload.put("dateKey", todayKey);
            payload.put("totalCount", total);
            payload.put("doneCount", done);
            payload.put("nextTitle", nextTitle);
            payload.put("nextTime", nextTime);
            payload.put("tasks", tasks);
            return payload.toString();
        } catch (Exception e) {
            return null;
        }
    }
}
