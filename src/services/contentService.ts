import { logger } from '../utils/logger';
import Content, { IContent } from '../models/Content';
import WebAnalysis from '../models/WebAnalysis';
import { SocialPublisherService } from './socialPublisherService';
import mongoose from 'mongoose';

export class ContentService {
  private static instance: ContentService;
  private publisherService: SocialPublisherService;

  private constructor() {
    this.publisherService = SocialPublisherService.getInstance();
  }

  public static getInstance(): ContentService {
    if (!ContentService.instance) {
      ContentService.instance = new ContentService();
    }
    return ContentService.instance;
  }

  /**
   * Vytvoří nový příspěvek
   */
  public async createContent(
    userId: string,
    contentData: {
      websiteUrl: string;
      title: string;
      description: string;
      textContent: string;
      imageUrl?: string;
      platforms: string[];
      scheduledFor?: Date;
      tags?: string[];
    }
  ): Promise<IContent> {
    try {
      logger.info(`Vytváření nového příspěvku pro web: ${contentData.websiteUrl}`);

      const content = new Content({
        userId: new mongoose.Types.ObjectId(userId),
        websiteUrl: contentData.websiteUrl,
        title: contentData.title,
        description: contentData.description,
        textContent: contentData.textContent,
        imageUrl: contentData.imageUrl,
        status: contentData.scheduledFor ? 'scheduled' : 'draft',
        scheduledFor: contentData.scheduledFor,
        tags: contentData.tags || [],
        socialPlatforms: contentData.platforms.map(platform => ({
          platform,
          status: 'pending'
        }))
      });

      await content.save();
      logger.info(`Příspěvek vytvořen s ID: ${content._id}`);
      
      return content;
    } catch (error) {
      logger.error('Chyba při vytváření příspěvku:', error);
      throw new Error(`Nepodařilo se vytvořit příspěvek: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }

  /**
   * Získá příspěvky uživatele
   */
  public async getUserContent(
    userId: string,
    filters?: {
      status?: string;
      platform?: string;
      websiteUrl?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<IContent[]> {
    try {
      const query: any = { userId: new mongoose.Types.ObjectId(userId) };

      if (filters?.status) {
        query.status = filters.status;
      }

      if (filters?.platform) {
        query['socialPlatforms.platform'] = filters.platform;
      }

      if (filters?.websiteUrl) {
        query.websiteUrl = filters.websiteUrl;
      }

      const contents = await Content.find(query)
        .sort({ createdAt: -1 })
        .limit(filters?.limit || 50)
        .skip(filters?.offset || 0);

      return contents;
    } catch (error) {
      logger.error('Chyba při získávání příspěvků:', error);
      throw new Error(`Nepodařilo se získat příspěvky: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }

  /**
   * Aktualizuje příspěvek
   */
  public async updateContent(
    contentId: string,
    userId: string,
    updates: Partial<IContent>
  ): Promise<IContent | null> {
    try {
      const content = await Content.findOneAndUpdate(
        { 
          _id: contentId, 
          userId: new mongoose.Types.ObjectId(userId) 
        },
        updates,
        { new: true }
      );

      if (content) {
        logger.info(`Příspěvek ${contentId} aktualizován`);
      }

      return content;
    } catch (error) {
      logger.error('Chyba při aktualizaci příspěvku:', error);
      throw new Error(`Nepodařilo se aktualizovat příspěvek: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }

  /**
   * Smaže příspěvek
   */
  public async deleteContent(
    contentId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const result = await Content.deleteOne({
        _id: contentId,
        userId: new mongoose.Types.ObjectId(userId)
      });

      const deleted = result.deletedCount > 0;
      
      if (deleted) {
        logger.info(`Příspěvek ${contentId} smazán`);
      }

      return deleted;
    } catch (error) {
      logger.error('Chyba při mazání příspěvku:', error);
      throw new Error(`Nepodařilo se smazat příspěvek: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }

  /**
   * Publikuje příspěvek okamžitě
   */
  public async publishContent(
    contentId: string,
    userId: string
  ): Promise<IContent | null> {
    try {
      const content = await Content.findOne({
        _id: contentId,
        userId: new mongoose.Types.ObjectId(userId)
      });

      if (!content) {
        throw new Error('Příspěvek nenalezen');
      }

      // Simulace publikace na sociální sítě
      // V reálné implementaci by zde byla volání API sociálních sítí
      
      content.status = 'published';
      content.publishedAt = new Date();
      
      // Aktualizace stavu pro každou platformu
      content.socialPlatforms.forEach(platform => {
        platform.publishedAt = new Date();
        platform.status = 'published';
      });

      await content.save();

      logger.info(`Příspěvek ${contentId} úspěšně publikován`);
      return content;
    } catch (error) {
      logger.error('Chyba při publikaci příspěvku:', error);
      throw new Error(`Nepodařilo se publikovat příspěvek: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }

  /**
   * Zpracuje naplánované příspěvky
   */
  public async processScheduledContent(): Promise<void> {
    try {
      const now = new Date();
      
      const scheduledContents = await Content.find({
        status: 'scheduled',
        scheduledFor: { $lte: now }
      });

      logger.info(`Nalezeno ${scheduledContents.length} naplánovaných příspěvků k publikaci`);

      for (const content of scheduledContents) {
        try {
          await this.publishContent(
            (content as any)._id.toString(),
            content.userId.toString()
          );
        } catch (error) {
          logger.error(`Chyba při publikaci naplánovaného příspěvku ${content._id}:`, error);
          content.status = 'failed';
          await content.save();
        }
      }
    } catch (error) {
      logger.error('Chyba při zpracování naplánovaných příspěvků:', error);
    }
  }

  /**
   * Získá statistiky příspěvků
   */
  public async getContentStats(userId: string): Promise<{
    total: number;
    published: number;
    scheduled: number;
    draft: number;
    failed: number;
  }> {
    try {
      const userIdObj = new mongoose.Types.ObjectId(userId);

      const [total, published, scheduled, draft, failed] = await Promise.all([
        Content.countDocuments({ userId: userIdObj }),
        Content.countDocuments({ userId: userIdObj, status: 'published' }),
        Content.countDocuments({ userId: userIdObj, status: 'scheduled' }),
        Content.countDocuments({ userId: userIdObj, status: 'draft' }),
        Content.countDocuments({ userId: userIdObj, status: 'failed' })
      ]);

      return { total, published, scheduled, draft, failed };
    } catch (error) {
      logger.error('Chyba při získávání statistik příspěvků:', error);
      throw new Error(`Nepodařilo se získat statistiky: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }

  /**
   * Vytvoří příspěvek z analýzy webu
   */
  public async createContentFromAnalysis(
    analysisId: string
  ): Promise<IContent> {
    try {
      const analysis = await WebAnalysis.findById(analysisId);
      
      if (!analysis) {
        throw new Error('Analýza nenalezena');
      }

      // Vytvoříme příspěvek z vygenerovaného obsahu
      const platforms: string[] = [];
      const content: any = {
        websiteUrl: analysis.websiteUrl,
        title: analysis.scannedContent?.title || 'Nový příspěvek',
        description: analysis.scannedContent?.description || '',
        tags: analysis.scannedContent?.keywords || []
      };

      // Použijeme obsah podle dostupných platforem
      if (analysis.generatedContent?.facebook) {
        platforms.push('facebook');
        content.textContent = analysis.generatedContent.facebook.text;
        content.imageUrl = analysis.generatedContent.facebook.image;
      } else if (analysis.generatedContent?.twitter) {
        platforms.push('twitter');
        content.textContent = analysis.generatedContent.twitter.text;
        content.imageUrl = analysis.generatedContent.twitter.image;
      } else if (analysis.generatedContent?.linkedin) {
        platforms.push('linkedin');
        content.textContent = analysis.generatedContent.linkedin.text;
        content.imageUrl = analysis.generatedContent.linkedin.image;
      }

      const newContent = await this.createContent(
        analysis.userId.toString(),
        {
          ...content,
          platforms,
          tags: content.tags
        }
      );

      return newContent;
    } catch (error) {
      logger.error('Chyba při vytváření příspěvku z analýzy:', error);
      throw new Error(`Nepodařilo se vytvořit příspěvek z analýzy: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }
}