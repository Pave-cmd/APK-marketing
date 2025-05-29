import { webLog } from '../utils/logger';
import ScheduledPost, { IScheduledPost } from '../models/ScheduledPost';
import User from '../models/User';
import { SocialApiService } from './socialApiService';
import { ContentGeneratorService } from './contentGeneratorService';
import { SocialPublisherService } from './socialPublisherService';
import mongoose from 'mongoose';

/**
 * Služba pro správu naplánovaných příspěvků na sociální sítě
 */
export class ScheduledPostService {
  private static instance: ScheduledPostService;
  private socialPublisherService: SocialPublisherService;
  private contentApiKey: string;

  private constructor(contentApiKey: string) {
    this.socialPublisherService = SocialPublisherService.getInstance();
    this.contentApiKey = contentApiKey;
  }

  /**
   * Získá instanci služby
   */
  public static getInstance(contentApiKey?: string): ScheduledPostService {
    if (!ScheduledPostService.instance) {
      if (!contentApiKey) {
        contentApiKey = process.env.OPENAI_API_KEY || '';
        if (!contentApiKey) {
          throw new Error('API klíč pro generování obsahu je vyžadován');
        }
      }
      ScheduledPostService.instance = new ScheduledPostService(contentApiKey);
    }
    return ScheduledPostService.instance;
  }

  /**
   * Vytvoří naplánovaný příspěvek
   */
  public async createScheduledPost(
    userId: string,
    postData: {
      socialNetworkId: string;
      websiteUrl: string;
      title: string;
      content: string;
      imageUrl?: string;
      platform: string;
      scheduledFor: Date;
      recurrence?: {
        pattern: 'daily' | 'weekly' | 'monthly';
        dayOfWeek?: number;
        dayOfMonth?: number;
        time: string;
        endDate?: Date;
      };
      metadata?: {
        hashtags?: string[];
        targetAudience?: string;
        campaignId?: string;
        useAi?: boolean;
        aiPrompt?: string;
      };
    }
  ): Promise<IScheduledPost> {
    try {
      webLog(`Vytváření naplánovaného příspěvku pro uživatele ${userId}`, {
        platform: postData.platform,
        scheduledFor: postData.scheduledFor
      });

      // Ověření existence sociální sítě
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('Uživatel nenalezen');
      }

      const network = user.socialNetworks.find(
        net => net._id.toString() === postData.socialNetworkId
      );

      if (!network) {
        throw new Error('Sociální síť nenalezena');
      }

      if (network.status !== 'active') {
        throw new Error(`Sociální síť není aktivní, současný stav: ${network.status}`);
      }

      // Vytvoření naplánovaného příspěvku
      const scheduledPost = new ScheduledPost({
        userId: new mongoose.Types.ObjectId(userId),
        socialNetworkId: new mongoose.Types.ObjectId(postData.socialNetworkId),
        websiteUrl: postData.websiteUrl,
        title: postData.title,
        content: postData.content,
        imageUrl: postData.imageUrl,
        platform: postData.platform,
        scheduledFor: postData.scheduledFor,
        status: 'pending',
        recurrence: postData.recurrence,
        metadata: postData.metadata
      });

      await scheduledPost.save();
      webLog(`Naplánovaný příspěvek vytvořen s ID: ${scheduledPost._id}`);

      return scheduledPost;
    } catch (error) {
      webLog('Chyba při vytváření naplánovaného příspěvku', { error });
      throw new Error(`Nepodařilo se vytvořit naplánovaný příspěvek: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }

  /**
   * Získá naplánované příspěvky uživatele
   */
  public async getUserScheduledPosts(
    userId: string,
    filters?: {
      status?: string;
      platform?: string;
      limit?: number;
      offset?: number;
      fromDate?: Date;
      toDate?: Date;
    }
  ): Promise<IScheduledPost[]> {
    try {
      const query: any = { userId: new mongoose.Types.ObjectId(userId) };

      if (filters?.status) {
        query.status = filters.status;
      }

      if (filters?.platform) {
        query.platform = filters.platform;
      }

      if (filters?.fromDate) {
        query.scheduledFor = { $gte: filters.fromDate };
      }

      if (filters?.toDate) {
        if (query.scheduledFor) {
          query.scheduledFor.$lte = filters.toDate;
        } else {
          query.scheduledFor = { $lte: filters.toDate };
        }
      }

      const posts = await ScheduledPost.find(query)
        .sort({ scheduledFor: 1 })
        .limit(filters?.limit || 50)
        .skip(filters?.offset || 0);

      return posts;
    } catch (error) {
      webLog('Chyba při získávání naplánovaných příspěvků', { error });
      throw new Error(`Nepodařilo se získat naplánované příspěvky: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }

  /**
   * Aktualizuje naplánovaný příspěvek
   */
  public async updateScheduledPost(
    postId: string,
    userId: string,
    updates: Partial<IScheduledPost>
  ): Promise<IScheduledPost | null> {
    try {
      const post = await ScheduledPost.findOneAndUpdate(
        {
          _id: postId,
          userId: new mongoose.Types.ObjectId(userId),
          status: { $ne: 'published' } // Nemůžeme aktualizovat již publikované příspěvky
        },
        updates,
        { new: true }
      );

      if (post) {
        webLog(`Naplánovaný příspěvek ${postId} aktualizován`);
      }

      return post;
    } catch (error) {
      webLog('Chyba při aktualizaci naplánovaného příspěvku', { error });
      throw new Error(`Nepodařilo se aktualizovat naplánovaný příspěvek: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }

  /**
   * Smaže naplánovaný příspěvek
   */
  public async deleteScheduledPost(
    postId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const result = await ScheduledPost.deleteOne({
        _id: postId,
        userId: new mongoose.Types.ObjectId(userId),
        status: { $ne: 'published' } // Nemůžeme smazat již publikované příspěvky
      });

      const deleted = result.deletedCount > 0;

      if (deleted) {
        webLog(`Naplánovaný příspěvek ${postId} smazán`);
      }

      return deleted;
    } catch (error) {
      webLog('Chyba při mazání naplánovaného příspěvku', { error });
      throw new Error(`Nepodařilo se smazat naplánovaný příspěvek: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }

  /**
   * Zruší naplánovaný příspěvek (změní jeho stav na zrušený)
   */
  public async cancelScheduledPost(
    postId: string,
    userId: string
  ): Promise<IScheduledPost | null> {
    try {
      const post = await ScheduledPost.findOneAndUpdate(
        {
          _id: postId,
          userId: new mongoose.Types.ObjectId(userId),
          status: 'pending' // Můžeme zrušit pouze čekající příspěvky
        },
        { status: 'cancelled' },
        { new: true }
      );

      if (post) {
        webLog(`Naplánovaný příspěvek ${postId} zrušen`);
      }

      return post;
    } catch (error) {
      webLog('Chyba při rušení naplánovaného příspěvku', { error });
      throw new Error(`Nepodařilo se zrušit naplánovaný příspěvek: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }

  /**
   * Publikuje naplánovaný příspěvek
   */
  public async publishScheduledPost(
    postId: string
  ): Promise<IScheduledPost | null> {
    try {
      const post = await ScheduledPost.findById(postId);
      
      if (!post) {
        throw new Error('Naplánovaný příspěvek nenalezen');
      }

      // Ověření existence sociální sítě a uživatele
      const user = await User.findById(post.userId);
      if (!user) {
        throw new Error('Uživatel nenalezen');
      }

      const network = user.socialNetworks.find(
        (net: any) => net._id.toString() === post.socialNetworkId.toString()
      );

      if (!network) {
        throw new Error('Sociální síť nenalezena');
      }

      if (network.status !== 'active') {
        throw new Error(`Sociální síť není aktivní, současný stav: ${network.status}`);
      }

      // Zpracování obsahu, použití AI pokud je požadováno
      let finalContent = post.content;
      if (post.metadata?.useAi && post.metadata.aiPrompt) {
        try {
          const contentGenerator = ContentGeneratorService.getInstance(this.contentApiKey);
          
          // Vygenerování obsahu na základě promptu
          const systemMessage = `You are a professional social media content writer that creates engaging posts specifically for ${post.platform}. Use appropriate tone and style for this platform.`;
          
          webLog(`Generování AI obsahu pro příspěvek ${postId}`, {
            platform: post.platform,
            aiPrompt: post.metadata.aiPrompt
          });
          
          // Získáme informace o webu pro kontext
          const websiteTitle = post.title || '';
          const websiteDescription = post.content || '';
          const websiteUrl = post.websiteUrl || '';
          
          // Volání ContentGeneratorService pro generování finálního příspěvku
          if (post.platform === 'facebook' || post.platform === 'twitter' || post.platform === 'linkedin') {
            finalContent = await contentGenerator.generateSocialPost(
              websiteTitle,
              websiteDescription,
              post.platform as any,
              websiteUrl
            );
            
            webLog(`AI obsah vygenerován pro ${post.platform}`, { 
              postId,
              contentLength: finalContent.length
            });
          } else {
            // Pro jiné platformy použijeme obecný OpenAI call
            finalContent = await contentGenerator.callOpenAI(systemMessage, post.metadata.aiPrompt);
          }
        } catch (error) {
          webLog('Chyba při generování AI obsahu', { error, postId });
          // Pokračujeme s původním obsahem
        }
      }

      // Publikace na sociální síť
      let publishResult: any;
      try {
        switch (post.platform) {
          case 'facebook':
            publishResult = await SocialApiService.publishFacebookPost(
              network.pageId || '',
              finalContent,
              post.imageUrl
            );
            break;
          case 'twitter':
            publishResult = await SocialApiService.publishTwitterPost(
              post.userId.toString(),
              finalContent,
              post.imageUrl
            );
            break;
          case 'linkedin':
            publishResult = await SocialApiService.publishLinkedInPost(
              post.userId.toString(),
              finalContent,
              post.imageUrl,
              post.websiteUrl
            );
            break;
          default:
            throw new Error(`Publikace na platformu ${post.platform} není podporována`);
        }

        // Aktualizace stavu příspěvku
        post.status = 'published';
        post.publishedAt = new Date();
        await post.save();

        // Aktualizace času poslední publikace na síti
        network.lastPostAt = new Date();
        await user.save();

        webLog(`Příspěvek ${postId} úspěšně publikován na ${post.platform}`, {
          result: publishResult
        });

        // Pokud má příspěvek nastavené opakování, vytvoříme další naplánovaný příspěvek
        if (post.recurrence) {
          await this.scheduleNextRecurringPost(post as IScheduledPost);
        }

        return post;
      } catch (error) {
        // Zaznamenání neúspěšného pokusu
        post.failedAttempts = (post.failedAttempts || 0) + 1;
        post.lastError = error instanceof Error ? error.message : 'Neznámá chyba';
        
        // Pokud jsme dosáhli maximálního počtu pokusů, označíme jako neúspěšný
        if (post.failedAttempts >= 3) {
          post.status = 'failed';
        }
        
        await post.save();
        
        webLog('Chyba při publikaci naplánovaného příspěvku', { 
          error, 
          postId,
          attempts: post.failedAttempts
        });
        
        throw new Error(`Publikace příspěvku selhala: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
      }
    } catch (error) {
      webLog('Chyba při publikaci naplánovaného příspěvku', { error });
      throw new Error(`Nepodařilo se publikovat naplánovaný příspěvek: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }

  /**
   * Naplánuje další opakující se příspěvek
   */
  private async scheduleNextRecurringPost(currentPost: IScheduledPost): Promise<IScheduledPost | null> {
    if (!currentPost.recurrence) {
      return null;
    }

    const recurrence = currentPost.recurrence;
    
    // Kontrola, zda jsme nepřekročili koncové datum
    if (recurrence.endDate && new Date() > recurrence.endDate) {
      webLog(`Opakující se příspěvek ${currentPost._id} již překročil koncové datum, další nebude naplánován`);
      return null;
    }

    // Výpočet dalšího data publikace
    const nextDate = this.calculateNextScheduleDate(
      currentPost.scheduledFor,
      recurrence.pattern,
      recurrence.time,
      recurrence.dayOfWeek,
      recurrence.dayOfMonth
    );

    // Kontrola, zda další datum není po koncovém datu
    if (recurrence.endDate && nextDate > recurrence.endDate) {
      webLog(`Další datum pro opakující se příspěvek ${currentPost._id} je po koncovém datu, nebude naplánován`);
      return null;
    }

    // Vytvoření nového naplánovaného příspěvku
    try {
      const newPost = new ScheduledPost({
        userId: currentPost.userId,
        socialNetworkId: currentPost.socialNetworkId,
        contentId: currentPost.contentId,
        websiteUrl: currentPost.websiteUrl,
        title: currentPost.title,
        content: currentPost.content,
        imageUrl: currentPost.imageUrl,
        platform: currentPost.platform,
        scheduledFor: nextDate,
        status: 'pending',
        recurrence: currentPost.recurrence,
        metadata: currentPost.metadata
      });

      await newPost.save();
      webLog(`Vytvořen další opakující se příspěvek s ID: ${newPost._id} na ${nextDate.toISOString()}`);
      
      return newPost;
    } catch (error) {
      webLog('Chyba při vytváření dalšího opakujícího se příspěvku', { error });
      return null;
    }
  }

  /**
   * Vypočítá další datum pro naplánování příspěvku
   */
  private calculateNextScheduleDate(
    currentDate: Date,
    pattern: string,
    time: string,
    dayOfWeek?: number,
    dayOfMonth?: number
  ): Date {
    const nextDate = new Date(currentDate);
    const [hours, minutes] = time.split(':').map(Number);
    
    // Nastavíme správný čas
    nextDate.setHours(hours);
    nextDate.setMinutes(minutes);
    nextDate.setSeconds(0);
    nextDate.setMilliseconds(0);
    
    switch (pattern) {
      case 'daily':
        // Přidáme jeden den
        nextDate.setDate(nextDate.getDate() + 1);
        break;
        
      case 'weekly':
        // Přidáme jeden týden
        nextDate.setDate(nextDate.getDate() + 7);
        
        // Pokud je specifikován den v týdnu, nastavíme ho
        if (dayOfWeek !== undefined) {
          const currentDayOfWeek = nextDate.getDay();
          const daysToAdd = (7 + dayOfWeek - currentDayOfWeek) % 7;
          nextDate.setDate(nextDate.getDate() + daysToAdd);
        }
        break;
        
      case 'monthly':
        // Přidáme jeden měsíc
        nextDate.setMonth(nextDate.getMonth() + 1);
        
        // Pokud je specifikován den v měsíci, nastavíme ho
        if (dayOfMonth !== undefined) {
          nextDate.setDate(Math.min(dayOfMonth, this.getDaysInMonth(nextDate.getFullYear(), nextDate.getMonth())));
        }
        break;
    }
    
    return nextDate;
  }

  /**
   * Vrátí počet dní v měsíci
   */
  private getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  /**
   * Zpracuje naplánované příspěvky, které jsou připraveny k publikaci
   */
  public async processScheduledPosts(): Promise<void> {
    try {
      const now = new Date();
      now.setSeconds(0, 0); // Zaokrouhlíme na minuty
      
      // Najdeme všechny příspěvky, které by měly být publikovány
      const posts = await ScheduledPost.find({
        status: 'pending',
        scheduledFor: { $lte: now }
      });
      
      webLog(`Nalezeno ${posts.length} naplánovaných příspěvků k publikaci`);
      
      for (const post of posts) {
        try {
          await this.publishScheduledPost(String(post._id));
        } catch (error) {
          webLog(`Chyba při publikaci naplánovaného příspěvku ${post._id}`, { error });
          // Chyby už jsou zaznamenány v publishScheduledPost
        }
      }
    } catch (error) {
      webLog('Chyba při zpracování naplánovaných příspěvků', { error });
    }
  }

  /**
   * Vrátí statistiky naplánovaných příspěvků uživatele
   */
  public async getScheduledPostStats(userId: string): Promise<{
    total: number;
    pending: number;
    published: number;
    failed: number;
    cancelled: number;
    upcoming24h: number;
    upcoming7d: number;
  }> {
    try {
      const userIdObj = new mongoose.Types.ObjectId(userId);
      const now = new Date();
      const next24h = new Date(now);
      next24h.setHours(now.getHours() + 24);
      
      const next7d = new Date(now);
      next7d.setDate(now.getDate() + 7);
      
      const [
        total,
        pending,
        published,
        failed,
        cancelled,
        upcoming24h,
        upcoming7d
      ] = await Promise.all([
        ScheduledPost.countDocuments({ userId: userIdObj }),
        ScheduledPost.countDocuments({ userId: userIdObj, status: 'pending' }),
        ScheduledPost.countDocuments({ userId: userIdObj, status: 'published' }),
        ScheduledPost.countDocuments({ userId: userIdObj, status: 'failed' }),
        ScheduledPost.countDocuments({ userId: userIdObj, status: 'cancelled' }),
        ScheduledPost.countDocuments({ 
          userId: userIdObj, 
          status: 'pending',
          scheduledFor: { $gte: now, $lte: next24h }
        }),
        ScheduledPost.countDocuments({ 
          userId: userIdObj, 
          status: 'pending',
          scheduledFor: { $gte: now, $lte: next7d }
        })
      ]);
      
      return {
        total,
        pending,
        published,
        failed,
        cancelled,
        upcoming24h,
        upcoming7d
      };
    } catch (error) {
      webLog('Chyba při získávání statistik naplánovaných příspěvků', { error });
      throw new Error(`Nepodařilo se získat statistiky naplánovaných příspěvků: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }

  /**
   * Vypočítá optimální čas pro publikaci příspěvku na základě preferencí uživatele
   */
  public calculateBestTimeToPost(
    platform: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _timezone: string = 'Europe/Prague'
  ): Date {
    // Optimální časy publikace podle platformy
    const bestTimes: Record<string, { hour: number, minute: number }[]> = {
      'facebook': [
        { hour: 9, minute: 0 },
        { hour: 13, minute: 0 },
        { hour: 15, minute: 0 },
        { hour: 19, minute: 0 }
      ],
      'instagram': [
        { hour: 11, minute: 0 },
        { hour: 13, minute: 0 },
        { hour: 19, minute: 0 },
        { hour: 21, minute: 0 }
      ],
      'twitter': [
        { hour: 8, minute: 0 },
        { hour: 12, minute: 0 },
        { hour: 17, minute: 0 },
        { hour: 20, minute: 0 }
      ],
      'linkedin': [
        { hour: 8, minute: 0 },
        { hour: 10, minute: 30 },
        { hour: 12, minute: 0 },
        { hour: 17, minute: 30 }
      ]
    };
    
    // Výběr optimálního času
    const platformTimes = bestTimes[platform] || bestTimes['facebook'];
    const randomIndex = Math.floor(Math.random() * platformTimes.length);
    const bestTime = platformTimes[randomIndex];
    
    // Vytvoření data a času
    const now = new Date();
    const result = new Date(now);
    
    // Nastavení času pro dnešek
    result.setHours(bestTime.hour, bestTime.minute, 0, 0);
    
    // Pokud je čas v minulosti, nastavíme na zítřek
    if (result <= now) {
      result.setDate(result.getDate() + 1);
    }
    
    return result;
  }
}