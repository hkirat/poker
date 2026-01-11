import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRooms } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Users, Coins, RefreshCw, ChevronRight, Sparkles, Crown } from 'lucide-react';

interface Room {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayers: number;
  status: string;
  currentPlayerCount: number;
}

export function LobbyPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const fetchRooms = async () => {
    setLoading(true);
    const result = await getRooms();
    if (result.success && result.data) {
      setRooms(result.data);
    } else {
      setError(result.error || 'Failed to load rooms');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const canJoinRoom = (room: Room) => {
    if (!user) return false;
    const minRequired = room.bigBlind * 3;
    return user.balance >= minRequired && room.currentPlayerCount < room.maxPlayers;
  };

  const handleJoinRoom = (room: Room) => {
    if (canJoinRoom(room)) {
      navigate(`/room/${room.id}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-10 animate-fade-in">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Crown className="w-8 h-8 gold-text" />
            <h1 className="text-4xl font-display gold-text-gradient">
              Poker Lobby
            </h1>
          </div>
          <p className="text-gray-500 ml-11">
            Choose a table to begin your game
          </p>
        </div>

        <button
          onClick={fetchRooms}
          disabled={loading}
          className="btn-luxury btn-velvet flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="p-4 rounded-xl mb-6 border animate-fade-in"
          style={{
            background: 'linear-gradient(135deg, hsl(0 70% 20% / 0.2) 0%, hsl(0 70% 15% / 0.1) 100%)',
            borderColor: 'hsl(0 60% 40% / 0.3)',
          }}
        >
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {rooms.length === 0 && !loading ? (
        <div className="text-center py-20 animate-fade-in">
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center glass-gold">
            <Sparkles className="w-10 h-10 gold-text" />
          </div>
          <p className="text-xl text-gray-400 mb-2">No tables available</p>
          <p className="text-sm text-gray-600">
            Check back later or ask an admin to create a table
          </p>
        </div>
      ) : (
        /* Room grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room, index) => (
            <div
              key={room.id}
              className="table-card group cursor-pointer animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => handleJoinRoom(room)}
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-5">
                <h2 className="text-xl font-display text-gray-100 group-hover:gold-text transition-colors">
                  {room.name}
                </h2>
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
                  style={{
                    background: room.status === 'waiting'
                      ? 'linear-gradient(135deg, hsl(145 70% 35% / 0.2) 0%, hsl(145 70% 25% / 0.1) 100%)'
                      : 'linear-gradient(135deg, hsl(43 90% 50% / 0.2) 0%, hsl(43 90% 40% / 0.1) 100%)',
                    color: room.status === 'waiting' ? 'hsl(145 70% 55%)' : 'hsl(43 90% 60%)',
                    border: room.status === 'waiting'
                      ? '1px solid hsl(145 70% 40% / 0.3)'
                      : '1px solid hsl(43 90% 50% / 0.3)',
                  }}
                >
                  {room.status === 'waiting' ? 'Open' : 'In Progress'}
                </span>
              </div>

              {/* Stats */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
                  <span className="text-gray-500">Blinds</span>
                  <span className="font-medium gold-text">
                    {room.smallBlind} / {room.bigBlind}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <Coins className="w-4 h-4" />
                    Buy-in
                  </span>
                  <span className="font-medium text-gray-200">
                    {room.minBuyIn.toLocaleString()} - {room.maxBuyIn.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-800/50">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    Players
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-200">
                      {room.currentPlayerCount} / {room.maxPlayers}
                    </span>
                    {/* Player indicator dots */}
                    <div className="flex gap-0.5">
                      {Array.from({ length: room.maxPlayers }).map((_, i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            background: i < room.currentPlayerCount
                              ? 'hsl(43 96% 56%)'
                              : 'hsl(240 12% 25%)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-500">Min. Required</span>
                  <span className="font-medium gold-text">
                    {(room.bigBlind * 3).toLocaleString()} chips
                  </span>
                </div>
              </div>

              {/* Join button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleJoinRoom(room);
                }}
                disabled={!canJoinRoom(room)}
                className="w-full mt-6 btn-luxury btn-gold py-3.5 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              >
                <span className="font-semibold">
                  {room.currentPlayerCount >= room.maxPlayers
                    ? 'Table Full'
                    : user && user.balance < room.bigBlind * 3
                      ? 'Insufficient Balance'
                      : 'Join Table'}
                </span>
                {canJoinRoom(room) && (
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
