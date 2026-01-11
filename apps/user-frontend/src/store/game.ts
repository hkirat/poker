import { create } from 'zustand';
import type { Card, GamePhase, Player } from '@poker/types';

interface HandResult {
  winners: Array<{
    userId: string;
    username: string;
    amount: number;
    hand?: {
      rank: string;
      description: string;
      cards: Card[];
    };
  }>;
  pot: number;
}

interface GameState {
  roomId: string | null;
  phase: GamePhase;
  pot: number;
  communityCards: Card[];
  players: Player[];
  currentPlayerIndex: number;
  dealerIndex: number;
  currentBet: number;
  minRaise: number;
  myCards: Card[];
  timeRemaining: number;
  isConnected: boolean;
  handResult: HandResult | null;
  setRoomId: (roomId: string | null) => void;
  updateGameState: (state: Partial<GameState>) => void;
  setMyCards: (cards: Card[]) => void;
  setTimeRemaining: (time: number) => void;
  setConnected: (connected: boolean) => void;
  setHandResult: (result: HandResult | null) => void;
  reset: () => void;
}

const initialState = {
  roomId: null,
  phase: 'waiting' as GamePhase,
  pot: 0,
  communityCards: [],
  players: [],
  currentPlayerIndex: 0,
  dealerIndex: 0,
  currentBet: 0,
  minRaise: 0,
  myCards: [],
  timeRemaining: 30,
  isConnected: false,
  handResult: null as HandResult | null,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,
  setRoomId: (roomId) => set({ roomId }),
  updateGameState: (state) => set((prev) => ({ ...prev, ...state })),
  setMyCards: (cards) => set({ myCards: cards }),
  setTimeRemaining: (time) => set({ timeRemaining: time }),
  setConnected: (connected) => set({ isConnected: connected }),
  setHandResult: (result) => set({ handResult: result }),
  reset: () => set(initialState),
}));
