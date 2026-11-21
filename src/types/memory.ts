export type MemoryCategory =
  | 'work'
  | 'fitness'
  | 'health'
  | 'phone'
  | 'errand'
  | 'anchor'
  | 'idea';

export type TimeBlock = 'morning' | 'noon' | 'evening' | 'night' | 'anytime';

export type PaletteId = 'ocean' | 'coral' | 'indigo' | 'emerald' | 'contrast';

export type WidgetType =
  | 'clock_next'
  | 'quick_capture'
  | 'progress_routine'
  | 'pinned_phones';

export type WidgetSize = '2x2' | '4x2';
export type WidgetStyle = 'tonal' | 'glass' | 'contrast';

export interface MemoryItem {
  id: string;
  title: string;
  notes?: string;
  category: MemoryCategory;
  dateStr: string; // YYYY-MM-DD, or '' for timeless vault notes
  timeStr: string; // HH:MM, or '' if unscheduled
  timeBlock: TimeBlock;
  repeatDaily: boolean;
  completed: boolean;
  completedDates: string[]; // For daily repeating habits
  preReminderMinutes: 0 | 5 | 10 | 15;
  phoneNumber?: string;
  contactName?: string;
  locationHint?: string;
  pinnedToWidget: boolean;
  createdAt: number;
  snoozedUntil?: number;
  voiceNoteId?: string;
  voiceDurationSec?: number;
}

export interface NativePermissionsStatus {
  isNativeAndroid: boolean;
  notifications: 'granted' | 'denied' | 'prompt';
  exactAlarm: 'granted' | 'denied';
  microphone: 'granted' | 'denied' | 'prompt' | 'unsupported';
  batteryIgnored: boolean;
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  enabled: boolean;
  size: WidgetSize;
  style: WidgetStyle;
  order: number;
}

export interface UserSettings {
  userName: string;
  palette: PaletteId;
  themeMode: 'light' | 'dark';
  fontScale: 'normal' | 'large' | 'xlarge';
  cornerStyle: 'soft' | 'compact';
  chimeType: 'gentle' | 'bell' | 'marimba' | 'none';
  autoRepeatNudge: boolean;
  nudgeIntervalMin: 5 | 10 | 15;
  notificationsEnabled: boolean;
  showFloatingWidget: boolean;
}

export type ActiveTab = 'today' | 'vault' | 'widgets' | 'settings';

export interface ActiveReminderAlert {
  item: MemoryItem;
  triggeredAt: number;
  isPreReminder: boolean;
}
