// server/utils/scoreAggregation.ts
// Helper to aggregate team scores for a given gameweek.
//
// Uses the project's existing `storage` and `db` modules and the Drizzle table objects
// already used in server/routes.ts. Adjust import paths if your project layout differs.

import { storage } from "../storage";
import { db } from "../db";
import { gameweekScores } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Aggregate and upsert gameweek scores for all teams for the given gameweekId.
 *
 * - Sums starting XI player performance points for each team for the provided gameweekId
 * - Upserts gameweek_scores rows (teamId + gameweekId -> points)
 * - Recalculates and writes teams.totalPoints using the gameweek_scores table
 */
export async function aggregateAndUpsertTeamScores(gameweekId: string) {
  if (!gameweekId) return;

  // Get all teams (storage helper used throughout the codebase)
  const allTeams = await storage.getAllTeams();

  // Preload all performances for that gameweek to avoid N+1 queries
  const allPerformances = await storage.getAllPlayerPerformances(gameweekId);

  // Map performances by playerId for quick lookup
  const perfByPlayer: Record<string, any> = {};
  for (const p of allPerformances) {
    perfByPlayer[p.playerId] = p;
  }

  for (const team of allTeams) {
    // Get team players (teamPlayers returns records that include playerId and isOnBench)
    const tPlayers = await storage.getTeamPlayers(team.id);

    // Consider starters only (isOnBench === false)
    const starters = tPlayers.filter((tp: any) => !tp.isOnBench);

    // Sum points for starters from perfByPlayer
    let teamGWPoints = 0;
    for (const tp of starters) {
      const perf = perfByPlayer[tp.playerId];
      teamGWPoints += (perf?.points || 0);
    }

    // Upsert gameweek_scores row for this team + gameweek
    const existing = await db.select().from(gameweekScores).where(
      eq(gameweekScores.teamId, team.id),
      eq(gameweekScores.gameweekId, gameweekId)
    );

    if (existing && existing.length > 0) {
      // Update existing row
      await db.update(gameweekScores).set({ points: teamGWPoints }).where(
        eq(gameweekScores.id, existing[0].id)
      );
    } else {
      // Insert new row
      await db.insert(gameweekScores).values({
        teamId: team.id,
        gameweekId,
        points: teamGWPoints,
      });
    }

    // Recalculate team's totalPoints across all gameweeks
    const scoresForTeam = await db.select().from(gameweekScores).where(eq(gameweekScores.teamId, team.id));
    const totalPoints = scoresForTeam.reduce((s: number, r: any) => s + (r.points || 0), 0);

    // Update team.totalPoints using storage helper so other behaviors remain consistent
    await storage.updateTeam(team.id, { totalPoints: String(totalPoints) });
  }
}