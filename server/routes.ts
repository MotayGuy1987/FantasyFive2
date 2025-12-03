// Updated server/routes.ts

import express from 'express';
import { calculatePerformanceScore } from './utils/performance';
import { aggregateTeamScores } from './utils/aggregation';

const router = express.Router();

// Endpoint to perform performance scoring
router.post('/performance', (req, res) => {
    const { players } = req.body;
    if (!players || players.length === 0) {
        return res.status(400).json({ error: 'No players provided' });
    }

    const scores = players.map(player => calculatePerformanceScore(player));
    res.json({ scores });
});

// Endpoint to aggregate team scores
router.post('/aggregate-scores', (req, res) => {
    const { teams } = req.body;
    if (!teams || teams.length === 0) {
        return res.status(400).json({ error: 'No teams provided' });
    }

    const aggregatedScores = aggregateTeamScores(teams);
    res.json({ aggregatedScores });
});

export default router;