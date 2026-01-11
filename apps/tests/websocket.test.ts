import { describe, test, expect, beforeAll, beforeEach, afterEach } from "bun:test";
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

describe("WebSocket API", () => {
  let adminUser: TestUser;
  let player1: TestUser;
  let player2: TestUser;
  let testRoom: TestRoom;
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

    // Create test room
    testRoom = await createRoom(adminUser.token, {
      name: "Test Room WS",
      smallBlind: 10,
      bigBlind: 20,
      minBuyIn: 200,
      maxBuyIn: 2000,
      maxPlayers: 6,
    });
  });

  beforeEach(async () => {
    // Create fresh players for each test
    player1 = await registerUser(
      generateTestEmail(),
      generateTestUsername(),
      "player1pass"
    );
    player2 = await registerUser(
      generateTestEmail(),
      generateTestUsername(),
      "player2pass"
    );

    ws1 = new TestWebSocketClient();
    ws2 = new TestWebSocketClient();
  });

  afterEach(async () => {
    if (ws1.isConnected) ws1.close();
    if (ws2.isConnected) ws2.close();
    await Bun.sleep(100);
  });

  describe("Connection and Authentication", () => {
    test("should connect to WebSocket server", async () => {
      await ws1.connect();
      expect(ws1.isConnected).toBe(true);
    });

    test("should authenticate with valid token", async () => {
      await ws1.connect();
      const authResult = await ws1.authenticate(player1.token);

      expect(authResult.type).toBe("auth_success");
      expect(authResult.payload.userId).toBe(player1.id);
      expect(authResult.payload.username).toBe(player1.username);
    });

    test("should reject authentication with invalid token", async () => {
      await ws1.connect();
      ws1.send("auth", { token: "invalid-token" });

      const errorMsg = await ws1.waitForMessageType("error");
      expect(errorMsg.type).toBe("error");
      expect(errorMsg.payload.message).toBe("Invalid token");
    });

    test("should reject authentication without token", async () => {
      await ws1.connect();
      ws1.send("auth", {});

      const errorMsg = await ws1.waitForMessageType("error");
      expect(errorMsg.type).toBe("error");
      expect(errorMsg.payload.message).toBe("No token provided");
    });
  });

  describe("Room Operations", () => {
    test("should join room after HTTP join and WS authentication", async () => {
      // Create a unique room for this test
      const room = await createRoom(adminUser.token, {
        name: "Test Room WS Join " + Date.now(),
        smallBlind: 10,
        bigBlind: 20,
        minBuyIn: 200,
        maxBuyIn: 2000,
        maxPlayers: 6,
      });

      // First join via HTTP API
      await joinRoom(player1.token, room.id, 1, 500);

      // Connect and authenticate WebSocket
      await ws1.connect();
      await ws1.authenticate(player1.token);

      // Join room via WebSocket
      const joinResult = await ws1.joinRoom(room.id, 1, 500);

      expect(joinResult.type).toBe("joined_room");
      expect(joinResult.payload.roomId).toBe(room.id);
      expect(joinResult.payload.seatNumber).toBe(1);
      expect(joinResult.payload.stack).toBe(500);

      // Cleanup
      await leaveRoom(player1.token, room.id);
    });

    test("should reject WS join without HTTP join first", async () => {
      await ws1.connect();
      await ws1.authenticate(player1.token);

      ws1.send("join_room", { roomId: testRoom.id, seatNumber: 3, buyIn: 500 });

      const errorMsg = await ws1.waitForMessageType("error");
      expect(errorMsg.type).toBe("error");
      expect(errorMsg.payload.message).toBe("You must join the table through the API first");
    });

    test("should reject join without authentication", async () => {
      await ws1.connect();

      ws1.send("join_room", { roomId: testRoom.id, seatNumber: 1, buyIn: 500 });

      const errorMsg = await ws1.waitForMessageType("error");
      expect(errorMsg.type).toBe("error");
      expect(errorMsg.payload.message).toBe("Not authenticated");
    });

    test("should broadcast player_joined to other players", async () => {
      // Create a unique room for this test
      const room = await createRoom(adminUser.token, {
        name: "Test Room WS Broadcast " + Date.now(),
        smallBlind: 10,
        bigBlind: 20,
        minBuyIn: 200,
        maxBuyIn: 2000,
        maxPlayers: 6,
      });

      // Player 1 joins via HTTP and WS
      await joinRoom(player1.token, room.id, 1, 500);
      await ws1.connect();
      await ws1.authenticate(player1.token);
      await ws1.joinRoom(room.id, 1, 500);
      ws1.clearQueue();

      // Player 2 joins via HTTP and WS
      await joinRoom(player2.token, room.id, 2, 500);
      await ws2.connect();
      await ws2.authenticate(player2.token);
      await ws2.joinRoom(room.id, 2, 500);

      // Player 1 should receive player_joined message
      const playerJoined = await ws1.waitForMessageType("player_joined", 3000);
      expect(playerJoined.type).toBe("player_joined");
      expect(playerJoined.payload.userId).toBe(player2.id);
      expect(playerJoined.payload.username).toBe(player2.username);
      expect(playerJoined.payload.seatNumber).toBe(2);
      expect(playerJoined.payload.stack).toBe(500);

      // Cleanup
      await leaveRoom(player1.token, room.id);
      await leaveRoom(player2.token, room.id);
    });

    test("should handle leave room", async () => {
      // Create a unique room for this test
      const room = await createRoom(adminUser.token, {
        name: "Test Room WS Leave " + Date.now(),
        smallBlind: 10,
        bigBlind: 20,
        minBuyIn: 200,
        maxBuyIn: 2000,
        maxPlayers: 6,
      });

      // Join via HTTP API
      await joinRoom(player1.token, room.id, 1, 500);

      // Connect and join via WebSocket
      await ws1.connect();
      await ws1.authenticate(player1.token);
      await ws1.joinRoom(room.id, 1, 500);

      // Leave room
      const leaveResult = await ws1.leaveRoom();
      expect(leaveResult.type).toBe("left_room");
    });
  });

  describe("Spectator Mode", () => {
    test("should spectate a room", async () => {
      await ws1.connect();
      await ws1.authenticate(player1.token);

      ws1.send("spectate", { roomId: testRoom.id });

      const spectateResult = await ws1.waitForMessageType("spectating");
      expect(spectateResult.type).toBe("spectating");
      expect(spectateResult.payload.roomId).toBe(testRoom.id);
    });

    test("should spectate without authentication", async () => {
      await ws1.connect();

      ws1.send("spectate", { roomId: testRoom.id });

      const spectateResult = await ws1.waitForMessageType("spectating");
      expect(spectateResult.type).toBe("spectating");
      expect(spectateResult.payload.roomId).toBe(testRoom.id);
    });
  });

  describe("Error Handling", () => {
    test("should handle unknown message type", async () => {
      await ws1.connect();
      await ws1.authenticate(player1.token);

      ws1.send("unknown_type", {});

      const errorMsg = await ws1.waitForMessageType("error");
      expect(errorMsg.type).toBe("error");
      expect(errorMsg.payload.message).toContain("Unknown message type");
    });

    test("should handle action without being in room", async () => {
      await ws1.connect();
      await ws1.authenticate(player1.token);

      ws1.send("player_action", { action: "fold" });

      const errorMsg = await ws1.waitForMessageType("error");
      expect(errorMsg.type).toBe("error");
      expect(errorMsg.payload.message).toBe("Not in a room");
    });
  });
});
