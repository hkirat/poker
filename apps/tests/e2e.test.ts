import { describe, test, expect, beforeAll, afterEach } from "bun:test";
import {
  registerUser,
  makeUserAdmin,
  createRoom,
  joinRoom,
  leaveRoom,
  generateTestEmail,
  generateTestUsername,
  TestWebSocketClient,
  TestUser,
  TestRoom,
  BACKEND_URL,
} from "./setup";

describe("End-to-End Game Tests", () => {
  let adminUser: TestUser;
  let gameRoom: TestRoom;
  let player1: TestUser;
  let player2: TestUser;
  let ws1: TestWebSocketClient;
  let ws2: TestWebSocketClient;

  beforeAll(async () => {
    // Create admin user
    adminUser = await registerUser(
      generateTestEmail(),
      generateTestUsername(),
      "adminpass123"
    );
    await makeUserAdmin(adminUser.id);
    // Re-login to get updated token
    const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminUser.email, password: adminUser.password }),
    });
    const loginData = await loginRes.json();
    adminUser.token = loginData.data.token;
  });

  afterEach(async () => {
    // Clean up WebSocket connections
    if (ws1?.isConnected) ws1.close();
    if (ws2?.isConnected) ws2.close();
    await Bun.sleep(200);
  });

  // Helper function to setup two players in a room with game started
  async function setupTwoPlayerGame(roomName: string, buyIn1 = 500, buyIn2 = 500): Promise<void> {
    gameRoom = await createRoom(adminUser.token, {
      name: roomName,
      smallBlind: 10,
      bigBlind: 20,
      minBuyIn: 200,
      maxBuyIn: 2000,
      maxPlayers: 6,
    });

    player1 = await registerUser(generateTestEmail(), generateTestUsername(), "testpass1");
    player2 = await registerUser(generateTestEmail(), generateTestUsername(), "testpass2");

    await joinRoom(player1.token, gameRoom.id, 1, buyIn1);
    await joinRoom(player2.token, gameRoom.id, 2, buyIn2);

    ws1 = new TestWebSocketClient();
    ws2 = new TestWebSocketClient();

    await ws1.connect();
    await ws2.connect();
    await ws1.authenticate(player1.token);
    await ws2.authenticate(player2.token);

    // Join players sequentially to avoid race condition
    ws1.send("join_room", { roomId: gameRoom.id, seatNumber: 1, buyIn: buyIn1 });
    await ws1.waitForMessageType("joined_room", 10000);
    await Bun.sleep(100);

    ws2.send("join_room", { roomId: gameRoom.id, seatNumber: 2, buyIn: buyIn2 });
    await ws2.waitForMessageType("joined_room", 10000);
  }

  describe("WebSocket Room Join Flow", () => {
    test("should join room via WebSocket after HTTP join", async () => {
      gameRoom = await createRoom(adminUser.token, {
        name: "E2E Room " + Date.now(),
        smallBlind: 10,
        bigBlind: 20,
        minBuyIn: 200,
        maxBuyIn: 2000,
        maxPlayers: 6,
      });

      player1 = await registerUser(generateTestEmail(), generateTestUsername(), "player1pass");
      await joinRoom(player1.token, gameRoom.id, 1, 500);
      await Bun.sleep(100);

      ws1 = new TestWebSocketClient();
      await ws1.connect();
      const authResult = await ws1.authenticate(player1.token);
      expect(authResult.type).toBe("auth_success");

      ws1.send("join_room", { roomId: gameRoom.id, seatNumber: 1, buyIn: 500 });
      const joinResult = await ws1.waitForMessageType("joined_room", 10000);

      expect(joinResult.type).toBe("joined_room");
      expect(joinResult.payload.roomId).toBe(gameRoom.id);
      expect(joinResult.payload.seatNumber).toBe(1);
      expect(joinResult.payload.stack).toBe(500);

      await leaveRoom(player1.token, gameRoom.id);
    });

    test("should receive player_joined when another player joins", async () => {
      gameRoom = await createRoom(adminUser.token, {
        name: "E2E Multi Room " + Date.now(),
        smallBlind: 10,
        bigBlind: 20,
        minBuyIn: 200,
        maxBuyIn: 2000,
        maxPlayers: 6,
      });

      player1 = await registerUser(generateTestEmail(), generateTestUsername(), "player1pass");
      await joinRoom(player1.token, gameRoom.id, 1, 500);

      ws1 = new TestWebSocketClient();
      await ws1.connect();
      await ws1.authenticate(player1.token);
      ws1.send("join_room", { roomId: gameRoom.id, seatNumber: 1, buyIn: 500 });
      await ws1.waitForMessageType("joined_room", 10000);
      ws1.clearQueue();

      player2 = await registerUser(generateTestEmail(), generateTestUsername(), "player2pass");
      await joinRoom(player2.token, gameRoom.id, 2, 500);

      ws2 = new TestWebSocketClient();
      await ws2.connect();
      await ws2.authenticate(player2.token);
      ws2.send("join_room", { roomId: gameRoom.id, seatNumber: 2, buyIn: 500 });

      const playerJoinedMsg = await ws1.waitForMessageType("player_joined", 10000);
      expect(playerJoinedMsg.type).toBe("player_joined");
      expect(playerJoinedMsg.payload.username).toBe(player2.username);
      expect(playerJoinedMsg.payload.seatNumber).toBe(2);

      await leaveRoom(player1.token, gameRoom.id);
      await leaveRoom(player2.token, gameRoom.id);
    });
  });

  describe("Game Start and Betting", () => {
    test("should start game when two players join", async () => {
      await setupTwoPlayerGame("E2E Game Start " + Date.now());

      const newRound = await ws1.waitForMessageType("new_round", 5000);
      expect(newRound.type).toBe("new_round");
      expect(newRound.payload.phase).toBe("preflop");
      expect(newRound.payload.pot).toBe(30);
      expect(newRound.payload.players).toHaveLength(2);

      const player1State = await ws1.waitForMessageType("game_state", 5000);
      expect(player1State.payload.yourCards).toHaveLength(2);

      await leaveRoom(player1.token, gameRoom.id);
      await leaveRoom(player2.token, gameRoom.id);
    });

    test("should handle fold action", async () => {
      await setupTwoPlayerGame("E2E Fold Test " + Date.now());

      await ws1.waitForMessageType("new_round", 5000);
      const gameState = await ws1.waitForMessageType("game_state", 5000);
      const currentPlayerId = gameState.payload.players[gameState.payload.currentPlayerIndex].userId;

      const activeWs = currentPlayerId === player1.id ? ws1 : ws2;
      const waitingWs = currentPlayerId === player1.id ? ws2 : ws1;

      activeWs.send("player_action", { action: "fold" });

      const actionResult = await waitingWs.waitForMessageType("action_result", 5000);
      expect(actionResult.payload.action).toBe("fold");

      const handResult = await waitingWs.waitForMessageType("hand_result", 5000);
      expect(handResult.type).toBe("hand_result");
      expect(handResult.payload.winners).toHaveLength(1);
      expect(handResult.payload.pot).toBe(30);

      await leaveRoom(player1.token, gameRoom.id);
      await leaveRoom(player2.token, gameRoom.id);
    });

    test("should handle call action", async () => {
      await setupTwoPlayerGame("E2E Call Test " + Date.now());

      await ws1.waitForMessageType("new_round", 5000);
      const gameState = await ws1.waitForMessageType("game_state", 5000);
      const currentPlayerId = gameState.payload.players[gameState.payload.currentPlayerIndex].userId;
      const activeWs = currentPlayerId === player1.id ? ws1 : ws2;

      activeWs.send("player_action", { action: "call" });

      const actionResult = await activeWs.waitForMessageType("action_result", 5000);
      expect(actionResult.payload.action).toBe("call");

      await leaveRoom(player1.token, gameRoom.id);
      await leaveRoom(player2.token, gameRoom.id);
    });

    test("should handle raise action", async () => {
      await setupTwoPlayerGame("E2E Raise Test " + Date.now());

      await ws1.waitForMessageType("new_round", 5000);
      const gameState = await ws1.waitForMessageType("game_state", 5000);
      const currentPlayerId = gameState.payload.players[gameState.payload.currentPlayerIndex].userId;
      const activeWs = currentPlayerId === player1.id ? ws1 : ws2;

      activeWs.send("player_action", { action: "raise", amount: 40 });

      const actionResult = await activeWs.waitForMessageType("action_result", 5000);
      expect(actionResult.payload.action).toBe("raise");
      expect(actionResult.payload.amount).toBe(40);

      await leaveRoom(player1.token, gameRoom.id);
      await leaveRoom(player2.token, gameRoom.id);
    });

    test("should handle all-in action", async () => {
      await setupTwoPlayerGame("E2E AllIn Test " + Date.now(), 200, 200);

      await ws1.waitForMessageType("new_round", 5000);
      const gameState = await ws1.waitForMessageType("game_state", 5000);
      const currentPlayerId = gameState.payload.players[gameState.payload.currentPlayerIndex].userId;
      const activeWs = currentPlayerId === player1.id ? ws1 : ws2;

      activeWs.send("player_action", { action: "all-in" });

      const actionResult = await activeWs.waitForMessageType("action_result", 5000);
      expect(actionResult.payload.action).toBe("all-in");
      expect(actionResult.payload.stack).toBe(0);

      await leaveRoom(player1.token, gameRoom.id);
      await leaveRoom(player2.token, gameRoom.id);
    });
  });

  describe("Full Hand Play", () => {
    test("should complete a hand when player folds", async () => {
      await setupTwoPlayerGame("E2E Full Hand " + Date.now());

      await ws1.waitForMessageType("new_round", 5000);
      const gameState = await ws1.waitForMessageType("game_state", 5000);
      const currentPlayerId = gameState.payload.players[gameState.payload.currentPlayerIndex].userId;

      // Current player folds
      const activeWs = currentPlayerId === player1.id ? ws1 : ws2;
      activeWs.send("player_action", { action: "fold" });

      // Hand ends with fold
      const handResult = await ws1.waitForMessageType("hand_result", 5000);
      expect(handResult.type).toBe("hand_result");
      expect(handResult.payload.winners).toBeDefined();
      expect(handResult.payload.winners.length).toBe(1);
      expect(handResult.payload.pot).toBe(30);

      await leaveRoom(player1.token, gameRoom.id);
      await leaveRoom(player2.token, gameRoom.id);
    });

  });

  describe("Spectator Mode", () => {
    test("should allow spectator to watch a game", async () => {
      await setupTwoPlayerGame("E2E Spectator " + Date.now());

      await ws1.waitForMessageType("new_round", 5000);

      const spectator = await registerUser(generateTestEmail(), generateTestUsername(), "specpass1");
      const wsSpec = new TestWebSocketClient();
      await wsSpec.connect();
      await wsSpec.authenticate(spectator.token);

      wsSpec.send("spectate", { roomId: gameRoom.id });
      const spectating = await wsSpec.waitForMessageType("spectating", 5000);
      expect(spectating.payload.roomId).toBe(gameRoom.id);

      const specState = await wsSpec.waitForMessageType("game_state", 5000);
      expect(specState.payload.phase).toBe("preflop");
      expect(specState.payload.yourCards).toBeUndefined();

      wsSpec.close();
      await leaveRoom(player1.token, gameRoom.id);
      await leaveRoom(player2.token, gameRoom.id);
    });
  });

  describe("Error Handling", () => {
    test("should reject action when not player's turn", async () => {
      await setupTwoPlayerGame("E2E Wrong Turn " + Date.now());

      await ws1.waitForMessageType("new_round", 5000);
      const gameState = await ws1.waitForMessageType("game_state", 5000);
      const currentPlayerId = gameState.payload.players[gameState.payload.currentPlayerIndex].userId;

      const wrongWs = currentPlayerId === player1.id ? ws2 : ws1;
      wrongWs.send("player_action", { action: "fold" });

      const error = await wrongWs.waitForMessageType("error", 5000);
      expect(error.payload.message).toBe("Invalid action");

      await leaveRoom(player1.token, gameRoom.id);
      await leaveRoom(player2.token, gameRoom.id);
    });
  });
});
