import { Router } from 'express';
import { ContentGeneratorController } from '../controllers/contentGeneratorController';
import { requireAuth } from '../middleware/authMiddleware';
import Content from '../models/Content';

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

/**
 * @route GET /api/content/history
 * @desc Get history of generated content
 * @access Private
 */
router.get(
  '/history',
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.user?._id?.toString() || req.user?.id;
      console.log('[CONTENT-HISTORY] Getting history for user:', userId);
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }
      
      // Use imported Content model
      
      // Get content for this user, sorted by creation date (newest first)
      const content = await Content.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      
      console.log('[CONTENT-HISTORY] Found content count:', content.length);
      
      res.json({
        success: true,
        content: content
      });
    } catch (error) {
      console.error('[CONTENT-HISTORY] Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to load content history'
      });
    }
  }
);

export default router;