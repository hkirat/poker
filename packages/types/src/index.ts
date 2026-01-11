// Card types
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

// Player types
export type PlayerStatus = 'waiting' | 'active' | 'folded' | 'all-in' | 'sitting-out';

export interface Player {
  id: string;
  userId: string;
  username: string;
  seatNumber: number;
  stack: number;
  status: PlayerStatus;
  currentBet: number;
  cards?: Card[];
  isDealer?: boolean;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
}

// Room types
export type RoomStatus = 'waiting' | 'playing' | 'closed';

export interface Room {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayers: number;
  status: RoomStatus;
  players: Player[];
  currentPlayerCount: number;
}

// Game types
export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'all-in';

export interface GameState {
  id: string;
  roomId: string;
  phase: GamePhase;
  pot: number;
  communityCards: Card[];
  currentPlayerIndex: number;
  dealerIndex: number;
  smallBlindIndex: number;
  bigBlindIndex: number;
  currentBet: number;
  minRaise: number;
  players: Player[];
  turnStartTime: number;
  turnTimeLimit: number; // 30 seconds
}

// WebSocket message types
export type WSMessageType =
  | 'join_room'
  | 'leave_room'
  | 'player_action'
  | 'game_state'
  | 'player_joined'
  | 'player_left'
  | 'game_started'
  | 'new_round'
  | 'player_turn'
  | 'action_result'
  | 'hand_result'
  | 'error'
  | 'chat'
  | 'timer_update';

export interface WSMessage {
  type: WSMessageType;
  payload: unknown;
}

export interface JoinRoomPayload {
  roomId: string;
  userId: string;
  seatNumber: number;
  buyIn: number;
}

export interface LeaveRoomPayload {
  roomId: string;
}

export interface PlayerActionPayload {
  roomId: string;
  action: PlayerAction;
  amount?: number;
}

export interface GameStatePayload {
  gameState: GameState;
}

export interface ErrorPayload {
  message: string;
  code?: string;
}

// API types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    username: string;
    balance: number;
    isAdmin: boolean;
  };
}

export interface CreateRoomRequest {
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayers: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Hand rankings
export type HandRank =
  | 'high-card'
  | 'pair'
  | 'two-pair'
  | 'three-of-a-kind'
  | 'straight'
  | 'flush'
  | 'full-house'
  | 'four-of-a-kind'
  | 'straight-flush'
  | 'royal-flush';

export interface HandResult {
  userId: string;
  rank: HandRank;
  rankValue: number;
  cards: Card[];
  description: string;
}

export interface RoundResult {
  winners: Array<{
    userId: string;
    username: string;
    amount: number;
    hand?: HandResult;
  }>;
  pot: number;
}
