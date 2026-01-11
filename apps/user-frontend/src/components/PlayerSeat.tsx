import type { Card, Player } from '@poker/types';
import { PlayingCard } from './PlayingCard';
import { clsx } from 'clsx';
import { Timer, Crown, Coins } from 'lucide-react';

interface PlayerSeatProps {
  player?: Partial<Player> & { userId?: string; username?: string };
  seatNumber: number;
  isCurrentTurn?: boolean;
  isMe?: boolean;
  timeRemaining?: number;
  cards?: Card[];
}

export function PlayerSeat({
  player,
  seatNumber,
  isCurrentTurn,
  isMe,
  timeRemaining,
  cards,
}: PlayerSeatProps) {
  if (!player) {
    return (
      <div className="empty-seat group cursor-pointer">
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full border-2 border-dashed border-current opacity-40 flex items-center justify-center">
            <span className="text-lg opacity-60">+</span>
          </div>
          <span className="opacity-60 text-xs">Seat {seatNumber + 1}</span>
        </div>
      </div>
    );
  }

  const isFolded = player.status === 'folded';
  const isAllIn = player.status === 'all-in';

  return (
    <div
      className={clsx(
        'player-seat animate-fade-in',
        isCurrentTurn && 'current-turn animate-pulse-gold',
        isMe && 'is-me',
        isFolded && 'folded'
      )}
    >
      {/* Timer Badge */}
      {isCurrentTurn && timeRemaining !== undefined && (
        <div
          className={clsx(
            'turn-timer absolute -top-8 left-1/2 transform -translate-x-1/2 z-20',
            timeRemaining <= 10 && 'urgent animate-timer-pulse'
          )}
        >
          <Timer className="w-3.5 h-3.5" />
          <span>{timeRemaining}s</span>
        </div>
      )}

      {/* Player Cards */}
      <div className="flex gap-1.5 mb-2 justify-center">
        {cards && cards.length > 0 ? (
          cards.map((card, idx) => (
            <PlayingCard
              key={idx}
              card={card}
              size="small"
              animate
              delay={idx * 100}
            />
          ))
        ) : player.status !== 'folded' ? (
          <>
            <PlayingCard faceDown size="small" animate delay={0} />
            <PlayingCard faceDown size="small" animate delay={100} />
          </>
        ) : null}
      </div>

      {/* Player Info Card */}
      <div
        className={clsx(
          'relative rounded-xl px-4 py-2.5 text-center min-w-[110px]',
          'transition-all duration-300'
        )}
        style={{
          background: isMe
            ? 'linear-gradient(135deg, hsl(43 96% 56% / 0.15) 0%, hsl(240 15% 10% / 0.95) 100%)'
            : 'linear-gradient(135deg, hsl(240 15% 14% / 0.95) 0%, hsl(240 15% 8% / 0.95) 100%)',
          backdropFilter: 'blur(8px)',
          border: isMe ? '1px solid hsl(43 96% 56% / 0.3)' : '1px solid hsl(240 12% 20% / 0.5)',
        }}
      >
        {/* Username */}
        <div className="flex items-center justify-center gap-1.5 mb-1">
          {isMe && <Crown className="w-3 h-3 gold-text" />}
          <span
            className={clsx(
              'text-sm font-medium truncate max-w-[80px]',
              isMe ? 'gold-text' : 'text-gray-100'
            )}
          >
            {player.username}
          </span>
        </div>

        {/* Stack */}
        <div className="flex items-center justify-center gap-1">
          <Coins className="w-3.5 h-3.5 gold-text" />
          <span className="text-base font-bold gold-text-gradient">
            {(player.stack || 0).toLocaleString()}
          </span>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap justify-center gap-1 mt-1.5">
          {isFolded && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-gray-700/80 text-gray-400">
              Folded
            </span>
          )}
          {isAllIn && (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white"
              style={{
                background: 'linear-gradient(135deg, hsl(0 75% 55%) 0%, hsl(0 80% 45%) 100%)',
                boxShadow: '0 0 12px hsl(0 80% 50% / 0.5)',
              }}
            >
              All-In
            </span>
          )}
          {player.currentBet !== undefined && player.currentBet > 0 && !isFolded && (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-semibold"
              style={{
                background: 'linear-gradient(135deg, hsl(210 70% 50%) 0%, hsl(210 75% 40%) 100%)',
                color: 'white',
              }}
            >
              Bet: {player.currentBet.toLocaleString()}
            </span>
          )}
        </div>

        {/* Position Badges (Dealer/Blinds) */}
        <div className="flex justify-center gap-1 mt-1.5">
          {player.isDealer && (
            <span className="badge badge-dealer">D</span>
          )}
          {player.isSmallBlind && (
            <span className="badge badge-sb">SB</span>
          )}
          {player.isBigBlind && (
            <span className="badge badge-bb">BB</span>
          )}
        </div>
      </div>

      {/* Active turn glow effect */}
      {isCurrentTurn && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, hsl(43 96% 56% / 0.1) 0%, transparent 70%)',
          }}
        />
      )}
    </div>
  );
}
