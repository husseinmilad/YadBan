package ir.yadban.app;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

public class YadbanQuickCaptureActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (getWindow() != null) {
            getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE);
        }

        int pad = dp(18);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(pad, pad, pad, pad);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        root.setBackgroundColor(Color.parseColor("#FFFFFF"));

        TextView header = new TextView(this);
        header.setText("ثبت فوری یادبان");
        header.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        header.setTextColor(Color.parseColor("#0F172A"));
        header.setTypeface(null, android.graphics.Typeface.BOLD);
        header.setGravity(Gravity.START);
        root.addView(header);

        TextView sub = new TextView(this);
        sub.setText("بدون بازکردن کامل برنامه، یادآور، کار یا محل وسیله را ثبت کنید:");
        sub.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        sub.setTextColor(Color.parseColor("#475569"));
        LinearLayout.LayoutParams subLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        subLp.topMargin = dp(4);
        subLp.bottomMargin = dp(12);
        root.addView(sub, subLp);

        EditText titleInput = new EditText(this);
        titleInput.setHint("مثلاً: فردا ساعت ۸ قبض برق، یا عینک روی میز");
        titleInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        titleInput.setTextColor(Color.parseColor("#0F172A"));
        titleInput.setHintTextColor(Color.parseColor("#94A3B8"));
        titleInput.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL);
        titleInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        titleInput.setPadding(dp(14), dp(12), dp(14), dp(12));
        GradientDrawable inputBg = new GradientDrawable();
        inputBg.setColor(Color.parseColor("#F1F5F9"));
        inputBg.setCornerRadius(dp(12));
        titleInput.setBackground(inputBg);
        root.addView(titleInput);

        RadioGroup modeGroup = new RadioGroup(this);
        modeGroup.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams groupLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        groupLp.topMargin = dp(12);

        RadioButton rbToday = new RadioButton(this);
        rbToday.setId(View.generateViewId());
        rbToday.setText("برای امروز");
        rbToday.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        rbToday.setChecked(true);

        RadioButton rb15m = new RadioButton(this);
        rb15m.setId(View.generateViewId());
        rb15m.setText("یادآوری ۱۵ دقیقه دیگر");
        rb15m.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);

        RadioButton rbTomorrow = new RadioButton(this);
        rbTomorrow.setId(View.generateViewId());
        rbTomorrow.setText("انتقال به فردا (ساعت ۰۹:۰۰)");
        rbTomorrow.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);

        RadioButton rbAnchor = new RadioButton(this);
        rbAnchor.setId(View.generateViewId());
        rbAnchor.setText("ثبت در دفترچه «کجا گذاشتم؟»");
        rbAnchor.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);

        modeGroup.addView(rbToday);
        modeGroup.addView(rb15m);
        modeGroup.addView(rbTomorrow);
        modeGroup.addView(rbAnchor);
        root.addView(modeGroup, groupLp);

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.END);
        LinearLayout.LayoutParams actLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        actLp.topMargin = dp(16);

        Button cancelBtn = new Button(this);
        cancelBtn.setText("بستن");
        cancelBtn.setTextColor(Color.parseColor("#475569"));
        cancelBtn.setBackgroundColor(Color.TRANSPARENT);
        cancelBtn.setOnClickListener(v -> finish());

        Button saveBtn = new Button(this);
        saveBtn.setText("ثبت فوری");
        saveBtn.setTextColor(Color.WHITE);
        GradientDrawable saveBg = new GradientDrawable();
        saveBg.setColor(Color.parseColor("#0F766E"));
        saveBg.setCornerRadius(dp(12));
        saveBtn.setBackground(saveBg);
        saveBtn.setPadding(dp(18), dp(8), dp(18), dp(8));

        saveBtn.setOnClickListener(v -> {
            String raw = titleInput.getText().toString().trim();
            if (raw.isEmpty()) {
                Toast.makeText(this, "لطفاً متن مورد نظر را وارد کنید", Toast.LENGTH_SHORT).show();
                return;
            }

            SimpleDateFormat dateFmt = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            SimpleDateFormat timeFmt = new SimpleDateFormat("HH:mm", Locale.US);
            Calendar cal = Calendar.getInstance();

            String dateStr = dateFmt.format(cal.getTime());
            String timeStr = "";
            String timeBlock = resolveTimeBlock(cal.get(Calendar.HOUR_OF_DAY));
            String category = "work";
            String locationHint = "";

            int checkedId = modeGroup.getCheckedRadioButtonId();
            if (checkedId == rb15m.getId()) {
                cal.add(Calendar.MINUTE, 15);
                dateStr = dateFmt.format(cal.getTime());
                timeStr = timeFmt.format(cal.getTime());
                timeBlock = resolveTimeBlock(cal.get(Calendar.HOUR_OF_DAY));
            } else if (checkedId == rbTomorrow.getId()) {
                cal.add(Calendar.DAY_OF_MONTH, 1);
                dateStr = dateFmt.format(cal.getTime());
                timeStr = "09:00";
                timeBlock = "morning";
            } else if (checkedId == rbAnchor.getId()) {
                dateStr = "";
                category = "anchor";
                locationHint = raw;
            } else {
                // Lightweight natural language detection for "فردا" / "ساعت X"
                if (raw.contains("فردا")) {
                    cal.add(Calendar.DAY_OF_MONTH, 1);
                    dateStr = dateFmt.format(cal.getTime());
                }
                String extractedTime = extractSimpleHour(raw);
                if (!extractedTime.isEmpty()) {
                    timeStr = extractedTime;
                    int hr = Integer.parseInt(extractedTime.split(":")[0]);
                    timeBlock = resolveTimeBlock(hr);
                }
            }

            YadbanOfflineDb db = YadbanOfflineDb.getInstance(this);
            String createdId = db.appendQuickCapturedItem(
                this,
                raw,
                category,
                dateStr,
                timeStr,
                timeBlock,
                "",
                locationHint
            );

            if (createdId != null) {
                YadbanAlarmScheduler.syncAlarms(this, db.getItemsJson(), db.getSettingsJson());
                YadbanWidgetUpdater.updateAllWidgets(this);
                Toast.makeText(this, "در حافظه آفلاین یادبان ثبت شد", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "ذخیره با خطا مواجه شد", Toast.LENGTH_SHORT).show();
            }
            finish();
        });

        actions.addView(cancelBtn);
        LinearLayout.LayoutParams saveLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        saveLp.setMarginStart(dp(8));
        actions.addView(saveBtn, saveLp);
        root.addView(actions, actLp);

        setContentView(root);
        titleInput.requestFocus();
    }

    private String resolveTimeBlock(int hour) {
        if (hour < 12) return "morning";
        if (hour < 16) return "noon";
        if (hour < 20) return "evening";
        return "night";
    }

    private String extractSimpleHour(String text) {
        String normalized = text
            .replace('۰', '0').replace('۱', '1').replace('۲', '2')
            .replace('۳', '3').replace('۴', '4').replace('۵', '5')
            .replace('۶', '6').replace('۷', '7').replace('۸', '8')
            .replace('۹', '9');
        java.util.regex.Matcher m = java.util.regex.Pattern
            .compile("(\\d{1,2}):(\\d{2})")
            .matcher(normalized);
        if (m.find()) {
            int hh = Math.min(23, Math.max(0, Integer.parseInt(m.group(1))));
            int mm = Math.min(59, Math.max(0, Integer.parseInt(m.group(2))));
            return String.format(Locale.US, "%02d:%02d", hh, mm);
        }
        java.util.regex.Matcher mHour = java.util.regex.Pattern
            .compile("ساعت\\s+(\\d{1,2})")
            .matcher(normalized);
        if (mHour.find()) {
            int hh = Math.min(23, Math.max(0, Integer.parseInt(mHour.group(1))));
            return String.format(Locale.US, "%02d:00", hh);
        }
        return "";
    }

    private int dp(int val) {
        return Math.round(
            TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                val,
                getResources().getDisplayMetrics()
            )
        );
    }
}
