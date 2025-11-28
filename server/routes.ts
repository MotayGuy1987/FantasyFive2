import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { validateTransfer } from "./positionValidation";
import { z } from "zod";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { teamPlayers, gameweekScores, createTeamSchema, users } from "@shared/schema";
import { insertPlayerPerformanceSchema, insertTransferSchema, insertLeagueSchema } from "@shared/schema";

// Calculate points dynamically from performance data based on player position
function calculatePerformancePoints(playerPosition: string, perf: any): number {
  let points = 0;

  const position = playerPosition.toUpperCase();
  const goals = perf.goals || 0;
  const assists = perf.assists || 0;
  const yellowCards = perf.yellowCards || 0;
  const redCards = perf.redCards || 0;
  const straightRed = perf.straightRed || false;
  const isMotm = perf.isMotm || false;

  // Goal points based on position
  if (position === "DEF") {
    points += goals * 6;
  } else if (position === "MID") {
    points += goals * 5;
  } else if (position === "FWD") {
    points += goals * 5;
  }

  // Assist points (same for all)
  points += assists * 3;

  // Card points (same for all)
  points -= yellowCards * 1;
  points -= redCards * 2;
  if (straightRed) {
    points -= 3;
  }

  // MOTM bonus (same for all)
  if (isMotm) {
    points += 3;
  }

  return Math.max(0, points); // Ensure points never go below 0
}

export async function registerRoutes(app: Express) {
  await setupAuth(app);
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarPersonColor: user.avatarPersonColor,
        avatarBgColor: user.avatarBgColor,
        nationality: user.nationality,
        favoriteTeam: user.favoriteTeam,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

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
      const canEdit = await storage.canEditTeamName(userId);
      res.json({ canEdit });
    } catch (error) {
      console.error("Error checking team name cooldown:", error);
      res.status(500).json({ message: "Failed to check cooldown" });
    }
  });

  app.get('/api/user/first-name-cooldown', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const canEdit = await storage.canEditFirstName(userId);
      res.json({ canEdit });
    } catch (error) {
      console.error("Error checking first name cooldown:", error);
      res.status(500).json({ message: "Failed to check cooldown" });
    }
  });

  app.patch('/api/user/first-name', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { firstName } = req.body;

      if (!firstName || typeof firstName !== 'string') {
        return res.status(400).json({ message: "Invalid first name" });
      }

      const canEdit = await storage.canEditFirstName(userId);
      if (!canEdit) {
        return res.status(429).json({ message: "You can only change your display name once every 7 days" });
      }

      const updatedUser = await storage.updateUserFirstName(userId, firstName);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating first name:", error);
      res.status(500).json({ message: "Failed to update first name" });
    }
  });

  app.get("/api/players", isAuthenticated, async (req, res) => {
    try {
      const players = await storage.getAllPlayers();
      res.json(players);
    } catch (error) {
      console.error("Error fetching players:", error);
      res.status(500).json({ message: "Failed to fetch players" });
    }
  });

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

  app.get("/api/team/players", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const team = await storage.getTeamByUserId(userId);
      
      if (!team) {
        return res.json([]);
      }

      const teamPlayers = await storage.getTeamPlayers(team.id);
      res.json(teamPlayers);
    } catch (error) {
      console.error("Error fetching team players:", error);
      res.status(500).json({ message: "Failed to fetch team players" });
    }
  });

  app.post("/api/team", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userRecord = await storage.getUser(userId);
      const isAdmin = userRecord?.email === "admin@admin.com" || userRecord?.username === "admin";
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

      const captainCount = requestedPlayers.filter((p: any) => p.isCaptain).length;
      const benchCount = requestedPlayers.filter((p: any) => p.isOnBench).length;

      if (captainCount !== 1 || benchCount !== 1) {
        return res.status(400).json({ message: "Must have exactly 1 captain and 1 bench player" });
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
      } else if (isAdmin && parseFloat(team.budget) !== budget) {
        // Update existing admin team to have correct budget
        team = await storage.updateTeam(team.id, { budget: String(budget) });
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

      // Save team name to user record (one-time only, can't be changed)
      if (userRecord && !userRecord.teamName) {
        await storage.updateUserTeamName(userId, teamName);
      }

      const overallLeague = await storage.getOrCreateOverallLeague();
      const isInLeague = await storage.isTeamInLeague(team.id, overallLeague.id);
      if (!isInLeague) {
        await storage.addLeagueMember({ leagueId: overallLeague.id, teamId: team.id });
      }

      res.json({ team, message: "Team created successfully" });
    } catch (error) {
      console.error("Error creating team:", error);
      res.status(500).json({ message: "Failed to create team" });
    }
  });

  app.patch("/api/team/name", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { teamName } = req.body;

      if (!teamName || typeof teamName !== 'string' || teamName.length > 30) {
        return res.status(400).json({ message: "Team name must be 1-30 characters" });
      }

      const canEdit = await storage.canEditTeamName(userId);
      if (!canEdit) {
        return res.status(429).json({ message: "You can only change your team name once every 7 days" });
      }

      const updatedUser = await storage.updateUserTeamName(userId, teamName);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating team name:", error);
      res.status(500).json({ message: "Failed to update team name" });
    }
  });

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

  app.get("/api/player-performances", isAuthenticated, async (req: any, res) => {
    try {
      const { gameweekId } = req.query;
      if (!gameweekId) {
        return res.status(400).json({ message: "gameweekId is required" });
      }

      const performances = await storage.getAllPlayerPerformances(gameweekId as string);
      res.json(performances);
    } catch (error) {
      console.error("Error fetching player performances:", error);
      res.status(500).json({ message: "Failed to fetch performances" });
    }
  });

  app.get("/api/stats", isAuthenticated, async (req, res) => {
    try {
      const allGameweeks = await storage.getAllGameweeks();
      const allPlayers = await storage.getAllPlayers();

      // Get all performances across all gameweeks
      const allPerformances: any[] = [];
      for (const gameweek of allGameweeks) {
        const perfs = await storage.getAllPlayerPerformances(gameweek.id);
        allPerformances.push(...perfs);
      }

      // Get total teams count
      const allTeams = await storage.getAllTeams();
      const totalTeams = allTeams.length || 1;

      // Get player ownership counts
      const playerOwnershipMap: Record<string, number> = {};
      const allTeamPlayers = await db.select().from(teamPlayers);
      for (const tp of allTeamPlayers) {
        playerOwnershipMap[tp.playerId] = (playerOwnershipMap[tp.playerId] || 0) + 1;
      }

      // Aggregate stats across all gameweeks for each player
      const stats = allPlayers.map((player) => {
        const playerPerfs = allPerformances.filter((p) => p.playerId === player.id);
        const ownedCount = playerOwnershipMap[player.id] || 0;
        const ownedPercentage = (ownedCount / totalTeams) * 100;
        
        // Calculate points dynamically from performance data
        const points = playerPerfs.reduce((sum, p) => sum + calculatePerformancePoints(player.position, p), 0);
        
        return {
          player,
          goals: playerPerfs.reduce((sum, p) => sum + (p.goals || 0), 0),
          assists: playerPerfs.reduce((sum, p) => sum + (p.assists || 0), 0),
          yellowCards: playerPerfs.reduce((sum, p) => sum + (p.yellowCards || 0), 0),
          redCards: playerPerfs.reduce((sum, p) => sum + (p.redCards || 0), 0),
          isMotm: playerPerfs.some((p) => p.isMotm),
          daysPlayed: playerPerfs.reduce((sum, p) => sum + (p.daysPlayed || 0), 0),
          penaltiesMissed: playerPerfs.reduce((sum, p) => sum + (p.penaltiesMissed || 0), 0),
          goalsConceded: playerPerfs.reduce((sum, p) => sum + (p.goalsConceded || 0), 0),
          points,
          ownedPercentage,
        };
      });

      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/achievements", isAuthenticated, async (req: any, res) => {
    try {
      const allGameweeks = await storage.getAllGameweeks();
      const allPlayers = await storage.getAllPlayers();

      const allPerformances: any[] = [];
      for (const gameweek of allGameweeks) {
        const perfs = await storage.getAllPlayerPerformances(gameweek.id);
        allPerformances.push(...perfs);
      }

      console.log(`Fetched ${allGameweeks.length} gameweeks, ${allPlayers.length} players, ${allPerformances.length} performances`);

      const statsMap: Record<string, any> = {};
      allPlayers.forEach((player) => {
        const playerPerfs = allPerformances.filter((p) => {
          const matches = p.playerId === player.id || (p.player && p.player.id === player.id);
          return matches;
        });
        statsMap[player.id] = {
          player,
          goals: playerPerfs.reduce((sum, p) => sum + (p.goals || 0), 0),
          assists: playerPerfs.reduce((sum, p) => sum + (p.assists || 0), 0),
          yellowCards: playerPerfs.reduce((sum, p) => sum + (p.yellowCards || 0), 0),
          redCards: playerPerfs.reduce((sum, p) => sum + (p.redCards || 0), 0),
          penaltiesMissed: playerPerfs.reduce((sum, p) => sum + (p.penaltiesMissed || 0), 0),
          goalsConceded: playerPerfs.reduce((sum, p) => sum + (p.goalsConceded || 0), 0),
        };
      });

      const achievements = [
        {
          id: "top-scorer",
          title: "Top Scorer",
          icon: "⚽",
          details: Object.values(statsMap)
            .sort((a: any, b: any) => b.goals - a.goals)
            .map((s: any) => ({ player: s.player, value: s.goals })),
        },
        {
          id: "top-assister",
          title: "Top Assister",
          icon: "🎯",
          details: Object.values(statsMap)
            .sort((a: any, b: any) => b.assists - a.assists)
            .map((s: any) => ({ player: s.player, value: s.assists })),
        },
        {
          id: "most-cards",
          title: "Most Cards",
          icon: "🟨",
          details: Object.values(statsMap)
            .sort((a: any, b: any) => b.yellowCards - a.yellowCards)
            .map((s: any) => ({ player: s.player, value: s.yellowCards })),
        },
        {
          id: "most-red-cards",
          title: "Most Red Cards",
          icon: "🟥",
          details: Object.values(statsMap)
            .sort((a: any, b: any) => b.redCards - a.redCards)
            .map((s: any) => ({ player: s.player, value: s.redCards })),
        },
        {
          id: "most-penalties-missed",
          title: "Most Penalties Missed",
          icon: "❌",
          details: Object.values(statsMap)
            .sort((a: any, b: any) => b.penaltiesMissed - a.penaltiesMissed)
            .map((s: any) => ({ player: s.player, value: s.penaltiesMissed })),
        },
        {
          id: "most-goals-conceded",
          title: "Most Goals Conceded",
          icon: "⚠️",
          details: Object.values(statsMap)
            .filter((s: any) => s.player.position === "Defender")
            .sort((a: any, b: any) => b.goalsConceded - a.goalsConceded)
            .map((s: any) => ({ player: s.player, value: s.goalsConceded })),
        },
      ];

      const result = achievements.map((ach) => {
        const topValue = ach.details.length > 0 ? ach.details[0].value : undefined;
        const topPlayers = topValue !== undefined ? ach.details.filter((d: any) => d.value === topValue) : [];
        return {
          id: ach.id,
          title: ach.title,
          icon: ach.icon,
          count: ach.details.length,
          topPlayers: topPlayers,
          details: ach.details,
        };
      });

      res.json(result);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({ message: "Failed to fetch achievements" });
    }
  });

  app.post("/api/transfers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const validation = createTransferSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid transfer data", errors: validation.error.errors });
      }
      
      const { playerOutId, playerInId, gameweekId } = validation.data;

      const team = await storage.getTeamByUserId(userId);
      if (!team) {
        return res.status(400).json({ message: "No team found" });
      }

      const teamPlayers = await storage.getTeamPlayers(team.id);
      const playerOut = teamPlayers.find((tp) => tp.playerId === playerOutId);
      
      if (!playerOut) {
        return res.status(400).json({ message: "Player not in team" });
      }

      const playerIn = await storage.getPlayer(playerInId);
      if (!playerIn) {
        return res.status(400).json({ message: "Player not found" });
      }

      const playerOutObj = await storage.getPlayer(playerOutId);
      if (!playerOutObj) {
        return res.status(400).json({ message: "Player not found" });
      }

      const budget = parseFloat(team.budget);
      const playerInPrice = parseFloat(playerIn.price);
      const playerOutPrice = parseFloat(playerOutObj.price);
      const remainingBudget = budget - (playerInPrice - playerOutPrice);

      if (remainingBudget < 0) {
        return res.status(400).json({ message: "Insufficient budget" });
      }

      await storage.updateTeamPlayer(playerOut.id, { playerId: playerInId });

      const transfer = await storage.createTransfer({
        teamId: team.id,
        gameweekId,
        playerInId,
        playerOutId,
        cost: playerInPrice - playerOutPrice >= 0 ? 2 : 0,
      });

      await storage.updateTeam(team.id, {
        budget: String(remainingBudget),
      });

      res.json(transfer);
    } catch (error) {
      console.error("Error creating transfer:", error);
      res.status(500).json({ message: "Failed to create transfer" });
    }
  });

  app.get("/api/transfers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const team = await storage.getTeamByUserId(userId);
      
      if (!team) {
        return res.json([]);
      }

      const transfers = await storage.getTransfersByTeam(team.id);
      res.json(transfers);
    } catch (error) {
      console.error("Error fetching transfers:", error);
      res.status(500).json({ message: "Failed to fetch transfers" });
    }
  });

  app.get("/api/leagues", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const leagues = await storage.getLeaguesByUser(userId);
      res.json(leagues);
    } catch (error) {
      console.error("Error fetching leagues:", error);
      res.status(500).json({ message: "Failed to fetch leagues" });
    }
  });

  app.post("/api/leagues", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { name, joinCode } = req.body;

      if (!name) {
        return res.status(400).json({ message: "League name is required" });
      }

      if (!joinCode) {
        return res.status(400).json({ message: "Join code is required" });
      }

      // Validate join code is unique
      const existingLeague = await storage.getLeagueByCode(joinCode);
      if (existingLeague) {
        return res.status(400).json({ message: "This join code is already taken" });
      }

      const league = await storage.createLeague({
        name,
        joinCode,
        createdBy: userId,
      });

      const team = await storage.getTeamByUserId(userId);
      if (team) {
        await storage.addLeagueMember({
          leagueId: league.id,
          teamId: team.id,
        });
      }

      res.json(league);
    } catch (error) {
      console.error("Error creating league:", error);
      res.status(500).json({ message: "Failed to create league" });
    }
  });

  app.post("/api/leagues/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { joinCode } = req.body;

      if (!joinCode) {
        return res.status(400).json({ message: "Join code is required" });
      }

      const league = await storage.getLeagueByCode(joinCode);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      const team = await storage.getTeamByUserId(userId);
      if (!team) {
        return res.status(400).json({ message: "Team not found" });
      }

      const isInLeague = await storage.isTeamInLeague(team.id, league.id);
      if (isInLeague) {
        return res.status(400).json({ message: "Already in this league" });
      }

      await storage.addLeagueMember({
        leagueId: league.id,
        teamId: team.id,
      });

      res.json({ message: "Successfully joined league" });
    } catch (error) {
      console.error("Error joining league:", error);
      res.status(500).json({ message: "Failed to join league" });
    }
  });

  app.get("/api/leagues/:leagueId/leaderboard", isAuthenticated, async (req, res) => {
    try {
      const { leagueId } = req.params;
      
      const leagueMembers = await storage.getLeagueMembers(leagueId);
      const currentGameweek = await storage.getCurrentGameweek();

      const leaderboard = await Promise.all(
        leagueMembers.map(async (member) => {
          const scores = await db.select().from(gameweekScores).where(eq(gameweekScores.teamId, member.team.id));
          const totalPoints = scores.reduce((sum, score) => sum + (score.points || 0), 0);
          const currentGameweekScore = currentGameweek ? scores.find(s => s.gameweekId === currentGameweek.id) : null;
          const gameweekPoints = currentGameweekScore?.points || 0;
          
          return {
            rank: 0,
            teamName: member.user.teamName,
            totalPoints,
            gameweekPoints,
            userId: member.user.id,
            firstName: member.user.firstName,
            nationality: member.user.nationality,
            favoriteTeam: member.user.favoriteTeam,
            profileImageUrl: member.user.profileImageUrl,
            avatarPersonColor: member.user.avatarPersonColor,
            avatarBgColor: member.user.avatarBgColor,
          };
        })
      );

      leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);

      const rankedLeaderboard = leaderboard.map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

      res.json(rankedLeaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.delete("/api/leagues/:leagueId", isAuthenticated, async (req: any, res) => {
    try {
      const { leagueId } = req.params;
      const userId = req.user.id;

      const league = await storage.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      if (league.createdBy !== userId) {
        return res.status(403).json({ message: "Only league creator can delete" });
      }

      await storage.deleteLeague(leagueId);
      res.json({ message: "League deleted" });
    } catch (error) {
      console.error("Error deleting league:", error);
      res.status(500).json({ message: "Failed to delete league" });
    }
  });

  app.get("/api/player-of-week", isAuthenticated, async (req, res) => {
    try {
      const gameweeks = await storage.getAllGameweeks();
      if (gameweeks.length === 0) {
        return res.json({ player: null, gameweek: null });
      }

      const latestGameweek = gameweeks[gameweeks.length - 1];
      const performances = await storage.getAllPlayerPerformances(latestGameweek.id);

      const playerScores = performances.map((perf) => ({
        playerId: perf.playerId,
        player: perf.player,
        points: perf.points || 0,
      }));

      const bestPlayer = playerScores.reduce((max, ps) => ps.points > max.points ? ps : max, playerScores[0]);

      res.json({ player: bestPlayer.player, gameweek: latestGameweek, points: bestPlayer.points });
    } catch (error) {
      console.error("Error fetching player of week:", error);
      res.status(500).json({ message: "Failed to fetch player of week" });
    }
  });

  app.get("/api/dashboard/most-owned-player", isAuthenticated, async (req, res) => {
    try {
      const mostOwned = await storage.getMostOwnedPlayer();
      if (!mostOwned) {
        return res.json({ players: [], count: 0, percentage: 0, message: "N/A" });
      }
      res.json(mostOwned);
    } catch (error) {
      console.error("Error fetching most owned player:", error);
      res.status(500).json({ message: "Failed to fetch most owned player" });
    }
  });

  app.get("/api/team-of-week", isAuthenticated, async (req, res) => {
    try {
      const gameweeks = await storage.getAllGameweeks();
      const allTeams = await storage.getAllTeams();

      const teamScores = [];
      for (const team of allTeams) {
        let totalPoints = 0;
        const user = await storage.getUser(team.userId);
        for (const gameweek of gameweeks) {
          const score = await storage.getGameweekScore(team.id, gameweek.id);
          totalPoints += score?.points || 0;
        }

        const teamPlayers = await storage.getTeamPlayers(team.id);
        teamScores.push({ team, user, points: totalPoints, playerCount: teamPlayers.length });
      }

      if (teamScores.length === 0) {
        return res.json({ team: null, user: null, points: 0, message: "N/A" });
      }

      const bestTeam = teamScores.reduce((max, ts) => ts.points > max.points ? ts : max);
      if (bestTeam.points === 0) {
        return res.json({ team: null, user: null, points: 0, message: "N/A" });
      }

      res.json({ 
        team: bestTeam.team, 
        user: { firstName: bestTeam.user.firstName, email: bestTeam.user.email },
        points: bestTeam.points 
      });
    } catch (error) {
      console.error("Error fetching team of week:", error);
      res.status(500).json({ message: "Failed to fetch team of week" });
    }
  });

  app.post("/api/transfers/:transferId/confirm", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.email !== "admin@admin.com" && req.user.username !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { transferId } = req.params;
      res.json({ success: true });
    } catch (error) {
      console.error("Error confirming transfer:", error);
      res.status(500).json({ message: "Failed to confirm transfer" });
    }
  });

  app.post("/api/admin/player-performance", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.email !== "admin@admin.com" && req.user.username !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const validation = createPlayerPerformanceSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid performance data", errors: validation.error.errors });
      }

      // Get player to determine position for point calculation
      const player = await storage.getPlayer(validation.data.playerId);
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      // Calculate points dynamically
      const points = calculatePerformancePoints(player.position, validation.data);

      const perfData = {
        ...validation.data,
        points,
      };

      const perf = await storage.upsertPlayerPerformance(perfData);
      res.json(perf);
    } catch (error) {
      console.error("Error creating player performance:", error);
      res.status(500).json({ message: "Failed to create performance" });
    }
  });

  app.post("/api/admin/gameweek", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.email !== "admin@admin.com" && req.user.username !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { number } = req.body;
      if (!number) {
        return res.status(400).json({ message: "number is required" });
      }

      const gameweek = await storage.createGameweek({ number });
      res.json(gameweek);
    } catch (error) {
      console.error("Error creating gameweek:", error);
      res.status(500).json({ message: "Failed to create gameweek" });
    }
  });

  app.post("/api/admin/activate-gameweek", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.email !== "admin@admin.com" && req.user.username !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { gameweekId } = req.body;
      if (!gameweekId) {
        return res.status(400).json({ message: "gameweekId is required" });
      }

      const gameweek = await storage.getGameweek(gameweekId);
      if (!gameweek) {
        return res.status(404).json({ message: "Gameweek not found" });
      }

      await storage.setActiveGameweek(gameweekId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error activating gameweek:", error);
      res.status(500).json({ message: "Failed to activate gameweek" });
    }
  });

  app.post("/api/admin/unactivate-gameweek", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.email !== "admin@admin.com" && req.user.username !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { gameweekId } = req.body;
      if (!gameweekId) {
        return res.status(400).json({ message: "gameweekId is required" });
      }

      const gameweek = await storage.getGameweek(gameweekId);
      if (!gameweek) {
        return res.status(404).json({ message: "Gameweek not found" });
      }

      await storage.updateGameweek(gameweekId, { isActive: false });
      res.json({ success: true });
    } catch (error) {
      console.error("Error unactivating gameweek:", error);
      res.status(500).json({ message: "Failed to unactivate gameweek" });
    }
  });

  app.post("/api/admin/performances", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.email !== "admin@admin.com" && req.user.username !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { gameweekId, performances, priceChanges } = req.body;
      if (!gameweekId || !Array.isArray(performances)) {
        return res.status(400).json({ message: "gameweekId and performances array required" });
      }

      // Create/update all player performances
      for (const perf of performances) {
        // Get player to determine position for point calculation
        const player = await storage.getPlayer(perf.playerId);
        if (player) {
          const perfData = {
            playerId: perf.playerId,
            gameweekId,
            goals: perf.goals || 0,
            assists: perf.assists || 0,
            yellowCards: perf.yellowCards || 0,
            redCards: perf.redCards || 0,
            isMotm: perf.isMotm || false,
            daysPlayed: perf.daysPlayed || 0,
            penaltiesMissed: perf.penaltiesMissed || 0,
            goalsConceded: perf.goalsConceded || 0,
          };
          
          // Calculate points dynamically
          const points = calculatePerformancePoints(player.position, perfData);
          
          await storage.upsertPlayerPerformance({
            ...perfData,
            points,
          });
        }
      }

      // Update player prices
      if (priceChanges && typeof priceChanges === 'object') {
        for (const [playerId, priceChange] of Object.entries(priceChanges)) {
          const player = await storage.getPlayer(playerId);
          if (player) {
            const newPrice = (parseFloat(player.price) + (priceChange as number)).toFixed(1);
            await storage.updatePlayerPrice(playerId, newPrice);
          }
        }
      }

      res.json({ success: true, message: "Performances and prices updated" });
    } catch (error) {
      console.error("Error updating performances:", error);
      res.status(500).json({ message: "Failed to update performances" });
    }
  });

  app.post("/api/admin/end-gameweek", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.email !== "admin@admin.com" && req.user.username !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { gameweekId } = req.body;
      if (!gameweekId) {
        return res.status(400).json({ message: "gameweekId is required" });
      }

      const gameweek = await storage.getGameweek(gameweekId);
      if (!gameweek) {
        return res.status(404).json({ message: "Gameweek not found" });
      }

      await storage.updateGameweek(gameweekId, { isCompleted: true });

      res.json({ success: true });
    } catch (error) {
      console.error("Error ending gameweek:", error);
      res.status(500).json({ message: "Failed to end gameweek" });
    }
  });

  app.get("/api/admin/teams-users", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.email !== "admin@admin.com" && req.user.username !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const teams = await storage.getAllTeams();
      const allUsers = await db.select().from(users);
      
      const teamsWithUsers = await Promise.all(
        teams.map(async (team) => {
          const user = await storage.getUser(team.userId);
          return { ...team, user };
        })
      );

      res.json({ teams: teamsWithUsers, users: allUsers });
    } catch (error) {
      console.error("Error fetching teams/users:", error);
      res.status(500).json({ message: "Failed to fetch teams/users" });
    }
  });

  app.delete("/api/admin/team/:teamId", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.email !== "admin@admin.com" && req.user.username !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { teamId } = req.params;
      if (!teamId) {
        return res.status(400).json({ message: "teamId is required" });
      }

      await storage.deleteTeam(teamId);
      res.json({ success: true, message: "Team deleted successfully" });
    } catch (error) {
      console.error("Error deleting team:", error);
      res.status(500).json({ message: "Failed to delete team" });
    }
  });

  app.post("/api/admin/user/:userId/reset-password", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.email !== "admin@admin.com" && req.user.username !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

      // Generate temporary password
      const tempPassword = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 4).toUpperCase();
      
      // Hash password using same method as auth
      const iterations = 100000;
      const keylen = 64;
      const salt = (await import("crypto")).randomBytes(16).toString("hex");
      const hash = (await import("crypto")).pbkdf2Sync(tempPassword, salt, iterations, keylen, "sha256").toString("hex");
      const hashedPassword = `${salt}:${hash}`;

      await storage.updateUserPassword(userId, hashedPassword);
      res.json({ success: true, temporaryPassword: tempPassword, message: "Password reset. Share this temporary password with the user." });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.patch("/api/admin/user/:userId/username", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.email !== "admin@admin.com" && req.user.username !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { userId } = req.params;
      const { username } = req.body;

      if (!userId || !username) {
        return res.status(400).json({ message: "userId and username are required" });
      }

      if (username.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters" });
      }

      // Check if username already exists
      const existing = await storage.getUserByUsername(username);
      if (existing && existing.id !== userId) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const updated = await storage.updateUserUsername(userId, username);
      res.json({ success: true, user: updated });
    } catch (error) {
      console.error("Error updating username:", error);
      res.status(500).json({ message: "Failed to update username" });
    }
  });

  app.delete("/api/admin/user/:userId", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.email !== "admin@admin.com" && req.user.username !== "admin") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }

      // Don't allow deleting admin
      const user = await storage.getUser(userId);
      if (user?.email === "admin@admin.com") {
        return res.status(400).json({ message: "Cannot delete admin user" });
      }

      await storage.deleteUser(userId);
      res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
