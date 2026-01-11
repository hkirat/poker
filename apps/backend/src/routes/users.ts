import { Hono } from 'hono';
import { db, users, transactions, eq, desc } from '@poker/db';
import { authMiddleware } from '../middleware/auth';

export const userRoutes = new Hono();

// Get current user profile
userRoutes.get('/me', authMiddleware, async (c) => {
  try {
    const authUser = c.get('user');

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        balance: users.balance,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, authUser.userId))
      .limit(1);

    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    return c.json({ success: true, data: user });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Get user's transaction history
userRoutes.get('/transactions', authMiddleware, async (c) => {
  try {
    const authUser = c.get('user');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, authUser.userId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({ success: true, data: userTransactions });
  } catch (error) {
    console.error('Get transactions error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// Update user balance (for testing purposes in development)
userRoutes.post('/add-chips', authMiddleware, async (c) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return c.json({ success: false, error: 'Not available in production' }, 403);
    }

    const authUser = c.get('user');
    const body = await c.req.json();
    const { amount } = body;

    if (!amount || amount < 0 || amount > 100000) {
      return c.json({ success: false, error: 'Invalid amount (max 100000)' }, 400);
    }

    const [user] = await db.select().from(users).where(eq(users.id, authUser.userId)).limit(1);

    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    await db
      .update(users)
      .set({ balance: user.balance + amount })
      .where(eq(users.id, authUser.userId));

    return c.json({
      success: true,
      data: { newBalance: user.balance + amount },
    });
  } catch (error) {
    console.error('Add chips error:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});
