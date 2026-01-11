import { useAuthStore } from '@/store/auth';

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
  return fetchApi<{
    token: string;
    user: { id: string; email: string; username: string; balance: number; isAdmin: boolean };
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// Admin - Rooms
export async function getAdminRooms() {
  return fetchApi<
    Array<{
      id: string;
      name: string;
      smallBlind: number;
      bigBlind: number;
      minBuyIn: number;
      maxBuyIn: number;
      maxPlayers: number;
      status: string;
      currentPlayerCount: number;
      createdAt: string;
    }>
  >('/api/admin/rooms');
}

export async function createRoom(data: {
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayers: number;
}) {
  return fetchApi<{
    id: string;
    name: string;
    smallBlind: number;
    bigBlind: number;
    minBuyIn: number;
    maxBuyIn: number;
    maxPlayers: number;
    status: string;
  }>('/api/admin/rooms', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRoomStatus(roomId: string, status: string) {
  return fetchApi<{ id: string; status: string }>(`/api/admin/rooms/${roomId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteRoom(roomId: string) {
  return fetchApi<{ message: string }>(`/api/admin/rooms/${roomId}`, {
    method: 'DELETE',
  });
}

// Admin - Users
export async function getAdminUsers() {
  return fetchApi<
    Array<{
      id: string;
      email: string;
      username: string;
      balance: number;
      isAdmin: boolean;
      createdAt: string;
    }>
  >('/api/admin/users');
}

export async function updateUserAdmin(userId: string, isAdmin: boolean) {
  return fetchApi<{ message: string }>(`/api/admin/users/${userId}/admin`, {
    method: 'PATCH',
    body: JSON.stringify({ isAdmin }),
  });
}
