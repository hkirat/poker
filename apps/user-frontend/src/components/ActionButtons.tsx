import { useState, useEffect } from 'react';
import { useWebSocket } from '@/context/WebSocketContext';
import { X, Check, TrendingUp, Flame, Coins } from 'lucide-react';
import { clsx } from 'clsx';

interface ActionButtonsProps {
  currentBet: number;
  tableBet: number;
  stack: number;
  minRaise: number;
  bigBlind: number;
}

export function ActionButtons({
  currentBet,
  tableBet,
  stack,
  minRaise,
  bigBlind,
}: ActionButtonsProps) {
  const { sendAction } = useWebSocket();
  const [raiseAmount, setRaiseAmount] = useState(minRaise || bigBlind);

  const callAmount = tableBet - currentBet;
  const canCheck = callAmount === 0;
  const canCall = callAmount > 0 && callAmount <= stack;
  const canRaise = stack > callAmount + minRaise;

  // Update raise amount when minRaise changes
  useEffect(() => {
    setRaiseAmount(minRaise || bigBlind);
  }, [minRaise, bigBlind]);

  const handleFold = () => {
    sendAction('fold');
  };

  const handleCheck = () => {
    sendAction('check');
  };

  const handleCall = () => {
    sendAction('call');
  };

  const handleRaise = () => {
    sendAction('raise', raiseAmount);
  };

  const handleAllIn = () => {
    sendAction('all-in');
  };

  const presetRaises = [
    { label: 'Min', amount: minRaise },
    { label: '2x', amount: minRaise * 2 },
    { label: '3x', amount: minRaise * 3 },
    { label: 'Pot', amount: tableBet * 2 },
  ].filter((r) => r.amount <= stack - callAmount && r.amount > 0);

  return (
    <div className="fixed bottom-28 left-1/2 transform -translate-x-1/2 z-30 animate-slide-up">
      <div
        className="rounded-2xl p-5 min-w-[400px]"
        style={{
          background: 'linear-gradient(135deg, hsl(240 15% 10% / 0.98) 0%, hsl(240 15% 6% / 0.98) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid hsl(32 94% 44% / 0.3)',
          boxShadow: `
            0 20px 60px rgba(0, 0, 0, 0.5),
            0 0 40px hsl(32 94% 44% / 0.1),
            inset 0 1px 0 hsl(32 94% 44% / 0.1)
          `,
        }}
      >
        {/* Raise slider and presets */}
        {canRaise && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 gold-text" />
                <span className="text-sm text-gray-400 font-medium uppercase tracking-wider">
                  Raise To
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Coins className="w-4 h-4 gold-text" />
                <span className="text-xl font-bold gold-text-gradient">
                  {(callAmount + raiseAmount).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Slider track */}
            <div className="relative">
              <input
                type="range"
                min={minRaise}
                max={stack - callAmount}
                value={raiseAmount}
                onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer focus-gold"
                style={{
                  background: `linear-gradient(to right,
                    hsl(32 94% 44%) 0%,
                    hsl(32 94% 44%) ${((raiseAmount - minRaise) / (stack - callAmount - minRaise)) * 100}%,
                    hsl(240 12% 20%) ${((raiseAmount - minRaise) / (stack - callAmount - minRaise)) * 100}%,
                    hsl(240 12% 20%) 100%)`,
                }}
              />
            </div>

            {/* Preset buttons */}
            <div className="flex gap-2 mt-3">
              {presetRaises.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => setRaiseAmount(preset.amount)}
                  className={clsx(
                    'flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
                    raiseAmount === preset.amount
                      ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/40 text-amber-400'
                      : 'bg-gray-800/60 border border-gray-700/50 text-gray-400 hover:bg-gray-700/60 hover:text-gray-300'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          {/* Fold Button */}
          <button
            onClick={handleFold}
            className="btn-luxury btn-danger flex-1 py-3.5 flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" />
            <span className="font-semibold">Fold</span>
          </button>

          {/* Check/Call Button */}
          {canCheck ? (
            <button
              onClick={handleCheck}
              className="btn-luxury btn-velvet flex-1 py-3.5 flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              <span className="font-semibold">Check</span>
            </button>
          ) : canCall ? (
            <button
              onClick={handleCall}
              className="btn-luxury btn-velvet flex-1 py-3.5 flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              <span className="font-semibold">Call {callAmount.toLocaleString()}</span>
            </button>
          ) : null}

          {/* Raise Button */}
          {canRaise && (
            <button
              onClick={handleRaise}
              className="btn-luxury btn-success flex-1 py-3.5 flex items-center justify-center gap-2"
            >
              <TrendingUp className="w-5 h-5" />
              <span className="font-semibold">Raise to {(callAmount + raiseAmount).toLocaleString()}</span>
            </button>
          )}

          {/* All-In Button */}
          <button
            onClick={handleAllIn}
            className="btn-luxury btn-gold py-3.5 px-5 flex items-center justify-center gap-2"
          >
            <Flame className="w-5 h-5" />
            <div className="flex flex-col items-start leading-tight">
              <span className="font-bold text-sm">ALL-IN</span>
              <span className="text-xs opacity-80">{stack.toLocaleString()}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
