import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  CalendarCheck,
  LayoutGrid,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { AndroidWidgetRenderer } from './components/AndroidWidgetRenderer';
import { BrainDumpVaultView } from './components/BrainDumpVaultView';
import { FloatingMiniWidget } from './components/FloatingMiniWidget';
import { HeadsUpReminderBanner } from './components/HeadsUpReminderBanner';
import { PersonalizationSettingsView } from './components/PersonalizationSettingsView';
import { OfflineIndicator } from './components/PWAInstallButton';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { TodayPlannerView } from './components/TodayPlannerView';
import { WidgetsStudioView } from './components/WidgetsStudioView';
import {
  createSeedItems,
  DEFAULT_SETTINGS,
  DEFAULT_WIDGETS,
} from './data/seedData';
import {
  ActiveReminderAlert,
  ActiveTab,
  MemoryItem,
  UserSettings,
  WidgetConfig,
} from './types/memory';
import { playChime, sendBrowserNotification } from './utils/audioAndVoice';
import { getLocalDateKey, parseQuickCapture, toPersianDigits } from './utils/dateFa';

const STORAGE_ITEMS_KEY = 'yadban_memory_items_v1';
const STORAGE_SETTINGS_KEY = 'yadban_user_settings_v1';
const STORAGE_WIDGETS_KEY = 'yadban_widgets_v1';

function loadFromStorage<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback();
    return JSON.parse(raw) as T;
  } catch {
    return fallback();
  }
}

export default function App() {
  const [items, setItems] = useState<MemoryItem[]>(() =>
    loadFromStorage(STORAGE_ITEMS_KEY, createSeedItems)
  );
  const [settings, setSettings] = useState<UserSettings>(() =>
    loadFromStorage(STORAGE_SETTINGS_KEY, () => DEFAULT_SETTINGS)
  );
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() =>
    loadFromStorage(STORAGE_WIDGETS_KEY, () => DEFAULT_WIDGETS)
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() =>
    getLocalDateKey(new Date())
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MemoryItem | null>(null);
  const [prefillText, setPrefillText] = useState('');
  const [activeAlert, setActiveAlert] = useState<ActiveReminderAlert | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const firedKeysRef = useRef<Set<string>>(new Set());

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(items));
    } catch {
      // ignore storage quota errors
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_WIDGETS_KEY, JSON.stringify(widgets));
    } catch {
      // ignore
    }
  }, [widgets]);

  // Apply Material You palette, dark mode, font scale, and corner tokens to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-palette', settings.palette);
    root.setAttribute('data-font-scale', settings.fontScale);
    root.setAttribute('data-corners', settings.cornerStyle);
  }, [settings.themeMode, settings.palette, settings.fontScale, settings.cornerStyle]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2600);
  }, []);

  const triggerAlert = useCallback(
    (item: MemoryItem, isPreReminder: boolean) => {
      const alertObj: ActiveReminderAlert = {
        item,
        triggeredAt: Date.now(),
        isPreReminder,
      };
      setActiveAlert(alertObj);
      playChime(settings.chimeType);

      const notifTitle = isPreReminder
        ? `پیش‌یادآوری (${toPersianDigits(item.preReminderMinutes)} دقیقه مانده)`
        : 'یادآور هوشمند یادبان';
      sendBrowserNotification(notifTitle, item.title, item.id);
    },
    [settings.chimeType]
  );

  // Smart Background Scheduler (runs every 15 seconds)
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const todayKey = getLocalDateKey(now);
      const nowMs = now.getTime();
      const curMinOfDay = now.getHours() * 60 + now.getMinutes();

      for (const item of items) {
        const isDone = item.repeatDaily
          ? item.completedDates.includes(todayKey)
          : item.completed;
        if (isDone) continue;

        if (item.snoozedUntil && nowMs >= item.snoozedUntil) {
          const snoozeKey = `${item.id}-snooze-${item.snoozedUntil}`;
          if (!firedKeysRef.current.has(snoozeKey)) {
            firedKeysRef.current.add(snoozeKey);
            setItems((prev) =>
              prev.map((x) => (x.id === item.id ? { ...x, snoozedUntil: undefined } : x))
            );
            triggerAlert(item, false);
            break;
          }
        }

        if (!item.timeStr) continue;
        if (!item.repeatDaily && item.dateStr !== todayKey) continue;

        const [hh, mm] = item.timeStr.split(':').map(Number);
        if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
        const targetMin = hh * 60 + mm;

        if (curMinOfDay === targetMin) {
          const key = `${item.id}-exact-${todayKey}-${item.timeStr}`;
          if (!firedKeysRef.current.has(key)) {
            firedKeysRef.current.add(key);
            triggerAlert(item, false);
            break;
          }
        }

        if (item.preReminderMinutes > 0 && curMinOfDay === targetMin - item.preReminderMinutes) {
          const preKey = `${item.id}-pre-${todayKey}-${item.timeStr}`;
          if (!firedKeysRef.current.has(preKey)) {
            firedKeysRef.current.add(preKey);
            triggerAlert(item, true);
            break;
          }
        }

        if (
          settings.autoRepeatNudge &&
          curMinOfDay > targetMin &&
          (curMinOfDay - targetMin) % settings.nudgeIntervalMin === 0 &&
          curMinOfDay - targetMin <= 45
        ) {
          const nudgeKey = `${item.id}-nudge-${todayKey}-${curMinOfDay}`;
          if (!firedKeysRef.current.has(nudgeKey)) {
            firedKeysRef.current.add(nudgeKey);
            triggerAlert(item, false);
            break;
          }
        }
      }
    };

    const interval = setInterval(checkReminders, 15000);
    return () => clearInterval(interval);
  }, [items, settings.autoRepeatNudge, settings.nudgeIntervalMin, triggerAlert]);

  const handleSaveItem = (
    data: Omit<MemoryItem, 'id' | 'createdAt'>,
    existingId?: string
  ) => {
    if (existingId) {
      setItems((prev) =>
        prev.map((item) => (item.id === existingId ? { ...item, ...data } : item))
      );
      showToast('تغییرات ذخیره شد');
    } else {
      const created: MemoryItem = {
        ...data,
        id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: Date.now(),
      };
      setItems((prev) => [created, ...prev]);
      showToast('در حافظه یادبان ثبت شد');
    }
  };

  const handleQuickAdd = (rawText: string) => {
    const parsed = parseQuickCapture(rawText, selectedDateKey);
    const created: MemoryItem = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: parsed.title,
      category: parsed.category,
      dateStr: parsed.dateStr,
      timeStr: parsed.timeStr,
      timeBlock: parsed.timeBlock,
      repeatDaily: false,
      completed: false,
      completedDates: [],
      preReminderMinutes: parsed.timeStr ? 10 : 0,
      phoneNumber: parsed.phoneNumber,
      contactName: parsed.contactName,
      pinnedToWidget: parsed.pinnedToWidget,
      createdAt: Date.now(),
    };
    setItems((prev) => [created, ...prev]);
    showToast(
      parsed.phoneNumber
        ? 'شماره تلفن در صندوق ذهن و ویجت ثبت شد'
        : 'مورد جدید با تشخیص هوشمند ثبت شد'
    );
  };

  const handleToggleComplete = (id: string, dateKey: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.repeatDaily) {
          const exists = item.completedDates.includes(dateKey);
          return {
            ...item,
            completedDates: exists
              ? item.completedDates.filter((d) => d !== dateKey)
              : [...item.completedDates, dateKey],
          };
        }
        return { ...item, completed: !item.completed, snoozedUntil: undefined };
      })
    );
    if (activeAlert?.item.id === id) {
      setActiveAlert(null);
    }
  };

  const handleSnooze = (id: string, minutes: number) => {
    const until = Date.now() + minutes * 60000;
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, snoozedUntil: until } : item))
    );
    setActiveAlert(null);
    showToast(`یادآور برای ${toPersianDigits(minutes)} دقیقه بعد تنظیم شد`);
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    showToast('مورد حذف شد');
  };

  const handleTogglePin = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, pinnedToWidget: !item.pinnedToWidget } : item
      )
    );
  };

  const handleScheduleToday = (id: string) => {
    const todayKey = getLocalDateKey(new Date());
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, dateStr: todayKey } : item
      )
    );
    showToast('به برنامه امروز اضافه شد');
  };

  const handleTriggerTestReminder = () => {
    const sample =
      items.find((i) => !i.completed) ||
      items[0] || {
        id: 'test',
        title: 'تست اعلان هوشمند یادبان',
        category: 'health',
        dateStr: getLocalDateKey(new Date()),
        timeStr: '12:00',
        timeBlock: 'noon',
        repeatDaily: false,
        completed: false,
        completedDates: [],
        preReminderMinutes: 5,
        pinnedToWidget: false,
        createdAt: Date.now(),
      };
    triggerAlert(sample, false);
  };

  const dockWidgets = useMemo(
    () =>
      [...widgets]
        .filter((w) => w.enabled)
        .sort((a, b) => a.order - b.order)
        .slice(0, 3),
    [widgets]
  );

  const navLinks: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'today', label: 'برنامه امروز', icon: <CalendarCheck className="w-5 h-5" /> },
    { id: 'vault', label: 'صندوق ذهن', icon: <Archive className="w-5 h-5" /> },
    { id: 'widgets', label: 'ویجت‌ها', icon: <LayoutGrid className="w-5 h-5" /> },
    { id: 'settings', label: 'شخصی‌سازی', icon: <SlidersHorizontal className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-24 md:pb-10">
      {/* Live Heads-Up Reminder Banner */}
      <HeadsUpReminderBanner
        alert={activeAlert}
        onComplete={(id) => handleToggleComplete(id, getLocalDateKey(new Date()))}
        onSnooze={handleSnooze}
        onDismiss={() => setActiveAlert(null)}
      />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 h-14 md:h-16 bg-[var(--bg-canvas)]/90 backdrop-blur-md border-b border-[var(--border-subtle)]">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className="text-xl font-extrabold tracking-tight text-[var(--text-primary)] whitespace-nowrap shrink-0 cursor-pointer"
          >
            یادبان
          </button>

          <nav
            aria-label="ناوبری اصلی"
            className="hidden md:flex items-center gap-7 text-sm font-semibold text-[var(--text-secondary)]"
          >
            {navLinks.map((link) => {
              const active = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => setActiveTab(link.id)}
                  className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'text-[var(--accent)] border-[var(--accent)]'
                      : 'border-transparent hover:text-[var(--text-primary)]'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setPrefillText('');
                setModalOpen(true);
              }}
              className="min-h-[40px] md:min-h-[44px] inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 py-2 text-xs sm:text-sm font-bold text-[var(--accent-on)] hover:opacity-95 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت فوری</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7">
        {activeTab === 'today' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8">
              <TodayPlannerView
                items={items}
                settings={settings}
                selectedDateKey={selectedDateKey}
                onSelectDateKey={setSelectedDateKey}
                onToggleComplete={handleToggleComplete}
                onQuickAdd={handleQuickAdd}
                onOpenModalForNew={(prefill = '') => {
                  setEditingItem(null);
                  setPrefillText(prefill);
                  setModalOpen(true);
                }}
                onEditItem={(item) => {
                  setEditingItem(item);
                  setPrefillText('');
                  setModalOpen(true);
                }}
                onDeleteItem={handleDeleteItem}
                onSnoozeItem={handleSnooze}
              />
            </div>

            {/* Live Pinned Widget Dock on Desktop */}
            <aside
              aria-label="ویجت‌های زنده کنار صفحه"
              className="lg:col-span-4 space-y-4"
            >
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold text-[var(--text-secondary)]">
                  ویجت‌های اختصاصی شما
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('widgets')}
                  className="text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                >
                  تنظیم ویجت‌ها
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {dockWidgets.map((w) => (
                  <AndroidWidgetRenderer
                    key={w.id}
                    widget={{ ...w, size: '2x2' }}
                    items={items}
                    onToggleComplete={handleToggleComplete}
                    onQuickAdd={handleQuickAdd}
                    onOpenCaptureModal={() => {
                      setEditingItem(null);
                      setPrefillText('');
                      setModalOpen(true);
                    }}
                  />
                ))}
              </div>
            </aside>
          </div>
        ) : activeTab === 'vault' ? (
          <BrainDumpVaultView
            items={items}
            onOpenModalForNew={() => {
              setEditingItem(null);
              setPrefillText('');
              setModalOpen(true);
            }}
            onEditItem={(item) => {
              setEditingItem(item);
              setPrefillText('');
              setModalOpen(true);
            }}
            onDeleteItem={handleDeleteItem}
            onTogglePin={handleTogglePin}
            onScheduleToday={handleScheduleToday}
          />
        ) : activeTab === 'widgets' ? (
          <WidgetsStudioView
            widgets={widgets}
            items={items}
            settings={settings}
            onUpdateWidgets={setWidgets}
            onToggleFloatingWidget={() =>
              setSettings((prev) => ({
                ...prev,
                showFloatingWidget: !prev.showFloatingWidget,
              }))
            }
            onToggleComplete={handleToggleComplete}
            onQuickAdd={handleQuickAdd}
            onOpenCaptureModal={() => {
              setEditingItem(null);
              setPrefillText('');
              setModalOpen(true);
            }}
          />
        ) : (
          <PersonalizationSettingsView
            settings={settings}
            items={items}
            onUpdateSettings={(partial) =>
              setSettings((prev) => ({ ...prev, ...partial }))
            }
            onImportItems={(imported) => setItems(imported)}
            onResetDemo={() => {
              setItems(createSeedItems());
              setWidgets(DEFAULT_WIDGETS);
              showToast('داده‌های نمونه بازیابی شدند');
            }}
            onTriggerTestReminder={handleTriggerTestReminder}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="منوی پایین موبایل"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[var(--bg-surface)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] grid grid-cols-4 items-center px-2"
      >
        {navLinks.map((link) => {
          const active = activeTab === link.id;
          return (
            <button
              key={link.id}
              type="button"
              onClick={() => setActiveTab(link.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-2xl transition-colors cursor-pointer ${
                active
                  ? 'text-[var(--accent)] font-bold'
                  : 'text-[var(--text-muted)] font-medium'
              }`}
            >
              {link.icon}
              <span className="text-[11px] leading-none whitespace-nowrap">{link.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Optional Floating Always-On Mini-Widget */}
      {settings.showFloatingWidget && (
        <FloatingMiniWidget
          items={items}
          onQuickAdd={handleQuickAdd}
          onToggleComplete={handleToggleComplete}
          onClose={() => setSettings((prev) => ({ ...prev, showFloatingWidget: false }))}
          onOpenModal={() => {
            setEditingItem(null);
            setPrefillText('');
            setModalOpen(true);
          }}
        />
      )}

      {/* Quick Capture & Full Editor Modal */}
      <QuickCaptureModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveItem}
        initialItem={editingItem}
        defaultDateKey={selectedDateKey}
        initialRawText={prefillText}
      />

      {/* Offline Status Banner */}
      <OfflineIndicator />

      {/* Subtle Action Feedback Toast */}
      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-20 md:bottom-6 right-1/2 translate-x-1/2 z-50 rounded-[var(--radius-control)] bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2.5 text-xs font-semibold shadow-xl whitespace-nowrap"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
