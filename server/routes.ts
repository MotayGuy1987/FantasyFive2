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
      const { email, password, username, firstName, lastName } = req.body;

      if (!email || !password || !username || !firstName || !lastName) {
        return res.status(400).json({ message: "All fields required" });
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

      const user = await storage.createUser({
        email,
        username,
        password: passwordHash,
        firstName,
        lastName,
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

  // User profile routes
  app.patch('/api/user/profile', isAuthenticated, async (req: any, res) => {
    try {
      const { avatarPersonColor, avatarBgColor, nationality, favoriteTeam } = req.body;
      const userId = req.user.id;

      const updatedUser = await storage.updateUserProfile(userId, {
        avatarPersonColor,
        avatarBgColor,
        nationality,
        favoriteTeam,
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

    app.get('/api/user/team-name-cooldown', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const lastChanged = user.lastTeamNameChange;
      if (!lastChanged) {
        return res.json({ canChange: true, timeRemaining: 0 });
      }

      const cooldownPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
      const timeSinceLastChange = Date.now() - new Date(lastChanged).getTime();
      const timeRemaining = Math.max(0, cooldownPeriod - timeSinceLastChange);

      res.json({
        canChange: timeRemaining === 0,
        timeRemaining: timeRemaining,
        cooldownDays: Math.ceil(timeRemaining / (24 * 60 * 60 * 1000))
      });
    } catch (error) {
      console.error("Error checking team name cooldown:", error);
      res.status(500).json({ message: "Failed to check cooldown" });
    }
  });

  app.patch('/api/user/team-name', isAuthenticated, async (req: any, res) => {
    try {
      const { teamName } = req.body;
      const userId = req.user.id;

      if (!teamName || teamName.trim().length === 0) {
        return res.status(400).json({ message: "Team name is required" });
      }

      if (teamName.length > 50) {
        return res.status(400).json({ message: "Team name must be 50 characters or less" });
      }

      // Check cooldown
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const lastChanged = user.lastTeamNameChange;
      if (lastChanged) {
        const cooldownPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
        const timeSinceLastChange = Date.now() - new Date(lastChanged).getTime();
        
        if (timeSinceLastChange < cooldownPeriod) {
          const timeRemaining = cooldownPeriod - timeSinceLastChange;
          const daysRemaining = Math.ceil(timeRemaining / (24 * 60 * 60 * 1000));
          return res.status(400).json({ 
            message: `You can only change your team name once every 7 days. Please wait ${daysRemaining} more day(s).` 
          });
        }
      }

      const updatedUser = await storage.updateUserTeamName(userId, teamName.trim());
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating team name:", error);
      res.status(500).json({ message: "Failed to update team name" });
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

  app.get("/api/player-performance/:playerId", isAuthenticated, async (req, res) => {
    try {
      const { playerId } = req.params;
      const performance = await storage.getPlayerPerformance(Number(playerId));
      res.json(performance || []);
    } catch (error) {
      console.error("Error fetching player performance:", error);
      res.status(500).json({ message: "Failed to fetch player performance" });
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
      const isAdmin = userRecord?.email === "admin@fantasyfive.app";
      const budget = isAdmin ? 1000.0 : 50.0;
      
      const validation = createTeamSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid team data", 
          errors: validation.error.issues 
        });
      }

      const { playerIds } = validation.data;

      // Validate team composition and budget
      const players = await storage.getPlayersByIds(playerIds);
      const validationResult = validateTransfer(players, budget);
      
      if (!validationResult.isValid) {
        return res.status(400).json({ message: validationResult.error });
      }

      // Check if user already has a team
      const existingTeam = await storage.getTeamByUserId(userId);
      if (existingTeam) {
        return res.status(400).json({ message: "You already have a team" });
      }

      const team = await storage.createTeam(userId, playerIds);
      res.json(team);
    } catch (error) {
      console.error("Error creating team:", error);
      res.status(500).json({ message: "Failed to create team" });
    }
  });

  app.put("/api/team", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userRecord = await storage.getUser(userId);
      const isAdmin = userRecord?.email === "admin@fantasyfive.app";
      const budget = isAdmin ? 1000.0 : 50.0;
      
      const validation = createTeamSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid team data", 
          errors: validation.error.issues 
        });
      }

      const { playerIds } = validation.data;

      // Validate team composition and budget
      const players = await storage.getPlayersByIds(playerIds);
      const validationResult = validateTransfer(players, budget);
      
      if (!validationResult.isValid) {
        return res.status(400).json({ message: validationResult.error });
      }

      const team = await storage.updateTeam(userId, playerIds);
      res.json(team);
    } catch (error) {
      console.error("Error updating team:", error);
      res.status(500).json({ message: "Failed to update team" });
    }
  });

  app.get("/api/teams/leaderboard", isAuthenticated, async (req, res) => {
    try {
      const leaderboard = await storage.getLeaderboard();
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Transfer routes
  app.get("/api/transfers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const transfers = await storage.getUserTransfers(userId);
      res.json(transfers);
    } catch (error) {
      console.error("Error fetching transfers:", error);
      res.status(500).json({ message: "Failed to fetch transfers" });
    }
  });

  app.post("/api/transfers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validation = insertTransferSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid transfer data", 
          errors: validation.error.issues 
        });
      }

      const { playerInId, playerOutId } = validation.data;

      // Get current team
      const team = await storage.getTeamByUserId(userId);
      if (!team) {
        return res.status(400).json({ message: "You don't have a team yet" });
      }

      // Check if player being transferred out is in the team
      const teamPlayerIds = team.players.map(tp => tp.playerId);
      if (!teamPlayerIds.includes(playerOutId)) {
        return res.status(400).json({ message: "Player to transfer out is not in your team" });
      }

      // Check if player being transferred in is already in the team
      if (teamPlayerIds.includes(playerInId)) {
        return res.status(400).json({ message: "Player to transfer in is already in your team" });
      }

      // Create new team composition
      const newPlayerIds = teamPlayerIds.map(id => id === playerOutId ? playerInId : id);
      
      // Validate new team composition
      const userRecord = await storage.getUser(userId);
      const isAdmin = userRecord?.email === "admin@fantasyfive.app";
      const budget = isAdmin ? 1000.0 : 50.0;
      
      const players = await storage.getPlayersByIds(newPlayerIds);
      const validationResult = validateTransfer(players, budget);
      
      if (!validationResult.isValid) {
        return res.status(400).json({ message: validationResult.error });
      }

      // Record the transfer
      const transfer = await storage.createTransfer({
        userId,
        playerInId,
        playerOutId,
        transferDate: new Date().toISOString()
      });

      // Update the team
      await storage.updateTeam(userId, newPlayerIds);

      res.json(transfer);
    } catch (error) {
      console.error("Error creating transfer:", error);
      res.status(500).json({ message: "Failed to create transfer" });
    }
  });

  // League routes
  app.get("/api/leagues", isAuthenticated, async (req, res) => {
    try {
      const leagues = await storage.getAllLeagues();
      res.json(leagues);
    } catch (error) {
      console.error("Error fetching leagues:", error);
      res.status(500).json({ message: "Failed to fetch leagues" });
    }
  });

  app.post("/api/leagues", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validation = insertLeagueSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid league data", 
          errors: validation.error.issues 
        });
      }

      const league = await storage.createLeague({
        ...validation.data,
        createdBy: userId
      });

      res.json(league);
    } catch (error) {
      console.error("Error creating league:", error);
      res.status(500).json({ message: "Failed to create league" });
    }
  });

  // Admin routes
  app.get("/api/admin/users", isAuthenticated, async (req: any, res) => {
    try {
      const userRecord = await storage.getUser(req.user.id);
      const isAdmin = userRecord?.email === "admin@fantasyfive.app";
      
      if (!isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/player-performance", isAuthenticated, async (req: any, res) => {
    try {
      const userRecord = await storage.getUser(req.user.id);
      const isAdmin = userRecord?.email === "admin@fantasyfive.app";
      
      if (!isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validation = insertPlayerPerformanceSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid performance data", 
          errors: validation.error.issues 
        });
      }

      // Get the player to determine position for scoring
      const player = await storage.getPlayer(validation.data.playerId);
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      // Calculate points based on performance
      const points = calculatePerformancePoints(player.position, validation.data);

      const performance = await storage.createPlayerPerformance({
        ...validation.data,
        points
      });

      // Aggregate and update team scores
      await aggregateAndUpsertTeamScores();

      res.json(performance);
    } catch (error) {
      console.error("Error creating player performance:", error);
      res.status(500).json({ message: "Failed to create player performance" });
    }
  });

  app.post("/api/admin/aggregate-scores", isAuthenticated, async (req: any, res) => {
    try {
      const userRecord = await storage.getUser(req.user.id);
      const isAdmin = userRecord?.email === "admin@fantasyfive.app";
      
      if (!isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      await aggregateAndUpsertTeamScores();
      res.json({ message: "Scores aggregated successfully" });
    } catch (error) {
      console.error("Error aggregating scores:", error);
      res.status(500).json({ message: "Failed to aggregate scores" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
