import { describe, test, expect, beforeAll } from "bun:test";
import {
  registerUser,
  makeUserAdmin,
  createRoom,
  joinRoom,
  leaveRoom,
  getRoom,
  generateTestEmail,
  generateTestUsername,
  TestUser,
  TestRoom,
  BACKEND_URL,
} from "./setup";

describe("Poker Game Flow", () => {
  let adminUser: TestUser;

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

  describe("Room and Player Setup", () => {
    test("should create room and allow player to join", async () => {
      const gameRoom = await createRoom(adminUser.token, {
        name: "Test Room Game " + Date.now(),
        smallBlind: 10,
        bigBlind: 20,
        minBuyIn: 200,
        maxBuyIn: 2000,
        maxPlayers: 6,
      });

      const player = await registerUser(
        generateTestEmail(),
        generateTestUsername(),
        "player1pass"
      );

      const joinResult = await joinRoom(player.token, gameRoom.id, 1, 1000);
      expect(joinResult.playerId).toBeDefined();
      expect(joinResult.newBalance).toBe(player.balance - 1000);

      // Verify player is in room
      const roomData = await getRoom(gameRoom.id);
      expect(roomData.currentPlayerCount).toBe(1);
      expect(roomData.players[0].seatNumber).toBe(1);
      expect(roomData.players[0].stack).toBe(1000);

      // Cleanup
      await leaveRoom(player.token, gameRoom.id);
    });

    test("should allow multiple players to join different seats", async () => {
      const gameRoom = await createRoom(adminUser.token, {
        name: "Test Room Multi " + Date.now(),
        smallBlind: 10,
        bigBlind: 20,
        minBuyIn: 200,
        maxBuyIn: 2000,
        maxPlayers: 6,
      });

      const player1 = await registerUser(
        generateTestEmail(),
        generateTestUsername(),
        "player1pass"
      );
      const player2 = await registerUser(
        generateTestEmail(),
        generateTestUsername(),
        "player2pass"
      );

      await joinRoom(player1.token, gameRoom.id, 1, 500);
      await joinRoom(player2.token, gameRoom.id, 2, 500);

      const roomData = await getRoom(gameRoom.id);
      expect(roomData.currentPlayerCount).toBe(2);

      // Cleanup
      await leaveRoom(player1.token, gameRoom.id);
      await leaveRoom(player2.token, gameRoom.id);
    });

    test("should return chips on leave", async () => {
      const gameRoom = await createRoom(adminUser.token, {
        name: "Test Room Leave " + Date.now(),
        smallBlind: 10,
        bigBlind: 20,
        minBuyIn: 200,
        maxBuyIn: 2000,
        maxPlayers: 6,
      });

      const player = await registerUser(
        generateTestEmail(),
        generateTestUsername(),
        "playerpass"
      );

      const initialBalance = player.balance;
      const buyIn = 500;

      await joinRoom(player.token, gameRoom.id, 1, buyIn);
      const leaveResult = await leaveRoom(player.token, gameRoom.id);

      expect(leaveResult.newBalance).toBe(initialBalance);
    });

    test("should prevent joining closed room", async () => {
      const gameRoom = await createRoom(adminUser.token, {
        name: "Test Room Closed " + Date.now(),
        smallBlind: 10,
        bigBlind: 20,
        minBuyIn: 200,
        maxBuyIn: 2000,
        maxPlayers: 6,
      });

      // Close the room
      await fetch(`${BACKEND_URL}/api/admin/rooms/${gameRoom.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminUser.token}`,
        },
        body: JSON.stringify({ status: "closed" }),
      });

      const player = await registerUser(
        generateTestEmail(),
        generateTestUsername(),
        "playerpass"
      );

      const joinRes = await fetch(`${BACKEND_URL}/api/rooms/${gameRoom.id}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${player.token}`,
        },
        body: JSON.stringify({ seatNumber: 1, buyIn: 500 }),
      });

      const joinData = await joinRes.json();
      expect(joinData.success).toBe(false);
      expect(joinData.error).toBe("Room is closed");
    });

    test("should enforce buy-in limits", async () => {
      const gameRoom = await createRoom(adminUser.token, {
        name: "Test Room BuyIn " + Date.now(),
        smallBlind: 10,
        bigBlind: 20,
        minBuyIn: 200,
        maxBuyIn: 2000,
        maxPlayers: 6,
      });

      const player = await registerUser(
        generateTestEmail(),
        generateTestUsername(),
        "playerpass"
      );

      // Try to join with too low buy-in
      const lowBuyInRes = await fetch(`${BACKEND_URL}/api/rooms/${gameRoom.id}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${player.token}`,
        },
        body: JSON.stringify({ seatNumber: 1, buyIn: 100 }),
      });

      const lowBuyInData = await lowBuyInRes.json();
      expect(lowBuyInData.success).toBe(false);
      expect(lowBuyInData.error).toContain("Buy-in must be between");

      // Try to join with too high buy-in
      const highBuyInRes = await fetch(`${BACKEND_URL}/api/rooms/${gameRoom.id}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${player.token}`,
        },
        body: JSON.stringify({ seatNumber: 1, buyIn: 5000 }),
      });

      const highBuyInData = await highBuyInRes.json();
      expect(highBuyInData.success).toBe(false);
      expect(highBuyInData.error).toContain("Buy-in must be between");
    });

    test("should prevent taking occupied seat", async () => {
      const gameRoom = await createRoom(adminUser.token, {
        name: "Test Room Seat " + Date.now(),
        smallBlind: 10,
        bigBlind: 20,
        minBuyIn: 200,
        maxBuyIn: 2000,
        maxPlayers: 6,
      });

      const player1 = await registerUser(
        generateTestEmail(),
        generateTestUsername(),
        "player1pass"
      );
      const player2 = await registerUser(
        generateTestEmail(),
        generateTestUsername(),
        "player2pass"
      );

      // Player 1 takes seat 1
      await joinRoom(player1.token, gameRoom.id, 1, 500);

      // Player 2 tries to take seat 1
      const seatTakenRes = await fetch(`${BACKEND_URL}/api/rooms/${gameRoom.id}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${player2.token}`,
        },
        body: JSON.stringify({ seatNumber: 1, buyIn: 500 }),
      });

      const seatTakenData = await seatTakenRes.json();
      expect(seatTakenData.success).toBe(false);
      expect(seatTakenData.error).toBe("Seat is already taken");

      // Cleanup
      await leaveRoom(player1.token, gameRoom.id);
    });
  });

  describe("Balance Management", () => {
    test("should deduct buy-in from user balance", async () => {
      const gameRoom = await createRoom(adminUser.token, {
        name: "Test Room Balance " + Date.now(),
        smallBlind: 10,
        bigBlind: 20,
        minBuyIn: 200,
        maxBuyIn: 2000,
        maxPlayers: 6,
      });

      const player = await registerUser(
        generateTestEmail(),
        generateTestUsername(),
        "playerpass"
      );

      const buyIn = 500;
      await joinRoom(player.token, gameRoom.id, 1, buyIn);

      // Check balance via API
      const userRes = await fetch(`${BACKEND_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${player.token}` },
      });
      const userData = await userRes.json();

      expect(userData.data.balance).toBe(player.balance - buyIn);

      // Cleanup
      await leaveRoom(player.token, gameRoom.id);
    });

    test("should prevent joining with insufficient balance", async () => {
      const gameRoom = await createRoom(adminUser.token, {
        name: "Test Room Insufficient " + Date.now(),
        smallBlind: 1000,
        bigBlind: 2000,
        minBuyIn: 20000,
        maxBuyIn: 100000,
        maxPlayers: 6,
      });

      const player = await registerUser(
        generateTestEmail(),
        generateTestUsername(),
        "playerpass"
      );

      // Player has 50000 balance, try to buy in for more
      const joinRes = await fetch(`${BACKEND_URL}/api/rooms/${gameRoom.id}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${player.token}`,
        },
        body: JSON.stringify({ seatNumber: 1, buyIn: 60000 }),
      });

      const joinData = await joinRes.json();
      expect(joinData.success).toBe(false);
      expect(joinData.error).toBe("Insufficient balance");
    });
  });
});
