import { pgTable, text, integer, boolean, timestamp, uuid, decimal, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const roomStatusEnum = pgEnum('room_status', ['waiting', 'playing', 'closed']);
export const transactionTypeEnum = pgEnum('transaction_type', ['buy_in', 'cash_out', 'win', 'signup_bonus']);

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  balance: integer('balance').notNull().default(50000), // 50,000 chips signup bonus
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Rooms table
export const rooms = pgTable('rooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  smallBlind: integer('small_blind').notNull(),
  bigBlind: integer('big_blind').notNull(),
  minBuyIn: integer('min_buy_in').notNull(),
  maxBuyIn: integer('max_buy_in').notNull(),
  maxPlayers: integer('max_players').notNull().default(9),
  status: roomStatusEnum('status').notNull().default('waiting'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Players at tables (current session)
export const tablePlayers = pgTable('table_players', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  seatNumber: integer('seat_number').notNull(),
  stack: integer('stack').notNull(),
  status: text('status').notNull().default('waiting'), // waiting, active, folded, all-in, sitting-out
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

// Transactions for wallet
export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  type: transactionTypeEnum('type').notNull(),
  amount: integer('amount').notNull(),
  balanceBefore: integer('balance_before').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Game history
export const gameHistory = pgTable('game_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  winnerId: uuid('winner_id').references(() => users.id, { onDelete: 'set null' }),
  pot: integer('pot').notNull(),
  communityCards: text('community_cards'), // JSON string of cards
  handData: text('hand_data'), // JSON string of full hand details
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  tablePlayers: many(tablePlayers),
  transactions: many(transactions),
  createdRooms: many(rooms),
  wonGames: many(gameHistory),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  creator: one(users, {
    fields: [rooms.createdBy],
    references: [users.id],
  }),
  players: many(tablePlayers),
  transactions: many(transactions),
  games: many(gameHistory),
}));

export const tablePlayersRelations = relations(tablePlayers, ({ one }) => ({
  room: one(rooms, {
    fields: [tablePlayers.roomId],
    references: [rooms.id],
  }),
  user: one(users, {
    fields: [tablePlayers.userId],
    references: [users.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  room: one(rooms, {
    fields: [transactions.roomId],
    references: [rooms.id],
  }),
}));

export const gameHistoryRelations = relations(gameHistory, ({ one }) => ({
  room: one(rooms, {
    fields: [gameHistory.roomId],
    references: [rooms.id],
  }),
  winner: one(users, {
    fields: [gameHistory.winnerId],
    references: [users.id],
  }),
}));
