// server/utils/aggregation.ts
// Compatibility aggregation helper expected by routes that import ./utils/aggregation
// Accepts an array of teams with players and returns aggregated scores.
// Uses the same scoring helper so rules remain consistent.

import { calculatePerformanceScore } from "./performance";

export function aggregateTeamScores(teams: any[] = []) {
  // teams expected shape:
  // [{ id: 'team-1', players: [{ playerId, goals, assists, ... } , ...] }, ...]
  return teams.map((team) => {
    const players = Array.isArray(team.players) ? team.players : [];
    const points = players.reduce((sum: number, p: any) => {
      const pPoints = typeof p.points === "number" ? p.points : calculatePerformanceScore(p);
      return sum + (pPoints || 0);
    }, 0);

    return {
      teamId: team.id,
      points,
    };
  });
}
