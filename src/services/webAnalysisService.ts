import { logger } from '../utils/logger';
import WebAnalysis, { IWebAnalysis } from '../models/WebAnalysis';
import { WebsiteScraperService } from './websiteScraperService';
import { ContentGeneratorService } from './contentGeneratorService';
import { SocialPublisherService } from './socialPublisherService';
import User from '../models/User';

export class WebAnalysisService {
  private scraperService: WebsiteScraperService;
  private generatorService: ContentGeneratorService;
  private publisherService: SocialPublisherService;

  constructor() {
    this.scraperService = WebsiteScraperService.getInstance();
    this.generatorService = ContentGeneratorService.getInstance();
    this.publisherService = SocialPublisherService.getInstance();
  }

  /**
   * Spustí kompletní analýzu webu
   */
  public async analyzeWebsite(userId: string, websiteUrl: string): Promise<IWebAnalysis> {
    logger.info(`Spouštím analýzu webu: ${websiteUrl} pro uživatele: ${userId}`);

    // Vytvoříme nebo aktualizujeme záznam analýzy
    let analysis = await WebAnalysis.findOne({ userId, websiteUrl });
    
    if (!analysis) {
      analysis = new WebAnalysis({
        userId,
        websiteUrl,
        status: 'pending',
        scanFrequency: 'daily'
      });
    }

    try {
      // 1. Skenování webu
      analysis.status = 'scanning';
      await analysis.save();

      const scrapedContent = await this.scraperService.scrapeWebsite(websiteUrl);
      
      // 2. Extrakce obsahu
      analysis.status = 'extracting';
      analysis.scannedContent = {
        title: scrapedContent.title,
        description: scrapedContent.description,
        images: scrapedContent.images,
        mainText: scrapedContent.mainText,
        keywords: scrapedContent.keywords,
        products: scrapedContent.products
      };
      await analysis.save();

      // 3. AI generování
      analysis.status = 'generating';
      await analysis.save();

      const generatedContent = await this.generatorService.generateSocialContent(scrapedContent, websiteUrl);
      analysis.generatedContent = generatedContent;
      await analysis.save();

      // 4. Publikace
      analysis.status = 'publishing';
      await analysis.save();

      const publishResults = await this.publisherService.publishToAllNetworks(analysis);
      
      // Aktualizujeme status na základě výsledků publikace
      const allSuccessful = publishResults.every(result => result.success);
      analysis.status = allSuccessful ? 'completed' : 'failed';
      analysis.lastScan = new Date();
      
      // Nastavíme další skenování
      analysis.nextScan = this.calculateNextScan(analysis.scanFrequency);
      
      await analysis.save();

      logger.info(`Analýza webu dokončena: ${websiteUrl}`);
      return analysis;

    } catch (error) {
      logger.error(`Chyba při analýze webu ${websiteUrl}:`, error);
      
      analysis.status = 'failed';
      analysis.error = error instanceof Error ? error.message : 'Neznámá chyba';
      await analysis.save();
      
      throw error;
    }
  }

  /**
   * Získá stav analýzy pro konkrétní web
   */
  public async getAnalysisStatus(userId: string, websiteUrl: string): Promise<IWebAnalysis | null> {
    return await WebAnalysis.findOne({ userId, websiteUrl });
  }

  /**
   * Získá všechny analýzy pro uživatele
   */
  public async getUserAnalyses(userId: string): Promise<IWebAnalysis[]> {
    return await WebAnalysis.find({ userId }).sort({ updatedAt: -1 });
  }

  /**
   * Vypočítá čas příštího skenování
   */
  private calculateNextScan(frequency: string): Date {
    const now = new Date();
    
    switch (frequency) {
      case 'hourly':
        return new Date(now.getTime() + 60 * 60 * 1000);
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default daily
    }
  }

  /**
   * Spustí naplánované analýzy
   */
  public async runScheduledAnalyses(): Promise<void> {
    logger.info('Spouštím naplánované analýzy');

    const pendingAnalyses = await WebAnalysis.find({
      status: { $ne: 'scanning' },
      nextScan: { $lte: new Date() }
    });

    logger.info(`Nalezeno ${pendingAnalyses.length} analýz k provedení`);

    for (const analysis of pendingAnalyses) {
      try {
        await this.analyzeWebsite(analysis.userId.toString(), analysis.websiteUrl);
      } catch (error) {
        logger.error(`Chyba při plánované analýze ${analysis.websiteUrl}:`, error);
      }
    }
  }
}