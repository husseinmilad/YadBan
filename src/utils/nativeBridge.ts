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
