import express, { RequestHandler } from 'express';
import { 
  addSocialNetwork, 
  removeSocialNetwork, 
  getSocialNetworks, 
  authenticateSocialNetwork,
  handleOAuthCallback,
  publishToSocialNetwork
} from '../controllers/socialNetworkController';
import { auth } from '../middleware/authMiddleware';

const router = express.Router();

// OAuth callback routes (no auth needed)
router.get('/callback/:platform', handleOAuthCallback as RequestHandler);

// All other routes require authentication
router.use(auth as RequestHandler);

// Social network routes
router.get('/', getSocialNetworks as RequestHandler);
router.post('/add', addSocialNetwork as RequestHandler);
router.delete('/remove/:networkId', removeSocialNetwork as RequestHandler);
router.get('/authenticate/:networkId', authenticateSocialNetwork as RequestHandler);
router.post('/publish/:networkId', publishToSocialNetwork as RequestHandler);

export default router;