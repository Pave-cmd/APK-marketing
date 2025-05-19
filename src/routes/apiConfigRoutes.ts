import express, { RequestHandler } from 'express';
import { getApiConfigs, updateApiConfig, testApiConfig } from '../controllers/apiConfigController';
import { auth } from '../middleware/authMiddleware';

const router = express.Router();

// Debug middleware
router.use((req, res, next) => {
  console.log('[API CONFIG ROUTES] Request received:', req.method, req.path);
  console.log('[API CONFIG ROUTES] Full URL:', req.originalUrl);
  next();
});

// All routes require authentication
router.use(auth as RequestHandler);

// API configuration routes
router.get('/', getApiConfigs as RequestHandler);
router.put('/:platform', updateApiConfig as RequestHandler);
router.post('/:platform/test', testApiConfig as RequestHandler);

export default router;