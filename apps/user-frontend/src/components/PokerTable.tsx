import { useGameStore } from '@/store/game';
import { useAuthStore } from '@/store/auth';
import { PlayingCard } from './PlayingCard';
import { PlayerSeat } from './PlayerSeat';
import { ActionButtons } from './ActionButtons';
import { Sparkles, Trophy, Coins } from 'lucide-react';

interface RoomData {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  maxPlayers: number;
  players: Array<{
    id: string;
    userId: string;
    seatNumber: number;
    stack: number;
    status: string;
    username: string;
  }>;
}

// Seat positions around an oval table (percentages)
const SEAT_POSITIONS: Record<number, { top: string; left: string }> = {
  0: { top: '85%', left: '50%' }, // Bottom center
  1: { top: '75%', left: '15%' }, // Bottom left
  2: { top: '45%', left: '5%' }, // Left
  3: { top: '15%', left: '15%' }, // Top left
  4: { top: '5%', left: '50%' }, // Top center
  5: { top: '15%', left: '85%' }, // Top right
  6: { top: '45%', left: '95%' }, // Right
  7: { top: '75%', left: '85%' }, // Bottom right
  8: { top: '90%', left: '30%' }, // Extra bottom left
};

export function PokerTable({ room }: { room: RoomData }) {
  const user = useAuthStore((s) => s.user);
  const { phase, pot, communityCards, players, currentPlayerIndex, myCards, timeRemaining, handResult } =
    useGameStore();

  // Get current player from game state or room data
  const gameActivePlayers = players.length > 0 ? players : room.players;
  const currentPlayer = players[currentPlayerIndex];
  const isMyTurn = currentPlayer?.userId === user?.id;

  // Find my player info
  const myPlayer = gameActivePlayers.find((p) => p.userId === user?.id);

  return (
    <div className="relative w-full h-[calc(100vh-80px)] flex items-center justify-center p-4">
      {/* Winner Overlay */}
      {handResult && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none animate-scale-in">
          <div className="winner-overlay animate-winner-glow">
            {/* Trophy Icon */}
            <div className="flex justify-center mb-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center animate-float"
                style={{
                  background: 'linear-gradient(135deg, hsl(43 96% 56%) 0%, hsl(32 94% 44%) 100%)',
                  boxShadow: '0 0 30px hsl(43 96% 56% / 0.5)',
                }}
              >
                <Trophy className="w-8 h-8 text-gray-900" />
              </div>
            </div>

            {/* Winner Name */}
            <div className="text-3xl font-display gold-text-gradient mb-2">
              {handResult.winners[0]?.username}
            </div>

            <div className="text-lg text-gray-400 mb-4 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 gold-text" />
              <span>Wins the Hand!</span>
              <Sparkles className="w-4 h-4 gold-text" />
            </div>

            {/* Hand Description */}
            {handResult.winners[0]?.hand?.description && (
              <div
                className="text-xl font-semibold mb-4 px-4 py-2 rounded-lg inline-block"
                style={{
                  background: 'linear-gradient(135deg, hsl(240 15% 15% / 0.8) 0%, hsl(240 15% 10% / 0.8) 100%)',
                  border: '1px solid hsl(43 96% 56% / 0.3)',
                }}
              >
                <span className="gold-text capitalize">{handResult.winners[0].hand.description}</span>
              </div>
            )}

            {/* Amount Won */}
            <div className="flex items-center justify-center gap-2 mt-4">
              <Coins className="w-8 h-8 gold-text" />
              <span className="text-5xl font-bold gold-text-gradient animate-shimmer">
                +{handResult.winners[0]?.amount.toLocaleString()}
              </span>
            </div>

            <div className="text-gray-500 mt-3 text-sm">
              Pot: {handResult.pot.toLocaleString()} chips
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="poker-table relative w-full max-w-5xl aspect-[2/1] rounded-[50%]">
        {/* Pot Display */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-10">
          <div className="pot-display animate-chip-drop">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Coins className="w-4 h-4 gold-text" />
              <span className="text-xs uppercase tracking-widest text-gray-400 font-medium">Pot</span>
            </div>
            <div className="text-3xl font-bold gold-text-gradient">
              {(pot || 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Community Cards */}
        {communityCards.length > 0 && (
          <div className="absolute top-[35%] left-1/2 transform -translate-x-1/2 z-10">
            <div className="card-container">
              {communityCards.map((card, idx) => (
                <PlayingCard
                  key={idx}
                  card={card}
                  animate
                  delay={idx * 100}
                />
              ))}
            </div>
          </div>
        )}

        {/* Phase indicator */}
        {phase !== 'waiting' && (
          <div className="absolute top-[18%] left-1/2 transform -translate-x-1/2">
            <div
              className="px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest"
              style={{
                background: 'linear-gradient(135deg, hsl(43 96% 56% / 0.15) 0%, hsl(43 96% 56% / 0.05) 100%)',
                border: '1px solid hsl(43 96% 56% / 0.3)',
                color: 'hsl(43 96% 56%)',
              }}
            >
              {phase}
            </div>
          </div>
        )}

        {/* Player Seats */}
        {Array.from({ length: room.maxPlayers }, (_, i) => {
          const player = gameActivePlayers.find((p) => p.seatNumber === i);
          const position = SEAT_POSITIONS[i] || SEAT_POSITIONS[0];
          const isCurrentPlayer = currentPlayer?.seatNumber === i;
          const isMe = player?.userId === user?.id;

          return (
            <div
              key={i}
              className="seat-position"
              style={{ top: position.top, left: position.left }}
            >
              <PlayerSeat
                player={player}
                seatNumber={i}
                isCurrentTurn={isCurrentPlayer}
                isMe={isMe}
                timeRemaining={isCurrentPlayer ? timeRemaining : undefined}
                cards={isMe ? myCards : undefined}
              />
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      {isMyTurn && myPlayer && phase !== 'waiting' && phase !== 'showdown' && (
        <ActionButtons
          currentBet={players[currentPlayerIndex]?.currentBet || 0}
          tableBet={Math.max(...players.map((p) => p.currentBet || 0))}
          stack={myPlayer.stack}
          minRaise={useGameStore.getState().minRaise}
          bigBlind={room.bigBlind}
        />
      )}

      {/* My Cards (larger display at bottom) */}
      {myCards.length > 0 && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-20 animate-slide-up">
          <div
            className="rounded-2xl p-4 flex items-center gap-4"
            style={{
              background: 'linear-gradient(135deg, hsl(240 15% 10% / 0.95) 0%, hsl(240 15% 6% / 0.95) 100%)',
              backdropFilter: 'blur(12px)',
              border: '1px solid hsl(43 96% 56% / 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px hsl(43 96% 56% / 0.1)',
            }}
          >
            <span className="text-sm text-gray-400 font-medium uppercase tracking-wider">
              Your Hand
            </span>
            <div className="flex gap-2">
              {myCards.map((card, idx) => (
                <PlayingCard
                  key={idx}
                  card={card}
                  size="large"
                  animate
                  delay={idx * 150}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
