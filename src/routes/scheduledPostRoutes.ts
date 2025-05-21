import express, { RequestHandler } from 'express';
import { 
  createScheduledPost,
  getUserScheduledPosts,
  updateScheduledPost,
  deleteScheduledPost,
  cancelScheduledPost,
  publishScheduledPostNow,
  calculateBestTimeToPost
} from '../controllers/scheduledPostController';
import { auth } from '../middleware/authMiddleware';

const router = express.Router();

// Všechny cesty vyžadují autentizaci
router.use(auth as RequestHandler);

// Cesty pro naplánované příspěvky
router.post('/', createScheduledPost as unknown as RequestHandler);
router.get('/', getUserScheduledPosts as unknown as RequestHandler);
router.put('/:postId', updateScheduledPost as unknown as RequestHandler);
router.delete('/:postId', deleteScheduledPost as unknown as RequestHandler);
router.post('/:postId/cancel', cancelScheduledPost as unknown as RequestHandler);
router.post('/:postId/publish-now', publishScheduledPostNow as unknown as RequestHandler);
router.post('/best-time', calculateBestTimeToPost as unknown as RequestHandler);

export default router;