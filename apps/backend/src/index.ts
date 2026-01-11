import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth';
import { roomRoutes } from './routes/rooms';
import { userRoutes } from './routes/users';
import { adminRoutes } from './routes/admin';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  })
);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/rooms', roomRoutes);
app.route('/api/users', userRoutes);
app.route('/api/admin', adminRoutes);

const port = parseInt(process.env.PORT || '3000');

console.log(`Backend server running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
