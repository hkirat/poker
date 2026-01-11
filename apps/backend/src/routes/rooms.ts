import { Hono } from 'hono';
import { db, rooms, tablePlayers, users, eq, and, transactions } from '@poker/db';
import { authMiddleware } from '../middleware/auth';

export const roomRoutes = new Hono();

// Get all active rooms
roomRoutes.get('/', async (c) => {
  try {
    const activeRooms = await db
      .select({
        id: rooms.id,
        name: rooms.name,
        smallBlind: rooms.smallBlind,
        bigBlind: rooms.bigBlind,
        minBuyIn: rooms.minBuyIn,
        maxBuyIn: rooms.maxBuyIn,
        maxPlayers: rooms.maxPlayers,
        status: rooms.status,
        createdAt: rooms.createdAt,
      })
      .from(rooms)
      .where(eq(rooms.status, 'waiting'))
      .orderBy(rooms.createdAt);

    // Get player counts for each room
    const roomsWithPlayers = await Promise.all(
      activeRooms.map(async (room) => {
        const players = await db
          .select()
          .from(tablePlayers)
          .where(eq(tablePlayers.roomId, room.id));

        return {
          ...room,
          currentPlayerCount: players.length,
        };
      })
    );

    return c.json({ success: true, data: roomsWithPlayers });
  } catch (error) {
    console.error('Get rooms error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Get room by ID with players
roomRoutes.get('/:id', async (c) => {
  try {
    const roomId = c.req.param('id');

    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);

    if (!room) {
      return c.json({ success: false, error: 'Room not found' }, 404);
    }

    const players = await db
      .select({
        id: tablePlayers.id,
        userId: tablePlayers.userId,
        seatNumber: tablePlayers.seatNumber,
        stack: tablePlayers.stack,
        status: tablePlayers.status,
        username: users.username,
      })
      .from(tablePlayers)
      .innerJoin(users, eq(tablePlayers.userId, users.id))
      .where(eq(tablePlayers.roomId, roomId));

    return c.json({
      success: true,
      data: {
        ...room,
        players,
        currentPlayerCount: players.length,
      },
    });
  } catch (error) {
    console.error('Get room error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Join a room (requires auth)
roomRoutes.post('/:id/join', authMiddleware, async (c) => {
  try {
    const roomId = c.req.param('id');
    const user = c.get('user');
    const body = await c.req.json();
    const { seatNumber, buyIn } = body;

    // Get room
    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);

    if (!room) {
      return c.json({ success: false, error: 'Room not found' }, 404);
    }

    if (room.status === 'closed') {
      return c.json({ success: false, error: 'Room is closed' }, 400);
    }

    // Check buy-in amount
    if (buyIn < room.minBuyIn || buyIn > room.maxBuyIn) {
      return c.json(
        { success: false, error: `Buy-in must be between ${room.minBuyIn} and ${room.maxBuyIn}` },
        400
      );
    }

    // Check minimum 3 big blinds
    const minRequired = room.bigBlind * 3;

    // Get user balance
    const [userData] = await db.select().from(users).where(eq(users.id, user.userId)).limit(1);

    if (!userData) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    if (userData.balance < minRequired) {
      return c.json(
        { success: false, error: `You need at least ${minRequired} chips (3 big blinds) to join` },
        400
      );
    }

    if (userData.balance < buyIn) {
      return c.json({ success: false, error: 'Insufficient balance' }, 400);
    }

    // Check if user is already at the table
    const existingPlayer = await db
      .select()
      .from(tablePlayers)
      .where(and(eq(tablePlayers.roomId, roomId), eq(tablePlayers.userId, user.userId)))
      .limit(1);

    if (existingPlayer.length > 0) {
      return c.json({ success: false, error: 'You are already at this table' }, 400);
    }

    // Check current player count
    const currentPlayers = await db
      .select()
      .from(tablePlayers)
      .where(eq(tablePlayers.roomId, roomId));

    if (currentPlayers.length >= room.maxPlayers) {
      return c.json({ success: false, error: 'Table is full' }, 400);
    }

    // Check if seat is taken
    const seatTaken = currentPlayers.find((p) => p.seatNumber === seatNumber);
    if (seatTaken) {
      return c.json({ success: false, error: 'Seat is already taken' }, 400);
    }

    // Deduct from user balance
    await db
      .update(users)
      .set({ balance: userData.balance - buyIn })
      .where(eq(users.id, user.userId));

    // Add player to table
    const [newPlayer] = await db
      .insert(tablePlayers)
      .values({
        roomId,
        userId: user.userId,
        seatNumber,
        stack: buyIn,
        status: 'waiting',
      })
      .returning();

    // Create transaction record
    await db.insert(transactions).values({
      userId: user.userId,
      roomId,
      type: 'buy_in',
      amount: -buyIn,
      balanceBefore: userData.balance,
      balanceAfter: userData.balance - buyIn,
    });

    return c.json({
      success: true,
      data: {
        player: {
          ...newPlayer,
          username: user.username,
        },
        newBalance: userData.balance - buyIn,
      },
    });
  } catch (error) {
    console.error('Join room error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Leave a room (requires auth)
roomRoutes.post('/:id/leave', authMiddleware, async (c) => {
  try {
    const roomId = c.req.param('id');
    const user = c.get('user');

    // Get player at table
    const [player] = await db
      .select()
      .from(tablePlayers)
      .where(and(eq(tablePlayers.roomId, roomId), eq(tablePlayers.userId, user.userId)))
      .limit(1);

    if (!player) {
      return c.json({ success: false, error: 'You are not at this table' }, 400);
    }

    // Get user data
    const [userData] = await db.select().from(users).where(eq(users.id, user.userId)).limit(1);

    if (!userData) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    // Return stack to user balance
    await db
      .update(users)
      .set({ balance: userData.balance + player.stack })
      .where(eq(users.id, user.userId));

    // Remove player from table
    await db
      .delete(tablePlayers)
      .where(and(eq(tablePlayers.roomId, roomId), eq(tablePlayers.userId, user.userId)));

    // Create transaction record
    await db.insert(transactions).values({
      userId: user.userId,
      roomId,
      type: 'cash_out',
      amount: player.stack,
      balanceBefore: userData.balance,
      balanceAfter: userData.balance + player.stack,
    });

    return c.json({
      success: true,
      data: {
        newBalance: userData.balance + player.stack,
      },
    });
  } catch (error) {
    console.error('Leave room error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});
