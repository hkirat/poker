# Poker Platform

A multiplayer Texas Hold'em poker platform built with modern web technologies.

## Tech Stack

- **Backend**: BunJS + Hono
- **Database**: PostgreSQL + Drizzle ORM
- **Real-time**: WebSocket (ws library)
- **Frontend**: React + Tailwind CSS + shadcn/ui
- **Monorepo**: Turborepo

## Architecture

```
poker/
├── apps/
│   ├── admin-frontend/   # Admin dashboard (React)
│   ├── user-frontend/    # Player interface (React)
│   ├── backend/          # REST API (Bun + Hono)
│   └── websocket/        # Game server (Bun + ws)
└── packages/
    ├── db/               # Database schema (Drizzle)
    ├── types/            # Shared TypeScript types
    └── ui/               # Shared UI components
```

## Features

### Game
- Texas Hold'em No-Limit poker
- 2-9 players per table
- 30-second turn timer (auto-fold on timeout)
- Real-time gameplay via WebSockets
- Hand evaluation and pot distribution

### Admin
- Create and configure rooms (blinds, buy-in limits)
- Manage room status (open/closed)
- User management (promote/demote admins)

### Users
- Registration with 50,000 chips signup bonus
- View and join active tables
- Minimum 3 big blinds required to join a table
- Buy-in selection when joining tables

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- PostgreSQL >= 14

### Setup

1. **Clone and install dependencies**
   ```bash
   cd poker
   bun install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Create the database**
   ```bash
   createdb poker
   ```

4. **Run database migrations**
   ```bash
   bun run db:push
   ```

5. **Create an admin user**

   Register a user through the user frontend, then manually set `is_admin = true` in the database:
   ```sql
   UPDATE users SET is_admin = true WHERE email = 'your@email.com';
   ```

### Development

Run all services in development mode:
```bash
bun run dev
```

Or run individual services:
```bash
# Backend API (port 3000)
cd apps/backend && bun run dev

# WebSocket server (port 3001)
cd apps/websocket && bun run dev

# User frontend (port 5173)
cd apps/user-frontend && bun run dev

# Admin frontend (port 5174)
cd apps/admin-frontend && bun run dev
```

### URLs

- User Frontend: http://localhost:5173
- Admin Frontend: http://localhost:5174
- Backend API: http://localhost:3000
- WebSocket: ws: http://localhost:3001

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login

### Rooms
- `GET /api/rooms` - List active rooms
- `GET /api/rooms/:id` - Get room details
- `POST /api/rooms/:id/join` - Join a room (requires auth)
- `POST /api/rooms/:id/leave` - Leave a room (requires auth)

### Users
- `GET /api/users/me` - Get current user profile
- `GET /api/users/transactions` - Get transaction history

### Admin
- `GET /api/admin/rooms` - List all rooms
- `POST /api/admin/rooms` - Create room
- `PATCH /api/admin/rooms/:id` - Update room status
- `DELETE /api/admin/rooms/:id` - Delete room
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users/:id/admin` - Toggle admin status

## WebSocket Messages

### Client -> Server
- `auth` - Authenticate with JWT token
- `join_room` - Join a room
- `leave_room` - Leave current room
- `player_action` - Send game action (fold/check/call/raise/all-in)

### Server -> Client
- `auth_success` - Authentication successful
- `joined_room` - Successfully joined room
- `game_state` - Current game state
- `new_round` - New hand started
- `player_turn` - It's a player's turn
- `action_result` - Action was processed
- `timer_update` - Turn timer update
- `hand_result` - Hand finished with results
- `error` - Error message

## Database Schema

- **users** - User accounts with balance
- **rooms** - Poker tables with configuration
- **table_players** - Players currently at tables
- **transactions** - Buy-in/cash-out/win records
- **game_history** - Completed hand records

## License

MIT
