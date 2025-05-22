import { logger } from '../utils/logger';
import WebAnalysis, { IWebAnalysis } from '../models/WebAnalysis';
import User from '../models/User';
import { WebsiteScraperService } from './websiteScraperService';
import { AdvancedWebsiteScraperService } from './advancedWebsiteScraperService';
import { ContentGeneratorService } from './contentGeneratorService';
import { SocialPublisherService } from './socialPublisherService';
import mongoose from 'mongoose';

export class WebAnalysisService {
  private scraperService: WebsiteScraperService;
  private advancedScraperService: AdvancedWebsiteScraperService | null;
  private generatorService: ContentGeneratorService;
  private publisherService: SocialPublisherService;

  constructor() {
    // Předpokládáme, že instančně již existují
    this.scraperService = new WebsiteScraperService();
    this.advancedScraperService = null; // Disabled due to issues
    
    // Pro generování obsahu potřebujeme API klíč
    const apiKey = process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      logger.warn('OpenAI API klíč není nastaven, generování obsahu bude omezeno');
    }
    this.generatorService = ContentGeneratorService.getInstance(apiKey);
    
    // Publisher služba
    this.publisherService = SocialPublisherService.getInstance();
  }

  /**
   * Vytváří novou analýzu
   */
  public async createAnalysis(userId: string, websiteUrl: string): Promise<IWebAnalysis> {
    try {
      // 0. Vytvoření záznamu
      const analysis = new WebAnalysis({
        userId: new mongoose.Types.ObjectId(userId),
        websiteUrl,
        status: 'pending',
        createdAt: new Date(),
        lastScan: new Date()
      });
      await analysis.save();
      
      // Spuštění analýzy
      this.runAnalysis(analysis).catch(error => {
        logger.error(`Chyba při analýze webu ${websiteUrl}:`, error);
      });
      
      return analysis;
    } catch (error) {
      logger.error(`Chyba při vytváření analýzy:`, error);
      throw new Error('Nepodařilo se vytvořit analýzu');
    }
  }

  /**
   * Spustí analýzu pro konkrétní web
   */
  private async runAnalysis(analysis: IWebAnalysis): Promise<void> {
    const websiteUrl = analysis.websiteUrl;
    
    try {
      // 1. Skenování webu
      analysis.status = 'scanning';
      await analysis.save();

      // Základní scraper pro statické weby
      let scrapedContent;
      try {
        scrapedContent = await this.scraperService.scrapeWebsite(websiteUrl);
        logger.info(`Použit základní scraper pro: ${websiteUrl}`);
      } catch (error) {
        logger.error(`Základní scraper selhal pro: ${websiteUrl}`, error);
        throw new Error(`Nepodařilo se stáhnout obsah webu: ${error instanceof Error ? error.message : String(error)}`);
      }

      // 2. Uložení výsledků
      analysis.scannedContent = {
        title: scrapedContent.title || websiteUrl,
        description: scrapedContent.description || '',
        mainText: scrapedContent.content || '',
        keywords: scrapedContent.keywords || [],
        images: scrapedContent.images || []
      };
      analysis.lastScan = new Date();
      await analysis.save();

      // 3. AI generování
      analysis.status = 'generating';
      await analysis.save();

      try {
        // Nastavíme timeout pro případné zaseknutí generování (5 minut)
        const generationTimeout = setTimeout(async () => {
          logger.warn(`Timeout při generování obsahu pro ${websiteUrl} - dokončuji analýzu`);          
          try {
            // Nastavíme základní výchozí obsah
            analysis.generatedContent = {
              facebook: {
                text: `Podívejte se na ${websiteUrl}!`,
                image: scrapedContent.images && scrapedContent.images.length > 0 ? scrapedContent.images[0] : undefined
              },
              twitter: {
                text: `Zajímavý obsah na ${websiteUrl}`,
                image: scrapedContent.images && scrapedContent.images.length > 0 ? scrapedContent.images[0] : undefined
              },
              linkedin: {
                text: `Doporučujeme obsah na ${websiteUrl}`,
                image: scrapedContent.images && scrapedContent.images.length > 0 ? scrapedContent.images[0] : undefined
              }
            };
            
            // Dokončíme analýzu
            analysis.status = 'completed';
            analysis.updatedAt = new Date();
            await analysis.save();
            logger.info(`Analýza webu ${websiteUrl} dokončena po timeoutu generování`);  
          } catch (timeoutError) {
            logger.error(`Chyba při dokončování analýzy po timeoutu pro ${websiteUrl}:`, timeoutError);
          }
        }, 300000); // 5 minut  
        
        // Generování obsahu pro Facebook
        const facebookContent = await this.generatorService.generateSocialPost(
          scrapedContent.title,
          scrapedContent.description,
          'facebook'
        );
        
        // Generování obsahu pro Twitter
        const twitterContent = await this.generatorService.generateSocialPost(
          scrapedContent.title,
          scrapedContent.description,
          'twitter'
        );
        
        // Generování obsahu pro LinkedIn
        const linkedinContent = await this.generatorService.generateSocialPost(
          scrapedContent.title,
          scrapedContent.description,
          'linkedin'
        );
        
        // Zrušíme timeout, protože generování proběhlo úspěšně
        clearTimeout(generationTimeout);
        
        // Uložení vygenerovaného obsahu
        analysis.generatedContent = {
          facebook: {
            text: facebookContent || `Podívejte se na ${websiteUrl}!`,
            image: scrapedContent.images && scrapedContent.images.length > 0 ? scrapedContent.images[0] : undefined
          },
          twitter: {
            text: twitterContent || `Zajímavý obsah na ${websiteUrl}`,
            image: scrapedContent.images && scrapedContent.images.length > 0 ? scrapedContent.images[0] : undefined
          },
          linkedin: {
            text: linkedinContent || `Doporučujeme obsah na ${websiteUrl}`,
            image: scrapedContent.images && scrapedContent.images.length > 0 ? scrapedContent.images[0] : undefined
          }
        };
        
        await analysis.save();
      } catch (error) {
        logger.error(`Chyba při generování obsahu pro ${websiteUrl}:`, error);
        // Pokračujeme i přes chybu v generování obsahu
        
        // Nastavíme základní výchozí obsah abychom mohli dokončit analýzu
        try {
          analysis.generatedContent = {
            facebook: {
              text: `Podívejte se na ${websiteUrl}!`,
              image: scrapedContent.images && scrapedContent.images.length > 0 ? scrapedContent.images[0] : undefined
            },
            twitter: {
              text: `Zajímavý obsah na ${websiteUrl}`,
              image: scrapedContent.images && scrapedContent.images.length > 0 ? scrapedContent.images[0] : undefined
            },
            linkedin: {
              text: `Doporučujeme obsah na ${websiteUrl}`,
              image: scrapedContent.images && scrapedContent.images.length > 0 ? scrapedContent.images[0] : undefined
            }
          };
          await analysis.save();
        } catch (fallbackError) {
          logger.error(`Chyba při ukládání náhradního obsahu pro ${websiteUrl}:`, fallbackError);
        }
      }

      // 4. Dokončení
      analysis.status = 'completed';
      analysis.updatedAt = new Date();
      await analysis.save();
      
      logger.info(`Analýza webu ${websiteUrl} úspěšně dokončena`);
    } catch (error) {
      logger.error(`Chyba při analýze webu ${websiteUrl}:`, error);
      analysis.status = 'failed';
      analysis.error = error instanceof Error ? error.message : 'Neznámá chyba';
      await analysis.save();
    }
  }

  /**
   * Iniciuje novou analýzu pro web (určeno pro API)
   */
  public async analyzeWebsite(userId: string, websiteUrl: string): Promise<IWebAnalysis> {
    try {
      // Nejprve zkontrolujeme, zda již neběží analýza pro tento web
      const existingAnalysis = await WebAnalysis.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        websiteUrl,
        status: { $in: ['pending', 'scanning', 'extracting', 'generating', 'publishing'] }
      });
      
      if (existingAnalysis) {
        logger.info(`Pro web ${websiteUrl} již běží analýza, vracím existující`);
        return existingAnalysis;
      }
      
      // Vytvoříme novou analýzu
      return await this.createAnalysis(userId, websiteUrl);
    } catch (error) {
      logger.error(`Chyba při spouštění analýzy webu:`, error);
      throw new Error(`Nepodařilo se spustit analýzu: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Získá stav analýzy pro web
   */
  public async getAnalysisStatus(userId: string, websiteUrl: string): Promise<IWebAnalysis | null> {
    try {
      // Nejprve hledáme aktuálně běžící analýzu
      let analysis = await WebAnalysis.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        websiteUrl,
        status: { $in: ['pending', 'scanning', 'extracting', 'generating', 'publishing'] }
      });
      
      if (analysis) {
        logger.info(`Nalezena běžící analýza pro ${websiteUrl}`);
        return analysis;
      }
      
      // Pokud neběží žádná analýza, najdeme nejnovější dokončenou
      analysis = await WebAnalysis.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        websiteUrl
      }).sort({ createdAt: -1 });
      
      return analysis;
    } catch (error) {
      logger.error(`Chyba při získávání stavu analýzy:`, error);
      throw new Error('Nepodařilo se získat stav analýzy');
    }
  }

  /**
   * Získá analýzu podle ID
   */
  public async getAnalysisById(analysisId: string, userId: string): Promise<IWebAnalysis | null> {
    try {
      return await WebAnalysis.findOne({
        _id: analysisId,
        userId: new mongoose.Types.ObjectId(userId)
      });
    } catch (error) {
      logger.error(`Chyba při získávání analýzy:`, error);
      throw new Error('Nepodařilo se získat analýzu');
    }
  }

  /**
   * Získá analýzy pro konkrétní web
   */
  public async getAnalysesForWebsite(websiteUrl: string, userId: string): Promise<IWebAnalysis[]> {
    try {
      return await WebAnalysis.find({
        websiteUrl,
        userId: new mongoose.Types.ObjectId(userId)
      }).sort({ createdAt: -1 });
    } catch (error) {
      logger.error(`Chyba při získávání analýz pro web:`, error);
      throw new Error('Nepodařilo se získat analýzy');
    }
  }

  /**
   * Získá všechny analýzy uživatele
   */
  public async getUserAnalyses(userId: string): Promise<IWebAnalysis[]> {
    try {
      return await WebAnalysis.find({
        userId: new mongoose.Types.ObjectId(userId)
      }).sort({ createdAt: -1 });
    } catch (error) {
      logger.error(`Chyba při získávání analýz uživatele:`, error);
      throw new Error('Nepodařilo se získat analýzy');
    }
  }

  /**
   * Spustí naplánované analýzy pro všechny registrované weby
   */
  public async runScheduledAnalyses(): Promise<void> {
    try {
      // Najdeme všechny uživatele s webovými stránkami
      const users = await User.find({ 'websites.0': { $exists: true } });
      logger.info(`Nalezeno ${users.length} uživatelů s webovými stránkami`);

      const analysisPromises = [];

      for (const user of users) {
        // Pro každý web uživatele vytvoříme analýzu
        for (const website of user.websites) {
          // Kontrola, kdy byla naposledy provedena analýza
          const lastAnalysis = await WebAnalysis.findOne({
            userId: user._id,
            websiteUrl: website
          }).sort({ createdAt: -1 });

          // Pokud už existuje analýza z posledních 24 hodin, přeskočíme
          if (lastAnalysis) {
            const lastAnalysisTime = lastAnalysis.createdAt.getTime();
            const now = Date.now();
            const hoursSinceLastAnalysis = (now - lastAnalysisTime) / (1000 * 60 * 60);

            if (hoursSinceLastAnalysis < 24) {
              logger.info(`Přeskakuji analýzu webu ${website} - poslední analýza před ${hoursSinceLastAnalysis.toFixed(1)} hodinami`);
              continue;
            }
          }

          const userId = user._id ? user._id.toString() : '';
          if (userId) {
            logger.info(`Vytvářím naplánovanou analýzu pro web ${website} uživatele ${userId}`);
            analysisPromises.push(this.createAnalysis(userId, website));
          }
        }
      }

      // Spustíme všechny analýzy paralelně
      await Promise.all(analysisPromises);
      logger.info(`Spuštěno ${analysisPromises.length} naplánovaných analýz`);
    } catch (error) {
      logger.error(`Chyba při spouštění naplánovaných analýz:`, error);
    }
  }

  /**
   * Smaže analýzu
   */
  public async deleteAnalysis(analysisId: string, userId: string): Promise<boolean> {
    try {
      const result = await WebAnalysis.deleteOne({
        _id: analysisId,
        userId: new mongoose.Types.ObjectId(userId)
      });
      
      return result.deletedCount > 0;
    } catch (error) {
      logger.error(`Chyba při mazání analýzy:`, error);
      throw new Error('Nepodařilo se smazat analýzu');
    }
  }
}