import type { Card } from '@poker/types';
import { clsx } from 'clsx';

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  size?: 'small' | 'medium' | 'large';
  animate?: boolean;
  delay?: number;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const SUIT_COLORS: Record<string, string> = {
  hearts: 'text-red-600',
  diamonds: 'text-red-600',
  clubs: 'text-gray-900',
  spades: 'text-gray-900',
};

const sizeClasses = {
  small: 'w-11 h-16 text-sm',
  medium: 'w-16 h-24 text-xl',
  large: 'w-24 h-36 text-3xl',
};

export function PlayingCard({ card, faceDown, size = 'medium', animate = false, delay = 0 }: PlayingCardProps) {
  if (faceDown || !card) {
    return (
      <div
        className={clsx(
          'relative rounded-xl flex items-center justify-center overflow-hidden',
          'transition-all duration-300 ease-out',
          animate && 'animate-card-deal opacity-0',
          sizeClasses[size]
        )}
        style={{
          background: `
            repeating-linear-gradient(
              45deg,
              hsl(345 45% 15%) 0px,
              hsl(345 45% 15%) 2px,
              hsl(345 35% 20%) 2px,
              hsl(345 35% 20%) 4px
            )
          `,
          border: '2px solid hsl(32 94% 44% / 0.4)',
          boxShadow: `
            0 4px 12px rgba(0, 0, 0, 0.4),
            0 8px 24px rgba(0, 0, 0, 0.3),
            inset 0 0 30px rgba(0, 0, 0, 0.4)
          `,
          animationDelay: `${delay}ms`,
        }}
      >
        {/* Gold diamond pattern in center */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: 'radial-gradient(ellipse at center, hsl(43 96% 56% / 0.08) 0%, transparent 60%)',
          }}
        >
          <div
            className="w-1/2 h-1/2 rounded-sm rotate-45"
            style={{
              border: '2px solid hsl(32 94% 44% / 0.25)',
              background: 'linear-gradient(135deg, hsl(32 94% 44% / 0.1) 0%, transparent 100%)',
            }}
          />
        </div>

        {/* Shine effect */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%)',
          }}
        />
      </div>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  return (
    <div
      className={clsx(
        'relative rounded-xl flex flex-col items-center justify-center font-bold overflow-hidden',
        'bg-gradient-to-br from-white via-gray-50 to-gray-100',
        'transition-all duration-300 ease-out',
        'hover:scale-105 hover:-translate-y-1',
        animate && 'animate-card-deal opacity-0',
        SUIT_COLORS[card.suit],
        sizeClasses[size]
      )}
      style={{
        boxShadow: `
          0 4px 8px rgba(0, 0, 0, 0.25),
          0 8px 24px rgba(0, 0, 0, 0.15),
          inset 0 1px 0 rgba(255, 255, 255, 0.9)
        `,
        border: '1px solid rgba(0, 0, 0, 0.08)',
        animationDelay: `${delay}ms`,
      }}
    >
      {/* Shine overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.5) 0%, transparent 40%)',
        }}
      />

      {/* Top left corner */}
      <div className={clsx(
        'absolute top-1 left-1.5 flex flex-col items-center leading-none',
        size === 'small' && 'text-[10px]',
        size === 'medium' && 'text-xs',
        size === 'large' && 'text-sm'
      )}>
        <span className="font-bold">{card.rank}</span>
        <span className="leading-none">{SUIT_SYMBOLS[card.suit]}</span>
      </div>

      {/* Center suit - large */}
      <span
        className={clsx(
          'relative z-10',
          isRed ? 'drop-shadow-[0_1px_1px_rgba(220,38,38,0.2)]' : 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]'
        )}
        style={{
          fontSize: size === 'small' ? '1.25rem' : size === 'medium' ? '2rem' : '3rem',
        }}
      >
        {SUIT_SYMBOLS[card.suit]}
      </span>

      {/* Bottom right corner (inverted) */}
      <div className={clsx(
        'absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180',
        size === 'small' && 'text-[10px]',
        size === 'medium' && 'text-xs',
        size === 'large' && 'text-sm'
      )}>
        <span className="font-bold">{card.rank}</span>
        <span className="leading-none">{SUIT_SYMBOLS[card.suit]}</span>
      </div>
    </div>
  );
}
