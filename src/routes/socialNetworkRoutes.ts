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
import { consentMiddleware } from '../middleware/consentMiddleware';

const router = express.Router();

// OAuth callback routes (no auth needed)
router.get('/callback/:platform', handleOAuthCallback as RequestHandler);

// All other routes require authentication
router.use(auth as RequestHandler);

// Social network routes
router.get('/', getSocialNetworks as RequestHandler);
router.post('/add', addSocialNetwork as RequestHandler);
router.delete('/remove/:networkId', removeSocialNetwork as RequestHandler);
// OAuth authentication vyžaduje consent
router.get('/authenticate/:networkId', consentMiddleware as unknown as RequestHandler, authenticateSocialNetwork as RequestHandler);
router.post('/publish/:networkId', publishToSocialNetwork as RequestHandler);

export default router;