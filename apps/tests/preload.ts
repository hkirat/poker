import { beforeAll, afterAll } from "bun:test";
import { Subprocess } from "bun";
import WebSocket from "ws";

const BACKEND_PORT = 3000;
const WS_PORT = 3001;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const WS_URL = `ws://localhost:${WS_PORT}`;

let backendProcess: Subprocess | null = null;
let websocketProcess: Subprocess | null = null;
let servicesStarted = false;

async function waitForService(url: string, timeout: number): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`Service at ${url} is ready`);
        return;
      }
    } catch {
      // Service not ready yet
    }
    await Bun.sleep(100);
  }

  throw new Error(`Service at ${url} did not start within ${timeout}ms`);
}

async function waitForWebSocket(url: string, timeout: number): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const ws = new WebSocket(url);
      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => {
          ws.close();
          resolve();
        });
        ws.on("error", reject);
      });
      console.log(`WebSocket at ${url} is ready`);
      return;
    } catch {
      // Service not ready yet
    }
    await Bun.sleep(100);
  }

  throw new Error(`WebSocket at ${url} did not start within ${timeout}ms`);
}

async function checkServiceRunning(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function checkWebSocketRunning(url: string): Promise<boolean> {
  try {
    const ws = new WebSocket(url);
    return await new Promise((resolve) => {
      ws.on("open", () => {
        ws.close();
        resolve(true);
      });
      ws.on("error", () => resolve(false));
      setTimeout(() => resolve(false), 1000);
    });
  } catch {
    return false;
  }
}

async function startServices(): Promise<void> {
  if (servicesStarted) return;

  // Check if services are already running
  const backendRunning = await checkServiceRunning(BACKEND_URL + "/health");
  const wsRunning = await checkWebSocketRunning(WS_URL);

  if (backendRunning && wsRunning) {
    console.log("Services already running, skipping startup");
    servicesStarted = true;
    return;
  }

  console.log("Starting backend service...");
  backendProcess = Bun.spawn(["bun", "run", "src/index.ts"], {
    cwd: "/Users/harkirat/Projects/poker/apps/backend",
    env: { ...process.env, PORT: String(BACKEND_PORT) },
    stdout: "pipe",
    stderr: "pipe",
  });

  console.log("Starting websocket service...");
  websocketProcess = Bun.spawn(["bun", "run", "src/index.ts"], {
    cwd: "/Users/harkirat/Projects/poker/apps/websocket",
    env: { ...process.env, WS_PORT: String(WS_PORT) },
    stdout: "pipe",
    stderr: "pipe",
  });

  await waitForService(BACKEND_URL + "/health", 15000);
  await waitForWebSocket(WS_URL, 15000);

  servicesStarted = true;
  console.log("All services started successfully");
}

async function stopServices(): Promise<void> {
  console.log("Stopping services...");

  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }

  if (websocketProcess) {
    websocketProcess.kill();
    websocketProcess = null;
  }

  servicesStarted = false;
  await Bun.sleep(500);
  console.log("Services stopped");
}

async function cleanupTestData(): Promise<void> {
  try {
    const { db, sql } = await import("@poker/db");
    // Delete in correct order to respect foreign key constraints
    await db.execute(sql`DELETE FROM game_history WHERE room_id IN (SELECT id FROM rooms WHERE name LIKE 'Test Room%' OR name LIKE 'E2E%' OR name LIKE 'Debug%')`);
    await db.execute(sql`DELETE FROM transactions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test%@example.com' OR email LIKE 'debug%@test.com')`);
    await db.execute(sql`DELETE FROM table_players WHERE room_id IN (SELECT id FROM rooms WHERE name LIKE 'Test Room%' OR name LIKE 'E2E%' OR name LIKE 'Debug%')`);
    await db.execute(sql`DELETE FROM table_players WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test%@example.com' OR email LIKE 'debug%@test.com')`);
    // Delete rooms before users (rooms reference users via created_by)
    await db.execute(sql`DELETE FROM rooms WHERE name LIKE 'Test Room%' OR name LIKE 'E2E%' OR name LIKE 'Debug%'`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE 'test%@example.com' OR email LIKE 'debug%@test.com'`);
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}

// Global setup
beforeAll(async () => {
  await startServices();
});

// Global teardown
afterAll(async () => {
  await cleanupTestData();
  await stopServices();
});
