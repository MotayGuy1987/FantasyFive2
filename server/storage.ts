import {
  users,
  players,
  teams,
  teamPlayers,
  gameweeks,
  playerPerformances,
  chips,
  transfers,
  leagues,
  leagueMembers,
  gameweekScores,
  type User,
  type UpsertUser,
  type Player,
  type InsertPlayer,
  type Team,
  type InsertTeam,
  type TeamPlayer,
  type InsertTeamPlayer,
  type Gameweek,
  type InsertGameweek,
  type PlayerPerformance,
  type InsertPlayerPerformance,
  type Chip,
  type InsertChip,
  type Transfer,
  type InsertTransfer,
  type League,
  type InsertLeague,
  type LeagueMember,
  type InsertLeagueMember,
  type GameweekScore,
  type InsertGameweekScore,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserTeamName(userId: string, teamName: string): Promise<User | undefined>;
  
  getAllPlayers(): Promise<Player[]>;
  getPlayer(id: string): Promise<Player | undefined>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayerForm(playerId: string, isInForm: boolean): Promise<void>;
  updatePlayerPrice(playerId: string, price: string): Promise<void>;
  
  getAllTeams(): Promise<Team[]>;
  getTeamByUserId(userId: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(teamId: string, data: Partial<Team>): Promise<Team>;
  
  getTeamPlayers(teamId: string): Promise<(TeamPlayer & { player: Player })[]>;
  createTeamPlayer(teamPlayer: InsertTeamPlayer): Promise<TeamPlayer>;
  updateTeamPlayer(teamPlayerId: string, data: Partial<TeamPlayer>): Promise<TeamPlayer>;
  deleteTeamPlayers(teamId: string): Promise<void>;
  
  getAllGameweeks(): Promise<Gameweek[]>;
  getCurrentGameweek(): Promise<Gameweek | undefined>;
  getGameweek(id: string): Promise<Gameweek | undefined>;
  createGameweek(gameweek: InsertGameweek): Promise<Gameweek>;
  updateGameweek(gameweekId: string, data: Partial<Gameweek>): Promise<Gameweek>;
  setActiveGameweek(gameweekId: string): Promise<void>;
  
  getPlayerPerformance(playerId: string, gameweekId: string): Promise<PlayerPerformance | undefined>;
  getAllPlayerPerformances(gameweekId: string): Promise<(PlayerPerformance & { player: Player })[]>;
  createPlayerPerformance(performance: InsertPlayerPerformance): Promise<PlayerPerformance>;
  upsertPlayerPerformance(performance: InsertPlayerPerformance): Promise<PlayerPerformance>;
  
  getChipsUsedByTeam(teamId: string): Promise<Chip[]>;
  createChip(chip: InsertChip): Promise<Chip>;
  canUseChip(teamId: string, chipType: string, gameweekNumber: number): Promise<boolean>;
  
  getTransfersByTeam(teamId: string): Promise<Transfer[]>;
  getTransfersByGameweek(teamId: string, gameweekId: string): Promise<Transfer[]>;
  createTransfer(transfer: InsertTransfer): Promise<Transfer>;
  
  getAllLeagues(): Promise<League[]>;
  getLeague(id: string): Promise<League | undefined>;
  getLeagueByCode(joinCode: string): Promise<League | undefined>;
  getLeaguesByUser(userId: string): Promise<League[]>;
  createLeague(league: InsertLeague): Promise<League>;
  deleteLeague(leagueId: string): Promise<void>;
  getOrCreateOverallLeague(): Promise<League>;
  
  getLeagueMembers(leagueId: string): Promise<(LeagueMember & { team: Team; user: User })[]>;
  addLeagueMember(member: InsertLeagueMember): Promise<LeagueMember>;
  isTeamInLeague(teamId: string, leagueId: string): Promise<boolean>;
  
  getGameweekScore(teamId: string, gameweekId: string): Promise<GameweekScore | undefined>;
  upsertGameweekScore(score: InsertGameweekScore): Promise<GameweekScore>;
  
  getMostOwnedPlayer(): Promise<{ player: Player; count: number; percentage: number } | null>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserTeamName(userId: string, teamName: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ teamName, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getAllPlayers(): Promise<Player[]> {
    return await db.select().from(players);
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player;
  }

  async createPlayer(playerData: InsertPlayer): Promise<Player> {
    const [player] = await db.insert(players).values(playerData).returning();
    return player;
  }

  async updatePlayerForm(playerId: string, isInForm: boolean): Promise<void> {
    await db.update(players).set({ isInForm }).where(eq(players.id, playerId));
  }

  async updatePlayerPrice(playerId: string, price: string): Promise<void> {
    await db.update(players).set({ price }).where(eq(players.id, playerId));
  }

  async getAllTeams(): Promise<Team[]> {
    return await db.select().from(teams);
  }

  async getTeamByUserId(userId: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.userId, userId));
    return team;
  }

  async createTeam(teamData: InsertTeam): Promise<Team> {
    const [team] = await db.insert(teams).values(teamData).returning();
    return team;
  }

  async updateTeam(teamId: string, data: Partial<Team>): Promise<Team> {
    const [team] = await db
      .update(teams)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(teams.id, teamId))
      .returning();
    return team;
  }

  async getTeamPlayers(teamId: string): Promise<(TeamPlayer & { player: Player })[]> {
    const results = await db
      .select()
      .from(teamPlayers)
      .innerJoin(players, eq(teamPlayers.playerId, players.id))
      .where(eq(teamPlayers.teamId, teamId));
    
    return results.map((r) => ({
      ...r.team_players,
      player: r.players,
    }));
  }

  async createTeamPlayer(teamPlayerData: InsertTeamPlayer): Promise<TeamPlayer> {
    const [teamPlayer] = await db.insert(teamPlayers).values(teamPlayerData).returning();
    return teamPlayer;
  }

  async updateTeamPlayer(teamPlayerId: string, data: Partial<TeamPlayer>): Promise<TeamPlayer> {
    const [teamPlayer] = await db
      .update(teamPlayers)
      .set(data)
      .where(eq(teamPlayers.id, teamPlayerId))
      .returning();
    return teamPlayer;
  }

  async deleteTeamPlayers(teamId: string): Promise<void> {
    await db.delete(teamPlayers).where(eq(teamPlayers.teamId, teamId));
  }

  async getAllGameweeks(): Promise<Gameweek[]> {
    return await db.select().from(gameweeks).orderBy(gameweeks.number);
  }

  async getCurrentGameweek(): Promise<Gameweek | undefined> {
    const [gameweek] = await db
      .select()
      .from(gameweeks)
      .where(eq(gameweeks.isActive, true))
      .limit(1);
    return gameweek;
  }

  async getGameweek(id: string): Promise<Gameweek | undefined> {
    const [gameweek] = await db.select().from(gameweeks).where(eq(gameweeks.id, id));
    return gameweek;
  }

  async createGameweek(gameweekData: InsertGameweek): Promise<Gameweek> {
    const [gameweek] = await db.insert(gameweeks).values(gameweekData).returning();
    return gameweek;
  }

  async updateGameweek(gameweekId: string, data: Partial<Gameweek>): Promise<Gameweek> {
    const [gameweek] = await db
      .update(gameweeks)
      .set(data)
      .where(eq(gameweeks.id, gameweekId))
      .returning();
    return gameweek;
  }

  async setActiveGameweek(gameweekId: string): Promise<void> {
    await db.update(gameweeks).set({ isActive: false });
    await db.update(gameweeks).set({ isActive: true }).where(eq(gameweeks.id, gameweekId));
  }

  async getPlayerPerformance(playerId: string, gameweekId: string): Promise<PlayerPerformance | undefined> {
    const [performance] = await db
      .select()
      .from(playerPerformances)
      .where(
        and(
          eq(playerPerformances.playerId, playerId),
          eq(playerPerformances.gameweekId, gameweekId)
        )
      );
    return performance;
  }

  async getAllPlayerPerformances(gameweekId: string): Promise<(PlayerPerformance & { player: Player })[]> {
    const results = await db
      .select()
      .from(playerPerformances)
      .innerJoin(players, eq(playerPerformances.playerId, players.id))
      .where(eq(playerPerformances.gameweekId, gameweekId));
    
    return results.map((r) => ({
      ...r.player_performances,
      player: r.players,
    }));
  }

  async createPlayerPerformance(performanceData: InsertPlayerPerformance): Promise<PlayerPerformance> {
    const [performance] = await db.insert(playerPerformances).values(performanceData).returning();
    return performance;
  }

  async upsertPlayerPerformance(performanceData: InsertPlayerPerformance): Promise<PlayerPerformance> {
    const [performance] = await db
      .insert(playerPerformances)
      .values(performanceData)
      .onConflictDoUpdate({
        target: [playerPerformances.playerId, playerPerformances.gameweekId],
        set: performanceData,
      })
      .returning();
    return performance;
  }

  async getChipsUsedByTeam(teamId: string): Promise<Chip[]> {
    return await db.select().from(chips).where(eq(chips.teamId, teamId));
  }

  async createChip(chipData: InsertChip): Promise<Chip> {
    const [chip] = await db.insert(chips).values(chipData).returning();
    return chip;
  }

  async canUseChip(teamId: string, chipType: string, gameweekNumber: number): Promise<boolean> {
    const chipsUsed = await db
      .select()
      .from(chips)
      .innerJoin(gameweeks, eq(chips.gameweekId, gameweeks.id))
      .where(
        and(
          eq(chips.teamId, teamId),
          eq(chips.chipType, chipType)
        )
      )
      .orderBy(desc(gameweeks.number))
      .limit(1);

    if (chipsUsed.length === 0) return true;

    const lastUsedGameweek = chipsUsed[0].gameweeks.number;
    return gameweekNumber - lastUsedGameweek >= 7;
  }

  async getTransfersByTeam(teamId: string): Promise<Transfer[]> {
    return await db.select().from(transfers).where(eq(transfers.teamId, teamId));
  }

  async getTransfersByGameweek(teamId: string, gameweekId: string): Promise<Transfer[]> {
    return await db
      .select()
      .from(transfers)
      .where(
        and(
          eq(transfers.teamId, teamId),
          eq(transfers.gameweekId, gameweekId)
        )
      );
  }

  async createTransfer(transferData: InsertTransfer): Promise<Transfer> {
    const [transfer] = await db.insert(transfers).values(transferData).returning();
    return transfer;
  }

  async getAllLeagues(): Promise<League[]> {
    return await db.select().from(leagues);
  }

  async getLeague(id: string): Promise<League | undefined> {
    const [league] = await db.select().from(leagues).where(eq(leagues.id, id));
    return league;
  }

  async getLeagueByCode(joinCode: string): Promise<League | undefined> {
    const [league] = await db.select().from(leagues).where(eq(leagues.joinCode, joinCode));
    return league;
  }

  async getLeaguesByUser(userId: string): Promise<League[]> {
    const userTeam = await this.getTeamByUserId(userId);
    if (!userTeam) return [];

    // Ensure user is in Overall League
    const overallLeague = await this.getOrCreateOverallLeague();
    const isAlreadyMember = await this.isTeamInLeague(userTeam.id, overallLeague.id);
    if (!isAlreadyMember) {
      await this.addLeagueMember({
        leagueId: overallLeague.id,
        teamId: userTeam.id,
      });
    }

    const results = await db
      .select()
      .from(leagueMembers)
      .innerJoin(leagues, eq(leagueMembers.leagueId, leagues.id))
      .where(eq(leagueMembers.teamId, userTeam.id));

    return results.map((r) => r.leagues);
  }

  async createLeague(leagueData: InsertLeague): Promise<League> {
    const [league] = await db.insert(leagues).values(leagueData).returning();
    return league;
  }

  async deleteLeague(leagueId: string): Promise<void> {
    await db.delete(leagueMembers).where(eq(leagueMembers.leagueId, leagueId));
    await db.delete(leagues).where(eq(leagues.id, leagueId));
  }

  async getOrCreateOverallLeague(): Promise<League> {
    const existing = await db
      .select()
      .from(leagues)
      .where(eq(leagues.isOverall, true))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    const systemUserId = (await db.select().from(users).limit(1))[0]?.id || "system";
    const [league] = await db
      .insert(leagues)
      .values({
        name: "Overall League",
        joinCode: "OVERALL",
        createdBy: systemUserId,
        isOverall: true,
      })
      .returning();
    return league;
  }

  async getLeagueMembers(leagueId: string): Promise<(LeagueMember & { team: Team; user: User })[]> {
    const results = await db
      .select()
      .from(leagueMembers)
      .innerJoin(teams, eq(leagueMembers.teamId, teams.id))
      .innerJoin(users, eq(teams.userId, users.id))
      .where(eq(leagueMembers.leagueId, leagueId));

    return results.map((r) => ({
      ...r.league_members,
      team: r.teams,
      user: r.users,
    }));
  }

  async addLeagueMember(memberData: InsertLeagueMember): Promise<LeagueMember> {
    const [member] = await db.insert(leagueMembers).values(memberData).returning();
    return member;
  }

  async isTeamInLeague(teamId: string, leagueId: string): Promise<boolean> {
    const [member] = await db
      .select()
      .from(leagueMembers)
      .where(
        and(
          eq(leagueMembers.teamId, teamId),
          eq(leagueMembers.leagueId, leagueId)
        )
      );
    return !!member;
  }

  async getGameweekScore(teamId: string, gameweekId: string): Promise<GameweekScore | undefined> {
    const [score] = await db
      .select()
      .from(gameweekScores)
      .where(
        and(
          eq(gameweekScores.teamId, teamId),
          eq(gameweekScores.gameweekId, gameweekId)
        )
      );
    return score;
  }

  async upsertGameweekScore(scoreData: InsertGameweekScore): Promise<GameweekScore> {
    const [score] = await db
      .insert(gameweekScores)
      .values(scoreData)
      .onConflictDoUpdate({
        target: [gameweekScores.teamId, gameweekScores.gameweekId],
        set: scoreData,
      })
      .returning();
    return score;
  }

  async getMostOwnedPlayer(): Promise<{ player: Player; count: number; percentage: number } | null> {
    const allTeams = await db.select().from(teams);
    const totalTeams = allTeams.length;
    
    if (totalTeams === 0) return null;

    const allTeamPlayers = await db.select().from(teamPlayers);
    const playerCounts: Record<string, number> = {};
    
    for (const tp of allTeamPlayers) {
      playerCounts[tp.playerId] = (playerCounts[tp.playerId] || 0) + 1;
    }
    
    const mostOwnedPlayerId = Object.keys(playerCounts).reduce((a, b) => 
      playerCounts[a] > playerCounts[b] ? a : b
    );
    
    if (!mostOwnedPlayerId) return null;
    
    const player = await this.getPlayer(mostOwnedPlayerId);
    if (!player) return null;
    
    const count = playerCounts[mostOwnedPlayerId];
    const percentage = (count / totalTeams) * 100;
    
    return { player, count, percentage };
  }
}

export const storage = new DatabaseStorage();
