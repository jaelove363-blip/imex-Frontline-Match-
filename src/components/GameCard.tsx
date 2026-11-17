import React, { useState } from 'react';
import { Check, AlertTriangle, Sparkles, ImageOff } from 'lucide-react';

export type CardVisualState =
  | 'default'
  | 'selected'
  | 'matched'
  | 'wrong'
  | 'trap'
  | 'hinted'
  | 'dimmed';

interface GameCardProps {
  kicker: string;
  title: string;
  caption: string;
  imageUrl: string;
  state?: CardVisualState;
  matchTag?: string;
  badgeIcon?: 'question' | 'solution';
  compact?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export const GameCard: React.FC<GameCardProps> = ({
  kicker,
  title,
  caption,
  imageUrl,
  state = 'default',
  matchTag,
  compact = false,
  disabled = false,
  onClick,
}) => {
  const [imgError, setImgError] = useState(false);

  const isSelected = state === 'selected';
  const isMatched = state === 'matched';
  const isWrong = state === 'wrong';
  const isTrap = state === 'trap';
  const isHinted = state === 'hinted';
  const isDimmed = state === 'dimmed';

  let containerRing = 'ring-1 ring-slate-200/80 hover:ring-sky-400 hover:-translate-y-0.5';
  let statusText: string | null = null;
  let statusColor = 'text-slate-500';

  if (isSelected) {
    containerRing = 'ring-3 ring-sky-400 -translate-y-1 shadow-lg shadow-sky-500/20';
    statusText = 'กำลังเลือก';
    statusColor = 'text-sky-700 font-semibold';
  } else if (isMatched) {
    containerRing = 'ring-2 ring-emerald-500 bg-emerald-50/40 animate-card-pop';
    statusText = matchTag ? `จับคู่แล้ว · ${matchTag}` : 'จับคู่สำเร็จ';
    statusColor = 'text-emerald-700 font-semibold';
  } else if (isWrong) {
    containerRing = 'ring-2 ring-rose-500 animate-card-shake';
    statusText = 'ยังไม่ตรงกัน';
    statusColor = 'text-rose-700 font-semibold';
  } else if (isTrap) {
    containerRing = 'ring-2 ring-amber-500/80 bg-amber-50/40 opacity-75 animate-card-shake';
    statusText = 'คำตอบหลอก';
    statusColor = 'text-amber-700 font-semibold';
  } else if (isHinted) {
    containerRing = 'ring-3 ring-amber-400 -translate-y-0.5 shadow-lg shadow-amber-400/20';
    statusText = 'คำใบ้แนะนำ';
    statusColor = 'text-amber-700 font-semibold';
  } else if (isDimmed) {
    containerRing = 'ring-1 ring-slate-200/60 opacity-50';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative w-full text-left bg-white text-slate-900 rounded-xl transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sky-400 ${
        compact ? 'p-2.5' : 'p-3'
      } ${containerRing} ${disabled ? 'cursor-default' : 'cursor-pointer active:scale-[0.985]'}`}
    >
      {/* Top unboxed metadata row (Zero-Pill Discipline) */}
      <div className="flex items-center justify-between gap-2 mb-2 min-h-[20px]">
        <span className="text-xs font-medium text-slate-500 truncate">{kicker}</span>
        {statusText && (
          <span className={`inline-flex items-center gap-1 text-xs shrink-0 ${statusColor}`}>
            {isMatched && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
            {isTrap && <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2.2} />}
            {isHinted && <Sparkles className="w-3.5 h-3.5" strokeWidth={2.2} />}
            <span>{statusText}</span>
          </span>
        )}
      </div>

      {/* 4:3 Image Frame (r_inner = 12 - 4 = 8px) */}
      <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 mb-2.5">
        {!imgError ? (
          <img
            src={imageUrl}
            alt={title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-transform duration-200 ${
              !disabled && !isMatched ? 'group-hover:scale-[1.03]' : ''
            } ${isTrap ? 'grayscale-[35%]' : ''}`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 p-4 text-center">
            <ImageOff className="w-7 h-7 mb-1.5 text-slate-400" />
            <span className="text-xs font-medium line-clamp-2">{title}</span>
          </div>
        )}

        {/* Crisp non-hue-only corner marker when matched or trap */}
        {isMatched && (
          <div className="absolute inset-0 bg-emerald-950/15 pointer-events-none flex items-end justify-end p-2">
            <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-xs font-semibold px-2 py-1 rounded-md shadow-sm">
              <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
              ถูกต้อง
            </span>
          </div>
        )}
      </div>

      {/* Thai Title & Caption */}
      <div className="space-y-1">
        <h3
          className={`font-semibold text-slate-900 leading-snug ${
            compact ? 'text-sm line-clamp-1' : 'text-[15px] line-clamp-2'
          }`}
        >
          {title}
        </h3>
        <p
          className={`text-slate-600 leading-relaxed ${
            compact ? 'text-xs line-clamp-2' : 'text-[13px] line-clamp-2'
          }`}
        >
          {caption}
        </p>
      </div>
    </button>
  );
};
