import { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { X, Coins, Users, ChevronRight, Check } from 'lucide-react';

interface RoomData {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayers: number;
  players: Array<{
    seatNumber: number;
    username: string;
  }>;
}

interface JoinTableModalProps {
  room: RoomData;
  onJoin: (seatNumber: number, buyIn: number) => void;
  onClose: () => void;
}

export function JoinTableModal({ room, onJoin, onClose }: JoinTableModalProps) {
  const user = useAuthStore((s) => s.user);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [buyIn, setBuyIn] = useState(room.minBuyIn);
  const [loading, setLoading] = useState(false);

  const occupiedSeats = new Set(room.players.map((p) => p.seatNumber));
  const availableSeats = Array.from({ length: room.maxPlayers }, (_, i) => i).filter(
    (seat) => !occupiedSeats.has(seat)
  );

  const maxBuyIn = Math.min(room.maxBuyIn, user?.balance || 0);
  const canJoin = selectedSeat !== null && buyIn >= room.minBuyIn && buyIn <= maxBuyIn;

  const handleJoin = async () => {
    if (!canJoin) return;
    setLoading(true);
    await onJoin(selectedSeat!, buyIn);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      {/* Backdrop - subtle, allows seeing table */}
      <div
        className="absolute inset-0 pointer-events-auto"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, hsl(240 15% 4% / 0.4) 50%, hsl(240 15% 4% / 0.7) 100%)',
        }}
        onClick={onClose}
      />

      {/* Side Panel */}
      <div
        className="relative w-full max-w-md h-full overflow-y-auto pointer-events-auto animate-slide-in-right"
        style={{
          background: 'linear-gradient(135deg, hsl(240 15% 10% / 0.98) 0%, hsl(240 15% 6% / 0.98) 100%)',
          borderLeft: '1px solid hsl(32 94% 44% / 0.25)',
          boxShadow: `-20px 0 60px rgba(0, 0, 0, 0.5), 0 0 40px hsl(32 94% 44% / 0.1)`,
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Panel content with padding */}
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-display gold-text-gradient mb-1">
                Join Table
              </h2>
              <p className="text-gray-500 text-sm">{room.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Table Info */}
          <div
            className="rounded-xl p-5 space-y-3"
            style={{
              background: 'linear-gradient(135deg, hsl(240 15% 8%) 0%, hsl(240 15% 6%) 100%)',
              border: '1px solid hsl(240 12% 20%)',
            }}
          >
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Blinds</span>
              <span className="gold-text font-medium">
                {room.smallBlind} / {room.bigBlind}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-1.5">
                <Coins className="w-4 h-4" />
                Buy-in Range
              </span>
              <span className="text-gray-200">
                {room.minBuyIn.toLocaleString()} - {room.maxBuyIn.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-800">
              <span className="text-gray-500">Your Balance</span>
              <span className="gold-text font-semibold">
                {user?.balance.toLocaleString()} chips
              </span>
            </div>
          </div>

          {/* Seat Selection */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-3">
              <Users className="w-4 h-4" />
              Select a Seat
            </label>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: room.maxPlayers }, (_, i) => {
                const isOccupied = occupiedSeats.has(i);
                const isSelected = selectedSeat === i;

                return (
                  <button
                    key={i}
                    onClick={() => !isOccupied && setSelectedSeat(i)}
                    disabled={isOccupied}
                    className="relative p-3 rounded-xl text-sm font-semibold transition-all duration-200"
                    style={{
                      background: isOccupied
                        ? 'hsl(240 12% 12%)'
                        : isSelected
                          ? 'linear-gradient(135deg, hsl(43 96% 56%) 0%, hsl(32 94% 44%) 100%)'
                          : 'hsl(240 15% 14%)',
                      border: isSelected
                        ? '2px solid hsl(43 96% 56%)'
                        : '2px solid transparent',
                      color: isOccupied
                        ? 'hsl(240 10% 40%)'
                        : isSelected
                          ? 'hsl(240 20% 4%)'
                          : 'hsl(40 33% 92%)',
                      cursor: isOccupied ? 'not-allowed' : 'pointer',
                      boxShadow: isSelected ? '0 4px 16px hsl(43 96% 56% / 0.3)' : 'none',
                    }}
                  >
                    {i + 1}
                    {isSelected && (
                      <Check className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full text-gray-900 p-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
            {availableSeats.length === 0 && (
              <p className="text-red-400 text-sm mt-3">No seats available</p>
            )}
          </div>

          {/* Buy-in Amount */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-3">
              <Coins className="w-4 h-4" />
              Buy-in Amount
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={room.minBuyIn}
                max={maxBuyIn}
                value={buyIn}
                onChange={(e) => setBuyIn(parseInt(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min={room.minBuyIn}
                max={maxBuyIn}
                value={buyIn}
                onChange={(e) =>
                  setBuyIn(Math.min(maxBuyIn, Math.max(room.minBuyIn, parseInt(e.target.value) || 0)))
                }
                className="w-28 px-3 py-2 rounded-lg text-center font-semibold focus-gold"
                style={{
                  background: 'hsl(240 15% 8%)',
                  border: '1px solid hsl(240 12% 20%)',
                  color: 'hsl(43 96% 56%)',
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-2">
              <span>Min: {room.minBuyIn.toLocaleString()}</span>
              <span>Max: {maxBuyIn.toLocaleString()}</span>
            </div>
          </div>

          {/* Quick Buy-in Presets */}
          <div className="flex gap-2">
            {[room.minBuyIn, Math.floor((room.minBuyIn + maxBuyIn) / 2), maxBuyIn]
              .filter((v, i, arr) => arr.indexOf(v) === i && v <= maxBuyIn)
              .map((amount) => (
                <button
                  key={amount}
                  onClick={() => setBuyIn(amount)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                  style={{
                    background:
                      buyIn === amount
                        ? 'linear-gradient(135deg, hsl(43 96% 56% / 0.2) 0%, hsl(43 96% 56% / 0.1) 100%)'
                        : 'hsl(240 15% 12%)',
                    border:
                      buyIn === amount
                        ? '1px solid hsl(43 96% 56% / 0.4)'
                        : '1px solid hsl(240 12% 18%)',
                    color: buyIn === amount ? 'hsl(43 96% 56%)' : 'hsl(240 10% 60%)',
                  }}
                >
                  {amount.toLocaleString()}
                </button>
              ))}
          </div>

          {/* Join Button */}
          <button
            onClick={handleJoin}
            disabled={!canJoin || loading}
            className="w-full btn-luxury btn-gold py-4 flex items-center justify-center gap-2 text-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-gray-900/20 border-t-gray-900 rounded-full animate-spin" />
                <span className="font-semibold">Joining...</span>
              </>
            ) : (
              <>
                <span className="font-semibold">Join with {buyIn.toLocaleString()} chips</span>
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
