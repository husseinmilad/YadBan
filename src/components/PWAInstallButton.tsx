import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <Smartphone className="w-4 h-4 text-[var(--accent)]" />
        <span>اپلیکیشن روی دستگاه شما نصب شده است</span>
      </div>
    );
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-on)] hover:opacity-95 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-4 h-4" />
        <span>نصب اپلیکیشن روی اندروید / دسکتاپ</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-tonal)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:opacity-90 transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>راهنمای نصب در آیفون</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-[var(--radius-card)] bg-[var(--bg-surface)] p-6 border border-[var(--border-subtle)] shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  نصب یادبان در آیفون و آیپد
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-[var(--bg-surface-tonal)] cursor-pointer"
                  aria-label="بستن"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="space-y-2.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                <li>۱. در نوار پایین مرورگر سافاری دکمه Share (اشتراک‌گذاری) را بزنید.</li>
                <li>۲. صفحه را به پایین بکشید و گزینه Add to Home Screen را انتخاب کنید.</li>
                <li>۳. روی Add بزنید تا آیکون یادبان کنار برنامه‌های شما قرار بگیرد.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--accent-on)] text-sm font-semibold cursor-pointer"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
      برای نصب به عنوان برنامه مستقل اندروید یا دسکتاپ، از منوی مرورگر کروم گزینه «Install app / افزودن به صفحه اصلی» را انتخاب کنید.
    </p>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-5 left-4 z-50 flex items-center gap-2 rounded-[var(--radius-control)] bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>حالت آفلاین — تمام یادداشت‌ها و یادآورها روی دستگاه فعال هستند</span>
    </div>
  );
};
