import express, { RequestHandler } from 'express';
import { addWebsite, getWebsites, removeWebsite } from '../controllers/websiteController';
import { auth } from '../middleware/authMiddleware';

const router = express.Router();

// Všechny routy vyžadují autentizaci
router.use(auth);

// Routy pro správu webových stránek
router.post('/add', (addWebsite as unknown) as RequestHandler);
router.get('/list', (getWebsites as unknown) as RequestHandler);
router.delete('/remove', (removeWebsite as unknown) as RequestHandler);

export default router;