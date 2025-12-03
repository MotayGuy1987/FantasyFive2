// server/utils/performance.ts
// Minimal scoring helper used by routes that import ./utils/performance
// Mirrors server scoring rules: Defender: 6/goal, Mid/Forward: 5/goal, assist 3,
// yellow -1, red -3, MOTM +3, and daysPlayed bonus: 1-3 => +1, 4+ => +2

export function calculatePerformanceScore(playerOrObj: any): number {
  if (!playerOrObj) return 0;

  // Accept either { player: { position }, perf: { ... } } or a single object with position + perf fields
  let position = "";
  let perf: any = {};

  if (playerOrObj.player && playerOrObj.perf) {
    position = String(playerOrObj.player.position || "").toLowerCase();
    perf = playerOrObj.perf;
  } else if (playerOrObj.position && (typeof playerOrObj.goals !== "undefined" || typeof playerOrObj.assists !== "undefined")) {
    position = String(playerOrObj.position || "").toLowerCase();
    perf = playerOrObj;
  } else {
    // fallback: treat provided object as performance with unknown position
    perf = playerOrObj;
    position = String(playerOrObj.position || "").toLowerCase();
  }

  const goals = perf.goals || 0;
  const assists = perf.assists || 0;
  const yellow = perf.yellowCards || 0;
  const red = perf.redCards || 0;
  const straightRed = perf.straightRed || false;
  const isMotm = perf.isMotm || false;
  const daysPlayed = perf.daysPlayed || 0;

  let points = 0;

  if (position.includes("def")) {
    points += goals * 6;
  } else if (position.includes("mid")) {
    points += goals * 5;
  } else if (position.includes("for") || position.includes("fwd")) {
    points += goals * 5;
  } else {
    points += goals * 5;
  }

  points += assists * 3;
  points -= yellow * 1;
  points -= red * 3;
  if (straightRed) points -= 3;
  if (isMotm) points += 3;

  if (daysPlayed >= 1 && daysPlayed <= 3) {
    points += 1;
  } else if (daysPlayed >= 4) {
    points += 2;
  }

  return points;
}
