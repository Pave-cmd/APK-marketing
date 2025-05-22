import { Request, Response } from 'express';
import { SocialContentGeneratorService } from '../services/socialContentGeneratorService';
import { logger } from '../utils/logger';
import Content, { SocialContent } from '../models/Content';

export class ContentGeneratorController {
  private contentGenerator: SocialContentGeneratorService;

  constructor() {
    // Initialize with API keys from environment variables
    const apiKey = process.env.OPENAI_API_KEY || '';
    const apiEndpoint = process.env.AI_API_ENDPOINT || 'https://api.openai.com/v1/completions';
    
    if (!apiKey) {
      logger.error('Missing OPENAI_API_KEY environment variable');
    }
    
    this.contentGenerator = new SocialContentGeneratorService(apiKey, apiEndpoint);
  }

  /**
   * Generate social media content based on website URL
   * @param req Request
   * @param res Response
   */
  async generateSocialContent(req: Request, res: Response): Promise<void> {
    try {
      console.log('[CONTENT-CONTROLLER] generateSocialContent called');
      console.log('[CONTENT-CONTROLLER] Request body:', req.body);
      console.log('[CONTENT-CONTROLLER] User:', req.user);
      
      const { websiteUrl, platform, tone, contentType } = req.body;
      const userId = req.user?._id?.toString() || req.user?.id;
      
      console.log('[CONTENT-CONTROLLER] Extracted data:', { websiteUrl, platform, tone, contentType, userId });

      if (!websiteUrl || !platform || !tone || !contentType || !userId) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: websiteUrl, platform, tone, contentType'
        });
        return;
      }

      // Validate inputs
      const validPlatforms = ['facebook', 'twitter', 'instagram', 'linkedin'];
      const validTones = ['professional', 'casual', 'humorous', 'informative'];
      const validContentTypes = ['post', 'ad', 'story'];

      if (!validPlatforms.includes(platform)) {
        res.status(400).json({
          success: false,
          error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}`
        });
        return;
      }

      if (!validTones.includes(tone)) {
        res.status(400).json({
          success: false,
          error: `Invalid tone. Must be one of: ${validTones.join(', ')}`
        });
        return;
      }

      if (!validContentTypes.includes(contentType)) {
        res.status(400).json({
          success: false,
          error: `Invalid content type. Must be one of: ${validContentTypes.join(', ')}`
        });
        return;
      }

      // Generate content
      const content = await this.contentGenerator.generateContent(
        websiteUrl,
        platform as 'facebook' | 'twitter' | 'instagram' | 'linkedin',
        tone as 'professional' | 'casual' | 'humorous' | 'informative',
        contentType as 'post' | 'ad' | 'story',
        userId
      );

      // Store the generated content in the database
      const newContent = new Content({
        userId,
        websiteUrl: content.websiteUrl,
        title: `${platform} ${contentType} - ${new Date().toLocaleDateString()}`,
        description: `AI-generated ${tone} content for ${platform}`,
        textContent: content.text,
        status: 'draft',
        socialPlatforms: [{
          platform,
          status: 'pending'
        }],
        tags: content.hashtags,
        aiGeneratedDetails: {
          promptUsed: `${tone} ${contentType} for ${platform}`,
          modelVersion: 'v1',
          generationDate: new Date()
        }
      });

      await newContent.save();

      res.status(200).json({
        success: true,
        content: newContent
      });
    } catch (error) {
      logger.error(`Error in content generation: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({
        success: false,
        error: 'Failed to generate content'
      });
    }
  }

  /**
   * Generate multiple content variations
   * @param req Request
   * @param res Response
   */
  async generateContentVariations(req: Request, res: Response): Promise<void> {
    try {
      const { websiteUrl, platform, count } = req.body;
      const userId = req.user?._id?.toString() || req.user?.id;

      if (!websiteUrl || !platform || !userId) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: websiteUrl, platform'
        });
        return;
      }

      // Validate platform
      const validPlatforms = ['facebook', 'twitter', 'instagram', 'linkedin'];
      if (!validPlatforms.includes(platform)) {
        res.status(400).json({
          success: false,
          error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}`
        });
        return;
      }

      // Default to 3 variations if count is not provided or invalid
      const variationCount = (!count || isNaN(parseInt(count)) || parseInt(count) < 1) ? 3 : parseInt(count);
      
      // Generate variations
      const variations = await this.contentGenerator.generateContentVariations(
        websiteUrl,
        platform as 'facebook' | 'twitter' | 'instagram' | 'linkedin',
        variationCount,
        userId
      );

      // Save variations to database
      const savedVariations = await Promise.all(variations.map(async (variation) => {
        const newContent = new Content({
          userId,
          websiteUrl: variation.websiteUrl,
          title: `${variation.platform} ${variation.contentType} - ${new Date().toLocaleDateString()}`,
          description: `AI-generated ${variation.tone} content for ${variation.platform}`,
          textContent: variation.text,
          status: 'draft',
          socialPlatforms: [{
            platform: variation.platform,
            status: 'pending'
          }],
          tags: variation.hashtags,
          aiGeneratedDetails: {
            promptUsed: `${variation.tone} ${variation.contentType} for ${variation.platform}`,
            modelVersion: 'v1',
            generationDate: new Date()
          }
        });

        return await newContent.save();
      }));

      res.status(200).json({
        success: true,
        variations: savedVariations
      });
    } catch (error) {
      logger.error(`Error generating content variations: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({
        success: false,
        error: 'Failed to generate content variations'
      });
    }
  }
}