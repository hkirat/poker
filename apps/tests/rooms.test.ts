import { describe, test, expect, beforeAll } from "bun:test";
import {
  registerUser,
  makeUserAdmin,
  generateTestEmail,
  generateTestUsername,
  BACKEND_URL,
  TestUser,
} from "./setup";

describe("Room API", () => {
  let adminUser: TestUser;
  let regularUser: TestUser;

  beforeAll(async () => {
    // Create admin user
    adminUser = await registerUser(
      generateTestEmail(),
      generateTestUsername(),
      "adminpass123"
    );
    await makeUserAdmin(adminUser.id);
    // Re-login to get updated token with admin flag
    const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminUser.email, password: adminUser.password }),
    });
    const loginData = await loginRes.json();
    adminUser.token = loginData.data.token;
    adminUser.isAdmin = true;

    // Create regular user
    regularUser = await registerUser(
      generateTestEmail(),
      generateTestUsername(),
      "userpass123"
    );
  });

  describe("Admin Room Management", () => {
    describe("POST /api/admin/rooms", () => {
      test("should create a room as admin", async () => {
        const response = await fetch(`${BACKEND_URL}/api/admin/rooms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminUser.token}`,
          },
          body: JSON.stringify({
            name: "Test Room 1",
            smallBlind: 10,
            bigBlind: 20,
            minBuyIn: 200,
            maxBuyIn: 2000,
            maxPlayers: 6,
          }),
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.name).toBe("Test Room 1");
        expect(data.data.smallBlind).toBe(10);
        expect(data.data.bigBlind).toBe(20);
        expect(data.data.minBuyIn).toBe(200);
        expect(data.data.maxBuyIn).toBe(2000);
        expect(data.data.maxPlayers).toBe(6);
        expect(data.data.status).toBe("waiting");
      });

      test("should reject room creation from non-admin", async () => {
        const response = await fetch(`${BACKEND_URL}/api/admin/rooms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${regularUser.token}`,
          },
          body: JSON.stringify({
            name: "Test Room Unauthorized",
            smallBlind: 10,
            bigBlind: 20,
            minBuyIn: 200,
            maxBuyIn: 2000,
            maxPlayers: 6,
          }),
        });

        expect(response.status).toBe(403);
      });

      test("should reject room with big blind != 2x small blind", async () => {
        const response = await fetch(`${BACKEND_URL}/api/admin/rooms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminUser.token}`,
          },
          body: JSON.stringify({
            name: "Test Room Invalid Blinds",
            smallBlind: 10,
            bigBlind: 30, // Should be 20
            minBuyIn: 200,
            maxBuyIn: 2000,
            maxPlayers: 6,
          }),
        });

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe("Big blind must be exactly 2x the small blind");
      });

      test("should reject room with minBuyIn > maxBuyIn", async () => {
        const response = await fetch(`${BACKEND_URL}/api/admin/rooms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminUser.token}`,
          },
          body: JSON.stringify({
            name: "Test Room Invalid BuyIn",
            smallBlind: 10,
            bigBlind: 20,
            minBuyIn: 3000,
            maxBuyIn: 2000,
            maxPlayers: 6,
          }),
        });

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe("Min buy-in cannot be greater than max buy-in");
      });

      test("should reject room with minBuyIn < 10 big blinds", async () => {
        const response = await fetch(`${BACKEND_URL}/api/admin/rooms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminUser.token}`,
          },
          body: JSON.stringify({
            name: "Test Room Low BuyIn",
            smallBlind: 10,
            bigBlind: 20,
            minBuyIn: 100, // Should be at least 200 (10 * bigBlind)
            maxBuyIn: 2000,
            maxPlayers: 6,
          }),
        });

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe("Min buy-in should be at least 10 big blinds");
      });
    });

    describe("GET /api/admin/rooms", () => {
      test("should get all rooms as admin", async () => {
        const response = await fetch(`${BACKEND_URL}/api/admin/rooms`, {
          headers: { Authorization: `Bearer ${adminUser.token}` },
        });

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
      });

      test("should reject request from non-admin", async () => {
        const response = await fetch(`${BACKEND_URL}/api/admin/rooms`, {
          headers: { Authorization: `Bearer ${regularUser.token}` },
        });

        expect(response.status).toBe(403);
      });
    });
  });

  describe("Public Room Endpoints", () => {
    let testRoomId: string;

    beforeAll(async () => {
      // Create a test room
      const response = await fetch(`${BACKEND_URL}/api/admin/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminUser.token}`,
        },
        body: JSON.stringify({
          name: "Test Room Public",
          smallBlind: 10,
          bigBlind: 20,
          minBuyIn: 200,
          maxBuyIn: 2000,
          maxPlayers: 6,
        }),
      });

      const data = await response.json();
      testRoomId = data.data.id;
    });

    describe("GET /api/rooms", () => {
      test("should list active rooms", async () => {
        const response = await fetch(`${BACKEND_URL}/api/rooms`);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
      });

      test("should include currentPlayerCount", async () => {
        const response = await fetch(`${BACKEND_URL}/api/rooms`);
        const data = await response.json();

        expect(response.status).toBe(200);
        const room = data.data.find((r: any) => r.id === testRoomId);
        expect(room).toBeDefined();
        expect(typeof room.currentPlayerCount).toBe("number");
      });
    });

    describe("GET /api/rooms/:id", () => {
      test("should get room details by ID", async () => {
        const response = await fetch(`${BACKEND_URL}/api/rooms/${testRoomId}`);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.id).toBe(testRoomId);
        expect(data.data.name).toBe("Test Room Public");
        expect(Array.isArray(data.data.players)).toBe(true);
        expect(typeof data.data.currentPlayerCount).toBe("number");
      });

      test("should return 404 for non-existent room", async () => {
        const response = await fetch(
          `${BACKEND_URL}/api/rooms/00000000-0000-0000-0000-000000000000`
        );
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.success).toBe(false);
        expect(data.error).toBe("Room not found");
      });
    });

    describe("POST /api/rooms/:id/join", () => {
      test("should join a room successfully", async () => {
        const response = await fetch(
          `${BACKEND_URL}/api/rooms/${testRoomId}/join`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${regularUser.token}`,
            },
            body: JSON.stringify({ seatNumber: 1, buyIn: 500 }),
          }
        );

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.player.seatNumber).toBe(1);
        expect(data.data.player.stack).toBe(500);
        expect(data.data.newBalance).toBe(regularUser.balance - 500);
      });

      test("should reject joining same table twice", async () => {
        const response = await fetch(
          `${BACKEND_URL}/api/rooms/${testRoomId}/join`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${regularUser.token}`,
            },
            body: JSON.stringify({ seatNumber: 2, buyIn: 500 }),
          }
        );

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe("You are already at this table");
      });

      test("should reject joining with taken seat", async () => {
        // Create another user to try to take the same seat
        const anotherUser = await registerUser(
          generateTestEmail(),
          generateTestUsername(),
          "anotherpass123"
        );

        const response = await fetch(
          `${BACKEND_URL}/api/rooms/${testRoomId}/join`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${anotherUser.token}`,
            },
            body: JSON.stringify({ seatNumber: 1, buyIn: 500 }), // Same seat as regularUser
          }
        );

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe("Seat is already taken");
      });

      test("should reject buy-in below minimum", async () => {
        const newUser = await registerUser(
          generateTestEmail(),
          generateTestUsername(),
          "newpass123"
        );

        const response = await fetch(
          `${BACKEND_URL}/api/rooms/${testRoomId}/join`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${newUser.token}`,
            },
            body: JSON.stringify({ seatNumber: 3, buyIn: 100 }), // Below min 200
          }
        );

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain("Buy-in must be between");
      });

      test("should reject buy-in above maximum", async () => {
        const newUser = await registerUser(
          generateTestEmail(),
          generateTestUsername(),
          "newpass123"
        );

        const response = await fetch(
          `${BACKEND_URL}/api/rooms/${testRoomId}/join`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${newUser.token}`,
            },
            body: JSON.stringify({ seatNumber: 3, buyIn: 5000 }), // Above max 2000
          }
        );

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toContain("Buy-in must be between");
      });

      test("should reject without authentication", async () => {
        const response = await fetch(
          `${BACKEND_URL}/api/rooms/${testRoomId}/join`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ seatNumber: 5, buyIn: 500 }),
          }
        );

        expect(response.status).toBe(401);
      });
    });

    describe("POST /api/rooms/:id/leave", () => {
      test("should leave a room successfully", async () => {
        const response = await fetch(
          `${BACKEND_URL}/api/rooms/${testRoomId}/leave`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${regularUser.token}` },
          }
        );

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(typeof data.data.newBalance).toBe("number");
      });

      test("should reject leaving room you're not in", async () => {
        const response = await fetch(
          `${BACKEND_URL}/api/rooms/${testRoomId}/leave`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${regularUser.token}` },
          }
        );

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe("You are not at this table");
      });
    });
  });

  describe("Room Status Management", () => {
    let testRoomId: string;

    beforeAll(async () => {
      const response = await fetch(`${BACKEND_URL}/api/admin/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminUser.token}`,
        },
        body: JSON.stringify({
          name: "Test Room Status",
          smallBlind: 10,
          bigBlind: 20,
          minBuyIn: 200,
          maxBuyIn: 2000,
          maxPlayers: 6,
        }),
      });

      const data = await response.json();
      testRoomId = data.data.id;
    });

    describe("PATCH /api/admin/rooms/:id", () => {
      test("should update room status", async () => {
        const response = await fetch(
          `${BACKEND_URL}/api/admin/rooms/${testRoomId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${adminUser.token}`,
            },
            body: JSON.stringify({ status: "closed" }),
          }
        );

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.status).toBe("closed");
      });

      test("should reject invalid status", async () => {
        const response = await fetch(
          `${BACKEND_URL}/api/admin/rooms/${testRoomId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${adminUser.token}`,
            },
            body: JSON.stringify({ status: "invalid" }),
          }
        );

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe("Invalid status");
      });
    });

    describe("DELETE /api/admin/rooms/:id", () => {
      test("should delete empty room", async () => {
        // Create a new room to delete
        const createRes = await fetch(`${BACKEND_URL}/api/admin/rooms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminUser.token}`,
          },
          body: JSON.stringify({
            name: "Test Room Delete",
            smallBlind: 10,
            bigBlind: 20,
            minBuyIn: 200,
            maxBuyIn: 2000,
            maxPlayers: 6,
          }),
        });

        const createData = await createRes.json();
        const roomToDelete = createData.data.id;

        const response = await fetch(
          `${BACKEND_URL}/api/admin/rooms/${roomToDelete}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${adminUser.token}` },
          }
        );

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });

      test("should reject deleting room with players", async () => {
        // Create room and join it
        const createRes = await fetch(`${BACKEND_URL}/api/admin/rooms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminUser.token}`,
          },
          body: JSON.stringify({
            name: "Test Room With Players",
            smallBlind: 10,
            bigBlind: 20,
            minBuyIn: 200,
            maxBuyIn: 2000,
            maxPlayers: 6,
          }),
        });

        const createData = await createRes.json();
        const roomWithPlayers = createData.data.id;

        // Join the room
        await fetch(`${BACKEND_URL}/api/rooms/${roomWithPlayers}/join`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${regularUser.token}`,
          },
          body: JSON.stringify({ seatNumber: 1, buyIn: 500 }),
        });

        // Try to delete
        const response = await fetch(
          `${BACKEND_URL}/api/admin/rooms/${roomWithPlayers}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${adminUser.token}` },
          }
        );

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe("Cannot delete room with players");

        // Cleanup - leave the room
        await fetch(`${BACKEND_URL}/api/rooms/${roomWithPlayers}/leave`, {
          method: "POST",
          headers: { Authorization: `Bearer ${regularUser.token}` },
        });
      });
    });
  });
});
