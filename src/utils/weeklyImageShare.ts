import { getIranDateDetails } from '../data/iranCalendarEvents';
import { MemoryItem, PaletteId } from '../types/memory';
import { getJalaliDayParts, getJalaliMonthInfo, toPersianDigits } from './dateFa';

const PALETTE_VISUALS: Record<
  PaletteId,
  {
    bgTop: string;
    bgBottom: string;
    headerStart: string;
    headerEnd: string;
    accent: string;
    accentSoft: string;
    cardBg: string;
    cardBorder: string;
    textPrimary: string;
    textSecondary: string;
  }
> = {
  ocean: {
    bgTop: '#EFF6F5',
    bgBottom: '#E0F2FE',
    headerStart: '#0F766E',
    headerEnd: '#0C4A6E',
    accent: '#0F766E',
    accentSoft: '#CCFBF1',
    cardBg: '#FFFFFF',
    cardBorder: '#CBD5E1',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
  },
  coral: {
    bgTop: '#FFF7ED',
    bgBottom: '#FFEDD5',
    headerStart: '#C2410C',
    headerEnd: '#9A3412',
    accent: '#C2410C',
    accentSoft: '#FFEDD5',
    cardBg: '#FFFFFF',
    cardBorder: '#FED7AA',
    textPrimary: '#1C1917',
    textSecondary: '#57534E',
  },
  indigo: {
    bgTop: '#EEF2FF',
    bgBottom: '#E0E7FF',
    headerStart: '#3730A3',
    headerEnd: '#1E1B4B',
    accent: '#3730A3',
    accentSoft: '#E0E7FF',
    cardBg: '#FFFFFF',
    cardBorder: '#C7D2FE',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
  },
  emerald: {
    bgTop: '#ECFDF5',
    bgBottom: '#D1FAE5',
    headerStart: '#15803D',
    headerEnd: '#064E3B',
    accent: '#15803D',
    accentSoft: '#DCFCE7',
    cardBg: '#FFFFFF',
    cardBorder: '#A7F3D0',
    textPrimary: '#064E3B',
    textSecondary: '#374151',
  },
  contrast: {
    bgTop: '#0F172A',
    bgBottom: '#1E293B',
    headerStart: '#020617',
    headerEnd: '#1E293B',
    accent: '#38BDF8',
    accentSoft: '#0369A1',
    cardBg: '#1E293B',
    cardBorder: '#334155',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
  },
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 3 && ctx.measureText(`${cut}...`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}...`;
}

export interface GeneratedWeeklyImage {
  blob: Blob;
  dataUrl: string;
  base64Png: string;
  fileName: string;
}

export async function generateWeeklyScheduleImage(options: {
  items: MemoryItem[];
  weekDays: string[];
  palette: PaletteId;
  userName?: string;
}): Promise<GeneratedWeeklyImage> {
  if (typeof document === 'undefined') {
    throw new Error('تولید تصویر فقط در محیط گرافیکی امکان‌پذیر است');
  }
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const { items, weekDays, palette, userName } = options;
  const theme = PALETTE_VISUALS[palette] || PALETTE_VISUALS.ocean;
  const width = 1080;
  const sidePad = 48;
  const cardWidth = width - sidePad * 2;
  const headerHeight = 200;
  const footerHeight = 90;
  const dayGap = 18;

  const dayEntries = weekDays.map((dayKey) => {
    const parts = getJalaliDayParts(dayKey);
    const details = getIranDateDetails(dayKey);
    const tasks = items
      .filter((item) => item.repeatDaily || item.dateStr === dayKey)
      .sort((a, b) => (a.timeStr || '99:99').localeCompare(b.timeStr || '99:99'));
    const shownTasks = tasks.slice(0, 4);
    const cardHeight = Math.max(106, 74 + Math.max(1, shownTasks.length) * 38);
    return { dayKey, parts, details, tasks, shownTasks, cardHeight };
  });

  const totalDaysHeight = dayEntries.reduce((sum, d) => sum + d.cardHeight + dayGap, 0);
  const height = sidePad + headerHeight + 28 + totalDaysHeight + footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('امکان ایجاد بوم تصویر وجود ندارد');
  }

  // Canvas background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, theme.bgTop);
  bgGrad.addColorStop(1, theme.bgBottom);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Header card
  const headerGrad = ctx.createLinearGradient(sidePad, sidePad, width - sidePad, sidePad + headerHeight);
  headerGrad.addColorStop(0, theme.headerStart);
  headerGrad.addColorStop(1, theme.headerEnd);
  drawRoundedRect(ctx, sidePad, sidePad, cardWidth, headerHeight, 32);
  ctx.fillStyle = headerGrad;
  ctx.fill();

  const firstParts = dayEntries[0]?.parts;
  const lastEntry = dayEntries[dayEntries.length - 1];
  const lastParts = lastEntry?.parts;
  const lastMonthInfo = lastEntry ? getJalaliMonthInfo(lastEntry.dayKey) : null;
  const totalWeekTasks = dayEntries.reduce((sum, d) => sum + d.tasks.length, 0);

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 40px Vazirmatn, sans-serif';
  ctx.fillText(
    userName?.trim() ? `برنامه هفتگی ${userName.trim()} · یادبان` : 'برنامه هفتگی من · یادبان',
    width - sidePad - 36,
    sidePad + 76
  );

  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = '600 24px Vazirmatn, sans-serif';
  const spanLabel =
    firstParts && lastParts && lastMonthInfo
      ? `از ${firstParts.dayNum} ${firstParts.monthName} تا ${lastParts.dayNum} ${lastParts.monthName} ${lastMonthInfo.yearFa}`
      : 'برنامه ۷ روز هفته';
  ctx.fillText(spanLabel, width - sidePad - 36, sidePad + 126);

  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = '500 21px Vazirmatn, sans-serif';
  ctx.fillText(
    `مجموع برنامه‌های هفته: ${toPersianDigits(totalWeekTasks)} مورد`,
    width - sidePad - 36,
    sidePad + 166
  );

  let cursorY = sidePad + headerHeight + 28;

  for (const entry of dayEntries) {
    drawRoundedRect(ctx, sidePad, cursorY, cardWidth, entry.cardHeight, 24);
    ctx.fillStyle = theme.cardBg;
    ctx.fill();
    ctx.lineWidth = entry.parts.isToday ? 2.5 : 1.2;
    ctx.strokeStyle = entry.parts.isToday ? theme.accent : theme.cardBorder;
    ctx.stroke();

    const isHoliday = entry.details.isOfficialHoliday || entry.details.isFriday;
    const dayTitle = `${entry.parts.isToday ? 'امروز · ' : ''}${entry.parts.weekdayLong} ${entry.parts.dayNum} ${entry.parts.monthName}`;

    ctx.textAlign = 'right';
    ctx.fillStyle = isHoliday
      ? palette === 'contrast'
        ? '#FDA4AF'
        : '#E11D48'
      : entry.parts.isToday
        ? theme.accent
        : theme.textPrimary;
    ctx.font = '800 24px Vazirmatn, sans-serif';
    ctx.fillText(dayTitle, width - sidePad - 28, cursorY + 40);

    // Count label on left side
    const pendingCount = entry.tasks.filter((t) =>
      t.repeatDaily ? !t.completedDates.includes(entry.dayKey) : !t.completed
    ).length;

    ctx.textAlign = 'left';
    ctx.fillStyle = theme.textSecondary;
    ctx.font = '600 20px Vazirmatn, sans-serif';
    const statusText =
      entry.tasks.length === 0
        ? 'آزاد'
        : `${toPersianDigits(pendingCount)} کار مانده`;
    ctx.fillText(statusText, sidePad + 28, cursorY + 39);

    ctx.textAlign = 'right';
    let rowY = cursorY + 78;
    if (entry.shownTasks.length === 0) {
      ctx.fillStyle = theme.textSecondary;
      ctx.font = '400 20px Vazirmatn, sans-serif';
      ctx.fillText('برنامه‌ای برای این روز ثبت نشده است', width - sidePad - 28, rowY);
    } else {
      for (const task of entry.shownTasks) {
        const isDone = task.repeatDaily
          ? task.completedDates.includes(entry.dayKey)
          : task.completed;
        const prefix = isDone ? '✓ ' : '• ';
        const timePart = task.timeStr ? `${toPersianDigits(task.timeStr)} — ` : '';
        const line = truncateText(ctx, `${prefix}${timePart}${task.title}`, cardWidth - 64);

        ctx.fillStyle = isDone ? theme.textSecondary : theme.textPrimary;
        ctx.font = isDone ? '500 21px Vazirmatn, sans-serif' : '600 21px Vazirmatn, sans-serif';
        ctx.fillText(line, width - sidePad - 28, rowY);
        rowY += 36;
      }

      if (entry.tasks.length > entry.shownTasks.length) {
        ctx.textAlign = 'left';
        ctx.fillStyle = theme.accent;
        ctx.font = '700 18px Vazirmatn, sans-serif';
        ctx.fillText(
          `+${toPersianDigits(entry.tasks.length - entry.shownTasks.length)} مورد دیگر`,
          sidePad + 28,
          cursorY + entry.cardHeight - 16
        );
      }
    }

    cursorY += entry.cardHeight + dayGap;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = theme.textSecondary;
  ctx.font = '600 20px Vazirmatn, sans-serif';
  ctx.fillText('ساخته‌شده با دستیار هوشمند یادبان', width / 2, cursorY + 40);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('تولید فایل PNG ناموفق بود'));
    }, 'image/png');
  });

  const dataUrl = canvas.toDataURL('image/png');
  const commaIdx = dataUrl.indexOf(',');
  const base64Png = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const firstKey = weekDays[0] || 'week';
  const fileName = `yadban-weekly-${firstKey}.png`;

  return { blob, dataUrl, base64Png, fileName };
}
