import { Hono } from 'hono';
import { z } from 'zod';
import { db, rooms, users, tablePlayers, eq, desc } from '@poker/db';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

export const adminRoutes = new Hono();

// All admin routes require auth + admin
adminRoutes.use('*', authMiddleware);
adminRoutes.use('*', adminMiddleware);

const createRoomSchema = z.object({
  name: z.string().min(3).max(50),
  smallBlind: z.number().min(1),
  bigBlind: z.number().min(2),
  minBuyIn: z.number().min(1),
  maxBuyIn: z.number().min(1),
  maxPlayers: z.number().min(2).max(9),
});

// Create a new room
adminRoutes.post('/rooms', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const parsed = createRoomSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ success: false, error: 'Invalid input', details: parsed.error.errors }, 400);
    }

    const { name, smallBlind, bigBlind, minBuyIn, maxBuyIn, maxPlayers } = parsed.data;

    // Validate blinds
    if (bigBlind !== smallBlind * 2) {
      return c.json(
        { success: false, error: 'Big blind must be exactly 2x the small blind' },
        400
      );
    }

    // Validate buy-in range
    if (minBuyIn > maxBuyIn) {
      return c.json(
        { success: false, error: 'Min buy-in cannot be greater than max buy-in' },
        400
      );
    }

    // Min buy-in should be at least 10 big blinds
    if (minBuyIn < bigBlind * 10) {
      return c.json(
        { success: false, error: 'Min buy-in should be at least 10 big blinds' },
        400
      );
    }

    const [newRoom] = await db
      .insert(rooms)
      .values({
        name,
        smallBlind,
        bigBlind,
        minBuyIn,
        maxBuyIn,
        maxPlayers,
        status: 'waiting',
        createdBy: user.userId,
      })
      .returning();

    return c.json({ success: true, data: newRoom });
  } catch (error) {
    console.error('Create room error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Get all rooms (including closed ones)
adminRoutes.get('/rooms', async (c) => {
  try {
    const allRooms = await db
      .select()
      .from(rooms)
      .orderBy(desc(rooms.createdAt));

    const roomsWithPlayers = await Promise.all(
      allRooms.map(async (room) => {
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

// Update room status
adminRoutes.patch('/rooms/:id', async (c) => {
  try {
    const roomId = c.req.param('id');
    const body = await c.req.json();
    const { status } = body;

    if (!['waiting', 'playing', 'closed'].includes(status)) {
      return c.json({ success: false, error: 'Invalid status' }, 400);
    }

    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);

    if (!room) {
      return c.json({ success: false, error: 'Room not found' }, 404);
    }

    const [updatedRoom] = await db
      .update(rooms)
      .set({ status, updatedAt: new Date() })
      .where(eq(rooms.id, roomId))
      .returning();

    return c.json({ success: true, data: updatedRoom });
  } catch (error) {
    console.error('Update room error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Delete room (only if no players)
adminRoutes.delete('/rooms/:id', async (c) => {
  try {
    const roomId = c.req.param('id');

    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);

    if (!room) {
      return c.json({ success: false, error: 'Room not found' }, 404);
    }

    const players = await db.select().from(tablePlayers).where(eq(tablePlayers.roomId, roomId));

    if (players.length > 0) {
      return c.json({ success: false, error: 'Cannot delete room with players' }, 400);
    }

    await db.delete(rooms).where(eq(rooms.id, roomId));

    return c.json({ success: true, data: { message: 'Room deleted' } });
  } catch (error) {
    console.error('Delete room error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Get all users
adminRoutes.get('/users', async (c) => {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        balance: users.balance,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return c.json({ success: true, data: allUsers });
  } catch (error) {
    console.error('Get users error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Update user admin status
adminRoutes.patch('/users/:id/admin', async (c) => {
  try {
    const userId = c.req.param('id');
    const body = await c.req.json();
    const { isAdmin } = body;

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    await db.update(users).set({ isAdmin }).where(eq(users.id, userId));

    return c.json({ success: true, data: { message: 'User updated' } });
  } catch (error) {
    console.error('Update user error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});
