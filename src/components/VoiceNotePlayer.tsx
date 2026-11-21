import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2 } from 'lucide-react';
import { formatDurationFa, getVoiceBlob } from '../utils/voiceStorage';

interface VoiceNotePlayerProps {
  voiceNoteId: string;
  durationSec?: number;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({
  voiceNoteId,
  durationSec = 0,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [available, setAvailable] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
      }
    };
  }, []);

  const togglePlay = async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (!urlRef.current) {
      const blob = await getVoiceBlob(voiceNoteId);
      if (!blob) {
        setAvailable(false);
        return;
      }
      urlRef.current = URL.createObjectURL(blob);
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(urlRef.current);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  };

  if (!available) return null;

  return (
    <button
      type="button"
      onClick={togglePlay}
      className="mt-2 min-h-[38px] inline-flex items-center gap-2 rounded-xl bg-[var(--bg-surface-tonal)] border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:opacity-90 cursor-pointer"
    >
      {isPlaying ? (
        <Pause className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
      ) : (
        <Play className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
      )}
      <Volume2 className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
      <span>{isPlaying ? 'در حال پخش یادداشت...' : 'پخش یادداشت صوتی'}</span>
      {durationSec > 0 && (
        <span className="font-mono-tabular text-[var(--text-muted)]">
          · {formatDurationFa(durationSec)}
        </span>
      )}
    </button>
  );
};
