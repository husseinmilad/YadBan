import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Link2,
  Mic,
  Pin,
  Repeat,
  ScanText,
  X,
} from 'lucide-react';
import { getIranDateDetails } from '../data/iranCalendarEvents';
import {
  CustomCategory,
  MemoryCategory,
  MemoryItem,
  TaskTemplate,
  TimeBlock,
} from '../types/memory';
import {
  addDaysToDateKey,
  CATEGORY_META,
  formatJalaliShortLabel,
  getJalaliDayParts,
  getJalaliMonthInfo,
  getLocalDateKey,
  getTimeBlockFromTime,
  parseQuickCapture,
  shiftJalaliMonthKey,
  toEnglishDigits,
  toPersianDigits,
} from '../utils/dateFa';
import { AiImageAnalysisResult } from '../utils/mediaStorage';
import { dictatePersianText } from '../utils/nativeBridge';
import { CategoryIcon } from './CategoryIcon';
import { PhotoAttachmentControl } from './PhotoAttachmentControl';
import { VoiceRecorderControl } from './VoiceRecorderControl';

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Omit<MemoryItem, 'id' | 'createdAt'>, existingId?: string) => void;
  initialItem?: MemoryItem | null;
  defaultDateKey: string;
  initialRawText?: string;
  initialCategory?: MemoryCategory;
  customCategories?: CustomCategory[];
  templates?: TaskTemplate[];
  existingItems?: MemoryItem[];
  enablePhotoOcr?: boolean;
}

const CATEGORIES: MemoryCategory[] = [
  'work',
  'fitness',
  'health',
  'phone',
  'errand',
  'anchor',
  'idea',
];

const WEEKDAY_HEADERS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

type TimePresetId = '15m' | '1h' | 'evening' | 'tomorrow9' | null;

const CATEGORY_FORM_CONFIG: Record<
  MemoryCategory,
  {
    titleLabel: string;
    titlePlaceholder: string;
    subTypes: string[];
  }
> = {
  health: {
    titleLabel: 'نام دارو، مکمل یا قرار پزشکی',
    titlePlaceholder: 'مثلاً: قرص ویتامین D، اسپری آسم یا ویزیت دندانپزشک',
    subTypes: ['مصرف دارو', 'ویتامین و مکمل', 'نوبت پزشک', 'آزمایش / چکاپ', 'نوشیدن آب'],
  },
  work: {
    titleLabel: 'عنوان کار، جلسه یا پیگیری اداری',
    titlePlaceholder: 'مثلاً: ارسال گزارش ماهانه یا فردا ساعت ۸ جلسه با تیم فنی',
    subTypes: ['جلسه', 'کار اداری و بانکی', 'پیگیری', 'تحویل پروژه'],
  },
  fitness: {
    titleLabel: 'نام تمرین یا فعالیت ورزشی',
    titlePlaceholder: 'مثلاً: پیاده‌روی عصرگاهی یا تمرین بالاتنه در باشگاه',
    subTypes: ['پیاده‌روی', 'باشگاه و وزنه', 'دویدن', 'کشش و یوگا', 'شنا'],
  },
  phone: {
    titleLabel: 'موضوع تماس یا نام مخاطب',
    titlePlaceholder: 'مثلاً: تماس با اداره یا مهندس کریمی ۰۹۱۲...',
    subTypes: ['تماس ضروری', 'پیگیری اداری', 'شماره خدمات', 'تماس خانوادگی'],
  },
  errand: {
    titleLabel: 'فهرست خرید یا کار روزمره',
    titlePlaceholder: 'مثلاً: فردا ساعت ۸ قبض را پرداخت کنم',
    subTypes: ['خرید روزانه', 'داروخانه', 'پرداخت قبض', 'آماده‌سازی سفر'],
  },
  anchor: {
    titleLabel: 'نام وسیله، رمز یا نکته‌ای که نباید فراموش شود',
    titlePlaceholder: 'مثلاً: عینک مطالعه، کلید یدک یا طبقه پارکینگ',
    subTypes: ['جای وسایل', 'پارکینگ خودرو', 'رمز و کارت', 'مدارک'],
  },
  idea: {
    titleLabel: 'متن یادداشت، ایده یا نکته لحظه‌ای',
    titlePlaceholder: 'مثلاً: ایده هدیه یا عنوان کتابی که باید بخوانم',
    subTypes: ['ایده شخصی', 'کتاب و فیلم', 'نکته مهم', 'فهرست کوتاه'],
  },
};

export const QuickCaptureModal: React.FC<QuickCaptureModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialItem,
  defaultDateKey,
  initialRawText = '',
  initialCategory,
  customCategories = [],
  templates = [],
  existingItems = [],
  enablePhotoOcr = true,
}) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<MemoryCategory>('work');
  const [customCategoryId, setCustomCategoryId] = useState<string | undefined>(undefined);
  const [dateStr, setDateStr] = useState(defaultDateKey);
  const [timeStr, setTimeStr] = useState('');
  const [repeatDaily, setRepeatDaily] = useState(false);
  const [repeatUntilDone, setRepeatUntilDone] = useState(false);
  const [priority, setPriority] = useState<'normal' | 'important'>('normal');
  const [preReminderMinutes, setPreReminderMinutes] = useState<0 | 5 | 10 | 15>(10);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [contactName, setContactName] = useState('');
  const [locationHint, setLocationHint] = useState('');
  const [subType, setSubType] = useState('');
  const [dosage, setDosage] = useState('');
  const [mealTiming, setMealTiming] = useState('');
  const [durationOrQty, setDurationOrQty] = useState('');
  const [personOrPlace, setPersonOrPlace] = useState('');
  const [pinnedToWidget, setPinnedToWidget] = useState(false);
  const [voiceNoteId, setVoiceNoteId] = useState<string | undefined>(undefined);
  const [voiceDurationSec, setVoiceDurationSec] = useState<number | undefined>(undefined);
  const [photoId, setPhotoId] = useState<string | undefined>(undefined);
  const [photoText, setPhotoText] = useState<string | undefined>(undefined);
  const [dependsOnId, setDependsOnId] = useState<string>('');
  const [nextStepTitle, setNextStepTitle] = useState<string>('');
  const [userTouchedCategory, setUserTouchedCategory] = useState(false);

  const [selectedTimePreset, setSelectedTimePreset] = useState<TimePresetId>(null);
  const [showJalaliCalendar, setShowJalaliCalendar] = useState(false);
  const [calendarRefKey, setCalendarRefKey] = useState(defaultDateKey);
  const [isDictating, setIsDictating] = useState(false);
  const [dictateError, setDictateError] = useState('');
  const photoSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const todayKey = getLocalDateKey(new Date());
    setShowJalaliCalendar(false);
    setDictateError('');
    setIsDictating(false);

    if (initialItem) {
      setTitle(initialItem.title);
      setNotes(initialItem.notes || '');
      setCategory(initialItem.category);
      setCustomCategoryId(initialItem.customCategoryId);
      const itemDate = initialItem.dateStr || defaultDateKey || todayKey;
      setDateStr(itemDate);
      setCalendarRefKey(itemDate);
      setTimeStr(initialItem.timeStr);
      setRepeatDaily(initialItem.repeatDaily);
      setRepeatUntilDone(Boolean(initialItem.repeatUntilDone));
      setPriority(initialItem.priority || 'normal');
      setPreReminderMinutes(initialItem.preReminderMinutes);
      setPhoneNumber(initialItem.phoneNumber || '');
      setContactName(initialItem.contactName || '');
      setLocationHint(initialItem.locationHint || '');
      setSubType(initialItem.subType || '');
      setDosage(initialItem.dosage || '');
      setMealTiming(initialItem.mealTiming || '');
      setDurationOrQty(initialItem.durationOrQty || '');
      setPersonOrPlace(initialItem.personOrPlace || '');
      setPinnedToWidget(initialItem.pinnedToWidget);
      setVoiceNoteId(initialItem.voiceNoteId);
      setVoiceDurationSec(initialItem.voiceDurationSec);
      setPhotoId(initialItem.photoId);
      setPhotoText(initialItem.photoText);
      setDependsOnId(initialItem.dependsOnId || '');
      setNextStepTitle(initialItem.nextStepTitle || '');
      setUserTouchedCategory(true);
      setSelectedTimePreset(null);
    } else {
      const startCat = initialCategory || 'work';
      const storageOnly = startCat === 'phone' || startCat === 'anchor' || startCat === 'idea';
      const startDate = defaultDateKey || todayKey;
      setTitle(initialRawText);
      setNotes('');
      setCategory(startCat);
      setCustomCategoryId(undefined);
      setDateStr(startDate);
      setCalendarRefKey(startDate);
      setTimeStr('');
      setRepeatDaily(false);
      setRepeatUntilDone(false);
      setPriority('normal');
      setPreReminderMinutes(storageOnly ? 0 : 10);
      setPhoneNumber('');
      setContactName('');
      setLocationHint('');
      setSubType('');
      setDosage('');
      setMealTiming('');
      setDurationOrQty('');
      setPersonOrPlace('');
      setPinnedToWidget(startCat === 'anchor' || startCat === 'health' || startCat === 'phone');
      setVoiceNoteId(undefined);
      setVoiceDurationSec(undefined);
      setPhotoId(undefined);
      setPhotoText(undefined);
      setDependsOnId('');
      setNextStepTitle('');
      setUserTouchedCategory(Boolean(initialCategory));
      setSelectedTimePreset(null);
    }
  }, [isOpen, initialItem, defaultDateKey, initialRawText, initialCategory]);

  const parsedPreview = useMemo(() => {
    if (!title.trim() || initialItem) return null;
    return parseQuickCapture(title, defaultDateKey);
  }, [title, defaultDateKey, initialItem]);

  useEffect(() => {
    if (!parsedPreview || initialItem) return;
    if (!userTouchedCategory) {
      setCategory(parsedPreview.category);
    }
    if (parsedPreview.phoneNumber && !phoneNumber) {
      setPhoneNumber(parsedPreview.phoneNumber);
    }
    if (parsedPreview.contactName && !contactName) {
      setContactName(parsedPreview.contactName);
    }
    if (parsedPreview.locationHint && !locationHint) {
      setLocationHint(parsedPreview.locationHint);
    }
    if (parsedPreview.nextStepTitle && !nextStepTitle) {
      setNextStepTitle(parsedPreview.nextStepTitle);
    }
    if (parsedPreview.priority === 'important') {
      setPriority('important');
    }
    if (parsedPreview.timeStr && !timeStr) {
      setTimeStr(parsedPreview.timeStr);
    }
    if (
      parsedPreview.dateStr &&
      parsedPreview.dateStr !== dateStr &&
      (parsedPreview.detectedHints.includes('فردا') ||
        parsedPreview.detectedHints.includes('پس‌فردا'))
    ) {
      setDateStr(parsedPreview.dateStr);
      setCalendarRefKey(parsedPreview.dateStr);
    }
    if (parsedPreview.pinnedToWidget) {
      setPinnedToWidget(true);
    }
  }, [parsedPreview, userTouchedCategory, initialItem]);

  const jalaliMonth = useMemo(() => {
    const safeKey = calendarRefKey || getLocalDateKey(new Date());
    return getJalaliMonthInfo(safeKey);
  }, [calendarRefKey]);

  const selectedDateDisplay = useMemo(() => {
    const safeKey = dateStr || getLocalDateKey(new Date());
    const parts = getJalaliDayParts(safeKey);
    const info = getJalaliMonthInfo(safeKey);
    const prefix = parts.isToday ? 'امروز · ' : `${parts.weekdayLong} `;
    return `${prefix}${parts.dayNum} ${parts.monthName} ${info.yearFa}`;
  }, [dateStr]);

  const selectableDependencyTasks = useMemo(
    () =>
      existingItems.filter(
        (it) => it.id !== initialItem?.id && !it.completed && it.category !== 'anchor'
      ),
    [existingItems, initialItem]
  );

  if (!isOpen) return null;

  const todayKey = getLocalDateKey(new Date());
  const tomorrowKey = addDaysToDateKey(todayKey, 1);
  const afterTomorrowKey = addDaysToDateKey(todayKey, 2);

  const applyTemplate = (tpl: TaskTemplate) => {
    setCategory(tpl.category);
    setUserTouchedCategory(true);
    setTitle(tpl.defaultTitle);
    if (tpl.defaultNotes) setNotes(tpl.defaultNotes);
    if (tpl.defaultTimeStr) setTimeStr(tpl.defaultTimeStr);
    if (tpl.subType) setSubType(tpl.subType);
    setPreReminderMinutes(tpl.preReminderMinutes);
    setRepeatDaily(Boolean(tpl.repeatDaily));
    setPriority(tpl.isImportant ? 'important' : 'normal');
  };

  const isStorageOnly = category === 'phone' || category === 'anchor' || category === 'idea';

  const applyQuickTimeOffset = (minutesFromNow: number, presetId: TimePresetId) => {
    if (selectedTimePreset === presetId) {
      setTimeStr('');
      setSelectedTimePreset(null);
      return;
    }
    const target = new Date(Date.now() + minutesFromNow * 60000);
    const nextDate = getLocalDateKey(target);
    setDateStr(nextDate);
    setCalendarRefKey(nextDate);
    setTimeStr(
      `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`
    );
    setSelectedTimePreset(presetId);
  };

  const applyPresetSlot = (tomorrow: boolean, time: string, presetId: TimePresetId) => {
    if (selectedTimePreset === presetId) {
      setTimeStr('');
      setSelectedTimePreset(null);
      return;
    }
    const base = getLocalDateKey(new Date());
    const nextDate = tomorrow ? addDaysToDateKey(base, 1) : base;
    setDateStr(nextDate);
    setCalendarRefKey(nextDate);
    setTimeStr(time);
    setSelectedTimePreset(presetId);
  };

  const handleDictateText = async () => {
    if (isDictating) return;
    setDictateError('');
    setIsDictating(true);
    try {
      const res = await dictatePersianText();
      if (res.ok && res.text) {
        setTitle((prev) => (prev.trim() ? `${prev.trim()} ${res.text}` : res.text || ''));
      } else if (res.error) {
        setDictateError(res.error);
      }
    } finally {
      setIsDictating(false);
    }
  };

  const handleSelectCategory = (cat: MemoryCategory, customId?: string) => {
    setCategory(cat);
    setCustomCategoryId(customId);
    setUserTouchedCategory(true);
    if ((cat === 'health' || cat === 'anchor' || cat === 'phone') && !initialItem) {
      setPinnedToWidget(true);
    }
    if (!initialItem && (cat === 'phone' || cat === 'anchor' || cat === 'idea')) {
      setPreReminderMinutes(0);
    } else if (!initialItem && preReminderMinutes === 0) {
      setPreReminderMinutes(10);
    }
  };

  const resolveDateHintKey = (hint: string): string => {
    if (/پس.?فردا/.test(hint)) return afterTomorrowKey;
    if (/فردا/.test(hint)) return tomorrowKey;
    return dateStr || todayKey;
  };

  const handleAiExtracted = (analysis: AiImageAnalysisResult, force = false) => {
    const nextCat = analysis.category || category;
    if (!customCategoryId && (!userTouchedCategory || force)) {
      setCategory(nextCat);
      if (nextCat === 'phone' || nextCat === 'anchor' || nextCat === 'idea') {
        setPreReminderMinutes(0);
      }
    }
    if (analysis.title && (force || !title.trim())) {
      setTitle(analysis.title);
    }
    if (analysis.timeStr && (force || !timeStr)) {
      setTimeStr(analysis.timeStr);
      setSelectedTimePreset(null);
    }
    if (analysis.dateHint) {
      const resolved = resolveDateHintKey(analysis.dateHint);
      if (resolved !== dateStr) {
        setDateStr(resolved);
        setCalendarRefKey(resolved);
      }
    }
    if (analysis.phoneNumber && (force || !phoneNumber.trim())) {
      setPhoneNumber(analysis.phoneNumber);
    }
    if (analysis.contactName && (force || !contactName.trim())) {
      setContactName(analysis.contactName);
    }
    if (analysis.locationHint && (force || !locationHint.trim())) {
      setLocationHint(analysis.locationHint);
    }
    if (analysis.dosage && (force || !dosage.trim())) {
      setDosage(analysis.dosage);
    }
    const mergedNotes = analysis.notes?.trim() || analysis.extractedText?.trim() || '';
    if (mergedNotes && (force || !notes.trim())) {
      setNotes(mergedNotes);
    }
  };

  const handleQuickSaveFromAi = (
    analysis: AiImageAnalysisResult,
    nextPhotoId: string
  ) => {
    const cat = analysis.category || category;
    const storageOnlyCat = cat === 'phone' || cat === 'anchor' || cat === 'idea';
    const resolvedDate = resolveDateHintKey(analysis.dateHint || '');
    const cleanPhone = toEnglishDigits(analysis.phoneNumber || phoneNumber).replace(/[^\d+]/g, '');
    const tStr = analysis.timeStr || timeStr;
    const tBlock: TimeBlock = tStr ? getTimeBlockFromTime(tStr) : 'anytime';

    onSave(
      {
        title:
          analysis.title?.trim() ||
          title.trim() ||
          (cleanPhone
            ? `تماس با ${analysis.contactName || toPersianDigits(cleanPhone)}`
            : 'مورد خوانده‌شده از تصویر'),
        notes: (analysis.notes || notes || '').trim() || undefined,
        category: cat,
        customCategoryId,
        dateStr: storageOnlyCat && !tStr && !repeatDaily ? '' : resolvedDate,
        timeStr: tStr,
        timeBlock: tBlock,
        repeatDaily,
        repeatUntilDone,
        priority,
        completed: initialItem?.completed ?? false,
        completedDates: initialItem?.completedDates ?? [],
        preReminderMinutes: tStr ? preReminderMinutes : 0,
        snoozedUntil: tStr ? initialItem?.snoozedUntil : undefined,
        phoneNumber: cleanPhone || undefined,
        contactName: (analysis.contactName || contactName).trim() || undefined,
        locationHint: (analysis.locationHint || locationHint).trim() || undefined,
        subType: subType.trim() || undefined,
        dosage: (analysis.dosage || dosage).trim() || undefined,
        mealTiming: mealTiming.trim() || undefined,
        durationOrQty: durationOrQty.trim() || undefined,
        personOrPlace: personOrPlace.trim() || undefined,
        pinnedToWidget: pinnedToWidget || cat === 'anchor' || cat === 'health' || cat === 'phone',
        voiceNoteId,
        voiceDurationSec,
        photoId: nextPhotoId,
        photoText: (analysis.extractedText || photoText || '').trim() || undefined,
        dependsOnId: dependsOnId || undefined,
        nextStepTitle: nextStepTitle.trim() || undefined,
      },
      initialItem?.id
    );
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle && !phoneNumber.trim() && !voiceNoteId && !photoId) return;

    const cleanTitle =
      !initialItem && parsedPreview && parsedPreview.detectedHints.length > 0
        ? parsedPreview.title
        : trimmedTitle;

    const finalTitle =
      cleanTitle ||
      trimmedTitle ||
      (phoneNumber.trim()
        ? `تماس با ${contactName.trim() || toPersianDigits(phoneNumber.trim())}`
        : photoId
          ? 'تصویر و یادداشت پیوست‌شده'
          : 'یادداشت صوتی آفلاین');
    const cleanPhone = toEnglishDigits(phoneNumber).replace(/[^\d+]/g, '');
    const timeBlock: TimeBlock = timeStr ? getTimeBlockFromTime(timeStr) : 'anytime';

    onSave(
      {
        title: finalTitle,
        notes: notes.trim() || undefined,
        category,
        customCategoryId,
        dateStr: isStorageOnly && !timeStr && !repeatDaily ? '' : dateStr,
        timeStr,
        timeBlock,
        repeatDaily,
        repeatUntilDone,
        priority,
        completed: initialItem?.completed ?? false,
        completedDates: initialItem?.completedDates ?? [],
        preReminderMinutes: timeStr ? preReminderMinutes : 0,
        snoozedUntil: timeStr ? initialItem?.snoozedUntil : undefined,
        phoneNumber: cleanPhone || undefined,
        contactName: contactName.trim() || undefined,
        locationHint: locationHint.trim() || undefined,
        subType: subType.trim() || undefined,
        dosage: dosage.trim() || undefined,
        mealTiming: mealTiming.trim() || undefined,
        durationOrQty: durationOrQty.trim() || undefined,
        personOrPlace: personOrPlace.trim() || undefined,
        pinnedToWidget,
        voiceNoteId,
        voiceDurationSec,
        photoId,
        photoText: photoText?.trim() || undefined,
        dependsOnId: dependsOnId || undefined,
        nextStepTitle: nextStepTitle.trim() || undefined,
      },
      initialItem?.id
    );
    onClose();
  };

  const formCfg = CATEGORY_FORM_CONFIG[category];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-capture-title"
        className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl"
      >
        <div className="sm:hidden w-10 h-1.5 rounded-full bg-[var(--border-subtle)] mx-auto mt-3" />

        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border-subtle)]">
          <h2 id="quick-capture-title" className="text-lg font-bold text-[var(--text-primary)]">
            {initialItem ? 'ویرایش یادآور و یادداشت' : 'ثبت برنامه و یادآور جدید'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-surface-tonal)] cursor-pointer"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Quick Templates Bar when creating */}
          {!initialItem && templates.length > 0 && (
            <div>
              <span className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                الگوهای آماده (انتخاب سریع)
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="min-h-[36px] px-3 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category segmented selector */}
          <div>
            <span className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
              موضوع برنامه
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => {
                const active = category === cat && !customCategoryId;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSelectCategory(cat, undefined)}
                    className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-2 text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)] shadow-sm'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-tonal)]'
                    }`}
                  >
                    <CategoryIcon category={cat} className="w-4 h-4 shrink-0" />
                    <span className="truncate">{CATEGORY_META[cat].shortLabel}</span>
                  </button>
                );
              })}

              {customCategories.map((cc) => {
                const active = customCategoryId === cc.id;
                return (
                  <button
                    key={cc.id}
                    type="button"
                    onClick={() => handleSelectCategory(cc.baseCategory, cc.id)}
                    className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-2 text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)] shadow-sm'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-tonal)]'
                    }`}
                  >
                    <span className="truncate">{cc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary input + Speech-to-Text */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label
                htmlFor="memory-title-input"
                className="block text-xs font-semibold text-[var(--text-secondary)]"
              >
                {formCfg.titleLabel}
              </label>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    photoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                  className="min-h-[34px] inline-flex items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold border border-[var(--border-subtle)] bg-[var(--bg-surface-tonal)] text-[var(--text-primary)] hover:border-[var(--accent)] cursor-pointer whitespace-nowrap"
                >
                  <ScanText className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>خواندن از تصویر (AI)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDictateText}
                  disabled={isDictating}
                  className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-xl px-3 text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                    isDictating
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-[var(--accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]/30 hover:opacity-90'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{isDictating ? 'در حال شنیدن...' : 'تایپ با ضبط صدا'}</span>
                </button>
              </div>
            </div>

            <input
              id="memory-title-input"
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={formCfg.titlePlaceholder}
              className="w-full min-h-[48px] rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />

            {dictateError && (
              <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                {dictateError}
              </p>
            )}

            {/* Short Live Preview of Natural Language Parsing before Save */}
            {parsedPreview && parsedPreview.detectedHints.length > 0 && (
              <div className="mt-2.5 rounded-xl bg-[var(--accent-soft)]/70 border border-[var(--accent)]/25 px-3.5 py-2.5 text-xs space-y-1">
                <p className="font-bold text-[var(--accent-soft-text)]">
                  پیشنمایش تشخیص زبان طبیعی:
                </p>
                <p className="text-[var(--text-primary)]">
                  <span>عنوان: </span>
                  <strong>{parsedPreview.title}</strong>
                  <span aria-hidden="true"> · </span>
                  <span>{formatJalaliShortLabel(parsedPreview.dateStr)}</span>
                  {parsedPreview.timeStr && (
                    <>
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono-tabular font-bold">
                        ساعت {toPersianDigits(parsedPreview.timeStr)}
                      </span>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Dynamic Category-Specific Section */}
          <div className="rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)]/70 border border-[var(--border-subtle)] p-4 space-y-3.5">
            <div>
              <span className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">
                {category === 'health'
                  ? 'نوع یادآوری سلامت و دارو'
                  : category === 'work'
                    ? 'نوع فعالیت کاری'
                    : category === 'fitness'
                      ? 'نوع تمرین ورزشی'
                      : category === 'phone'
                        ? 'دسته‌بندی تماس'
                        : category === 'errand'
                          ? 'نوع کار یا خرید'
                          : category === 'anchor'
                            ? 'نوع وسیله یا مکان'
                            : 'برچسب یادداشت'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {formCfg.subTypes.map((st) => {
                  const active = subType === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setSubType(active ? '' : st)}
                      className={`min-h-[34px] px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        active
                          ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)] shadow-sm'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {st}
                    </button>
                  );
                })}
              </div>
            </div>

            {category === 'health' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                      مقدار / دوز مصرف
                    </label>
                    <input
                      type="text"
                      value={dosage}
                      onChange={(e) => setDosage(e.target.value)}
                      placeholder="مثلاً: ۱ عدد قرص یا ۵ سی‌سی"
                      className="w-full min-h-[42px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 text-sm text-[var(--text-primary)]"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {['۱ عدد', 'نصف قرص', '۵ سی‌سی', '۱ لیوان'].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDosage(dosage === d ? '' : d)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                            dosage === d
                              ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)]'
                              : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                      پزشک یا داروخانه (اختیاری)
                    </label>
                    <input
                      type="text"
                      value={personOrPlace}
                      onChange={(e) => setPersonOrPlace(e.target.value)}
                      placeholder="مثلاً: دکتر حسینی / کلینیک مهر"
                      className="w-full min-h-[42px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 text-sm text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    زمان مصرف نسبت به وعده غذایی
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {['ناشتا', 'قبل از غذا', 'همراه غذا', 'بعد از غذا', 'اهمیتی ندارد'].map(
                      (mt) => {
                        const active = mealTiming === mt;
                        return (
                          <button
                            key={mt}
                            type="button"
                            onClick={() => setMealTiming(active ? '' : mt)}
                            className={`min-h-[34px] px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              active
                                ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)] shadow-sm'
                                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                            }`}
                          >
                            {mt}
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              </>
            )}

            {category === 'phone' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    شماره تلفن
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="0912..."
                    className="w-full min-h-[42px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3.5 text-sm font-mono-tabular text-left text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    نام شخص یا مرکز
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="مثلاً: تعمیرکار پکیج"
                    className="w-full min-h-[42px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3.5 text-sm text-[var(--text-primary)]"
                  />
                </div>
              </div>
            )}

            {category === 'anchor' && (
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  نشانی دقیق یا محل قرارگیری شیء (دفترچه «کجا گذاشتم؟»)
                </label>
                <input
                  type="text"
                  value={locationHint}
                  onChange={(e) => setLocationHint(e.target.value)}
                  placeholder="مثلاً: کشوی اول میز، جاکفشی طبقه دوم یا پارکینگ B4"
                  className="w-full min-h-[42px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3.5 text-sm text-[var(--text-primary)]"
                />
              </div>
            )}

            {category === 'work' && (
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  همکار، سازمان یا محل جلسه (اختیاری)
                </label>
                <input
                  type="text"
                  value={personOrPlace}
                  onChange={(e) => setPersonOrPlace(e.target.value)}
                  placeholder="مثلاً: اتاق جلسات طبقه ۳ یا آقای رضایی"
                  className="w-full min-h-[42px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3.5 text-sm text-[var(--text-primary)]"
                />
              </div>
            )}

            {category === 'fitness' && (
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  مدت تمرین یا تعداد ست
                </label>
                <input
                  type="text"
                  value={durationOrQty}
                  onChange={(e) => setDurationOrQty(e.target.value)}
                  placeholder="مثلاً: ۳۰ دقیقه یا ۳ ست ۱۵ تایی"
                  className="w-full min-h-[42px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3.5 text-sm text-[var(--text-primary)]"
                />
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {['۲۰ دقیقه', '۳۰ دقیقه', '۴۵ دقیقه', '۶۰ دقیقه', '۳ ست'].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setDurationOrQty(durationOrQty === dur ? '' : dur)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                        durationOrQty === dur
                          ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)]'
                          : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                      }`}
                    >
                      {dur}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {category === 'errand' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    فروشگاه یا مقصد (اختیاری)
                  </label>
                  <input
                    type="text"
                    value={personOrPlace}
                    onChange={(e) => setPersonOrPlace(e.target.value)}
                    placeholder="مثلاً: نانوایی، میوه‌فروشی یا بانک"
                    className="w-full min-h-[42px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 text-sm text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    مقدار یا مبلغ تقریبی (اختیاری)
                  </label>
                  <input
                    type="text"
                    value={durationOrQty}
                    onChange={(e) => setDurationOrQty(e.target.value)}
                    placeholder="مثلاً: ۲ کیلو یا ۵۰۰ هزار تومان"
                    className="w-full min-h-[42px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 text-sm text-[var(--text-primary)]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fast time presets + Jalali Date & Time pickers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                {isStorageOnly
                  ? 'زمان‌بندی و یادآور (اختیاری — برای ذخیره ساده نیازی به ساعت نیست)'
                  : 'زمان‌بندی و یادآور'}
              </span>
              {(timeStr || selectedTimePreset) && (
                <button
                  type="button"
                  onClick={() => {
                    setTimeStr('');
                    setSelectedTimePreset(null);
                    setPreReminderMinutes(0);
                  }}
                  className="text-xs font-bold text-[var(--sem-danger)] hover:underline cursor-pointer whitespace-nowrap"
                >
                  لغو زمان‌بندی
                </button>
              )}
            </div>

            {isStorageOnly && !timeStr && (
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                این مورد بدون نیاز به ساعت صرفاً در «صندوق ذهن» ذخیره می‌شود؛ فقط در صورت نیاز ساعت انتخاب کنید.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: '15m', label: '۱۵ دقیقه دیگه', onClick: () => applyQuickTimeOffset(15, '15m') },
                  { id: '1h', label: '۱ ساعت دیگه', onClick: () => applyQuickTimeOffset(60, '1h') },
                  { id: 'evening', label: 'امروز عصر ۱۸:۰۰', onClick: () => applyPresetSlot(false, '18:00', 'evening') },
                  { id: 'tomorrow9', label: 'فردا صبح ۰۹:۰۰', onClick: () => applyPresetSlot(true, '09:00', 'tomorrow9') },
                ] as const
              ).map((preset) => {
                const active = selectedTimePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={preset.onClick}
                    className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      active
                        ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)] shadow-sm'
                        : 'bg-[var(--bg-surface-tonal)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:opacity-85'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Jalali quick date chips + Jalali Picker & Time Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-[var(--text-muted)]">تاریخ شمسی</label>
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { key: todayKey, label: 'امروز' },
                        { key: tomorrowKey, label: 'فردا' },
                        { key: afterTomorrowKey, label: 'پس‌فردا' },
                      ] as const
                    ).map((d) => {
                      const active = dateStr === d.key;
                      return (
                        <button
                          key={d.label}
                          type="button"
                          onClick={() => {
                            setDateStr(d.key);
                            setCalendarRefKey(d.key);
                            setSelectedTimePreset(null);
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                            active
                              ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)]'
                              : 'bg-[var(--bg-surface-tonal)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCalendarRefKey(dateStr || todayKey);
                    setShowJalaliCalendar((v) => !v);
                  }}
                  className={`w-full min-h-[44px] flex items-center justify-between gap-2 rounded-[var(--radius-control)] px-3 text-sm font-semibold border cursor-pointer transition-colors ${
                    showJalaliCalendar
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]'
                      : 'bg-[var(--bg-surface-tonal)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                  }`}
                >
                  <span className="truncate">{selectedDateDisplay}</span>
                  <Calendar className="w-4 h-4 text-[var(--accent)] shrink-0" />
                </button>
              </div>

              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1.5">ساعت دقیق</label>
                <input
                  type="time"
                  value={timeStr}
                  onChange={(e) => {
                    setTimeStr(e.target.value);
                    setSelectedTimePreset(null);
                  }}
                  className="w-full min-h-[44px] rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] px-3 text-sm font-mono-tabular text-[var(--text-primary)]"
                />
              </div>
            </div>

            {showJalaliCalendar && (
              <div className="rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCalendarRefKey((k) => shiftJalaliMonthKey(k, -1))}
                    className="min-w-[36px] min-h-[36px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] cursor-pointer"
                    aria-label="ماه قبل"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-extrabold text-[var(--text-primary)]">
                    {jalaliMonth.monthTitle} {jalaliMonth.yearFa}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCalendarRefKey((k) => shiftJalaliMonthKey(k, 1))}
                    className="min-w-[36px] min-h-[36px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] cursor-pointer"
                    aria-label="ماه بعد"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEKDAY_HEADERS.map((wd, idx) => (
                    <span
                      key={wd}
                      className={`text-[11px] font-bold py-1 ${
                        idx === 6 ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {wd}
                    </span>
                  ))}

                  {Array.from({ length: jalaliMonth.leadingEmptyCells }).map((_, idx) => (
                    <div key={`empty-${idx}`} />
                  ))}

                  {jalaliMonth.days.map((day) => {
                    const isSelected = day.dateKey === dateStr;
                    const details = getIranDateDetails(day.dateKey);
                    const isHoliday = details.isOfficialHoliday || details.isFriday;
                    return (
                      <button
                        key={day.dateKey}
                        type="button"
                        onClick={() => {
                          setDateStr(day.dateKey);
                          setSelectedTimePreset(null);
                          setShowJalaliCalendar(false);
                        }}
                        className={`min-h-[36px] rounded-xl text-xs font-bold tabular-nums border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)] shadow-sm'
                            : day.isToday
                              ? 'bg-[var(--accent-soft)] text-[var(--accent-soft-text)] border-[var(--accent)]/40'
                              : isHoliday
                                ? 'bg-[var(--bg-surface)] text-rose-600 dark:text-rose-400 border-transparent hover:border-rose-400/40'
                                : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-transparent hover:border-[var(--border-subtle)]'
                        }`}
                      >
                        {day.dayNumFa}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Priority, Repeat, Repeat-until-done, Pin options */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPriority((p) => (p === 'important' ? 'normal' : 'important'))}
              className={`min-h-[42px] flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] border px-3 text-xs font-semibold transition-all cursor-pointer ${
                priority === 'important'
                  ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
              <span>{priority === 'important' ? 'کار مهم است' : 'اولویت مهم'}</span>
            </button>

            <button
              type="button"
              onClick={() => setRepeatUntilDone((v) => !v)}
              className={`min-h-[42px] flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] border px-3 text-xs font-semibold transition-all cursor-pointer ${
                repeatUntilDone
                  ? 'bg-[var(--sem-warning-soft)] text-[var(--sem-warning)] border-[var(--sem-warning)]/40'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>{repeatUntilDone ? 'تکرار تا زمان انجام' : 'پیگیری تا انجام'}</span>
            </button>

            <button
              type="button"
              onClick={() => setRepeatDaily((v) => !v)}
              className={`min-h-[42px] flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] border px-3 text-xs font-semibold transition-all cursor-pointer ${
                repeatDaily
                  ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>{repeatDaily ? 'تکرار روزانه فعال' : 'تکرار روزانه'}</span>
            </button>

            <button
              type="button"
              onClick={() => setPinnedToWidget((v) => !v)}
              className={`min-h-[42px] flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] border px-3 text-xs font-semibold transition-all cursor-pointer ${
                pinnedToWidget
                  ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
              }`}
            >
              <Pin className="w-3.5 h-3.5" />
              <span>{pinnedToWidget ? 'سنجاق به ویجت فعال' : 'سنجاق به ویجت'}</span>
            </button>
          </div>

          {timeStr && (
            <div className="rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)]/60 border border-[var(--border-subtle)] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                پیش‌هشدار مرحله‌ای قبل از موعد:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {([0, 5, 10, 15] as const).map((mins) => {
                  const active = preReminderMinutes === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setPreReminderMinutes(mins)}
                      className={`min-h-[36px] px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        active
                          ? 'bg-[var(--accent)] text-[var(--accent-on)] border-[var(--accent)] shadow-sm'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {mins === 0 ? 'خاموش' : `${toPersianDigits(mins)} دقیقه`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chained / Dependent Reminders */}
          <div className="rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)]/60 border border-[var(--border-subtle)] p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
              <Link2 className="w-4 h-4 text-[var(--accent)]" />
              <span>یادآور وابسته و مرحله بعدی (اختیاری)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                  فعال شدن پس از انجام کار دیگر:
                </label>
                <select
                  value={dependsOnId}
                  onChange={(e) => setDependsOnId(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 text-xs text-[var(--text-primary)]"
                >
                  <option value="">بدون وابستگی به کار قبلی</option>
                  {selectableDependencyTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      بعد از: {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                  مرحله بعدی پس از انجام این کار:
                </label>
                <input
                  type="text"
                  value={nextStepTitle}
                  onChange={(e) => setNextStepTitle(e.target.value)}
                  placeholder="مثلاً: ثبت نتیجه تماس یا ارسال رسید"
                  className="w-full min-h-[40px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 text-xs text-[var(--text-primary)]"
                />
              </div>
            </div>
          </div>

          {/* Offline Voice Memo + Photo with Searchable Text */}
          <div className="space-y-3">
            <VoiceRecorderControl
              voiceNoteId={voiceNoteId}
              voiceDurationSec={voiceDurationSec}
              onChange={(id, dur) => {
                setVoiceNoteId(id);
                setVoiceDurationSec(dur);
              }}
            />

            <div ref={photoSectionRef}>
              <PhotoAttachmentControl
                photoId={photoId}
                photoText={photoText}
                enableOcrByDefault={enablePhotoOcr}
                onChange={(id, txt) => {
                  setPhotoId(id);
                  setPhotoText(txt);
                }}
                onAiExtracted={(analysis) => handleAiExtracted(analysis, false)}
                onQuickSaveExtracted={handleQuickSaveFromAi}
              />
            </div>
          </div>

          {/* Optional extra details */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              توضیح تکمیلی (اختیاری)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="نکته‌ای که دوست ندارید فراموش شود..."
              className="w-full rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[var(--accent-on)] hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{initialItem ? 'ذخیره تغییرات' : 'ثبت در حافظه یادبان'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-5 rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] text-sm font-semibold text-[var(--text-secondary)] hover:opacity-90 cursor-pointer"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
