// Replace calculatePerformancePoints(...) with this in server/routes.ts and call aggregation helper

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

  // Goal points based on position (accept full names and common abbreviations)
  if (position.includes("def")) {
    points += goals * 6;
  } else if (position.includes("mid")) {
    points += goals * 5;
  } else if (position.includes("for") || position.includes("fwd")) {
    points += goals * 5;
  } else {
    // default to 5 per goal for unknown/other positions
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

  // Days-played bonus: 1-3 -> +1, 4+ -> +2
  if (daysPlayed >= 1 && daysPlayed <= 3) {
    points += 1;
  } else if (daysPlayed >= 4) {
    points += 2;
  }

  return points;
}

// In POST /api/admin/performances handler, after upserting performances and updating prices, add:
// try { await aggregateAndUpsertTeamScores(gameweekId); } catch (aggErr) { console.error("Error aggregating team scores:", aggErr); }