import WebSocket from "ws";

const BACKEND_URL = "http://localhost:3000";
const WS_URL = "ws://localhost:3001";

async function debug() {
  console.log("1. Registering user...");
  const registerRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `debug${Date.now()}@test.com`,
      username: `dbg${Date.now()}`.slice(0, 12),
      password: "test123456",
    }),
  });
  const registerData = await registerRes.json();
  console.log("Register response:", registerData);

  if (!registerData.success) {
    console.error("Registration failed");
    return;
  }

  const token = registerData.data.token;
  const userId = registerData.data.user.id;

  console.log("\n2. Creating admin user and room...");
  // Make user admin directly via db
  const { db, users, eq } = await import("@poker/db");
  await db.update(users).set({ isAdmin: true }).where(eq(users.id, userId));

  // Re-login to get updated token
  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: registerData.data.user.email,
      password: "test123456",
    }),
  });
  const loginData = await loginRes.json();
  const adminToken = loginData.data.token;

  // Create room
  const roomRes = await fetch(`${BACKEND_URL}/api/admin/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Debug Test Room",
      smallBlind: 10,
      bigBlind: 20,
      minBuyIn: 200,
      maxBuyIn: 2000,
      maxPlayers: 6,
    }),
  });
  const roomData = await roomRes.json();
  console.log("Room response:", roomData);

  if (!roomData.success) {
    console.error("Room creation failed");
    return;
  }

  const roomId = roomData.data.id;

  console.log("\n3. Joining room via HTTP...");
  const joinRes = await fetch(`${BACKEND_URL}/api/rooms/${roomId}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ seatNumber: 1, buyIn: 500 }),
  });
  const joinData = await joinRes.json();
  console.log("HTTP Join response:", joinData);

  if (!joinData.success) {
    console.error("HTTP join failed");
    return;
  }

  console.log("\n4. Connecting WebSocket...");
  const ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    console.log("WebSocket connected");

    console.log("\n5. Sending auth message...");
    ws.send(JSON.stringify({ type: "auth", payload: { token: adminToken } }));
  });

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    console.log("Received:", msg.type, JSON.stringify(msg.payload).slice(0, 200));

    if (msg.type === "auth_success") {
      console.log("\n6. Auth successful, sending join_room...");
      ws.send(JSON.stringify({
        type: "join_room",
        payload: { roomId, seatNumber: 1, buyIn: 500 },
      }));

      // Set timeout to exit if no response
      setTimeout(() => {
        console.log("\nTimeout - no response to join_room");
        ws.close();
        process.exit(1);
      }, 5000);
    }

    if (msg.type === "joined_room") {
      console.log("\n7. Successfully joined room via WS!");
      ws.close();
      process.exit(0);
    }

    if (msg.type === "error") {
      console.log("\nError from server:", msg.payload.message);
      ws.close();
      process.exit(1);
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });

  ws.on("close", () => {
    console.log("WebSocket closed");
  });
}

debug().catch(console.error);
