import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';
import { getPhotoBlob } from '../utils/mediaStorage';

interface PhotoThumbnailProps {
  photoId: string;
  photoText?: string;
  title?: string;
}

export const PhotoThumbnail: React.FC<PhotoThumbnailProps> = ({
  photoId,
  photoText,
  title = 'تصویر پیوست‌شده',
}) => {
  const [url, setUrl] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    let objUrl = '';
    void (async () => {
      const blob = await getPhotoBlob(photoId);
      if (!active || !blob) return;
      objUrl = URL.createObjectURL(blob);
      setUrl(objUrl);
    })();
    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [photoId]);

  if (!url) {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <ImageIcon className="w-3.5 h-3.5" />
        <span>دارای تصویر پیوست‌شده</span>
      </div>
    );
  }

  return (
    <>
      <div className="mt-2 flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="rounded-xl overflow-hidden border border-[var(--border-subtle)] hover:opacity-90 transition-opacity cursor-pointer shrink-0"
          aria-label={`بزرگ‌نمایی ${title}`}
        >
          <img src={url} alt={title} className="w-16 h-16 object-cover" />
        </button>
        {photoText && (
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-3">
            متن تصویر: {photoText}
          </p>
        )}
      </div>

      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4"
        >
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="self-end mb-3 min-w-[44px] min-h-[44px] rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer"
            aria-label="بستن تصویر"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={url}
            alt={title}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl"
          />
          {photoText && (
            <p
              onClick={(e) => e.stopPropagation()}
              className="mt-3 max-w-lg text-center text-sm text-white/95 bg-black/50 rounded-xl px-4 py-2"
            >
              {photoText}
            </p>
          )}
        </div>
      )}
    </>
  );
};
