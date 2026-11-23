import { MemoryCategory, TimeBlock } from '../types/memory';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}

export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return getLocalDateKey(dt);
}

export function getJalaliFullDate(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toLocaleDateString('fa-IR');
  }
}

export function getJalaliDayParts(dateKey: string): {
  weekdayShort: string;
  weekdayLong: string;
  dayNum: string;
  monthName: string;
  isToday: boolean;
} {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const todayKey = getLocalDateKey(new Date());

  try {
    const weekdayLong = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long' }).format(dt);
    const dayNum = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric' }).format(dt);
    const monthName = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long' }).format(dt);
    return {
      weekdayShort: weekdayLong.replace('‌', ' ').slice(0, 5),
      weekdayLong,
      dayNum,
      monthName,
      isToday: dateKey === todayKey,
    };
  } catch {
    return {
      weekdayShort: 'روز',
      weekdayLong: 'امروز',
      dayNum: toPersianDigits(d),
      monthName: '',
      isToday: dateKey === todayKey,
    };
  }
}

export function get7DayWindow(centerDateKey?: string): string[] {
  const today = getLocalDateKey(new Date());
  const base = centerDateKey || today;
  const daysFromToday = Math.round(
    (new Date(base + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) /
      86400000
  );
  const start = daysFromToday >= 0 && daysFromToday < 7 ? today : addDaysToDateKey(base, -2);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(addDaysToDateKey(start, i));
  }
  return days;
}

export interface JalaliDayCell {
  dateKey: string;
  dayNum: number;
  dayNumFa: string;
  weekdayIndex: number; // 0 = Saturday ... 6 = Friday
  isToday: boolean;
}

function getJalaliNumericParts(date: Date): { year: number; month: number; day: number } {
  try {
    const fmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const parts = fmt.formatToParts(date);
    const year = Number(parts.find((p) => p.type === 'year')?.value || 1405);
    const month = Number(parts.find((p) => p.type === 'month')?.value || 1);
    const day = Number(parts.find((p) => p.type === 'day')?.value || 1);
    return { year, month, day };
  } catch {
    return { year: 1405, month: 9, day: date.getDate() };
  }
}

export function getPersianWeekdayIndex(date: Date): number {
  // JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat -> Persian: 0=Sat, 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri
  return (date.getDay() + 1) % 7;
}

export function getJalaliMonthInfo(referenceDateKey: string): {
  monthTitle: string;
  yearFa: string;
  firstDayKey: string;
  lastDayKey: string;
  leadingEmptyCells: number;
  days: JalaliDayCell[];
} {
  const [y, m, d] = referenceDateKey.split('-').map(Number);
  const refDate = new Date(y, m - 1, d);
  const { month: targetMonth } = getJalaliNumericParts(refDate);
  const { day: refJalaliDay } = getJalaliNumericParts(refDate);

  const firstDate = new Date(refDate);
  firstDate.setDate(firstDate.getDate() - (refJalaliDay - 1));

  const todayKey = getLocalDateKey(new Date());
  const days: JalaliDayCell[] = [];
  const cursor = new Date(firstDate);

  for (let i = 0; i < 32; i++) {
    const parts = getJalaliNumericParts(cursor);
    if (parts.month !== targetMonth) break;
    const key = getLocalDateKey(cursor);
    days.push({
      dateKey: key,
      dayNum: parts.day,
      dayNumFa: toPersianDigits(parts.day),
      weekdayIndex: getPersianWeekdayIndex(cursor),
      isToday: key === todayKey,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  let monthTitle = '';
  let yearFa = '';
  try {
    monthTitle = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long' }).format(firstDate);
    yearFa = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric' }).format(firstDate);
  } catch {
    monthTitle = 'ماه';
    yearFa = '';
  }

  return {
    monthTitle,
    yearFa,
    firstDayKey: days[0]?.dateKey || referenceDateKey,
    lastDayKey: days[days.length - 1]?.dateKey || referenceDateKey,
    leadingEmptyCells: days[0]?.weekdayIndex ?? 0,
    days,
  };
}

export function shiftJalaliMonthKey(referenceDateKey: string, delta: -1 | 1): string {
  const info = getJalaliMonthInfo(referenceDateKey);
  if (delta === -1) {
    return addDaysToDateKey(info.firstDayKey, -1);
  }
  return addDaysToDateKey(info.lastDayKey, 1);
}

export function getTimeBlockFromTime(timeStr: string): TimeBlock {
  if (!timeStr) return 'anytime';
  const [hStr] = timeStr.split(':');
  const h = Number(hStr);
  if (Number.isNaN(h)) return 'anytime';
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 16) return 'noon';
  if (h >= 16 && h < 20) return 'evening';
  return 'night';
}

export function formatClockFa(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return toPersianDigits(`${h}:${m}`);
}

export function formatSecondsClockFa(date: Date = new Date()): { hm: string; sec: string } {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return {
    hm: toPersianDigits(`${h}:${m}`),
    sec: toPersianDigits(s),
  };
}

export function formatJalaliShortLabel(dateKey: string): string {
  if (!dateKey) return 'بدون تاریخ (صندوق ذهن)';
  const todayKey = getLocalDateKey(new Date());
  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  const afterTomorrowKey = addDaysToDateKey(todayKey, 2);
  const parts = getJalaliDayParts(dateKey);
  const full = `${parts.weekdayLong} ${parts.dayNum} ${parts.monthName}`;
  if (dateKey === todayKey) return `امروز · ${parts.dayNum} ${parts.monthName}`;
  if (dateKey === tomorrowKey) return `فردا · ${full}`;
  if (dateKey === afterTomorrowKey) return `پس‌فردا · ${full}`;
  return full;
}

export interface ParsedQuickCapture {
  title: string;
  category: MemoryCategory;
  phoneNumber?: string;
  contactName?: string;
  locationHint?: string;
  nextStepTitle?: string;
  priority: 'normal' | 'important';
  timeStr: string;
  dateStr: string;
  dateLabelFa: string;
  timeBlock: TimeBlock;
  pinnedToWidget: boolean;
  detectedHints: string[];
}

function getNextPersianWeekdayDateKey(targetPersianIndex: number): string {
  const now = new Date();
  const currentIdx = getPersianWeekdayIndex(now);
  let diff = (targetPersianIndex - currentIdx + 7) % 7;
  if (diff === 0) diff = 7;
  return addDaysToDateKey(getLocalDateKey(now), diff);
}

export function parseQuickCapture(rawInput: string, activeDateKey?: string): ParsedQuickCapture {
  const normalized = toEnglishDigits(rawInput).trim();
  const hints: string[] = [];
  let workingText = normalized;
  let phoneNumber: string | undefined;
  let contactName: string | undefined;
  let locationHint: string | undefined;
  let nextStepTitle: string | undefined;
  let dateStr = activeDateKey || getLocalDateKey(new Date());
  let explicitDateMatched = false;
  let timeStr = '';
  let priority: 'normal' | 'important' = 'normal';

  // 0. Detect chained/dependent reminder ("بعد از X، Y" or "پس از انجام X، Y")
  const chainMatch = workingText.match(/^(?:بعد\s*از|پس\s*از)(?:\s*انجام)?\s+(.+?)[،,;:\-]+\s*(.+)$/);
  if (chainMatch && chainMatch[1].trim().length >= 2 && chainMatch[2].trim().length >= 2) {
    workingText = chainMatch[1].trim();
    nextStepTitle = chainMatch[2].trim();
    hints.push(`مرحله بعد: ${nextStepTitle}`);
  }

  // 1. Detect importance words
  if (/(?:مهم|فوری|ضروری|حتما|حتماً|اورژانسی)/.test(workingText)) {
    priority = 'important';
    hints.push('اولویت مهم');
    workingText = workingText.replace(/(?:خیلی\s*)?(?:مهم|فوری|ضروری|حتما|حتماً|اورژانسی)/g, ' ');
  }

  // 2. Detect Iranian mobile / landline / international phone numbers
  const phoneRegex = /(?:\+98|0098|0)?9\d{9}|0\d{2,3}[-\s]?\d{7,8}|\b\d{8,11}\b/;
  const phoneMatch = workingText.match(phoneRegex);
  if (phoneMatch) {
    phoneNumber = phoneMatch[0].replace(/[-\s]/g, '');
    hints.push(`شماره ${toPersianDigits(phoneNumber)}`);
    workingText = workingText.replace(phoneMatch[0], ' ');
    const cleanedContact = workingText
      .replace(/(?:شماره|تلفن|موبایل|زنگ به|زنگ بزن|تماس با)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanedContact.length >= 2) {
      contactName = cleanedContact;
    }
  }

  // 3. Detect relative time ("15 دقیقه دیگه", "نیم ساعت دیگه", "1 ساعت دیگه")
  const now = new Date();
  const minMatch = workingText.match(/(\d+)\s*دقیقه\s*(?:دیگه|دیگر|بعد)/);
  const hourMatch = workingText.match(/(\d+)\s*ساعت\s*(?:دیگه|دیگر|بعد)/);
  if (minMatch) {
    const mins = Math.min(Number(minMatch[1]), 600);
    const target = new Date(now.getTime() + mins * 60000);
    timeStr = `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`;
    dateStr = getLocalDateKey(target);
    explicitDateMatched = true;
    workingText = workingText.replace(minMatch[0], ' ');
    hints.push(`ساعت ${toPersianDigits(timeStr)}`);
  } else if (/نیم\s*ساعت\s*(?:دیگه|دیگر|بعد)/.test(workingText)) {
    const target = new Date(now.getTime() + 30 * 60000);
    timeStr = `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`;
    dateStr = getLocalDateKey(target);
    explicitDateMatched = true;
    workingText = workingText.replace(/نیم\s*ساعت\s*(?:دیگه|دیگر|بعد)/, ' ');
    hints.push(`ساعت ${toPersianDigits(timeStr)}`);
  } else if (hourMatch) {
    const hrs = Math.min(Number(hourMatch[1]), 24);
    const target = new Date(now.getTime() + hrs * 3600000);
    timeStr = `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`;
    dateStr = getLocalDateKey(target);
    explicitDateMatched = true;
    workingText = workingText.replace(hourMatch[0], ' ');
    hints.push(`ساعت ${toPersianDigits(timeStr)}`);
  }

  // 4. Detect explicit HH:MM or "ساعت 8" / "ساعت 8 و نیم" / "ساعت 8 شب"
  if (!timeStr) {
    const hhmm = workingText.match(/(?:ساعت\s*)?\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    const saat = workingText.match(/ساعت\s*([01]?\d|2[0-3])(?:\s*و\s*(نیم))?(?:\s*(صبح|ظهر|عصر|شب|بعدازظهر))?/);
    if (hhmm) {
      let hr = Number(hhmm[1]);
      if (/(?:شب|عصر|بعدازظهر)/.test(workingText) && hr >= 1 && hr <= 11) {
        hr += 12;
      }
      timeStr = `${String(hr).padStart(2, '0')}:${hhmm[2]}`;
      workingText = workingText.replace(hhmm[0], ' ');
      hints.push(`ساعت ${toPersianDigits(timeStr)}`);
    } else if (saat) {
      let hr = Number(saat[1]);
      const periodHint = saat[3] || '';
      if ((/شب|عصر|بعدازظهر/.test(periodHint) || /شب|عصر|بعدازظهر/.test(workingText)) && hr >= 1 && hr <= 11) {
        hr += 12;
      } else if (periodHint === 'ظهر' && hr >= 1 && hr <= 4) {
        hr += 12;
      }
      const mins = saat[2] ? '30' : '00';
      timeStr = `${String(hr).padStart(2, '0')}:${mins}`;
      workingText = workingText.replace(saat[0], ' ');
      hints.push(`ساعت ${toPersianDigits(timeStr)}`);
    }
  }

  // 5. Detect date expressions ("پس‌فردا", "فردا", "امروز", weekdays)
  const todayKey = getLocalDateKey(new Date());
  if (/پس[\s‌]*فردا/.test(workingText)) {
    dateStr = addDaysToDateKey(todayKey, 2);
    explicitDateMatched = true;
    workingText = workingText.replace(/پس[\s‌]*فردا/g, ' ');
    hints.push('پس‌فردا');
  } else if (/فردا/.test(workingText)) {
    dateStr = addDaysToDateKey(todayKey, 1);
    explicitDateMatched = true;
    workingText = workingText.replace(/فردا/g, ' ');
    hints.push('فردا');
  } else if (/امروز/.test(workingText)) {
    dateStr = todayKey;
    explicitDateMatched = true;
    workingText = workingText.replace(/امروز/g, ' ');
  } else {
    const weekdayPatterns: { regex: RegExp; idx: number; label: string }[] = [
      { regex: /چهار[\s‌]*شنبه/, idx: 4, label: 'چهارشنبه' },
      { regex: /پنج[\s‌]*شنبه/, idx: 5, label: 'پنج‌شنبه' },
      { regex: /سه[\s‌]*شنبه/, idx: 3, label: 'سه‌شنبه' },
      { regex: /دو[\s‌]*شنبه/, idx: 2, label: 'دوشنبه' },
      { regex: /یک[\s‌]*شنبه/, idx: 1, label: 'یکشنبه' },
      { regex: /جمعه/, idx: 6, label: 'جمعه' },
      { regex: /شنبه/, idx: 0, label: 'شنبه' },
    ];
    for (const wp of weekdayPatterns) {
      if (wp.regex.test(workingText)) {
        dateStr = getNextPersianWeekdayDateKey(wp.idx);
        explicitDateMatched = true;
        workingText = workingText.replace(wp.regex, ' ');
        hints.push(wp.label);
        break;
      }
    }
  }

  // 6. Detect "کجا گذاشتم؟" location pattern ("X را گذاشتم توی Y" / "محل X: Y")
  const putMatch = workingText.match(/^(.+?)\s*(?:رو|را)?\s*(?:گذاشتم|قرار\s*دادم|هست|توی|در)\s+(.+)$/);
  if (
    putMatch &&
    /کلید|عینک|کیف|مدارک|پاسپورت|ساعت|کارت|گوشی|دفتر|کنترل|شارژر|کفش|گذاشتم/.test(normalized)
  ) {
    locationHint = putMatch[2].trim();
  }

  // 7. Detect category
  let category: MemoryCategory = phoneNumber ? 'phone' : 'idea';
  let pinnedToWidget = Boolean(phoneNumber);

  if (!phoneNumber) {
    if (/باشگاه|ورزش|تمرین|دویدن|پیاده‌روی|پیاده روی|یوگا|شنا|بدنسازی|کشش/.test(normalized)) {
      category = 'fitness';
      hints.push('دسته: ورزشی');
    } else if (/دارو|قرص|ویتامین|دکتر|ویزیت|آزمایش|آب|فشار|پزشک|کپسول|شربت/.test(normalized)) {
      category = 'health';
      pinnedToWidget = true;
      hints.push('دسته: دارو و سلامت');
    } else if (/کلید|پارکینگ|طبقه|رمز|کارت|عینک|کیف|مدارک|گذاشتم|پلاک|پاسپورت|شارژر/.test(normalized)) {
      category = 'anchor';
      pinnedToWidget = true;
      hints.push('دسته: کجا گذاشتم / لنگر حافظه');
    } else if (/خرید|نان|شیر|میوه|سوپر|قبض|پست|سبزی|مرغ|گوشت|داروخانه/.test(normalized)) {
      category = 'errand';
      hints.push('دسته: خرید و روزمره');
    } else if (/جلسه|گزارش|ایمیل|پروژه|اداره|بانک|فاکتور|چک|مشتری|قرار|کار/.test(normalized)) {
      category = 'work';
      hints.push('دسته: کاری');
    } else if (/تماس|زنگ|تلفن|پیام/.test(normalized)) {
      category = 'phone';
      hints.push('دسته: تماس');
    } else if (timeStr || explicitDateMatched) {
      category = 'work';
    }
  }

  // Clean residual phrasing for title preview
  let cleanTitle = workingText
    .replace(/\b(?:صبح|ظهر|عصر|شب|به من یادآوری کن|یادم بنداز|یادآوری کن|لطفا|لطفاً)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[،,:\-\s]+|[،,:\-\s]+$/g, '')
    .trim();

  if (phoneNumber) {
    cleanTitle = contactName
      ? `تماس با ${contactName}`
      : `شماره ثبت‌شده ${toPersianDigits(phoneNumber)}`;
  } else if (!cleanTitle) {
    cleanTitle = rawInput.trim();
  }

  const timeBlock: TimeBlock = timeStr
    ? getTimeBlockFromTime(timeStr)
    : /صبح/.test(normalized)
      ? 'morning'
      : /ظهر/.test(normalized)
        ? 'noon'
        : /عصر/.test(normalized)
          ? 'evening'
          : /شب/.test(normalized)
            ? 'night'
            : 'anytime';

  const finalDateStr = category === 'anchor' && !timeStr && !explicitDateMatched ? '' : dateStr;

  return {
    title: cleanTitle,
    category,
    phoneNumber,
    contactName,
    locationHint,
    nextStepTitle,
    priority,
    timeStr,
    dateStr: finalDateStr,
    dateLabelFa: formatJalaliShortLabel(finalDateStr),
    timeBlock,
    pinnedToWidget,
    detectedHints: hints,
  };
}

export interface BrainDumpCandidate {
  id: string;
  rawLine: string;
  parsed: ParsedQuickCapture;
  kindLabel: 'یادآور زمان‌دار' | 'تماس' | 'مکان شیء' | 'کار روزانه' | 'یادداشت';
}

export function parseBrainDumpLines(multiLineText: string, activeDateKey?: string): BrainDumpCandidate[] {
  const lines = multiLineText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return lines.map((line, idx) => {
    const parsed = parseQuickCapture(line, activeDateKey);
    let kindLabel: BrainDumpCandidate['kindLabel'] = 'یادداشت';
    if (parsed.phoneNumber || parsed.category === 'phone') {
      kindLabel = 'تماس';
    } else if (parsed.category === 'anchor') {
      kindLabel = 'مکان شیء';
    } else if (parsed.timeStr) {
      kindLabel = 'یادآور زمان‌دار';
    } else if (parsed.category !== 'idea') {
      kindLabel = 'کار روزانه';
    }
    return {
      id: `dump-${idx}-${line.slice(0, 10)}`,
      rawLine: line,
      parsed,
      kindLabel,
    };
  });
}

export const CATEGORY_META: Record<
  MemoryCategory,
  { label: string; shortLabel: string; colorClass: string; softBgClass: string }
> = {
  work: {
    label: 'کاری و اداری',
    shortLabel: 'کاری',
    colorClass: 'text-sky-700 dark:text-sky-300',
    softBgClass: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
  },
  fitness: {
    label: 'ورزشی و تحرک',
    shortLabel: 'ورزشی',
    colorClass: 'text-emerald-700 dark:text-emerald-300',
    softBgClass: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  },
  health: {
    label: 'دارو و سلامت',
    shortLabel: 'سلامت',
    colorClass: 'text-rose-700 dark:text-rose-300',
    softBgClass: 'bg-rose-500/12 text-rose-700 dark:text-rose-300',
  },
  phone: {
    label: 'شماره و تماس',
    shortLabel: 'تماس',
    colorClass: 'text-amber-700 dark:text-amber-300',
    softBgClass: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
  },
  errand: {
    label: 'خرید و روزمره',
    shortLabel: 'خرید',
    colorClass: 'text-teal-700 dark:text-teal-300',
    softBgClass: 'bg-teal-500/12 text-teal-700 dark:text-teal-300',
  },
  anchor: {
    label: 'لنگر حافظه (اشیا و مکان)',
    shortLabel: 'لنگر حافظه',
    colorClass: 'text-indigo-700 dark:text-indigo-300',
    softBgClass: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300',
  },
  idea: {
    label: 'یادداشت و ایده لحظه‌ای',
    shortLabel: 'یادداشت',
    colorClass: 'text-slate-700 dark:text-slate-300',
    softBgClass: 'bg-slate-500/12 text-slate-700 dark:text-slate-300',
  },
};

export const TIME_BLOCK_LABELS: Record<TimeBlock, string> = {
  morning: 'صبح',
  noon: 'ظهر',
  evening: 'عصر',
  night: 'شب',
  anytime: 'هر زمان',
};
