import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { db, rooms, tablePlayers, users, eq, and } from '@poker/db';
import { GameRoom, RoomConfig } from './poker/game-room';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const PORT = parseInt(process.env.WS_PORT || '3001');

interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  isAdmin: boolean;
}

interface ClientConnection {
  ws: WebSocket;
  user: JWTPayload | null;
  roomId: string | null;
}

const gameRooms = new Map<string, GameRoom>();
const connections = new Map<WebSocket, ClientConnection>();

async function loadRooms(): Promise<void> {
  try {
    const activeRooms = await db
      .select()
      .from(rooms)
      .where(eq(rooms.status, 'waiting'));

    for (const room of activeRooms) {
      const config: RoomConfig = {
        id: room.id,
        name: room.name,
        smallBlind: room.smallBlind,
        bigBlind: room.bigBlind,
        minBuyIn: room.minBuyIn,
        maxBuyIn: room.maxBuyIn,
        maxPlayers: room.maxPlayers,
      };
      gameRooms.set(room.id, new GameRoom(config));

      // Load existing players - these are stale from before server restart
      const players = await db
        .select({
          userId: tablePlayers.userId,
          seatNumber: tablePlayers.seatNumber,
          stack: tablePlayers.stack,
          username: users.username,
        })
        .from(tablePlayers)
        .innerJoin(users, eq(tablePlayers.userId, users.id))
        .where(eq(tablePlayers.roomId, room.id));

      if (players.length > 0) {
        console.log(`Room ${room.name} has ${players.length} stale players - cleaning up in 60s if they don't reconnect`);

        // Clean up stale players after 60 seconds if they don't reconnect
        for (const player of players) {
          scheduleStalePlayerCleanup(room.id, player.userId, player.username, player.stack);
        }
      } else {
        console.log(`Loaded room ${room.name} (empty)`);
      }
    }
  } catch (error) {
    console.error('Failed to load rooms:', error);
  }
}

// Track pending cleanup timers for stale players
const stalePlayerTimers = new Map<string, Timer>();

function scheduleStalePlayerCleanup(roomId: string, userId: string, username: string, stack: number): void {
  const key = `${roomId}:${userId}`;

  const timer = setTimeout(async () => {
    stalePlayerTimers.delete(key);

    // Check if player has reconnected (they'd be in the GameRoom)
    const gameRoom = gameRooms.get(roomId);
    if (gameRoom && gameRoom.playerCount > 0) {
      // Player might have reconnected - check by trying to see if they're active
      // If they reconnected, handleJoinRoom would have added them
      // We can't easily check, so just check if the DB entry still exists
    }

    console.log(`Cleaning up stale player ${username} from room - returning ${stack} chips`);

    try {
      // Return chips to user balance
      const [user] = await db
        .select({ balance: users.balance })
        .from(users)
        .where(eq(users.id, userId));

      if (user) {
        await db
          .update(users)
          .set({ balance: user.balance + stack })
          .where(eq(users.id, userId));
      }

      // Remove from table_players
      await db
        .delete(tablePlayers)
        .where(
          and(
            eq(tablePlayers.roomId, roomId),
            eq(tablePlayers.userId, userId)
          )
        );

      console.log(`Stale player ${username} cleaned up, ${stack} chips returned`);
    } catch (error) {
      console.error(`Failed to clean up stale player ${username}:`, error);
    }
  }, 60000); // 60 seconds to reconnect

  stalePlayerTimers.set(key, timer);
}

function cancelStalePlayerCleanup(roomId: string, userId: string): void {
  const key = `${roomId}:${userId}`;
  const timer = stalePlayerTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    stalePlayerTimers.delete(key);
    console.log(`Cancelled stale player cleanup for ${userId} - they reconnected`);
  }
}

function authenticateToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

async function getOrCreateRoom(roomId: string): Promise<GameRoom | null> {
  if (gameRooms.has(roomId)) {
    return gameRooms.get(roomId)!;
  }

  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);

  if (!room || room.status === 'closed') {
    return null;
  }

  const config: RoomConfig = {
    id: room.id,
    name: room.name,
    smallBlind: room.smallBlind,
    bigBlind: room.bigBlind,
    minBuyIn: room.minBuyIn,
    maxBuyIn: room.maxBuyIn,
    maxPlayers: room.maxPlayers,
  };

  const gameRoom = new GameRoom(config);
  gameRooms.set(roomId, gameRoom);
  return gameRoom;
}

function handleMessage(ws: WebSocket, data: string): void {
  const connection = connections.get(ws);
  if (!connection) return;

  let message: { type: string; payload: Record<string, unknown> };

  try {
    message = JSON.parse(data);
    console.log('Received message:', message.type, JSON.stringify(message.payload).slice(0, 100));
  } catch {
    sendError(ws, 'Invalid message format');
    return;
  }

  switch (message.type) {
    case 'auth':
      handleAuth(ws, connection, message.payload);
      break;
    case 'join_room':
      handleJoinRoom(ws, connection, message.payload);
      break;
    case 'leave_room':
      handleLeaveRoom(ws, connection);
      break;
    case 'player_action':
      handlePlayerAction(ws, connection, message.payload);
      break;
    case 'spectate':
      handleSpectate(ws, connection, message.payload);
      break;
    case 'chat_message':
      handleChatMessage(ws, connection, message.payload);
      break;
    default:
      sendError(ws, `Unknown message type: ${message.type}`);
  }
}

function handleAuth(
  ws: WebSocket,
  connection: ClientConnection,
  payload: Record<string, unknown>
): void {
  const token = payload.token as string;
  if (!token) {
    sendError(ws, 'No token provided');
    return;
  }

  const user = authenticateToken(token);
  if (!user) {
    sendError(ws, 'Invalid token');
    return;
  }

  connection.user = user;
  ws.send(
    JSON.stringify({
      type: 'auth_success',
      payload: { userId: user.userId, username: user.username },
    })
  );
}

async function handleJoinRoom(
  ws: WebSocket,
  connection: ClientConnection,
  payload: Record<string, unknown>
): Promise<void> {
  if (!connection.user) {
    sendError(ws, 'Not authenticated');
    return;
  }

  const { roomId, seatNumber, buyIn } = payload as {
    roomId: string;
    seatNumber: number;
    buyIn: number;
  };

  const gameRoom = await getOrCreateRoom(roomId);
  if (!gameRoom) {
    sendError(ws, 'Room not found or closed');
    return;
  }

  // Verify player is registered at table in database
  const [tablePlayer] = await db
    .select()
    .from(tablePlayers)
    .where(
      and(eq(tablePlayers.roomId, roomId), eq(tablePlayers.userId, connection.user.userId))
    )
    .limit(1);

  if (!tablePlayer) {
    sendError(ws, 'You must join the table through the API first');
    return;
  }

  // Cancel any pending stale player cleanup (from server restart)
  cancelStalePlayerCleanup(roomId, connection.user.userId);

  const success = gameRoom.addPlayer(
    connection.user.userId,
    connection.user.username,
    tablePlayer.seatNumber,
    tablePlayer.stack,
    ws
  );

  if (success) {
    connection.roomId = roomId;
    ws.send(
      JSON.stringify({
        type: 'joined_room',
        payload: { roomId, seatNumber: tablePlayer.seatNumber, stack: tablePlayer.stack },
      })
    );
  } else {
    sendError(ws, 'Failed to join room');
  }
}

async function handleLeaveRoom(
  ws: WebSocket,
  connection: ClientConnection
): Promise<void> {
  if (!connection.user || !connection.roomId) {
    return;
  }

  const gameRoom = gameRooms.get(connection.roomId);
  if (gameRoom) {
    const stack = gameRoom.removePlayer(connection.user.userId);

    // Update database - return chips to player's balance
    if (stack > 0) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, connection.user.userId))
        .limit(1);

      if (user) {
        await db
          .update(users)
          .set({ balance: user.balance + stack })
          .where(eq(users.id, connection.user.userId));
      }
    }

    // Remove from table_players
    await db
      .delete(tablePlayers)
      .where(
        and(
          eq(tablePlayers.roomId, connection.roomId),
          eq(tablePlayers.userId, connection.user.userId)
        )
      );
  }

  connection.roomId = null;
  ws.send(JSON.stringify({ type: 'left_room', payload: {} }));
}

function handlePlayerAction(
  ws: WebSocket,
  connection: ClientConnection,
  payload: Record<string, unknown>
): void {
  console.log('handlePlayerAction:', { user: connection.user?.username, roomId: connection.roomId, payload });

  if (!connection.user || !connection.roomId) {
    console.log('Not in a room - user:', connection.user, 'roomId:', connection.roomId);
    sendError(ws, 'Not in a room');
    return;
  }

  const gameRoom = gameRooms.get(connection.roomId);
  if (!gameRoom) {
    console.log('Room not found:', connection.roomId);
    sendError(ws, 'Room not found');
    return;
  }

  const { action, amount } = payload as {
    action: 'fold' | 'check' | 'call' | 'raise' | 'all-in';
    amount?: number;
  };

  console.log('Calling handleAction:', { userId: connection.user.userId, action, amount });
  const success = gameRoom.handleAction(connection.user.userId, action, amount);

  if (!success) {
    console.log('Action failed');
    sendError(ws, 'Invalid action');
  }
}

async function handleSpectate(
  ws: WebSocket,
  connection: ClientConnection,
  payload: Record<string, unknown>
): Promise<void> {
  const { roomId } = payload as { roomId: string };

  const gameRoom = await getOrCreateRoom(roomId);
  if (!gameRoom) {
    sendError(ws, 'Room not found');
    return;
  }

  gameRoom.addSpectator(connection.user?.userId || 'anonymous', ws);
  connection.roomId = roomId;

  ws.send(
    JSON.stringify({
      type: 'spectating',
      payload: { roomId },
    })
  );
}

function handleChatMessage(
  ws: WebSocket,
  connection: ClientConnection,
  payload: Record<string, unknown>
): void {
  if (!connection.user || !connection.roomId) {
    sendError(ws, 'Not in a room');
    return;
  }

  const { message: chatMessage } = payload as { message: string };

  if (!chatMessage || typeof chatMessage !== 'string' || chatMessage.trim().length === 0) {
    return;
  }

  // Sanitize and limit message length
  const sanitizedMessage = chatMessage.trim().slice(0, 200);

  // Create chat message payload
  const chatPayload = {
    id: crypto.randomUUID(),
    userId: connection.user.userId,
    username: connection.user.username,
    message: sanitizedMessage,
    timestamp: Date.now(),
  };

  // Broadcast to all connections in the same room
  for (const [clientWs, clientConnection] of connections) {
    if (clientConnection.roomId === connection.roomId && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'chat_message',
        payload: chatPayload,
      }));
    }
  }
}

function sendError(ws: WebSocket, message: string): void {
  ws.send(JSON.stringify({ type: 'error', payload: { message } }));
}

function handleDisconnect(ws: WebSocket): void {
  const connection = connections.get(ws);

  if (connection?.roomId && connection.user) {
    const gameRoom = gameRooms.get(connection.roomId);
    if (gameRoom) {
      // Check if this user is a player in the game
      if (gameRoom.playerCount > 0) {
        // Handle player disconnect with reconnection timeout
        gameRoom.handlePlayerDisconnect(connection.user.userId);
      }
      // Also remove from spectators if they were spectating
      gameRoom.removeSpectator(connection.user.userId);
    }
  }

  connections.delete(ws);
}

// Create WebSocket server
const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws: WebSocket) => {
  console.log('New WebSocket connection');
  connections.set(ws, {
    ws,
    user: null,
    roomId: null,
  });

  ws.on('message', (data) => {
    handleMessage(ws, data.toString());
  });

  ws.on('close', () => {
    handleDisconnect(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    handleDisconnect(ws);
  });
});

// Load existing rooms on startup
loadRooms().then(() => {
  console.log(`WebSocket server running on port ${PORT}`);
});
