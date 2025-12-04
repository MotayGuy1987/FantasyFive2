// Replace calculatePointsBreakdown in client/src/pages/my-team.tsx with this implementation

function calculatePointsBreakdown(perf: PlayerPerformance, position: string): Record<string, number> {
  const multipliers = POINT_MULTIPLIERS[position as keyof typeof POINT_MULTIPLIERS] || POINT_MULTIPLIERS.Midfielder;

  // days played points must match server rules:
  // 1-3 days -> +1, 4+ days -> +2
  const days = perf.daysPlayed || 0;
  let daysPlayedPoints = 0;
  if (days >= 1 && days <= 3) {
    daysPlayedPoints = 1;
  } else if (days >= 4) {
    daysPlayedPoints = 2;
  }
//pushpa
  return {
    goals: (perf.goals || 0) * multipliers.goal,
    assists: (perf.assists || 0) * multipliers.assist,
    yellowCards: (perf.yellowCards || 0) * multipliers.yellowCard,
    redCards: (perf.redCards || 0) * multipliers.redCard,
    motm: (perf.isMotm ? 1 : 0) * multipliers.motm,
    daysPlayed: daysPlayedPoints,
  };
  export default MyTeam;
}
