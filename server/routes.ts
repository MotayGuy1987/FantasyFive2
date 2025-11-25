import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { validateTransfer } from "./positionValidation";
import { z } from "zod";

const createTeamSchema = z.object({
  teamName: z.string().min(1),
  players: z.array(z.object({
    playerId: z.string(),
    isCaptain: z.boolean(),
    isOnBench: z.boolean(),
    position: z.number(),
  })).length(6),
});

const createTransferSchema = z.object({
  playerOutId: z.string(),
  playerInId: z.string(),
  gameweekId: z.string(),
});

const createLeagueSchema = z.object({
  name: z.string().min(1),
});

const joinLeagueSchema = z.object({
  joinCode: z.string().length(6),
});

const createGameweekSchema = z.object({
  number: z.number().int().positive(),
});

const submitPerformancesSchema = z.object({
  gameweekId: z.string(),
  performances: z.array(z.object({
    playerId: z.string(),
    goals: z.number().int().min(0),
    assists: z.number().int().min(0),
    yellowCards: z.number().int().min(0),
    redCards: z.number().int().min(0),
    straightRed: z.boolean(),
    isMotm: z.boolean(),
    daysPlayed: z.number().int().min(0),
  })),
});

const activateChipSchema = z.object({
  chipType: z.enum(["BENCH_BOOST", "TRIPLE_CAPTAIN"]),
  gameweekId: z.string(),
});

function calculatePlayerPoints(
  goals: number,
  assists: number,
  yellowCards: number,
  redCards: number,
  straightRed: boolean,
  isMotm: boolean,
  daysPlayed: number,
  position: string
): number {
  let points = 0;

  if (position === "Midfielder") {
    points += goals * 5;
  } else if (position === "Defender") {
    points += goals * 6;
  } else {
    points += goals * 5;
  }

  points += assists * 3;
  points -= yellowCards * 1;
  points -= redCards * 2;
  
  if (straightRed) {
    points -= 3;
  }

  if (isMotm) {
    points += 3;
  }

  if (daysPlayed >= 4) {
    points += 2;
  }

  return points;
}

function generateJoinCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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
      res.json(team || null);
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
      if (totalCost > 50) {
        return res.status(400).json({ message: "Team exceeds budget" });
      }

      const captainCount = requestedPlayers.filter((p: any) => p.isCaptain).length;
      const benchCount = requestedPlayers.filter((p: any) => p.isOnBench).length;

      if (captainCount !== 1 || benchCount !== 1) {
        return res.status(400).json({ message: "Must have exactly 1 captain and 1 bench player" });
      }

      let team = await storage.getTeamByUserId(userId);
      if (!team) {
        team = await storage.createTeam({ userId, freeTransfers: 1 });
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
      const user = await storage.getUser(userId);
      if (user && !user.teamName) {
        await storage.updateUserTeamName(userId, teamName);
      }

      res.json({ success: true, team });
    } catch (error) {
      console.error("Error creating/updating team:", error);
      res.status(500).json({ message: "Failed to save team" });
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
      res.json(gameweek || null);
    } catch (error) {
      console.error("Error fetching current gameweek:", error);
      res.status(500).json({ message: "Failed to fetch current gameweek" });
    }
  });

  app.post("/api/gameweeks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (req.user.email !== "admin@admin.com") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const validation = createGameweekSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid gameweek data", errors: validation.error.errors });
      }
      
      const { number } = validation.data;
      const gameweek = await storage.createGameweek({ number, isActive: false, isCompleted: false });
      res.json(gameweek);
    } catch (error) {
      console.error("Error creating gameweek:", error);
      res.status(500).json({ message: "Failed to create gameweek" });
    }
  });

  app.get("/api/team/gameweek-score/:gameweekId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { gameweekId } = req.params;
      
      const team = await storage.getTeamByUserId(userId);
      if (!team) {
        return res.json({ points: 0 });
      }

      const score = await storage.getGameweekScore(team.id, gameweekId);
      res.json({ points: score?.points || 0 });
    } catch (error) {
      console.error("Error fetching gameweek score:", error);
      res.status(500).json({ message: "Failed to fetch gameweek score" });
    }
  });

  app.get("/api/gameweek/:gameweekId/player-performances", isAuthenticated, async (req, res) => {
    try {
      const { gameweekId } = req.params;
      const performances = await storage.getAllPlayerPerformances(gameweekId);
      res.json(performances);
    } catch (error) {
      console.error("Error fetching player performances:", error);
      res.status(500).json({ message: "Failed to fetch player performances" });
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
        return res.status(400).json({ message: "Invalid player" });
      }

      // Validate position requirements
      const transferValidation = validateTransfer(
        playerOut.player.position,
        playerIn.position,
        teamPlayers.map(tp => ({
          id: tp.playerId,
          position: tp.player.position,
          isOnBench: tp.isOnBench,
        }))
      );

      if (!transferValidation.canTransfer) {
        return res.status(400).json({ message: transferValidation.reason || "Invalid transfer" });
      }

      const transfersThisGameweek = await storage.getTransfersByGameweek(team.id, gameweekId);
      const freeTransfers = team.freeTransfers || 0;
      const cost = transfersThisGameweek.length >= freeTransfers ? -2 : 0;

      await storage.deleteTeamPlayers(team.id);
      
      for (const tp of teamPlayers) {
        if (tp.playerId === playerOutId) {
          await storage.createTeamPlayer({
            teamId: team.id,
            playerId: playerInId,
            isCaptain: tp.isCaptain,
            isOnBench: tp.isOnBench,
            position: tp.position,
          });
        } else {
          await storage.createTeamPlayer({
            teamId: team.id,
            playerId: tp.playerId,
            isCaptain: tp.isCaptain,
            isOnBench: tp.isOnBench,
            position: tp.position,
          });
        }
      }

      await storage.createTransfer({
        teamId: team.id,
        gameweekId,
        playerInId,
        playerOutId,
        cost,
      });

      if (cost < 0) {
        await storage.updateTeam(team.id, { 
          totalPoints: (team.totalPoints || 0) + cost 
        });
      }

      const newFreeTransfers = cost === 0 ? Math.max(0, freeTransfers - 1) : freeTransfers;
      await storage.updateTeam(team.id, { freeTransfers: newFreeTransfers });

      res.json({ success: true });
    } catch (error) {
      console.error("Error making transfer:", error);
      res.status(500).json({ message: "Failed to make transfer" });
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

  app.get("/api/leagues/my-leagues", isAuthenticated, async (req: any, res) => {
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
      
      const validation = createLeagueSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid league data", errors: validation.error.errors });
      }
      
      const { name } = validation.data;

      const team = await storage.getTeamByUserId(userId);
      if (!team) {
        return res.status(400).json({ message: "You must create a team first" });
      }

      const joinCode = generateJoinCode();
      const league = await storage.createLeague({
        name,
        joinCode,
        createdBy: userId,
      });

      await storage.addLeagueMember({
        leagueId: league.id,
        teamId: team.id,
      });

      res.json(league);
    } catch (error) {
      console.error("Error creating league:", error);
      res.status(500).json({ message: "Failed to create league" });
    }
  });

  app.post("/api/leagues/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const validation = joinLeagueSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid join code", errors: validation.error.errors });
      }
      
      const { joinCode } = validation.data;

      const team = await storage.getTeamByUserId(userId);
      if (!team) {
        return res.status(400).json({ message: "You must create a team first" });
      }

      const league = await storage.getLeagueByCode(joinCode);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      const alreadyMember = await storage.isTeamInLeague(team.id, league.id);
      if (alreadyMember) {
        return res.status(400).json({ message: "Already a member of this league" });
      }

      await storage.addLeagueMember({
        leagueId: league.id,
        teamId: team.id,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error joining league:", error);
      res.status(500).json({ message: "Failed to join league" });
    }
  });

  app.delete("/api/leagues/:leagueId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { leagueId } = req.params;

      const league = await storage.getLeague(leagueId);
      if (!league) {
        return res.status(404).json({ message: "League not found" });
      }

      if (league.createdBy !== userId) {
        return res.status(403).json({ message: "Only the league creator can delete it" });
      }

      await storage.deleteLeague(leagueId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting league:", error);
      res.status(500).json({ message: "Failed to delete league" });
    }
  });

  app.get("/api/leagues/:leagueId/leaderboard", isAuthenticated, async (req, res) => {
    try {
      const { leagueId } = req.params;
      
      const members = await storage.getLeagueMembers(leagueId);
      const currentGameweek = await storage.getCurrentGameweek();

      const leaderboard = await Promise.all(
        members.map(async (member) => {
          const gameweekScore = currentGameweek 
            ? await storage.getGameweekScore(member.teamId, currentGameweek.id)
            : null;

          return {
            teamName: member.user.teamName || member.user.email || 'Unknown',
            totalPoints: member.team.totalPoints || 0,
            gameweekPoints: gameweekScore?.points || 0,
          };
        })
      );

      leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
      
      const rankedLeaderboard = leaderboard.map((entry, index) => ({
        rank: index + 1,
        ...entry,
      }));

      res.json(rankedLeaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  app.post("/api/chips/activate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const validation = activateChipSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid chip data", errors: validation.error.errors });
      }
      
      const { chipType, gameweekId } = validation.data;

      const team = await storage.getTeamByUserId(userId);
      if (!team) {
        return res.status(400).json({ message: "No team found" });
      }

      const gameweek = await storage.getGameweek(gameweekId);
      if (!gameweek) {
        return res.status(404).json({ message: "Gameweek not found" });
      }

      const canUse = await storage.canUseChip(team.id, chipType, gameweek.number);
      if (!canUse) {
        return res.status(400).json({ message: "Chip cannot be used. Must wait 7 gameweeks between uses." });
      }

      await storage.createChip({
        teamId: team.id,
        chipType,
        gameweekId,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error activating chip:", error);
      res.status(500).json({ message: "Failed to activate chip" });
    }
  });

  app.get("/api/chips", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const team = await storage.getTeamByUserId(userId);
      
      if (!team) {
        return res.json([]);
      }

      const chips = await storage.getChipsUsedByTeam(team.id);
      res.json(chips);
    } catch (error) {
      console.error("Error fetching chips:", error);
      res.status(500).json({ message: "Failed to fetch chips" });
    }
  });

  app.post("/api/admin/performances", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (req.user.email !== "admin@admin.com") {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const validation = submitPerformancesSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: "Invalid performance data", errors: validation.error.errors });
      }
      
      const { gameweekId, performances } = validation.data;
      const gameweek = await storage.getGameweek(gameweekId);
      
      if (!gameweek) {
        return res.status(404).json({ message: "Gameweek not found" });
      }

      for (const perf of performances) {
        const player = await storage.getPlayer(perf.playerId);
        if (!player) continue;

        const points = calculatePlayerPoints(
          perf.goals,
          perf.assists,
          perf.yellowCards,
          perf.redCards,
          perf.straightRed,
          perf.isMotm,
          perf.daysPlayed,
          player.position
        );

        await storage.upsertPlayerPerformance({
          playerId: perf.playerId,
          gameweekId,
          goals: perf.goals,
          assists: perf.assists,
          yellowCards: perf.yellowCards,
          redCards: perf.redCards,
          straightRed: perf.straightRed,
          isMotm: perf.isMotm,
          daysPlayed: perf.daysPlayed,
          points,
        });

        const isInForm = perf.goals > 0 || perf.assists > 0 || perf.isMotm;
        await storage.updatePlayerForm(perf.playerId, isInForm);
      }

      // Auto-substitution: replace 0-point starters with bench player if bench player has >0 points
      const allTeams = await storage.getAllTeams();

      for (const team of allTeams) {
        let teamPlayers = await storage.getTeamPlayers(team.id);
        
        const starters = teamPlayers.filter((tp) => !tp.isOnBench);
        const bench = teamPlayers.filter((tp) => tp.isOnBench);
        
        for (const starter of starters) {
          const starterPerf = await storage.getPlayerPerformance(starter.playerId, gameweekId);
          const starterPoints = starterPerf?.points || 0;
          
          if (starterPoints === 0 && bench.length > 0) {
            const benchPlayer = bench[0];
            const benchPerf = await storage.getPlayerPerformance(benchPlayer.playerId, gameweekId);
            const benchPoints = benchPerf?.points || 0;
            
            if (benchPoints > 0) {
              // Swap starter and bench
              await storage.updateTeamPlayer(starter.id, { isOnBench: true });
              await storage.updateTeamPlayer(benchPlayer.id, { isOnBench: false });
            }
          }
        }
      }

      const allTeamsUpdated = await storage.getAllTeams();

      for (const team of allTeamsUpdated) {
        const teamPlayers = await storage.getTeamPlayers(team.id);
        let totalPoints = 0;
        let benchBoostUsed = false;
        let tripleCaptainUsed = false;

        const chips = await storage.getChipsUsedByTeam(team.id);
        const gameweekChips = chips.filter((c) => c.gameweekId === gameweekId);
        
        benchBoostUsed = gameweekChips.some((c) => c.chipType === "BENCH_BOOST");
        tripleCaptainUsed = gameweekChips.some((c) => c.chipType === "TRIPLE_CAPTAIN");

        for (const tp of teamPlayers) {
          const performance = await storage.getPlayerPerformance(tp.playerId, gameweekId);
          const playerPoints = performance?.points || 0;

          if (tp.isOnBench && !benchBoostUsed) {
            continue;
          }

          if (tp.isCaptain) {
            totalPoints += playerPoints * (tripleCaptainUsed ? 3 : 2);
          } else {
            totalPoints += playerPoints;
          }
        }

        await storage.upsertGameweekScore({
          teamId: team.id,
          gameweekId,
          points: totalPoints,
          benchBoostUsed,
          tripleCaptainUsed,
        });

        const transfers = await storage.getTransfersByGameweek(team.id, gameweekId);
        const transferCost = transfers.reduce((sum, t) => sum + (t.cost || 0), 0);
        
        const newTotalPoints = (team.totalPoints || 0) + totalPoints + transferCost;
        const newFreeTransfers = Math.min((team.freeTransfers || 0) + 1, 5);
        
        await storage.updateTeam(team.id, {
          totalPoints: newTotalPoints,
          freeTransfers: newFreeTransfers,
        });
      }

      await storage.setActiveGameweek(gameweekId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error submitting performances:", error);
      res.status(500).json({ message: "Failed to submit performances" });
    }
  });

  app.post("/api/admin/end-gameweek", isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.email !== "admin@admin.com") {
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

  const httpServer = createServer(app);
  return httpServer;
}
