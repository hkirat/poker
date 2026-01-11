import { useAuthStore } from '@/store/auth';
import type { PlayerStatus, RoomStatus } from '@poker/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, error: 'Network error' };
  }
}

// Auth
export async function login(email: string, password: string) {
  return fetchApi<{ token: string; user: { id: string; email: string; username: string; balance: number; isAdmin: boolean } }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }
  );
}

export async function register(email: string, password: string, username: string) {
  return fetchApi<{ token: string; user: { id: string; email: string; username: string; balance: number; isAdmin: boolean } }>(
    '/api/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({ email, password, username }),
    }
  );
}

// Rooms
export async function getRooms() {
  return fetchApi<Array<{
    id: string;
    name: string;
    smallBlind: number;
    bigBlind: number;
    minBuyIn: number;
    maxBuyIn: number;
    maxPlayers: number;
    status: RoomStatus;
    currentPlayerCount: number;
  }>>('/api/rooms');
}

export async function getRoom(id: string) {
  return fetchApi<{
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
    currentPlayerCount: number;
  }>(`/api/rooms/${id}`);
}

export async function joinRoom(roomId: string, seatNumber: number, buyIn: number) {
  return fetchApi<{ player: { id: string; seatNumber: number; stack: number }; newBalance: number }>(
    `/api/rooms/${roomId}/join`,
    {
      method: 'POST',
      body: JSON.stringify({ seatNumber, buyIn }),
    }
  );
}

export async function leaveRoom(roomId: string) {
  return fetchApi<{ newBalance: number }>(`/api/rooms/${roomId}/leave`, {
    method: 'POST',
  });
}

// User
export async function getMe() {
  return fetchApi<{ id: string; email: string; username: string; balance: number; isAdmin: boolean }>(
    '/api/users/me'
  );
}

export async function getTransactions(limit = 50, offset = 0) {
  return fetchApi<Array<{
    id: string;
    type: string;
    amount: number;
    createdAt: string;
  }>>(`/api/users/transactions?limit=${limit}&offset=${offset}`);
}
