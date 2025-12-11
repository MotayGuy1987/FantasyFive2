import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { validateTransfer } from "./positionValidation";
import { z } from "zod";
import { db } from "./db";
import { teamPlayers, createTeamSchema } from "@shared/schema";
import { insertPlayerPerformanceSchema, insertTransferSchema, insertLeagueSchema } from "@shared/schema";
import { aggregateAndUpsertTeamScores } from "./utils/scoreAggregation";

function calculatePerformancePoints(playerPosition: string, perf: any): number {
  let points = 0;

  const position = String(playerPosition || "").toLowerCase();
  const goals = perf.goals || 0;
  const assists = perf.assists || 0;
  const yellowCards = perf.yellowCards || 0;
  const redCards = perf.redCards || 0;
  const straightRed = perf.straightRed || false;
  const isMotm = perf.isMotm || false;
  const daysPlayed = perf.daysPlayed || 0;

  // Goal points based on position
  if (position.includes("def")) {
    points += goals * 6;
  } else if (position.includes("mid")) {
    points += goals * 5;
  } else if (position.includes("for") || position.includes("fwd")) {
    points += goals * 4;
  } else {
    points += goals * 5;
  }

  points += assists * 3;
  points -= yellowCards * 1;
  points -= redCards * 3;
  if (straightRed) points -= 3;
  if (isMotm) points += 3;

  if (daysPlayed >= 1 && daysPlayed <= 3) {
    points += 1;
  } else if (daysPlayed >= 4) {
    points += 2;
  }

  return points;
}

export function registerRoutes(app: Express): Server {
  // Auth routes
  app.post("/api/auth/register", async (req: any, res) => {
    try {
      const { email, password, username } = req.body;

      if (!email || !password || !username) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already in use" });
      }

      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already in use" });
      }

      const crypto = require("crypto");
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha256").toString("hex");
      const passwordHash = `${salt}$${hash}`;

      const user = await storage.upsertUser({
        email,
        username,
        password: passwordHash,
      });

      req.logIn(user, (err: any) => {
        if (err) {
          return res.status(500).json({ message: "Login failed" });
        }
        res.json({ message: "Registration successful", user });
      });
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: any, res) => {
  try {
    console.log("🔐 Login attempt:", { username: req.body.username, hasPassword: !!req.body.password });
    
    const { username, password } = req.body;

    if (!username || !password) {
      console.log("❌ Missing username or password");
      return res.status(400).json({ message: "Username and password required" });
    }

    // Try to find user by username first, then by email as fallback
    console.log("🔍 Looking up user by username:", username);
    let user = await storage.getUserByUsername(username);
    
    if (!user) {
      console.log("🔍 Username not found, trying email lookup:", username);
      user = await storage.getUserByEmail(username);
    }
    
    if (!user) {
      console.log("❌ User not found:", username);
      return res.status(400).json({ message: "Invalid username or password" });
    }
    
    console.log("✅ User found:", { id: user.id, email: user.email, username: user.username, hasPassword: !!user.password });
    
    if (!user.password) {
      console.log("❌ User has no password set");
      return res.status(400).json({ message: "Invalid username or password" });
    }

    // Handle both password formats: "salt:hash" (seed) and "salt$hash" (registration)
    let salt: string;
    let hash: string;
    
    if (user.password.includes(':')) {
      // Seed format: "salt:hash"
      [salt, hash] = user.password.split(':');
      console.log("🔑 Using colon-separated password format");
    } else if (user.password.includes('$')) {
      // Registration format: "salt$hash"
      [salt, hash] = user.password.split('$');
      console.log("🔑 Using dollar-separated password format");
    } else {
      console.log("❌ Invalid password format");
      return res.status(400).json({ message: "Invalid username or password" });
    }

    const crypto = require("crypto");
    const testHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha256").toString("hex");

    if (testHash !== hash) {
      console.log("❌ Password hash mismatch");
      console.log("Expected hash:", hash.substring(0, 20) + "...");
      console.log("Computed hash:", testHash.substring(0, 20) + "...");
      return res.status(400).json({ message: "Invalid username or password" });
    }

    console.log("✅ Password verified successfully");

    req.logIn(user, (err: any) => {
      if (err) {
        console.error("❌ Session login error:", err);
        return res.status(500).json({ message: "Login failed" });
      }
      console.log("✅ Login successful for user:", user.id);
      res.json({ message: "Login successful", user });
    });
  } catch (error) {
    console.error("❌ Login route error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

  app.post("/api/auth/logout", (req: any, res) => {
    req.logOut((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Player routes
  app.get("/api/players", isAuthenticated, async (req, res) => {
    try {
      const players = await storage.getAllPlayers();
      res.json(players);
    } catch (error) {
      console.error("Error fetching players:", error);
      res.status(500).json({ message: "Failed to fetch players" });
    }
  });

  // Team routes
  app.get("/api/team", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const team = await storage.getTeamByUserId(userId);
      const user = await storage.getUser(userId);
      
      if (!team) {
        return res.json(null);
      }
      
      res.json({ ...team, teamName: user?.teamName });
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  app.post("/api/team", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userRecord = await storage.getUser(userId);
      const isAdmin = userRecord?.email === "admin@admin.com";
      const budget = isAdmin ? 1000.0 : 50.0;
      
      const validation = createTeamSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid team data", errors: validation.error.errors });
      }
      
      const { teamName, players: requestedPlayers } = validation.data;

      const playerIds = requestedPlayers.map((p: any) => p.playerId);
      const players = await Promise.all(
        playerIds.map((id: string) => storage.getPlayer(id))
      );

      if (players.some((p) => !p)) {
        return res.status(400).json({ message: "Invalid players" });
      }

      const totalCost = players.reduce((sum, p) => sum + parseFloat(p!.price), 0);
      if (totalCost > budget) {
        return res.status(400).json({ message: "Team exceeds budget" });
      }

      let team = await storage.getTeamByUserId(userId);
      if (!team) {
        const currentGameweek = await storage.getCurrentGameweek();
        team = await storage.createTeam({ 
          userId, 
          budget: String(budget), 
          freeTransfers: 1,
          firstGameweekId: currentGameweek?.id || undefined,
        });
      }

      await storage.deleteTeamPlayers(team.id);

      for (const playerData of requestedPlayers) {
        await storage.createTeamPlayer({
          teamId: team.id,
          playerId: playerData.playerId,
          isCaptain: playerData.isCaptain,
          isOnBench: playerData.isOnBench,
          position: playerData.position,
        });
      }

      if (userRecord && !userRecord.teamName) {
        await storage.updateUserTeamName(userId, teamName);
      }

      res.json({ team, message: "Team created successfully" });
    } catch (error) {
      console.error("Error creating team:", error);
      res.status(500).json({ message: "Failed to create team" });
    }
  });

  // Gameweek routes
  app.get("/api/gameweeks", isAuthenticated, async (req, res) => {
    try {
      const gameweeks = await storage.getAllGameweeks();
      res.json(gameweeks);
    } catch (error) {
      console.error("Error fetching gameweeks:", error);
      res.status(500).json({ message: "Failed to fetch gameweeks" });
    }
  });

  app.get("/api/gameweeks/current", isAuthenticated, async (req, res) => {
    try {
      const gameweek = await storage.getCurrentGameweek();
      res.json(gameweek);
    } catch (error) {
      console.error("Error fetching current gameweek:", error);
      res.status(500).json({ message: "Failed to fetch gameweek" });
    }
  });

  // Basic health check route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/api/auth/login", async (req: any, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    // Try to find user by username first, then by email as fallback
    let user = await storage.getUserByUsername(username);
    if (!user) {
      user = await storage.getUserByEmail(username); // Allow email as username
    }
    
    if (!user || !user.password) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    const [salt, hash] = user.password.split("$");
    const crypto = require("crypto");
    const testHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha256").toString("hex");

    if (testHash !== hash) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    req.logIn(user, (err: any) => {
      if (err) {
        return res.status(500).json({ message: "Login failed" });
      }
      res.json({ message: "Login successful", user });
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Login failed" });
  }
});
  // Setup authentication and create server
  setupAuth(app);
  const server = createServer(app);
  return server;
}
// Temporary admin creation route - REMOVE AFTER USING
// Temporary admin creation route - REMOVE AFTER USING  
app.post("/api/create-admin", async (req: any, res) => {
  try {
    const adminEmail = "admin@fantasyfive.app";
    
    // Check if admin already exists
    const existingAdmin = await storage.getUserByEmail(adminEmail);
    if (existingAdmin) {
      return res.json({ message: "Admin already exists", user: existingAdmin });
    }

    // Create password hash
    const crypto = require("crypto");
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.pbkdf2Sync("admin1", salt, 100000, 64, "sha256").toString("hex");
    const hashedPassword = `${salt}$${hash}`;

    // Direct SQL insert to avoid schema issues
    const { neon } = require("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL!);
    
    const result = await sql`
      INSERT INTO users (id, email, username, password, "firstName", "lastName", "profileImageUrl")
      VALUES (
        'admin-user-id',
        ${adminEmail},
        'admin',
        ${hashedPassword},
        'Admin',
        'User',
        NULL
      )
      RETURNING id, email, username, "firstName", "lastName"
    `;

    console.log("✅ Admin user created:", result[0]);
    res.json({ message: "Admin user created successfully", user: result[0] });
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    res.status(500).json({ message: "Failed to create admin", error: error.message });
  }
});
