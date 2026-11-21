import React, { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, Square, Trash2 } from 'lucide-react';
import { requestNativeMicrophonePermission } from '../utils/nativeBridge';
import {
  deleteVoiceBlob,
  formatDurationFa,
  getSupportedAudioMimeType,
  getVoiceBlob,
  saveVoiceBlob,
} from '../utils/voiceStorage';

interface VoiceRecorderControlProps {
  voiceNoteId?: string;
  voiceDurationSec?: number;
  onChange: (voiceNoteId?: string, voiceDurationSec?: number) => void;
}

export const VoiceRecorderControl: React.FC<VoiceRecorderControlProps> = ({
  voiceNoteId,
  voiceDurationSec = 0,
  onChange,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let active = true;
    if (!voiceNoteId) {
      setPreviewUrl(null);
      return;
    }
    getVoiceBlob(voiceNoteId).then((blob) => {
      if (!active || !blob) return;
      const url = URL.createObjectURL(blob);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    });

    return () => {
      active = false;
    };
  }, [voiceNoteId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);

  const startRecording = async () => {
    setErrorMsg('');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('ضبط صوت در این دستگاه پشتیبانی نمی‌شود.');
      return;
    }
    try {
      const perm = await requestNativeMicrophonePermission();
      if (perm === 'denied') {
        setErrorMsg('مجوز میکروفن مسدود شده است؛ از بخش مجوزهای برنامه آن را فعال کنید.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = getSupportedAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, {
          type: mimeType || 'audio/webm',
        });
        if (blob.size > 0) {
          const newId = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          if (voiceNoteId) {
            await deleteVoiceBlob(voiceNoteId);
          }
          await saveVoiceBlob(newId, blob);
          onChange(newId, Math.max(1, elapsedRef.current));
        }
        setIsRecording(false);
      };

      elapsedRef.current = 0;
      setElapsedSec(0);
      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        elapsedRef.current += 1;
        setElapsedSec(elapsedRef.current);
      }, 1000);
    } catch {
      setErrorMsg('دسترسی به میکروفن امکان‌پذیر نبود. لطفاً مجوز میکروفن را بررسی کنید.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const togglePlayPreview = () => {
    if (!previewUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(previewUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    } else if (audioRef.current.src !== previewUrl) {
      audioRef.current.src = previewUrl;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const handleDeleteVoice = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    if (voiceNoteId) {
      await deleteVoiceBlob(voiceNoteId);
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    onChange(undefined, undefined);
  };

  return (
    <div className="rounded-[var(--radius-control)] bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          یادداشت صوتی آفلاین (ذخیره روی گوشی)
        </span>
        {(isRecording || voiceNoteId) && (
          <span className="text-xs font-mono-tabular font-bold text-[var(--accent)]">
            {formatDurationFa(isRecording ? elapsedSec : voiceDurationSec)}
          </span>
        )}
      </div>

      {isRecording ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
            در حال ضبط صدا از میکروفن...
          </span>
          <button
            type="button"
            onClick={stopRecording}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-rose-600 text-white px-4 text-xs font-bold hover:bg-rose-700 cursor-pointer whitespace-nowrap"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>پایان و ذخیره ضبط</span>
          </button>
        </div>
      ) : voiceNoteId && previewUrl ? (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={togglePlayPreview}
            className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
          >
            {isPlaying ? <Pause className="w-4 h-4 text-[var(--accent)]" /> : <Play className="w-4 h-4 text-[var(--accent)]" />}
            <span>{isPlaying ? 'توقف پخش' : 'پخش یادداشت ضبط‌شده'}</span>
          </button>

          <button
            type="button"
            onClick={startRecording}
            className="min-h-[44px] px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] cursor-pointer whitespace-nowrap"
          >
            ضبط مجدد
          </button>

          <button
            type="button"
            onClick={handleDeleteVoice}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
            aria-label="حذف یادداشت صوتی"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-4 text-xs font-semibold text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
        >
          <Mic className="w-4 h-4 text-[var(--accent)]" />
          <span>شروع ضبط صدای یادآور</span>
        </button>
      )}

      {errorMsg && (
        <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{errorMsg}</p>
      )}
    </div>
  );
};
