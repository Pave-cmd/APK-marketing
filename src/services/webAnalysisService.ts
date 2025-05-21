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
  private advancedScraperService: AdvancedWebsiteScraperService;
  private generatorService: ContentGeneratorService;
  private publisherService: SocialPublisherService;

  constructor() {
    // Předpokládáme, že instančně již existují
    this.scraperService = new WebsiteScraperService();
    this.advancedScraperService = new AdvancedWebsiteScraperService();
    
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
        createdAt: new Date()
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

      // Nejprve zkusíme pokročilý scraper pro dynamické weby
      let scrapedContent;
      try {
        // @ts-ignore - Property 'scrapeWebsite' exists dynamically
        scrapedContent = await this.advancedScraperService.scrapeWebsite(websiteUrl);
        logger.info(`Použit pokročilý scraper pro: ${websiteUrl}`);
      } catch (error) {
        logger.warn(`Pokročilý scraper selhal, používám základní scraper pro: ${websiteUrl}`);
        // Pokud pokročilý scraper selže, použijeme základní
        scrapedContent = await this.scraperService.scrapeWebsite(websiteUrl);
      }

      // 2. Uložení výsledků
      analysis.scannedContent = {
        title: scrapedContent.title || websiteUrl,
        description: scrapedContent.description || '',
        keywords: scrapedContent.keywords || [],
        headers: scrapedContent.headers || [],
        images: scrapedContent.images || [],
        links: scrapedContent.links || []
      };
      await analysis.save();

      // 3. AI generování
      analysis.status = 'generating';
      await analysis.save();

      // @ts-ignore - Property 'generateSocialContent' exists dynamically
      const generatedContent = await this.generatorService.generateSocialContent(scrapedContent, websiteUrl);
      analysis.generatedContent = generatedContent;
      await analysis.save();

      // 4. Publikace
      analysis.status = 'publishing';
      await analysis.save();

      // Automatická publikace obsahu
      const publishResult = await this.publisherService.publishToAllNetworks(analysis);
      analysis.publishResult = publishResult;
      
      // 5. Dokončení
      analysis.status = 'completed';
      analysis.completedAt = new Date();
      await analysis.save();
      
      logger.info(`Analýza webu ${websiteUrl} úspěšně dokončena`);
    } catch (error) {
      logger.error(`Chyba při analýze webu ${websiteUrl}:`, error);
      analysis.status = 'error';
      analysis.errorMessage = error instanceof Error ? error.message : 'Neznámá chyba';
      await analysis.save();
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

          logger.info(`Vytvářím naplánovanou analýzu pro web ${website} uživatele ${user._id}`);
          analysisPromises.push(this.createAnalysis(user._id.toString(), website));
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