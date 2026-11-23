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

export type SemanticTone = 'important' | 'done' | 'warning' | 'neutral';

export type WidgetType =
  | 'clock_next'
  | 'quick_capture'
  | 'progress_routine'
  | 'pinned_phones';

export type WidgetSize = '2x2' | '3x2' | '4x2';
export type WidgetStyle = 'tonal' | 'glass' | 'contrast';

export interface CustomCategory {
  id: string;
  label: string;
  baseCategory: MemoryCategory;
  tone: SemanticTone;
}

export interface TaskTemplate {
  id: string;
  name: string;
  category: MemoryCategory;
  defaultTitle: string;
  defaultTimeStr?: string;
  defaultNotes?: string;
  subType?: string;
  preReminderMinutes: 0 | 5 | 10 | 15;
  repeatDaily?: boolean;
  isImportant?: boolean;
}

export interface MemoryItem {
  id: string;
  title: string;
  notes?: string;
  category: MemoryCategory;
  customCategoryId?: string;
  dateStr: string; // YYYY-MM-DD, or '' for timeless vault notes
  timeStr: string; // HH:MM, or '' if unscheduled
  timeBlock: TimeBlock;
  repeatDaily: boolean;
  repeatUntilDone?: boolean;
  completed: boolean;
  completedDates: string[]; // For daily repeating habits
  preReminderMinutes: 0 | 5 | 10 | 15;
  priority?: 'normal' | 'important';
  phoneNumber?: string;
  contactName?: string;
  locationHint?: string;
  subType?: string;
  dosage?: string;
  mealTiming?: string;
  durationOrQty?: string;
  personOrPlace?: string;
  pinnedToWidget: boolean;
  createdAt: number;
  snoozedUntil?: number;
  voiceNoteId?: string;
  voiceDurationSec?: number;
  photoId?: string;
  photoText?: string;
  dependsOnId?: string;
  nextStepTitle?: string;
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
  enablePhotoOcr?: boolean;
  customCategories?: CustomCategory[];
  templates?: TaskTemplate[];
}

export type ActiveTab = 'today' | 'vault' | 'widgets' | 'settings';

export interface ActiveReminderAlert {
  item: MemoryItem;
  triggeredAt: number;
  isPreReminder: boolean;
  stageLabel?: string;
}
