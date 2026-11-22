import { Capacitor, registerPlugin } from '@capacitor/core';
import { MemoryItem, NativePermissionsStatus, UserSettings } from '../types/memory';
import { getJalaliFullDate, getLocalDateKey } from './dateFa';

interface YadbanNativePluginInterface {
  saveOfflineSnapshot(options: {
    itemsJson: string;
    settingsJson: string;
    widgetPayloadJson: string;
  }): Promise<{ ok: boolean }>;
  loadOfflineSnapshot(): Promise<{
    itemsJson?: string;
    settingsJson?: string;
    hasSnapshot: boolean;
  }>;
  syncAlarms(options: {
    itemsJson: string;
    settingsJson: string;
  }): Promise<{ scheduledCount: number }>;
  triggerImmediateNativeAlert(options: {
    itemId: string;
    title: string;
    body: string;
    chimeType: string;
  }): Promise<{ ok: boolean }>;
  scheduleDelayedTestAlarm(options: {
    delaySeconds: number;
    title: string;
    body: string;
  }): Promise<{ ok: boolean }>;
  refreshWidgets(options: { widgetPayloadJson: string }): Promise<{ ok: boolean }>;
  checkPermissions(): Promise<{
    notifications: 'granted' | 'denied' | 'prompt';
    exactAlarm: 'granted' | 'denied';
    microphone: 'granted' | 'denied' | 'prompt';
    batteryIgnored: boolean;
  }>;
  requestNotificationPermission(): Promise<{ status: 'granted' | 'denied' | 'prompt' }>;
  requestExactAlarmPermission(): Promise<{ status: 'granted' | 'denied' }>;
  requestMicrophonePermission(): Promise<{ status: 'granted' | 'denied' | 'prompt' }>;
  requestBatteryOptimizationExemption(): Promise<{ batteryIgnored: boolean }>;
  startSpeechToText(): Promise<{ ok: boolean; text?: string; reason?: string }>;
  exportBackupFile(options: {
    fileName: string;
    jsonContent: string;
  }): Promise<{ ok: boolean; cancelled?: boolean; method?: string; error?: string }>;
  shareBackupFile(options: {
    fileName: string;
    jsonContent: string;
  }): Promise<{ ok: boolean; error?: string }>;
}

const YadbanNative = registerPlugin<YadbanNativePluginInterface>('YadbanNative');

export function isNativeAndroidApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function buildWidgetPayload(items: MemoryItem[]): string {
  const todayKey = getLocalDateKey(new Date());
  const todayItems = items
    .filter((i) => i.repeatDaily || i.dateStr === todayKey)
    .sort((a, b) => {
      const aDone = a.repeatDaily ? a.completedDates.includes(todayKey) : a.completed;
      const bDone = b.repeatDaily ? b.completedDates.includes(todayKey) : b.completed;
      if (aDone !== bDone) return aDone ? 1 : -1;
      return (a.timeStr || '99:99').localeCompare(b.timeStr || '99:99');
    });

  const doneCount = todayItems.filter((i) =>
    i.repeatDaily ? i.completedDates.includes(todayKey) : i.completed
  ).length;

  const nextPending = todayItems.find((i) => {
    const done = i.repeatDaily ? i.completedDates.includes(todayKey) : i.completed;
    return !done;
  });

  return JSON.stringify({
    dateKey: todayKey,
    jalaliLabel: getJalaliFullDate(new Date()),
    totalCount: todayItems.length,
    doneCount,
    nextTitle: nextPending ? nextPending.title : 'همه کارهای امروز انجام شد',
    nextTime: nextPending?.timeStr || '',
    tasks: todayItems.slice(0, 4).map((i) => ({
      id: i.id,
      title: i.title,
      timeStr: i.timeStr,
      repeatDaily: i.repeatDaily,
      done: i.repeatDaily ? i.completedDates.includes(todayKey) : i.completed,
    })),
  });
}

export async function loadNativeOfflineData(): Promise<{
  items: MemoryItem[] | null;
  settings: UserSettings | null;
}> {
  if (!isNativeAndroidApp()) {
    return { items: null, settings: null };
  }
  try {
    const res = await YadbanNative.loadOfflineSnapshot();
    if (!res.hasSnapshot) return { items: null, settings: null };
    const items = res.itemsJson ? (JSON.parse(res.itemsJson) as MemoryItem[]) : null;
    const settings = res.settingsJson ? (JSON.parse(res.settingsJson) as UserSettings) : null;
    return { items, settings };
  } catch {
    return { items: null, settings: null };
  }
}

export async function syncOfflineStateAndAlarms(
  items: MemoryItem[],
  settings: UserSettings
): Promise<number> {
  if (!isNativeAndroidApp()) return 0;
  try {
    const itemsJson = JSON.stringify(items);
    const settingsJson = JSON.stringify(settings);
    const widgetPayloadJson = buildWidgetPayload(items);

    await YadbanNative.saveOfflineSnapshot({
      itemsJson,
      settingsJson,
      widgetPayloadJson,
    });
    const res = await YadbanNative.syncAlarms({ itemsJson, settingsJson });
    return res.scheduledCount || 0;
  } catch {
    return 0;
  }
}

export async function refreshNativeHomeWidgets(items: MemoryItem[]): Promise<boolean> {
  if (!isNativeAndroidApp()) return false;
  try {
    await YadbanNative.refreshWidgets({
      widgetPayloadJson: buildWidgetPayload(items),
    });
    return true;
  } catch {
    return false;
  }
}

export async function triggerNativeAlertNotification(
  itemId: string,
  title: string,
  body: string,
  chimeType: UserSettings['chimeType']
): Promise<boolean> {
  if (isNativeAndroidApp()) {
    try {
      await YadbanNative.triggerImmediateNativeAlert({
        itemId,
        title,
        body,
        chimeType,
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function scheduleNativeDelayedTestAlarm(
  delaySeconds: number,
  title: string,
  body: string
): Promise<boolean> {
  if (!isNativeAndroidApp()) return false;
  try {
    const res = await YadbanNative.scheduleDelayedTestAlarm({
      delaySeconds,
      title,
      body,
    });
    return Boolean(res.ok);
  } catch {
    return false;
  }
}

export async function getNativePermissionsStatus(): Promise<NativePermissionsStatus> {
  if (isNativeAndroidApp()) {
    try {
      const status = await YadbanNative.checkPermissions();
      return {
        isNativeAndroid: true,
        notifications: status.notifications,
        exactAlarm: status.exactAlarm,
        microphone: status.microphone,
        batteryIgnored: status.batteryIgnored,
      };
    } catch {
      // fallback below
    }
  }

  let notifications: 'granted' | 'denied' | 'prompt' = 'prompt';
  if (typeof window !== 'undefined' && 'Notification' in window) {
    notifications = Notification.permission === 'default' ? 'prompt' : Notification.permission;
  }

  let microphone: 'granted' | 'denied' | 'prompt' | 'unsupported' =
    typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
      ? 'prompt'
      : 'unsupported';

  if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
    try {
      const micPerm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (micPerm.state === 'granted' || micPerm.state === 'denied' || micPerm.state === 'prompt') {
        microphone = micPerm.state;
      }
    } catch {
      // ignore unsupported browser query
    }
  }

  return {
    isNativeAndroid: false,
    notifications,
    exactAlarm: 'granted',
    microphone,
    batteryIgnored: true,
  };
}

export async function requestNativeNotificationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (isNativeAndroidApp()) {
    const res = await YadbanNative.requestNotificationPermission();
    return res.status;
  }
  if (typeof window !== 'undefined' && 'Notification' in window) {
    const res = await Notification.requestPermission();
    return res === 'default' ? 'prompt' : res;
  }
  return 'denied';
}

export async function requestNativeExactAlarmPermission(): Promise<'granted' | 'denied'> {
  if (isNativeAndroidApp()) {
    const res = await YadbanNative.requestExactAlarmPermission();
    return res.status;
  }
  return 'granted';
}

export async function requestNativeMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (isNativeAndroidApp()) {
    const res = await YadbanNative.requestMicrophonePermission();
    return res.status;
  }
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'unsupported';
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return 'granted';
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'denied';
    }
    return 'prompt';
  }
}

export async function requestNativeBatteryOptimizationExemption(): Promise<boolean> {
  if (isNativeAndroidApp()) {
    try {
      const res = await YadbanNative.requestBatteryOptimizationExemption();
      return Boolean(res.batteryIgnored);
    } catch {
      return false;
    }
  }
  return true;
}

interface SpeechRecognitionAlternativeLike {
  transcript?: string;
}

interface SpeechRecognitionResultLike {
  0?: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results?: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

export async function dictatePersianText(): Promise<{
  ok: boolean;
  text?: string;
  error?: string;
}> {
  if (isNativeAndroidApp()) {
    try {
      const micPerm = await requestNativeMicrophonePermission();
      if (micPerm === 'denied') {
        return {
          ok: false,
          error: 'مجوز میکروفن مسدود شده است؛ لطفاً از بخش «شخصی‌سازی ← مجوزهای برنامه» آن را تایید کنید.',
        };
      }
      const res = await YadbanNative.startSpeechToText();
      if (res.ok && res.text) {
        return { ok: true, text: res.text };
      }
      if (res.reason === 'permission_denied') {
        return {
          ok: false,
          error: 'مجوز میکروفن داده نشد؛ لطفاً دسترسی میکروفن را تایید کنید.',
        };
      }
      if (res.reason === 'no_speech_service') {
        return {
          ok: false,
          error: 'سرویس تبدیل گفتار به متن روی این گوشی نصب یا فعال نیست.',
        };
      }
      return { ok: false, error: 'صدایی دریافت نشد یا تبدیل گفتار لغو شد.' };
    } catch {
      return { ok: false, error: 'خطا در اجرای تبدیل گفتار به متن بومی اندروید.' };
    }
  }

  if (typeof window === 'undefined') {
    return { ok: false, error: 'امکان تبدیل گفتار در این محیط وجود ندارد.' };
  }

  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  const SpeechCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!SpeechCtor) {
    return {
      ok: false,
      error: 'تایپ صوتی در این مرورگر پشتیبانی نمی‌شود (از ضبط یادداشت صوتی پایین استفاده کنید یا نسخه APK را نصب کنید).',
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    try {
      const recognition = new SpeechCtor();
      recognition.lang = 'fa-IR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onresult = (event) => {
        if (settled) return;
        settled = true;
        const transcript = event.results?.[0]?.[0]?.transcript?.trim() || '';
        if (transcript) {
          resolve({ ok: true, text: transcript });
        } else {
          resolve({ ok: false, error: 'صدایی تشخیص داده نشد.' });
        }
      };

      recognition.onerror = (ev) => {
        if (settled) return;
        settled = true;
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          resolve({
            ok: false,
            error: 'دسترسی میکروفن مسدود است؛ لطفاً مجوز میکروفن مرورگر را تایید کنید.',
          });
        } else if (ev.error === 'no-speech') {
          resolve({ ok: false, error: 'صدایی شنیده نشد؛ لطفاً واضح‌تر صحبت کنید.' });
        } else {
          resolve({ ok: false, error: 'تبدیل گفتار به متن در مرورگر با خطا مواجه شد.' });
        }
      };

      recognition.onend = () => {
        if (!settled) {
          settled = true;
          resolve({ ok: false, error: 'تایپ صوتی پایان یافت.' });
        }
      };

      recognition.start();
    } catch {
      if (!settled) {
        settled = true;
        resolve({ ok: false, error: 'راه‌اندازی تایپ صوتی با خطا مواجه شد.' });
      }
    }
  });
}

export async function exportYadbanBackup(
  fileName: string,
  jsonContent: string
): Promise<{ ok: boolean; cancelled?: boolean; method?: string; error?: string }> {
  if (isNativeAndroidApp()) {
    try {
      return await YadbanNative.exportBackupFile({ fileName, jsonContent });
    } catch {
      return { ok: false, error: 'خطا در ذخیره‌سازی فایل پشتیبان در حافظه گوشی.' };
    }
  }

  try {
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 1000);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 15000);
    return { ok: true, method: 'browser_download' };
  } catch {
    return { ok: false, error: 'مرورگر اجازه دانلود مستقیم فایل را نداد.' };
  }
}

export async function shareYadbanBackup(
  fileName: string,
  jsonContent: string
): Promise<{ ok: boolean; error?: string }> {
  if (isNativeAndroidApp()) {
    try {
      return await YadbanNative.shareBackupFile({ fileName, jsonContent });
    } catch {
      return { ok: false, error: 'خطا در اشتراک‌گذاری فایل پشتیبان.' };
    }
  }

  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      const file = new File([jsonContent], fileName, { type: 'application/json' });
      const navWithShare = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      if (navWithShare.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'فایل پشتیبان یادبان', files: [file] });
        return { ok: true };
      }
      await navigator.share({ title: 'فایل پشتیبان یادبان', text: jsonContent });
      return { ok: true };
    } catch {
      return { ok: false, error: 'اشتراک‌گذاری لغو شد یا در این مرورگر پشتیبانی نمی‌شود.' };
    }
  }
  return { ok: false, error: 'اشتراک‌گذاری مستقیم در این مرورگر در دسترس نیست.' };
}
