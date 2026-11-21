import { toPersianDigits } from '../utils/dateFa';

export interface IranCalendarEvent {
  title: string;
  isHoliday: boolean;
  source: 'jalali' | 'hijri';
}

export interface DateEventsSummary {
  jalaliMonth: number;
  jalaliDay: number;
  jalaliYear: number;
  hijriLabel: string;
  gregorianLabel: string;
  isFriday: boolean;
  isOfficialHoliday: boolean;
  events: IranCalendarEvent[];
}

// Fixed Solar Hijri (Jalali) Iranian official holidays & key cultural occasions
// Key format: "MM-DD"
const JALALI_FIXED_EVENTS: Record<string, IranCalendarEvent[]> = {
  '01-01': [{ title: 'آغاز نوروز', isHoliday: true, source: 'jalali' }],
  '01-02': [{ title: 'عید نوروز', isHoliday: true, source: 'jalali' }],
  '01-03': [{ title: 'عید نوروز', isHoliday: true, source: 'jalali' }],
  '01-04': [{ title: 'عید نوروز', isHoliday: true, source: 'jalali' }],
  '01-12': [{ title: 'روز جمهوری اسلامی ایران', isHoliday: true, source: 'jalali' }],
  '01-13': [{ title: 'روز طبیعت (سیزده‌بدر)', isHoliday: true, source: 'jalali' }],
  '01-25': [{ title: 'روز بزرگداشت عطار نیشابوری', isHoliday: false, source: 'jalali' }],
  '02-01': [{ title: 'روز بزرگداشت سعدی', isHoliday: false, source: 'jalali' }],
  '02-10': [{ title: 'روز ملی خلیج فارس', isHoliday: false, source: 'jalali' }],
  '02-12': [{ title: 'روز معلم', isHoliday: false, source: 'jalali' }],
  '02-25': [{ title: 'روز پاسداشت زبان فارسی و بزرگداشت فردوسی', isHoliday: false, source: 'jalali' }],
  '02-28': [{ title: 'روز بزرگداشت حکیم عمر خیام', isHoliday: false, source: 'jalali' }],
  '03-14': [{ title: 'رحلت امام خمینی (ره)', isHoliday: true, source: 'jalali' }],
  '03-15': [{ title: 'قیام خونین ۱۵ خرداد', isHoliday: true, source: 'jalali' }],
  '04-10': [{ title: 'جشن تیرگان', isHoliday: false, source: 'jalali' }],
  '05-07': [{ title: 'جشن امردادگان', isHoliday: false, source: 'jalali' }],
  '06-27': [{ title: 'روز شعر و ادب فارسی (بزرگداشت شهریار)', isHoliday: false, source: 'jalali' }],
  '07-01': [{ title: 'آغاز سال تحصیلی', isHoliday: false, source: 'jalali' }],
  '07-08': [{ title: 'روز بزرگداشت مولوی', isHoliday: false, source: 'jalali' }],
  '07-16': [{ title: 'جشن مهرگان', isHoliday: false, source: 'jalali' }],
  '07-20': [{ title: 'روز بزرگداشت حافظ', isHoliday: false, source: 'jalali' }],
  '08-07': [{ title: 'روز بزرگداشت کوروش بزرگ', isHoliday: false, source: 'jalali' }],
  '08-13': [{ title: 'روز دانش‌آموز', isHoliday: false, source: 'jalali' }],
  '09-10': [{ title: 'شهادت آیت‌الله مدرس و روز مجلس', isHoliday: false, source: 'jalali' }],
  '09-16': [{ title: 'روز دانشجو', isHoliday: false, source: 'jalali' }],
  '09-30': [{ title: 'شب یلدا (جشن شب چله)', isHoliday: false, source: 'jalali' }],
  '10-10': [{ title: 'روز ایمنی در برابر زلزله', isHoliday: false, source: 'jalali' }],
  '10-13': [{ title: 'سالروز شهادت سردار قاسم سلیمانی', isHoliday: false, source: 'jalali' }],
  '10-19': [{ title: 'قیام خونین مردم قم', isHoliday: false, source: 'jalali' }],
  '11-10': [{ title: 'جشن سده', isHoliday: false, source: 'jalali' }],
  '11-12': [{ title: 'بازگشت امام خمینی (ره) و آغاز دهه فجر', isHoliday: false, source: 'jalali' }],
  '11-22': [{ title: 'پیروزی انقلاب اسلامی', isHoliday: true, source: 'jalali' }],
  '11-29': [{ title: 'جشن سپندارمذگان (روز عشق ایرانی)', isHoliday: false, source: 'jalali' }],
  '12-05': [{ title: 'روز مهندس (بزرگداشت خواجه نصیرالدین طوسی)', isHoliday: false, source: 'jalali' }],
  '12-29': [{ title: 'روز ملی شدن صنعت نفت ایران', isHoliday: true, source: 'jalali' }],
};

// Verified official 1405 Iranian lunar holidays & key occasions mapped to Jalali "MM-DD"
// Source: Official Iranian Calendar 1405 (Geophysics Institute, University of Tehran)
const OFFICIAL_1405_LUNAR_EVENTS: Record<string, IranCalendarEvent[]> = {
  '01-01': [{ title: 'عید سعید فطر (۱ شوال)', isHoliday: true, source: 'hijri' }],
  '01-02': [{ title: 'تعطیلات عید سعید فطر (۲ شوال)', isHoliday: true, source: 'hijri' }],
  '01-25': [{ title: 'شهادت امام جعفر صادق (ع)', isHoliday: true, source: 'hijri' }],
  '03-06': [{ title: 'عید سعید قربان', isHoliday: true, source: 'hijri' }],
  '03-14': [{ title: 'عید سعید غدیر خم', isHoliday: true, source: 'hijri' }],
  '04-03': [{ title: 'تاسوعای حسینی', isHoliday: true, source: 'hijri' }],
  '04-04': [{ title: 'عاشورای حسینی', isHoliday: true, source: 'hijri' }],
  '05-13': [{ title: 'اربعین حسینی', isHoliday: true, source: 'hijri' }],
  '05-21': [{ title: 'رحلت پیامبر اکرم (ص) و شهادت امام حسن مجتبی (ع)', isHoliday: true, source: 'hijri' }],
  '05-23': [{ title: 'شهادت امام رضا (ع)', isHoliday: true, source: 'hijri' }],
  '05-30': [{ title: 'شهادت امام حسن عسکری (ع)', isHoliday: true, source: 'hijri' }],
  '06-08': [{ title: 'ولادت پیامبر اکرم (ص) و امام جعفر صادق (ع)', isHoliday: true, source: 'hijri' }],
  '08-22': [{ title: 'شهادت حضرت فاطمه زهرا (س)', isHoliday: true, source: 'hijri' }],
  '09-09': [{ title: 'ولادت حضرت فاطمه زهرا (س) و روز زن و مادر', isHoliday: false, source: 'hijri' }],
  '10-02': [{ title: 'ولادت امام علی (ع) و روز پدر', isHoliday: true, source: 'hijri' }],
  '10-16': [{ title: 'مبعث پیامبر اکرم (ص)', isHoliday: true, source: 'hijri' }],
  '10-22': [{ title: 'ولادت امام حسین (ع) و روز پاسدار', isHoliday: false, source: 'hijri' }],
  '11-04': [{ title: 'ولادت حضرت مهدی (عج) — نیمه شعبان', isHoliday: true, source: 'hijri' }],
  '12-07': [{ title: 'ضربت خوردن امام علی (ع)', isHoliday: false, source: 'hijri' }],
  '12-09': [{ title: 'شهادت امام علی (ع)', isHoliday: true, source: 'hijri' }],
  '12-19': [{ title: 'عید سعید فطر', isHoliday: true, source: 'hijri' }],
  '12-20': [{ title: 'تعطیل به مناسبت عید سعید فطر', isHoliday: true, source: 'hijri' }],
};

// Dynamic Lunar Hijri fallback for non-1405 years (1404, 1406, ...)
const HIJRI_DYNAMIC_EVENTS: Record<string, IranCalendarEvent[]> = {
  '01-01': [{ title: 'آغاز سال هجری قمری', isHoliday: false, source: 'hijri' }],
  '01-09': [{ title: 'تاسوعای حسینی', isHoliday: true, source: 'hijri' }],
  '01-10': [{ title: 'عاشورای حسینی', isHoliday: true, source: 'hijri' }],
  '02-20': [{ title: 'اربعین حسینی', isHoliday: true, source: 'hijri' }],
  '02-28': [{ title: 'رحلت پیامبر اکرم (ص) و شهادت امام حسن مجتبی (ع)', isHoliday: true, source: 'hijri' }],
  '02-30': [{ title: 'شهادت امام رضا (ع)', isHoliday: true, source: 'hijri' }],
  '03-08': [{ title: 'شهادت امام حسن عسکری (ع)', isHoliday: true, source: 'hijri' }],
  '03-12': [{ title: 'آغاز هفته وحدت', isHoliday: false, source: 'hijri' }],
  '03-17': [{ title: 'ولادت پیامبر اکرم (ص) و امام جعفر صادق (ع)', isHoliday: true, source: 'hijri' }],
  '06-03': [{ title: 'شهادت حضرت فاطمه زهرا (س)', isHoliday: true, source: 'hijri' }],
  '06-20': [{ title: 'ولادت حضرت فاطمه زهرا (س) و روز زن و مادر', isHoliday: false, source: 'hijri' }],
  '07-13': [{ title: 'ولادت امام علی (ع) و روز پدر', isHoliday: true, source: 'hijri' }],
  '07-27': [{ title: 'مبعث پیامبر اکرم (ص)', isHoliday: true, source: 'hijri' }],
  '08-15': [{ title: 'ولادت حضرت مهدی (عج) — نیمه شعبان', isHoliday: true, source: 'hijri' }],
  '09-19': [{ title: 'ضربت خوردن امام علی (ع)', isHoliday: false, source: 'hijri' }],
  '09-21': [{ title: 'شهادت امام علی (ع)', isHoliday: true, source: 'hijri' }],
  '10-01': [{ title: 'عید سعید فطر', isHoliday: true, source: 'hijri' }],
  '10-02': [{ title: 'تعطیلات عید سعید فطر', isHoliday: true, source: 'hijri' }],
  '10-25': [{ title: 'شهادت امام جعفر صادق (ع)', isHoliday: true, source: 'hijri' }],
  '12-10': [{ title: 'عید سعید قربان', isHoliday: true, source: 'hijri' }],
  '12-18': [{ title: 'عید سعید غدیر خم', isHoliday: true, source: 'hijri' }],
};

const HIJRI_MONTHS_FA = [
  'محرم',
  'صفر',
  'ربیع‌الاول',
  'ربیع‌الثانی',
  'جمادی‌الاول',
  'جمادی‌الثانی',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذی‌القعده',
  'ذی‌الحجه',
];

function getNumericCalendarParts(
  date: Date,
  calendar: 'persian' | 'islamic' | 'islamic-umalqura'
): { year: number; month: number; day: number } {
  try {
    const fmt = new Intl.DateTimeFormat(`en-US-u-ca-${calendar}`, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const parts = fmt.formatToParts(date);
    const year = Number(parts.find((p) => p.type === 'year')?.value || 0);
    const month = Number(parts.find((p) => p.type === 'month')?.value || 1);
    const day = Number(parts.find((p) => p.type === 'day')?.value || 1);
    return { year, month, day };
  } catch {
    return { year: 0, month: 1, day: 1 };
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function getIranDateDetails(dateKey: string): DateEventsSummary {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);

  const jalali = getNumericCalendarParts(dt, 'persian');
  let hijri = getNumericCalendarParts(dt, 'islamic');
  if (!hijri.year) {
    hijri = getNumericCalendarParts(dt, 'islamic-umalqura');
  }
  const isFriday = dt.getDay() === 5;

  const jalaliKey = `${pad2(jalali.month)}-${pad2(jalali.day)}`;
  const hijriKey = `${pad2(hijri.month)}-${pad2(hijri.day)}`;

  const events: IranCalendarEvent[] = [...(JALALI_FIXED_EVENTS[jalaliKey] || [])];

  if (jalali.year === 1405) {
    events.push(...(OFFICIAL_1405_LUNAR_EVENTS[jalaliKey] || []));
  } else {
    events.push(...(HIJRI_DYNAMIC_EVENTS[hijriKey] || []));
    // Handle 29-day Safar where 30 Safar (Imam Reza) shifts to 29 Safar
    if (hijri.month === 2 && hijri.day === 29) {
      const nextDay = new Date(dt);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextHijri = getNumericCalendarParts(nextDay, 'islamic');
      if (nextHijri.month === 3) {
        events.push(...(HIJRI_DYNAMIC_EVENTS['02-30'] || []));
      }
    }
  }

  // Chaharshanbe Suri (last Tuesday before Nowruz)
  if (jalali.month === 12 && dt.getDay() === 2) {
    const nextWeek = new Date(dt);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekJalali = getNumericCalendarParts(nextWeek, 'persian');
    if (nextWeekJalali.month === 1) {
      events.push({
        title: 'چهارشنبه‌سوری (غروب سه‌شنبه پایانی سال)',
        isHoliday: false,
        source: 'jalali',
      });
    }
  }

  const hijriMonthName = HIJRI_MONTHS_FA[hijri.month - 1] || '';
  const hijriLabel = hijri.year
    ? `${toPersianDigits(hijri.day)} ${hijriMonthName} ${toPersianDigits(hijri.year)}`
    : '';

  let gregorianLabel = '';
  try {
    gregorianLabel = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(dt);
  } catch {
    gregorianLabel = dateKey;
  }

  const isOfficialHoliday = events.some((e) => e.isHoliday);

  return {
    jalaliMonth: jalali.month,
    jalaliDay: jalali.day,
    jalaliYear: jalali.year,
    hijriLabel,
    gregorianLabel,
    isFriday,
    isOfficialHoliday,
    events,
  };
}
