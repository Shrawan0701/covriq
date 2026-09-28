import { Router } from 'express';
import { scanBoardForEdges } from '../services/edgeScannerService.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/edge-scanner
 * Returns scanned games & market opportunities with quantitative edge and EV calculations.
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      sport = 'mlb',
      league,
      minEdge = '0',
      marketType = 'all',
      state = 'all',
      sortBy = 'edge'
    } = req.query;

    const result = await scanBoardForEdges({
      sport,
      league: league || null,
      minEdge: parseFloat(minEdge) || 0,
      marketType,
      state,
      sortBy
    });

    return res.json(result);
  } catch (error) {
    console.error('[Edge Scanner Route] Scan error:', error);
    return res.status(500).json({
      error: 'Failed to scan sports board for edges.',
      details: error.message
    });
  }
});

export default router;
