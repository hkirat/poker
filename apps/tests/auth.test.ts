import { describe, test, expect } from "bun:test";
import {
  generateTestEmail,
  generateTestUsername,
  BACKEND_URL,
} from "./setup";

describe("Authentication API", () => {

  describe("POST /api/auth/register", () => {
    test("should register a new user successfully", async () => {
      const email = generateTestEmail();
      const username = generateTestUsername();
      const password = "testpass123";

      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.token).toBeDefined();
      expect(data.data.user.email).toBe(email);
      expect(data.data.user.username).toBe(username);
      expect(data.data.user.balance).toBe(50000); // Signup bonus
      expect(data.data.user.isAdmin).toBe(false);
    });

    test("should reject registration with invalid email", async () => {
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "invalid-email",
          username: generateTestUsername(),
          password: "testpass123",
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid input");
    });

    test("should reject registration with short password", async () => {
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: generateTestEmail(),
          username: generateTestUsername(),
          password: "123", // Too short
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    test("should reject registration with short username", async () => {
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: generateTestEmail(),
          username: "ab", // Too short (min 3)
          password: "testpass123",
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    test("should reject duplicate email registration", async () => {
      const email = generateTestEmail();
      const password = "testpass123";

      // Register first user
      await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username: generateTestUsername(),
          password,
        }),
      });

      // Try to register with same email
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username: generateTestUsername(),
          password,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Email already registered");
    });

    test("should reject duplicate username registration", async () => {
      const username = generateTestUsername();
      const password = "testpass123";

      // Register first user
      await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: generateTestEmail(),
          username,
          password,
        }),
      });

      // Try to register with same username
      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: generateTestEmail(),
          username,
          password,
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Username already taken");
    });
  });

  describe("POST /api/auth/login", () => {
    test("should login an existing user successfully", async () => {
      const email = generateTestEmail();
      const username = generateTestUsername();
      const password = "testpass123";

      // Register user first
      await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });

      // Login
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.token).toBeDefined();
      expect(data.data.user.email).toBe(email);
      expect(data.data.user.username).toBe(username);
    });

    test("should reject login with wrong password", async () => {
      const email = generateTestEmail();
      const username = generateTestUsername();
      const password = "testpass123";

      // Register user first
      await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });

      // Login with wrong password
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "wrongpassword" }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid credentials");
    });

    test("should reject login with non-existent email", async () => {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nonexistent@example.com",
          password: "anypassword",
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid credentials");
    });

    test("should reject login with invalid email format", async () => {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "invalid-email",
          password: "anypassword",
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe("GET /api/users/me", () => {
    test("should return user info with valid token", async () => {
      const email = generateTestEmail();
      const username = generateTestUsername();
      const password = "testpass123";

      // Register user
      const registerRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });

      const registerData = await registerRes.json();
      const token = registerData.data.token;

      // Get user info
      const response = await fetch(`${BACKEND_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.email).toBe(email);
      expect(data.data.username).toBe(username);
      expect(data.data.balance).toBe(50000);
    });

    test("should reject request without token", async () => {
      const response = await fetch(`${BACKEND_URL}/api/users/me`);

      expect(response.status).toBe(401);
    });

    test("should reject request with invalid token", async () => {
      const response = await fetch(`${BACKEND_URL}/api/users/me`, {
        headers: { Authorization: "Bearer invalid-token" },
      });

      expect(response.status).toBe(401);
    });
  });

  describe("Health Check", () => {
    test("GET /health should return ok status", async () => {
      const response = await fetch(`${BACKEND_URL}/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("ok");
    });
  });
});
