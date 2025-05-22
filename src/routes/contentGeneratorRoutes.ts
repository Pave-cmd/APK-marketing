import { Router } from 'express';
import { ContentGeneratorController } from '../controllers/contentGeneratorController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();
const contentGeneratorController = new ContentGeneratorController();

/**
 * @route POST /api/content/generate
 * @desc Generate social media content for a website
 * @access Private
 */
router.post(
  '/generate',
  requireAuth,
  contentGeneratorController.generateSocialContent.bind(contentGeneratorController)
);

/**
 * @route POST /api/content/generate-variations
 * @desc Generate multiple content variations
 * @access Private
 */
router.post(
  '/generate-variations',
  requireAuth,
  contentGeneratorController.generateContentVariations.bind(contentGeneratorController)
);

export default router;