import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useGameStore } from '@/store/game';
import { useWebSocket } from '@/context/WebSocketContext';
import { getRoom, joinRoom as apiJoinRoom, leaveRoom as apiLeaveRoom } from '@/lib/api';
import { PokerTable } from '@/components/PokerTable';
import { JoinTableModal } from '@/components/JoinTableModal';
import { ArrowLeft, Wifi, WifiOff, LogOut, Coins, Spade } from 'lucide-react';
import type { PlayerStatus, RoomStatus } from '@poker/types';

interface RoomData {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayers: number;
  status: RoomStatus;
  players: Array<{
    id: string;
    userId: string;
    seatNumber: number;
    stack: number;
    status: PlayerStatus;
    username: string;
  }>;
}

export function GamePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateBalance = useAuthStore((s) => s.updateBalance);
  const { setRoomId, reset } = useGameStore();
  const { isConnected, joinRoom, leaveRoom } = useWebSocket();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [isSeated, setIsSeated] = useState(false);

  useEffect(() => {
    if (id) {
      fetchRoom();
    }
    return () => {
      reset();
    };
  }, [id]);

  useEffect(() => {
    if (room && user) {
      const playerAtTable = room.players.find((p) => p.userId === user.id);
      if (playerAtTable) {
        setIsSeated(true);
        setRoomId(room.id);
        if (isConnected) {
          joinRoom(room.id);
        }
      }
    }
  }, [room, user, isConnected]);

  const fetchRoom = async () => {
    if (!id) return;
    setLoading(true);
    const result = await getRoom(id);
    if (result.success && result.data) {
      setRoom(result.data);
      if (user && !result.data.players.find((p) => p.userId === user.id)) {
        setShowJoinModal(true);
      }
    } else {
      navigate('/');
    }
    setLoading(false);
  };

  const handleJoinTable = async (seatNumber: number, buyIn: number) => {
    if (!id) return;

    const result = await apiJoinRoom(id, seatNumber, buyIn);
    if (result.success && result.data) {
      updateBalance(result.data.newBalance);
      setIsSeated(true);
      setShowJoinModal(false);
      setRoomId(id);
      joinRoom(id);
      fetchRoom();
    }
  };

  const handleLeaveTable = async () => {
    if (!id) return;

    const result = await apiLeaveRoom(id);
    if (result.success && result.data) {
      updateBalance(result.data.newBalance);
      leaveRoom();
      reset();
      navigate('/');
    }
  };

  if (loading || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center animate-float"
            style={{
              background: 'linear-gradient(135deg, hsl(43 96% 56%) 0%, hsl(32 94% 44%) 100%)',
              boxShadow: '0 8px 32px hsl(32 94% 44% / 0.4)',
            }}
          >
            <Spade className="w-8 h-8 text-gray-900" />
          </div>
          <div className="text-xl text-gray-400">Loading table...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div
        className="fixed top-0 left-0 right-0 z-40"
        style={{
          background: 'linear-gradient(180deg, hsl(240 15% 6% / 0.98) 0%, hsl(240 15% 6% / 0.9) 100%)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid hsl(32 94% 44% / 0.15)',
        }}
      >
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-5">
            {/* Back button */}
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Lobby</span>
            </button>

            {/* Divider */}
            <div className="w-px h-8 bg-gray-800" />

            {/* Room info */}
            <div>
              <h1 className="text-lg font-display gold-text-gradient">{room.name}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Coins className="w-3.5 h-3.5" />
                <span>Blinds: {room.smallBlind}/{room.bigBlind}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Connection status */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{
                background: isConnected
                  ? 'linear-gradient(135deg, hsl(145 70% 35% / 0.2) 0%, hsl(145 70% 25% / 0.1) 100%)'
                  : 'linear-gradient(135deg, hsl(0 70% 40% / 0.2) 0%, hsl(0 70% 30% / 0.1) 100%)',
                border: isConnected
                  ? '1px solid hsl(145 70% 40% / 0.3)'
                  : '1px solid hsl(0 60% 40% / 0.3)',
                color: isConnected ? 'hsl(145 70% 55%)' : 'hsl(0 70% 60%)',
              }}
            >
              {isConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Offline</span>
                </>
              )}
            </div>

            {/* Leave button */}
            {isSeated && (
              <button
                onClick={handleLeaveTable}
                className="btn-luxury btn-danger flex items-center gap-2 py-2 px-4"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium text-sm">Leave Table</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Game Table */}
      <div className="pt-16">
        <PokerTable room={room} />
      </div>

      {/* Join Modal */}
      {showJoinModal && room && (
        <JoinTableModal
          room={room}
          onJoin={handleJoinTable}
          onClose={() => {
            setShowJoinModal(false);
            navigate('/');
          }}
        />
      )}
    </div>
  );
}
