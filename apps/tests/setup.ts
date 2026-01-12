import WebSocket from "ws";

const BACKEND_PORT = 3000;
const WS_PORT = 3001;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const WS_URL = `ws://localhost:${WS_PORT}`;

export interface TestUser {
  id: string;
  email: string;
  username: string;
  password: string;
  token: string;
  balance: number;
  isAdmin: boolean;
}

export interface TestRoom {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayers: number;
}

// HTTP API helpers
export async function registerUser(
  email: string,
  username: string,
  password: string
): Promise<TestUser> {
  const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password }),
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(`Failed to register user: ${data.error}`);
  }

  return {
    id: data.data.user.id,
    email: data.data.user.email,
    username: data.data.user.username,
    password,
    token: data.data.token,
    balance: data.data.user.balance,
    isAdmin: data.data.user.isAdmin,
  };
}

export async function loginUser(
  email: string,
  password: string
): Promise<TestUser> {
  const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(`Failed to login: ${data.error}`);
  }

  return {
    id: data.data.user.id,
    email: data.data.user.email,
    username: data.data.user.username,
    password,
    token: data.data.token,
    balance: data.data.user.balance,
    isAdmin: data.data.user.isAdmin,
  };
}

export async function createRoom(
  token: string,
  roomData: Omit<TestRoom, "id">
): Promise<TestRoom> {
  const response = await fetch(`${BACKEND_URL}/api/admin/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(roomData),
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(`Failed to create room: ${data.error}`);
  }

  return {
    id: data.data.id,
    name: data.data.name,
    smallBlind: data.data.smallBlind,
    bigBlind: data.data.bigBlind,
    minBuyIn: data.data.minBuyIn,
    maxBuyIn: data.data.maxBuyIn,
    maxPlayers: data.data.maxPlayers,
  };
}

export async function joinRoom(
  token: string,
  roomId: string,
  seatNumber: number,
  buyIn: number
): Promise<{ playerId: string; newBalance: number }> {
  const response = await fetch(`${BACKEND_URL}/api/rooms/${roomId}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ seatNumber, buyIn }),
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(`Failed to join room: ${data.error}`);
  }

  return {
    playerId: data.data.player.id,
    newBalance: data.data.newBalance,
  };
}

export async function leaveRoom(
  token: string,
  roomId: string
): Promise<{ newBalance: number }> {
  const response = await fetch(`${BACKEND_URL}/api/rooms/${roomId}/leave`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(`Failed to leave room: ${data.error}`);
  }

  return {
    newBalance: data.data.newBalance,
  };
}

export async function getRooms(): Promise<TestRoom[]> {
  const response = await fetch(`${BACKEND_URL}/api/rooms`);
  const data = await response.json();
  if (!data.success) {
    throw new Error(`Failed to get rooms: ${data.error}`);
  }
  return data.data;
}

export async function getRoom(
  roomId: string
): Promise<TestRoom & { players: any[]; currentPlayerCount: number }> {
  const response = await fetch(`${BACKEND_URL}/api/rooms/${roomId}`);
  const data = await response.json();
  if (!data.success) {
    throw new Error(`Failed to get room: ${data.error}`);
  }
  return data.data;
}

export async function getUserInfo(
  token: string
): Promise<{ id: string; email: string; username: string; balance: number }> {
  const response = await fetch(`${BACKEND_URL}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(`Failed to get user info: ${data.error}`);
  }
  return data.data;
}

export async function makeUserAdmin(userId: string): Promise<void> {
  const { db, users, eq } = await import("@poker/db");
  await db.update(users).set({ isAdmin: true }).where(eq(users.id, userId));
}

// WebSocket helpers
export class TestWebSocketClient {
  private ws: WebSocket | null = null;
  private messageQueue: any[] = [];
  private messageResolvers: ((msg: any) => void)[] = [];
  private debug: boolean = false;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  private log(...args: any[]): void {
    if (this.debug) {
      console.log("[WS]", ...args);
    }
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);

      this.ws.on("open", () => {
        this.log("Connected");
        resolve();
      });

      this.ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        this.log("Received:", message.type);
        if (this.messageResolvers.length > 0) {
          const resolver = this.messageResolvers.shift()!;
          resolver(message);
        } else {
          this.messageQueue.push(message);
        }
      });

      this.ws.on("error", (err) => {
        this.log("Error:", err);
        reject(err);
      });
    });
  }

  send(type: string, payload: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }
    this.log("Sending:", type);
    this.ws.send(JSON.stringify({ type, payload }));
  }

  async waitForMessage(timeout: number = 5000): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.messageQueue.length > 0) {
        return this.messageQueue.shift();
      }
      // Yield to event loop to allow messages to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    throw new Error("Timeout waiting for message");
  }

  async waitForMessageType(type: string, timeout: number = 5000): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const queuedIndex = this.messageQueue.findIndex((m) => m.type === type);
      if (queuedIndex > -1) {
        this.log("Found queued message:", type);
        return this.messageQueue.splice(queuedIndex, 1)[0];
      }

      // Yield to event loop to allow messages to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.log("Timeout! Queue contents:", this.messageQueue.map(m => m.type));
    throw new Error(`Timeout waiting for message type: ${type}`);
  }

  async authenticate(token: string): Promise<any> {
    this.send("auth", { token });
    return this.waitForMessageType("auth_success");
  }

  async joinRoom(roomId: string, seatNumber: number, buyIn: number): Promise<any> {
    this.send("join_room", { roomId, seatNumber, buyIn });
    // Wait for response - could be joined_room or error
    const msg = await this.waitForMessage(10000);
    if (msg.type === "error") {
      throw new Error(`WS join room failed: ${msg.payload.message}`);
    }
    if (msg.type !== "joined_room") {
      // Put it back and wait for joined_room
      this.messageQueue.push(msg);
      return this.waitForMessageType("joined_room", 10000);
    }
    return msg;
  }

  async leaveRoom(): Promise<any> {
    this.send("leave_room", {});
    return this.waitForMessageType("left_room");
  }

  async performAction(action: string, amount?: number): Promise<void> {
    this.send("player_action", { action, amount });
  }

  clearQueue(): void {
    this.messageQueue = [];
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Test data generator - use timestamp + random for uniqueness across test runs
export function generateTestEmail(): string {
  const ts = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `test${ts}${random}@example.com`;
}

export function generateTestUsername(): string {
  const ts = Date.now().toString(36).slice(-4);
  const random = Math.random().toString(36).substring(2, 6);
  return `tu${ts}${random}`; // max 12 chars
}

export { BACKEND_URL, WS_URL, BACKEND_PORT, WS_PORT };
