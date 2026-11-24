import {
  MemoryCategory,
  MemoryItem,
  TimeBlock,
  UserSettings,
  WidgetConfig,
} from '../types/memory';

const VALID_CATEGORIES = new Set<MemoryCategory>([
  'work',
  'fitness',
  'health',
  'phone',
  'errand',
  'anchor',
  'idea',
]);

const VALID_TIME_BLOCKS = new Set<TimeBlock>([
  'morning',
  'noon',
  'evening',
  'night',
  'anytime',
]);

export interface ParsedYadbanBackup {
  ok: true;
  items: MemoryItem[];
  settings?: Partial<UserSettings>;
  widgets?: WidgetConfig[];
}

export interface FailedYadbanBackup {
  ok: false;
  error: string;
}

export type ParseBackupResult = ParsedYadbanBackup | FailedYadbanBackup;

function stripLeadingInvisible(text: string): string {
  return text.replace(/^[\uFEFF\u200B\u200E\u200F\u202A-\u202E\s]+/, '').replace(/[\u200B\u200E\u200F\u202A-\u202E\s]+$/, '');
}

function stripMarkdownFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    return stripLeadingInvisible(fenced[1]);
  }
  return text;
}

function tryDecodeDataUrl(text: string): string {
  const m = text.match(/^data:[^,;]*;base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!m) return text;
  try {
    const binary = atob(m[1].replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return text;
  }
}

/**
 * Extracts the first complete balanced JSON object or array from text,
 * tolerating share headers/footers or trailing stale bytes.
 */
function extractBalancedJson(text: string): string | null {
  const startObj = text.indexOf('{');
  const startArr = text.indexOf('[');
  let start = -1;
  if (startObj >= 0 && startArr >= 0) {
    start = Math.min(startObj, startArr);
  } else {
    start = Math.max(startObj, startArr);
  }
  if (start < 0) return null;

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      stack.push('}');
    } else if (ch === '[') {
      stack.push(']');
    } else if (ch === '}' || ch === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
        if (stack.length === 0) {
          return text.slice(start, i + 1);
        }
      }
    }
  }

  return text.slice(start);
}

function tryParseJsonFlexible(raw: string): unknown {
  const cleaned = stripLeadingInvisible(
    stripMarkdownFences(stripLeadingInvisible(tryDecodeDataUrl(stripLeadingInvisible(raw))))
  );

  const candidates = [cleaned];
  const balanced = extractBalancedJson(cleaned);
  if (balanced && balanced !== cleaned) {
    candidates.push(balanced);
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (typeof parsed === 'string') {
        return JSON.parse(parsed);
      }
      return parsed;
    } catch {
      // retry with curly quotes normalized if copied through rich notes/messaging apps
      const normalizedQuotes = candidate.replace(/[\u201C\u201D]/g, '"');
      if (normalizedQuotes !== candidate) {
        try {
          const parsedQuotes: unknown = JSON.parse(normalizedQuotes);
          if (typeof parsedQuotes === 'string') {
            return JSON.parse(parsedQuotes);
          }
          return parsedQuotes;
        } catch {
          // continue to next candidate
        }
      }
    }
  }

  throw new Error('INVALID_JSON');
}

function normalizeMemoryItem(raw: unknown, idx: number): MemoryItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const rawCategory = typeof obj.category === 'string' ? obj.category : 'work';
  const category: MemoryCategory = VALID_CATEGORIES.has(rawCategory as MemoryCategory)
    ? (rawCategory as MemoryCategory)
    : 'work';

  const isStorageOnly = category === 'phone' || category === 'anchor' || category === 'idea';

  const rawTimeBlock = typeof obj.timeBlock === 'string' ? obj.timeBlock : 'anytime';
  const timeBlock: TimeBlock = VALID_TIME_BLOCKS.has(rawTimeBlock as TimeBlock)
    ? (rawTimeBlock as TimeBlock)
    : 'anytime';

  const rawPre = Number(obj.preReminderMinutes);
  const preReminderMinutes: 0 | 5 | 10 | 15 =
    rawPre === 5 || rawPre === 10 || rawPre === 15 ? rawPre : 0;

  const title =
    typeof obj.title === 'string' && obj.title.trim()
      ? obj.title.trim()
      : typeof obj.contactName === 'string' && obj.contactName.trim()
        ? obj.contactName.trim()
        : 'مورد بازیابی‌شده';

  return {
    id:
      typeof obj.id === 'string' && obj.id.trim()
        ? obj.id.trim()
        : `restored-${Date.now()}-${idx}`,
    title,
    notes: typeof obj.notes === 'string' && obj.notes.trim() ? obj.notes : undefined,
    category,
    customCategoryId:
      typeof obj.customCategoryId === 'string' && obj.customCategoryId.trim()
        ? obj.customCategoryId
        : undefined,
    dateStr: isStorageOnly ? '' : typeof obj.dateStr === 'string' ? obj.dateStr : '',
    timeStr: isStorageOnly ? '' : typeof obj.timeStr === 'string' ? obj.timeStr : '',
    timeBlock: isStorageOnly ? 'anytime' : timeBlock,
    repeatDaily: isStorageOnly ? false : Boolean(obj.repeatDaily),
    repeatUntilDone: isStorageOnly ? false : Boolean(obj.repeatUntilDone),
    completed: Boolean(obj.completed),
    completedDates: Array.isArray(obj.completedDates)
      ? obj.completedDates.filter((d): d is string => typeof d === 'string')
      : [],
    preReminderMinutes: isStorageOnly ? 0 : preReminderMinutes,
    priority: obj.priority === 'important' ? 'important' : 'normal',
    phoneNumber:
      typeof obj.phoneNumber === 'string' && obj.phoneNumber.trim()
        ? obj.phoneNumber
        : undefined,
    contactName:
      typeof obj.contactName === 'string' && obj.contactName.trim()
        ? obj.contactName
        : undefined,
    locationHint:
      typeof obj.locationHint === 'string' && obj.locationHint.trim()
        ? obj.locationHint
        : undefined,
    subType:
      typeof obj.subType === 'string' && obj.subType.trim() ? obj.subType : undefined,
    dosage:
      typeof obj.dosage === 'string' && obj.dosage.trim() ? obj.dosage : undefined,
    mealTiming:
      typeof obj.mealTiming === 'string' && obj.mealTiming.trim()
        ? obj.mealTiming
        : undefined,
    durationOrQty:
      typeof obj.durationOrQty === 'string' && obj.durationOrQty.trim()
        ? obj.durationOrQty
        : undefined,
    personOrPlace:
      typeof obj.personOrPlace === 'string' && obj.personOrPlace.trim()
        ? obj.personOrPlace
        : undefined,
    pinnedToWidget: Boolean(obj.pinnedToWidget),
    createdAt:
      typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt)
        ? obj.createdAt
        : Date.now() - idx * 1000,
    snoozedUntil:
      typeof obj.snoozedUntil === 'number' && Number.isFinite(obj.snoozedUntil)
        ? obj.snoozedUntil
        : undefined,
    voiceNoteId:
      typeof obj.voiceNoteId === 'string' ? obj.voiceNoteId : undefined,
    voiceDurationSec:
      typeof obj.voiceDurationSec === 'number' ? obj.voiceDurationSec : undefined,
    photoId: typeof obj.photoId === 'string' ? obj.photoId : undefined,
    photoText: typeof obj.photoText === 'string' ? obj.photoText : undefined,
    dependsOnId:
      typeof obj.dependsOnId === 'string' ? obj.dependsOnId : undefined,
    nextStepTitle:
      typeof obj.nextStepTitle === 'string' ? obj.nextStepTitle : undefined,
  };
}

export function parseYadbanBackup(rawInput: string): ParseBackupResult {
  if (typeof rawInput !== 'string' || !rawInput.trim()) {
    return {
      ok: false,
      error: 'محتوای فایل یا متن پشتیبان خالی است.',
    };
  }

  let root: unknown;
  try {
    root = tryParseJsonFlexible(rawInput);
  } catch {
    return {
      ok: false,
      error: 'متن یا ساختار فایل پشتیبان معتبر نیست.',
    };
  }

  if (!root || typeof root !== 'object') {
    return {
      ok: false,
      error: 'متن یا ساختار فایل پشتیبان معتبر نیست.',
    };
  }

  // Handle wrapped envelopes ({ data: {...} } or { backup: {...} })
  let payloadObj: Record<string, unknown> | null = Array.isArray(root)
    ? null
    : (root as Record<string, unknown>);

  if (
    payloadObj &&
    !Array.isArray(payloadObj.items) &&
    !Array.isArray(payloadObj.tasks)
  ) {
    if (payloadObj.data && typeof payloadObj.data === 'object' && !Array.isArray(payloadObj.data)) {
      payloadObj = payloadObj.data as Record<string, unknown>;
    } else if (
      payloadObj.backup &&
      typeof payloadObj.backup === 'object' &&
      !Array.isArray(payloadObj.backup)
    ) {
      payloadObj = payloadObj.backup as Record<string, unknown>;
    }
  }

  let rawItems: unknown[] | null = null;
  if (Array.isArray(root)) {
    rawItems = root;
  } else if (payloadObj) {
    if (Array.isArray(payloadObj.items)) {
      rawItems = payloadObj.items;
    } else if (Array.isArray(payloadObj.tasks)) {
      rawItems = payloadObj.tasks;
    } else if (
      payloadObj.settings &&
      typeof payloadObj.settings === 'object' &&
      !Array.isArray(payloadObj.settings)
    ) {
      rawItems = [];
    }
  }

  if (!rawItems) {
    return {
      ok: false,
      error: 'ساختار فایل پشتیبان معتبر نیست (لیست کارها یافت نشد).',
    };
  }

  const normalizedItems = rawItems
    .map((entry, idx) => normalizeMemoryItem(entry, idx))
    .filter((item): item is MemoryItem => item !== null);

  const settings =
    payloadObj?.settings &&
    typeof payloadObj.settings === 'object' &&
    !Array.isArray(payloadObj.settings)
      ? (payloadObj.settings as Partial<UserSettings>)
      : undefined;

  const widgets = Array.isArray(payloadObj?.widgets)
    ? (payloadObj.widgets.filter(
        (w): w is WidgetConfig => Boolean(w && typeof w === 'object' && 'type' in w)
      ) as WidgetConfig[])
    : undefined;

  return {
    ok: true,
    items: normalizedItems,
    settings,
    widgets,
  };
}
