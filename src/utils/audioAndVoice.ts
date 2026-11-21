import { UserSettings } from '../types/memory';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playChime(type: UserSettings['chimeType']): Promise<void> {
  return new Promise((resolve) => {
    if (type === 'none') {
      resolve();
      return;
    }
    const ctx = getAudioContext();
    if (!ctx) {
      resolve();
      return;
    }

    const now = ctx.currentTime;
    const playTone = (
      freq: number,
      startOffset: number,
      duration: number,
      wave: OscillatorType,
      gainPeak: number
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(gainPeak, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.05);
    };

    if (type === 'gentle') {
      playTone(523.25, 0, 0.35, 'sine', 0.14);
      playTone(659.25, 0.14, 0.4, 'sine', 0.14);
      playTone(783.99, 0.28, 0.55, 'sine', 0.12);
      setTimeout(resolve, 650);
    } else if (type === 'bell') {
      playTone(880, 0, 0.6, 'triangle', 0.18);
      playTone(1318.5, 0.02, 0.5, 'sine', 0.09);
      playTone(880, 0.35, 0.6, 'triangle', 0.15);
      setTimeout(resolve, 750);
    } else {
      playTone(440, 0, 0.22, 'sine', 0.18);
      playTone(554.37, 0.12, 0.22, 'sine', 0.16);
      playTone(659.25, 0.24, 0.24, 'sine', 0.16);
      playTone(880, 0.36, 0.45, 'sine', 0.14);
      setTimeout(resolve, 650);
    }
  });
}

export function sendBrowserNotification(title: string, body: string, tag?: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: tag || 'yadban-reminder',
      dir: 'rtl',
      lang: 'fa',
    });
  } catch {
    // Fallback ignored in restricted frames
  }
}

export function isAlertAudioUnlocked(): boolean {
  if (!sharedAudioCtx) return false;
  return sharedAudioCtx.state === 'running';
}

export async function unlockAlertSoundAndVibration(
  chimeType: UserSettings['chimeType']
): Promise<boolean> {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // ignore resume error
    }
  }
  await playChime(chimeType === 'none' ? 'gentle' : chimeType);
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([140, 70, 140]);
    } catch {
      // ignore unsupported vibrate
    }
  }
  return Boolean(ctx && ctx.state === 'running');
}
