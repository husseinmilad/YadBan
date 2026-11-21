# راهنمای ساخت فایل نصبی APK یادبان

این پروژه بر پایه **Capacitor + ماژول‌های بومی اندروید (Kotlin)** طراحی شده است و تمام داده‌ها، فونت‌ها، ضبط یادداشت صوتی، دیتابیس آفلاین SQLite، آلارم بومی `AlarmManager` و ویجت‌های صفحه اول گوشی (`AppWidgetProvider`) به‌صورت کاملاً آفلاین درون آن پیاده‌سازی شده‌اند.

## پیش‌نیازها برای ساخت APK
- **Node.js 20+**
- **JDK 21** (همراه Android Studio Ladybug یا جدیدتر نصب می‌شود)
- **Android SDK Platform 35**

## روش اول: ساخت با یک دستور در ترمینال
```bash
npm install
npm run cap:sync
cd android
./gradlew assembleDebug
```
فایل نصبی APK در مسیر زیر ساخته می‌شود:
`android/app/build/outputs/apk/debug/app-debug.apk`

برای ساخت نسخه نهایی امضاشده (Release):
```bash
cd android
./gradlew assembleRelease
```

## روش دوم: باز کردن در Android Studio
1. دستور زیر را اجرا کنید:
   ```bash
   npm run cap:sync
   npm run cap:open
   ```
2. در Android Studio منتظر اتمام Gradle Sync بمانید.
3. از منوی بالا گزینه **Build > Build Bundle(s) / APK(s) > Build APK(s)** را انتخاب کنید.

## روش سوم: ساخت خودکار ابری با GitHub Actions
فایل گردش‌کار در `.github/workflows/build-apk.yml` آماده است. با ارسال کدها به GitHub یا اجرای دستی Workflow، فایل `yadban-android-apk` به‌صورت خودکار کامپایل و آماده دانلود می‌شود.
