import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { validateTransfer } from "./positionValidation";
import { z } from "zod";
import { db } from "./db";
import { teamPlayers } from "@shared/schema";
import { insertPlayerPerformanceSchema, insertTransferSchema, insertLeagueSchema } from "@shared/schema";
import { aggregateAndUpsertTeamScores } from "./utils/scoreAggregation";

// Remove the duplicate isAuthenticated declaration since it's imported from "./auth"

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
    points += goals * 5;
  } else {
    points += goals * 5;
  }

  // Assists
  points += assists * 3;

  // Cards
  points -= yellowCards * 1;
  points -= redCards * 3;
  if (straightRed) {
    points -= 3;
  }

  // MOTM
  if (isMotm) points += 3;

  // Days-played bonus
  if (daysPlayed >= 1 && daysPlayed <= 3) {
    points += 1;
  } else if (daysPlayed >= 4) {
    points += 2;
  }

  return points;
}

// Add the missing schema definitions
const createTeamSchema = z.object({
  teamName: z.string().min(1).max(30),
  players: z.array(z.object({
    playerId: z.string(),
    isCaptain: z.boolean(),
    isOnBench: z.boolean(),
    position: z.string(),
  })).length(5),
});

export function registerRoutes(app: Express): Server {
  // Copy all the routes from the backup file here...
  // [Include all the routes from the backup file - I'll provide the key ones]

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

  // ... [Include all other routes from the backup file] ...

  // At the end, create and return the server
  const server = createServer(app);
  setupAuth(app);
  return server;
}
