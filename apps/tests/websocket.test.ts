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
