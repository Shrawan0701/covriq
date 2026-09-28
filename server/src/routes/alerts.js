import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createAlert, listUserAlerts, deleteAlert } from '../services/alertService.js';

const router = Router();

/**
 * GET /api/alerts
 * List user's active edge/line alerts.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const alerts = await listUserAlerts(req.user.id);
    return res.json({ alerts });
  } catch (error) {
    console.error('[Alerts Route] List error:', error);
    return res.status(500).json({ error: 'Failed to retrieve edge alerts.' });
  }
});

/**
 * POST /api/alerts
 * Create a new edge or line alert.
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const alert = await createAlert(req.user.id, req.body);
    return res.status(201).json({ alert, message: 'Edge alert configured successfully!' });
  } catch (error) {
    console.error('[Alerts Route] Create error:', error);
    return res.status(500).json({ error: 'Failed to create edge alert.' });
  }
});

/**
 * DELETE /api/alerts/:id
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await deleteAlert(req.user.id, req.params.id);
    return res.json({ message: 'Alert removed.' });
  } catch (error) {
    console.error('[Alerts Route] Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete alert.' });
  }
});

export default router;
