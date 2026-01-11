import type { WebSocket } from 'ws';
import type {
  Card,
  GamePhase,
  GameState,
  Player,
  PlayerAction,
  RoundResult,
  HandResult,
} from '@poker/types';
import { Deck } from './deck';
import { evaluateHand, compareHands } from './hand-evaluator';
import { db, tablePlayers, users, gameHistory, transactions, eq, and } from '@poker/db';

const TURN_TIME_LIMIT = 30000; // 30 seconds

interface RoomPlayer extends Player {
  userId: string;
  ws: WebSocket;
  holeCards: Card[];
}

export interface RoomConfig {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayers: number;
}

export class GameRoom {
  private players: Map<string, RoomPlayer> = new Map();
  private spectators: Map<string, WebSocket> = new Map();
  private deck: Deck = new Deck();
  private gameState: GameState | null = null;
  private turnTimer: Timer | null = null;
  private turnTimerInterval: Timer | null = null;
  private playersActedThisRound: Set<string> = new Set();
  private lastAggressorId: string | null = null;
  private lastDealerIndex: number = -1;
  private config: RoomConfig;

  constructor(config: RoomConfig) {
    this.config = config;
  }

  get id(): string {
    return this.config.id;
  }

  get playerCount(): number {
    return this.players.size;
  }

  addPlayer(userId: string, username: string, seatNumber: number, stack: number, ws: WebSocket): boolean {
    // Handle reconnection - update WebSocket for existing player
    if (this.players.has(userId)) {
      const existingPlayer = this.players.get(userId)!;
      existingPlayer.ws = ws;
      console.log(`Player ${username} reconnected`);

      // Send current game state to reconnected player
      if (this.gameState) {
        this.sendToPlayer(userId, {
          type: 'game_state',
          payload: {
            ...this.getPublicGameState(),
            yourCards: existingPlayer.holeCards,
          },
        });
      }
      return true;
    }

    if (this.players.size >= this.config.maxPlayers) {
      return false;
    }

    // Check if seat is taken
    for (const player of this.players.values()) {
      if (player.seatNumber === seatNumber) {
        return false;
      }
    }

    const player: RoomPlayer = {
      id: userId,
      userId,
      username,
      seatNumber,
      stack,
      status: 'waiting',
      currentBet: 0,
      holeCards: [],
      ws,
    };

    this.players.set(userId, player);
    console.log(`Player ${username} joined. Total players: ${this.players.size}`);

    this.broadcast({
      type: 'player_joined',
      payload: {
        userId,
        username,
        seatNumber,
        stack,
      },
    });

    // Start game if we have 2+ players and no game is running
    if (this.players.size >= 2 && !this.gameState) {
      console.log('Starting new hand in 2 seconds...');
      setTimeout(() => this.startNewHand(), 2000);
    }

    return true;
  }

  removePlayer(userId: string): number {
    const player = this.players.get(userId);
    if (!player) {
      return 0;
    }

    const stack = player.stack;

    // If player was in active game, handle their departure but keep them visible
    if (this.gameState) {
      const gamePlayer = this.gameState.players.find((p) => p.userId === userId);
      if (gamePlayer && gamePlayer.status !== 'folded') {
        gamePlayer.status = 'folded';

        // Remove from active players map (they can't play anymore)
        this.players.delete(userId);

        this.broadcast({
          type: 'player_left',
          payload: { userId },
        });

        // Broadcast updated game state so everyone sees them as folded
        this.broadcast({
          type: 'game_state',
          payload: this.getPublicGameState(),
        });

        // Send updated state with hole cards to remaining players
        for (const p of this.players.values()) {
          this.sendToPlayer(p.userId, {
            type: 'game_state',
            payload: {
              ...this.getPublicGameState(),
              yourCards: p.holeCards,
            },
          });
        }

        this.checkForWinner();
      } else {
        // Player already folded, just remove them
        this.players.delete(userId);
        this.broadcast({
          type: 'player_left',
          payload: { userId },
        });
      }
    } else {
      // No active game, just remove player
      this.players.delete(userId);
      this.broadcast({
        type: 'player_left',
        payload: { userId },
      });
    }

    return stack;
  }

  async sitOutPlayer(userId: string, reason: 'timeout' | 'disconnect' = 'timeout'): Promise<void> {
    const player = this.players.get(userId);
    if (!player) {
      return;
    }

    console.log(`Sitting out player ${player.username} (${reason}), returning ${player.stack} chips`);

    const stackToReturn = player.stack;

    // Mark as folded in game state if game is active
    if (this.gameState) {
      const gamePlayer = this.gameState.players.find((p) => p.userId === userId);
      if (gamePlayer) {
        gamePlayer.status = 'folded';
      }
    }

    // Remove from active players
    this.players.delete(userId);

    // Return chips to user balance and remove from table
    try {
      // Get current user balance
      const [user] = await db
        .select({ balance: users.balance })
        .from(users)
        .where(eq(users.id, userId));

      if (user) {
        // Add stack back to user balance
        await db
          .update(users)
          .set({ balance: user.balance + stackToReturn })
          .where(eq(users.id, userId));
      }

      // Remove from table_players
      await db
        .delete(tablePlayers)
        .where(
          and(
            eq(tablePlayers.roomId, this.config.id),
            eq(tablePlayers.userId, userId)
          )
        );
    } catch (error) {
      console.error('Failed to return chips for sat out player:', error);
    }

    // Broadcast that player was sat out
    this.broadcast({
      type: 'player_sat_out',
      payload: {
        userId,
        username: player.username,
        reason,
        chipsReturned: stackToReturn,
      },
    });

    // If game is active, broadcast updated state and continue
    if (this.gameState) {
      this.broadcast({
        type: 'game_state',
        payload: this.getPublicGameState(),
      });

      // Send updated state with hole cards to remaining players
      for (const p of this.players.values()) {
        this.sendToPlayer(p.userId, {
          type: 'game_state',
          payload: {
            ...this.getPublicGameState(),
            yourCards: p.holeCards,
          },
        });
      }

      // Check if we have a winner or need to advance
      if (!this.checkForWinner()) {
        this.advanceGame();
      }
    }
  }

  addSpectator(userId: string, ws: WebSocket): void {
    this.spectators.set(userId, ws);
    // Send current game state
    if (this.gameState) {
      this.sendToPlayer(userId, {
        type: 'game_state',
        payload: this.getPublicGameState(),
      });
    }
  }

  removeSpectator(userId: string): void {
    this.spectators.delete(userId);
  }

  handleAction(userId: string, action: PlayerAction, amount?: number): boolean {
    console.log('handleAction:', { userId, action, amount, hasGameState: !!this.gameState });

    if (!this.gameState) {
      console.log('No game state!');
      return false;
    }

    const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
    console.log('Current player turn:', currentPlayer?.userId, 'Action from:', userId);
    if (currentPlayer.userId !== userId) {
      console.log('Not this player turn!');
      return false;
    }

    const player = this.players.get(userId);
    if (!player) {
      console.log('Player not found in map!');
      return false;
    }

    this.clearTurnTimer();

    let success = false;

    switch (action) {
      case 'fold':
        success = this.handleFold(player);
        break;
      case 'check':
        success = this.handleCheck(player);
        break;
      case 'call':
        success = this.handleCall(player);
        break;
      case 'raise':
        success = this.handleRaise(player, amount || 0);
        break;
      case 'all-in':
        success = this.handleAllIn(player);
        break;
    }

    if (success) {
      // Track that this player has acted
      this.playersActedThisRound.add(userId);

      // If it's a raise or all-in that increases the bet, reset acted tracking (others need to respond)
      if (action === 'raise' || (action === 'all-in' && player.currentBet > this.gameState.currentBet)) {
        this.playersActedThisRound.clear();
        this.playersActedThisRound.add(userId); // Raiser has acted
        this.lastAggressorId = userId;
      }

      this.broadcast({
        type: 'action_result',
        payload: {
          userId,
          action,
          amount: action === 'raise' ? amount : player.currentBet,
          stack: player.stack,
        },
      });

      this.advanceGame();
    }

    return success;
  }

  private handleFold(player: RoomPlayer): boolean {
    const gamePlayer = this.gameState!.players.find((p) => p.userId === player.userId);
    if (gamePlayer) {
      gamePlayer.status = 'folded';
    }
    player.status = 'folded';
    return true;
  }

  private handleCheck(player: RoomPlayer): boolean {
    if (player.currentBet < this.gameState!.currentBet) {
      return false; // Can't check if there's a bet to call
    }
    return true;
  }

  private handleCall(player: RoomPlayer): boolean {
    const callAmount = this.gameState!.currentBet - player.currentBet;
    if (callAmount <= 0) {
      return false;
    }

    const actualCall = Math.min(callAmount, player.stack);
    player.stack -= actualCall;
    player.currentBet += actualCall;
    this.gameState!.pot += actualCall;

    if (player.stack === 0) {
      player.status = 'all-in';
      const gamePlayer = this.gameState!.players.find((p) => p.userId === player.userId);
      if (gamePlayer) {
        gamePlayer.status = 'all-in';
        gamePlayer.stack = 0;
      }
    }

    this.syncPlayerState(player);
    return true;
  }

  private handleRaise(player: RoomPlayer, raiseAmount: number): boolean {
    const callAmount = this.gameState!.currentBet - player.currentBet;
    const totalAmount = callAmount + raiseAmount;

    if (totalAmount > player.stack) {
      return false;
    }

    if (raiseAmount < this.gameState!.minRaise && player.stack > totalAmount) {
      return false; // Raise must be at least min raise unless all-in
    }

    player.stack -= totalAmount;
    player.currentBet += totalAmount;
    this.gameState!.pot += totalAmount;
    this.gameState!.currentBet = player.currentBet;
    this.gameState!.minRaise = raiseAmount;

    if (player.stack === 0) {
      player.status = 'all-in';
    }

    this.syncPlayerState(player);
    return true;
  }

  private handleAllIn(player: RoomPlayer): boolean {
    const allInAmount = player.stack;
    player.currentBet += allInAmount;
    this.gameState!.pot += allInAmount;

    if (player.currentBet > this.gameState!.currentBet) {
      const raiseAmount = player.currentBet - this.gameState!.currentBet;
      this.gameState!.currentBet = player.currentBet;
      if (raiseAmount > this.gameState!.minRaise) {
        this.gameState!.minRaise = raiseAmount;
      }
    }

    player.stack = 0;
    player.status = 'all-in';

    const gamePlayer = this.gameState!.players.find((p) => p.userId === player.userId);
    if (gamePlayer) {
      gamePlayer.status = 'all-in';
      gamePlayer.stack = 0;
      gamePlayer.currentBet = player.currentBet;
    }

    return true;
  }

  private syncPlayerState(player: RoomPlayer): void {
    const gamePlayer = this.gameState!.players.find((p) => p.userId === player.userId);
    if (gamePlayer) {
      gamePlayer.stack = player.stack;
      gamePlayer.currentBet = player.currentBet;
      gamePlayer.status = player.status;
    }
  }

  private startNewHand(): void {
    console.log('startNewHand called');
    const activePlayers = Array.from(this.players.values()).filter(
      (p) => p.stack > 0
    );
    console.log('Active players:', activePlayers.length, activePlayers.map(p => ({ username: p.username, stack: p.stack })));

    if (activePlayers.length < 2) {
      console.log('Not enough players, returning');
      this.gameState = null;
      return;
    }

    this.deck.reset();

    // Reset betting round tracking
    this.playersActedThisRound.clear();
    this.lastAggressorId = null;

    // Sort by seat number
    activePlayers.sort((a, b) => a.seatNumber - b.seatNumber);

    // Determine dealer, small blind, big blind (rotate from last hand)
    const dealerIndex = (this.lastDealerIndex + 1) % activePlayers.length;
    this.lastDealerIndex = dealerIndex; // Save for next hand

    // In heads-up, dealer is small blind and acts first preflop
    const isHeadsUp = activePlayers.length === 2;
    const smallBlindIndex = isHeadsUp ? dealerIndex : (dealerIndex + 1) % activePlayers.length;
    const bigBlindIndex = isHeadsUp ? (dealerIndex + 1) % activePlayers.length : (dealerIndex + 2) % activePlayers.length;

    // Reset player states
    for (const player of activePlayers) {
      player.status = 'active';
      player.currentBet = 0;
      player.holeCards = this.deck.deal(2);
    }

    // Post blinds
    const smallBlindPlayer = activePlayers[smallBlindIndex];
    const bigBlindPlayer = activePlayers[bigBlindIndex];

    const sbAmount = Math.min(this.config.smallBlind, smallBlindPlayer.stack);
    const bbAmount = Math.min(this.config.bigBlind, bigBlindPlayer.stack);

    smallBlindPlayer.stack -= sbAmount;
    smallBlindPlayer.currentBet = sbAmount;
    if (smallBlindPlayer.stack === 0) smallBlindPlayer.status = 'all-in';

    bigBlindPlayer.stack -= bbAmount;
    bigBlindPlayer.currentBet = bbAmount;
    if (bigBlindPlayer.stack === 0) bigBlindPlayer.status = 'all-in';

    const pot = sbAmount + bbAmount;

    // Create game state
    this.gameState = {
      id: crypto.randomUUID(),
      roomId: this.config.id,
      phase: 'preflop',
      pot,
      communityCards: [],
      currentPlayerIndex: (bigBlindIndex + 1) % activePlayers.length,
      dealerIndex,
      smallBlindIndex,
      bigBlindIndex,
      currentBet: bbAmount,
      minRaise: this.config.bigBlind,
      players: activePlayers.map((p) => ({
        id: p.id,
        userId: p.userId,
        username: p.username,
        seatNumber: p.seatNumber,
        stack: p.stack,
        status: p.status,
        currentBet: p.currentBet,
        isDealer: p.seatNumber === activePlayers[dealerIndex].seatNumber,
        isSmallBlind: p.seatNumber === activePlayers[smallBlindIndex].seatNumber,
        isBigBlind: p.seatNumber === activePlayers[bigBlindIndex].seatNumber,
      })),
      turnStartTime: Date.now(),
      turnTimeLimit: TURN_TIME_LIMIT,
    };

    // Broadcast new hand
    this.broadcast({
      type: 'new_round',
      payload: this.getPublicGameState(),
    });

    // Send hole cards to each player
    for (const player of activePlayers) {
      this.sendToPlayer(player.userId, {
        type: 'game_state',
        payload: {
          ...this.getPublicGameState(),
          yourCards: player.holeCards,
        },
      });
    }

    this.startTurnTimer();
  }

  private advanceGame(): void {
    if (!this.gameState) return;

    // Check if only one player remains
    if (this.checkForWinner()) {
      return;
    }

    // Move to next active player
    let nextIndex = this.gameState.currentPlayerIndex;
    let loopCount = 0;

    do {
      nextIndex = (nextIndex + 1) % this.gameState.players.length;
      loopCount++;

      // Prevent infinite loop
      if (loopCount > this.gameState.players.length) {
        break;
      }
    } while (
      this.gameState.players[nextIndex].status === 'folded' ||
      this.gameState.players[nextIndex].status === 'all-in'
    );

    // Check if betting round is complete
    if (this.isBettingRoundComplete()) {
      this.advancePhase();
      return;
    }

    this.gameState.currentPlayerIndex = nextIndex;
    this.gameState.turnStartTime = Date.now();

    // Broadcast full game state so all clients know whose turn it is
    this.broadcast({
      type: 'game_state',
      payload: this.getPublicGameState(),
    });

    // Also send hole cards to each player
    for (const player of this.players.values()) {
      this.sendToPlayer(player.userId, {
        type: 'game_state',
        payload: {
          ...this.getPublicGameState(),
          yourCards: player.holeCards,
        },
      });
    }

    this.startTurnTimer();
  }

  private isBettingRoundComplete(): boolean {
    if (!this.gameState) return true;

    const activePlayers = this.gameState.players.filter(
      (p) => p.status === 'active'
    );

    if (activePlayers.length <= 1) return true;

    // All active players must have acted AND matched the current bet
    const allPlayersActed = activePlayers.every(
      (p) => this.playersActedThisRound.has(p.userId)
    );

    const allBetsMatched = activePlayers.every(
      (p) => p.currentBet === this.gameState!.currentBet
    );

    return allPlayersActed && allBetsMatched;
  }

  private advancePhase(): void {
    if (!this.gameState) return;

    // Reset tracking for new betting round
    this.playersActedThisRound.clear();
    this.lastAggressorId = null;

    // Reset bets for new phase
    for (const player of this.gameState.players) {
      player.currentBet = 0;
    }
    for (const player of this.players.values()) {
      player.currentBet = 0;
    }
    this.gameState.currentBet = 0;
    this.gameState.minRaise = this.config.bigBlind;

    const phases: GamePhase[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    const currentPhaseIndex = phases.indexOf(this.gameState.phase);

    if (currentPhaseIndex >= phases.length - 1) {
      this.showdown();
      return;
    }

    this.gameState.phase = phases[currentPhaseIndex + 1];

    // Deal community cards
    switch (this.gameState.phase) {
      case 'flop':
        this.gameState.communityCards = this.deck.deal(3);
        break;
      case 'turn':
        this.gameState.communityCards.push(...this.deck.deal(1));
        break;
      case 'river':
        this.gameState.communityCards.push(...this.deck.deal(1));
        break;
      case 'showdown':
        this.showdown();
        return;
    }

    // Find first active player after dealer
    let startIndex = (this.gameState.dealerIndex + 1) % this.gameState.players.length;
    while (
      this.gameState.players[startIndex].status === 'folded' ||
      this.gameState.players[startIndex].status === 'all-in'
    ) {
      startIndex = (startIndex + 1) % this.gameState.players.length;
    }

    this.gameState.currentPlayerIndex = startIndex;
    this.gameState.turnStartTime = Date.now();

    this.broadcast({
      type: 'game_state',
      payload: this.getPublicGameState(),
    });

    // Send updated state with hole cards to each player
    for (const player of this.players.values()) {
      this.sendToPlayer(player.userId, {
        type: 'game_state',
        payload: {
          ...this.getPublicGameState(),
          yourCards: player.holeCards,
        },
      });
    }

    // Check if all active players are all-in
    const activePlayers = this.gameState.players.filter((p) => p.status === 'active');
    if (activePlayers.length <= 1) {
      // Run out remaining cards
      if (this.gameState.phase === 'flop') {
        this.gameState.communityCards.push(...this.deck.deal(2));
      } else if (this.gameState.phase === 'turn') {
        this.gameState.communityCards.push(...this.deck.deal(1));
      }
      this.showdown();
      return;
    }

    this.startTurnTimer();
  }

  private checkForWinner(): boolean {
    if (!this.gameState) return true;

    const remainingPlayers = this.gameState.players.filter(
      (p) => p.status !== 'folded'
    );

    if (remainingPlayers.length === 1) {
      const winner = remainingPlayers[0];
      const winAmount = this.gameState.pot;

      // Award pot to winner
      const winnerPlayer = this.players.get(winner.userId);
      if (winnerPlayer) {
        winnerPlayer.stack += winAmount;
        winner.stack = winnerPlayer.stack;
      }

      const result: RoundResult = {
        winners: [
          {
            userId: winner.userId,
            username: winner.username,
            amount: winAmount,
          },
        ],
        pot: this.gameState.pot,
      };

      this.broadcast({
        type: 'hand_result',
        payload: result,
      });

      this.saveGameResult(result);
      this.endHand();
      return true;
    }

    return false;
  }

  private showdown(): void {
    if (!this.gameState) return;

    const eligiblePlayers = this.gameState.players.filter(
      (p) => p.status !== 'folded'
    );

    // Evaluate all hands
    const results: Array<{ player: Player; hand: HandResult }> = [];

    for (const player of eligiblePlayers) {
      const roomPlayer = this.players.get(player.userId);
      if (!roomPlayer) continue;

      const hand = evaluateHand(roomPlayer.holeCards, this.gameState.communityCards);
      hand.userId = player.userId;
      results.push({ player, hand });
    }

    // Sort by hand strength
    results.sort((a, b) => compareHands(b.hand, a.hand));

    // Find winners (could be multiple in case of tie)
    const winners: Array<{
      userId: string;
      username: string;
      amount: number;
      hand: HandResult;
    }> = [];

    const topHandValue = results[0].hand.rankValue;
    const winningPlayers = results.filter((r) => r.hand.rankValue === topHandValue);
    const winAmount = Math.floor(this.gameState.pot / winningPlayers.length);

    for (const { player, hand } of winningPlayers) {
      const roomPlayer = this.players.get(player.userId);
      if (roomPlayer) {
        roomPlayer.stack += winAmount;
      }

      winners.push({
        userId: player.userId,
        username: player.username,
        amount: winAmount,
        hand,
      });
    }

    // Reveal all hands
    const revealedHands: Record<string, Card[]> = {};
    for (const { player } of results) {
      const roomPlayer = this.players.get(player.userId);
      if (roomPlayer) {
        revealedHands[player.userId] = roomPlayer.holeCards;
      }
    }

    const result: RoundResult = {
      winners,
      pot: this.gameState.pot,
    };

    this.broadcast({
      type: 'hand_result',
      payload: {
        ...result,
        revealedHands,
        communityCards: this.gameState.communityCards,
      },
    });

    this.saveGameResult(result);
    this.endHand();
  }

  private async saveGameResult(result: RoundResult): Promise<void> {
    try {
      // Update player stacks in database
      for (const player of this.players.values()) {
        await db
          .update(tablePlayers)
          .set({ stack: player.stack })
          .where(
            and(eq(tablePlayers.roomId, this.config.id), eq(tablePlayers.userId, player.userId))
          );
      }

      // Save game history
      if (result.winners.length > 0 && this.gameState) {
        await db.insert(gameHistory).values({
          roomId: this.config.id,
          winnerId: result.winners[0].userId,
          pot: result.pot,
          communityCards: JSON.stringify(this.gameState.communityCards),
          handData: JSON.stringify(result),
        });

        // Record winning transactions
        for (const winner of result.winners) {
          await db.insert(transactions).values({
            userId: winner.userId,
            roomId: this.config.id,
            type: 'win',
            amount: winner.amount,
            balanceBefore: 0, // Stack based, not wallet
            balanceAfter: 0,
          });
        }
      }
    } catch (error) {
      console.error('Failed to save game result:', error);
    }
  }

  private endHand(): void {
    this.clearTurnTimer();

    // Remove players with no chips
    const brokePlayers: string[] = [];
    for (const player of this.players.values()) {
      if (player.stack <= 0) {
        brokePlayers.push(player.userId);
      }
    }

    for (const userId of brokePlayers) {
      this.players.delete(userId);
      this.broadcast({
        type: 'player_left',
        payload: { userId, reason: 'busted' },
      });
    }

    this.gameState = null;

    // Start new hand after delay if enough players
    if (this.players.size >= 2) {
      setTimeout(() => this.startNewHand(), 5000);
    }
  }

  private startTurnTimer(): void {
    this.clearTurnTimer();

    this.turnTimer = setTimeout(async () => {
      if (!this.gameState) return;

      const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
      const roomPlayer = this.players.get(currentPlayer.userId);

      if (roomPlayer) {
        // Player timed out - sit them out of the table entirely
        console.log(`Player ${roomPlayer.username} timed out - sitting them out`);

        this.broadcast({
          type: 'timer_update',
          payload: {
            userId: currentPlayer.userId,
            timedOut: true,
          },
        });

        // Sit out the player (removes from table, returns chips to balance)
        await this.sitOutPlayer(currentPlayer.userId, 'timeout');
      }
    }, TURN_TIME_LIMIT);

    // Broadcast timer updates
    let remaining = TURN_TIME_LIMIT;
    this.turnTimerInterval = setInterval(() => {
      remaining -= 1000;
      if (remaining <= 0 || !this.gameState) {
        if (this.turnTimerInterval) {
          clearInterval(this.turnTimerInterval);
          this.turnTimerInterval = null;
        }
        return;
      }

      this.broadcast({
        type: 'timer_update',
        payload: {
          userId: this.gameState.players[this.gameState.currentPlayerIndex].userId,
          remaining,
        },
      });
    }, 1000);
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    if (this.turnTimerInterval) {
      clearInterval(this.turnTimerInterval);
      this.turnTimerInterval = null;
    }
  }

  private getPublicGameState(): Partial<GameState> {
    if (!this.gameState) return {};

    return {
      id: this.gameState.id,
      roomId: this.gameState.roomId,
      phase: this.gameState.phase,
      pot: this.gameState.pot,
      communityCards: this.gameState.communityCards,
      currentPlayerIndex: this.gameState.currentPlayerIndex,
      dealerIndex: this.gameState.dealerIndex,
      smallBlindIndex: this.gameState.smallBlindIndex,
      bigBlindIndex: this.gameState.bigBlindIndex,
      currentBet: this.gameState.currentBet,
      minRaise: this.gameState.minRaise,
      players: this.gameState.players.map((p) => ({
        ...p,
        cards: undefined, // Hide other players' cards
      })),
      turnStartTime: this.gameState.turnStartTime,
      turnTimeLimit: this.gameState.turnTimeLimit,
    };
  }

  private broadcast(message: { type: string; payload: unknown }): void {
    const data = JSON.stringify(message);

    for (const player of this.players.values()) {
      if (player.ws.readyState === 1) {
        // WebSocket.OPEN
        player.ws.send(data);
      }
    }

    for (const ws of this.spectators.values()) {
      if (ws.readyState === 1) {
        ws.send(data);
      }
    }
  }

  private sendToPlayer(userId: string, message: { type: string; payload: unknown }): void {
    const player = this.players.get(userId);
    if (player && player.ws.readyState === 1) {
      player.ws.send(JSON.stringify(message));
    }

    const spectator = this.spectators.get(userId);
    if (spectator && spectator.readyState === 1) {
      spectator.send(JSON.stringify(message));
    }
  }
}
