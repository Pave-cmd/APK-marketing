import express, { RequestHandler } from 'express';
import { startAnalysis, getAnalysisStatus, getUserAnalyses } from '../controllers/webAnalysisController';
import { auth } from '../middleware/authMiddleware';

const router = express.Router();

// Všechny routy vyžadují autentizaci
router.use((auth as unknown) as RequestHandler);

// Spustit analýzu webu
router.post('/start', (startAnalysis as unknown) as RequestHandler);

// Získat stav analýzy pro konkrétní web
router.get('/status/:websiteUrl', (getAnalysisStatus as unknown) as RequestHandler);

// Získat všechny analýzy uživatele
router.get('/list', (getUserAnalyses as unknown) as RequestHandler);

export default router;