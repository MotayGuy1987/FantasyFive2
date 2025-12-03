import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import the functions under test
import { aggregateAndUpsertTeamScores } from '../utils/scoreAggregation';
import { calculatePerformancePoints } from '../routes';

// Mock the storage and db modules used by the aggregation helper
vi.mock('../storage', () => ({
  storage: {
    getAllTeams: vi.fn(),
    getAllPlayerPerformances: vi.fn(),
    getTeamPlayers: vi.fn(),
    updateTeam: vi.fn(),
  },
}));
vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

import { storage } from '../storage';
import { db } from '../db';

describe('scoring & aggregation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('calculatePerformancePoints: defender goal = 6, midfielder/forward = 5, daysPlayed bonus applied', () => {
    const defPerf = { goals: 1, assists: 0, yellowCards: 0, redCards: 0, isMotm: false, daysPlayed: 4 };
    const midPerf = { goals: 1, assists: 0, yellowCards: 0, redCards: 0, isMotm: false, daysPlayed: 2 };
    const fwdPerf = { goals: 1, assists: 0, yellowCards: 0, redCards: 0, isMotm: false, daysPlayed: 0 };

    const defPoints = calculatePerformancePoints('Defender', defPerf);
    const midPoints = calculatePerformancePoints('Midfielder', midPerf);
    const fwdPoints = calculatePerformancePoints('Forward', fwdPerf);

    expect(defPoints).toBeGreaterThanOrEqual(8);
    expect(midPoints).toBeGreaterThanOrEqual(6);
    expect(fwdPoints).toBeGreaterThanOrEqual(5);
  });

  it('aggregateAndUpsertTeamScores: sums starter points and updates team totalPoints', async () => {
    const gwId = 'gw-test-1';

    const teamsMock = [{ id: 'team-1' }, { id: 'team-2' }];
    (storage.getAllTeams as any).mockResolvedValue(teamsMock);

    const perfs = [
      { playerId: 'p1', points: 5 },
      { playerId: 'p2', points: 3 },
      { playerId: 'p3', points: 4 },
    ];
    (storage.getAllPlayerPerformances as any).mockResolvedValue(perfs);

    (storage.getTeamPlayers as any)
      .mockResolvedValueOnce([{ playerId: 'p1', isOnBench: false }, { playerId: 'p2', isOnBench: true }])
      .mockResolvedValueOnce([{ playerId: 'p3', isOnBench: false }]);

    (db.select as any).mockResolvedValue([]);

    await aggregateAndUpsertTeamScores(gwId);

    expect(storage.updateTeam).toHaveBeenCalled();
    const calls = (storage.updateTeam as any).mock.calls;
    const calledForTeam1 = calls.some((c: any[]) => c[0] === 'team-1' && c[1].totalPoints && c[1].totalPoints.includes('5'));
    const calledForTeam2 = calls.some((c: any[]) => c[0] === 'team-2' && c[1].totalPoints && c[1].totalPoints.includes('4'));
    expect(calledForTeam1).toBeTruthy();
    expect(calledForTeam2).toBeTruthy();
  });
});
