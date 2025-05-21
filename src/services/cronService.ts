import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { WebAnalysisService } from './webAnalysisService';
import { ContentService } from './contentService';
import { ScheduledPostService } from './scheduledPostService';

export class CronService {
  private static instance: CronService;
  private webAnalysisService: WebAnalysisService;
  private contentService: ContentService;
  private scheduledPostService: ScheduledPostService;
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  private constructor() {
    this.webAnalysisService = new WebAnalysisService();
    this.contentService = ContentService.getInstance();
    this.scheduledPostService = ScheduledPostService.getInstance();
  }

  public static getInstance(): CronService {
    if (!CronService.instance) {
      CronService.instance = new CronService();
    }
    return CronService.instance;
  }

  /**
   * Spustí všechny cron joby
   */
  public startAllJobs(): void {
    logger.info('Spouštím cron joby');

    // Job pro pravidelné analýzy webů - každých 15 minut
    const analysisJob = cron.schedule('*/15 * * * *', async () => {
      logger.info('Spouštím plánované analýzy webů');
      try {
        await this.webAnalysisService.runScheduledAnalyses();
      } catch (error) {
        logger.error('Chyba při spouštění plánovaných analýz:', error);
      }
    });

    this.jobs.set('website-analysis', analysisJob);

    // Job pro zpracování naplánovaných příspěvků - každých 5 minut
    const scheduledContentJob = cron.schedule('*/5 * * * *', async () => {
      logger.info('Zpracovávám naplánované příspěvky z Content');
      try {
        await this.contentService.processScheduledContent();
      } catch (error) {
        logger.error('Chyba při zpracování naplánovaných příspěvků Content:', error);
      }
    });

    this.jobs.set('scheduled-content', scheduledContentJob);
    
    // Job pro zpracování naplánovaných příspěvků na sociální sítě - každé 2 minuty
    const scheduledSocialPostsJob = cron.schedule('*/2 * * * *', async () => {
      logger.info('Zpracovávám naplánované příspěvky pro sociální sítě');
      try {
        await this.scheduledPostService.processScheduledPosts();
      } catch (error) {
        logger.error('Chyba při zpracování naplánovaných příspěvků pro sociální sítě:', error);
      }
    });

    this.jobs.set('scheduled-social-posts', scheduledSocialPostsJob);

    // Job pro čištění starých záznamů - jednou denně
    const cleanupJob = cron.schedule('0 0 * * *', async () => {
      logger.info('Spouštím čištění starých záznamů');
      // Implementace čištění
    });

    this.jobs.set('cleanup', cleanupJob);

    logger.info(`Spuštěno ${this.jobs.size} cron jobů`);
  }

  /**
   * Zastaví všechny cron joby
   */
  public stopAllJobs(): void {
    logger.info('Zastavuji cron joby');
    
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`Zastaven job: ${name}`);
    });

    this.jobs.clear();
  }

  /**
   * Restartuje konkrétní job
   */
  public restartJob(jobName: string): void {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      job.start();
      logger.info(`Restartován job: ${jobName}`);
    }
  }

  /**
   * Získá stav všech jobů
   */
  public getJobsStatus(): { name: string; running: boolean }[] {
    const status: { name: string; running: boolean }[] = [];
    
    this.jobs.forEach((job, name) => {
      status.push({
        name,
        running: true // Cron-node ScheduledTask nemá veřejnou vlastnost running
      });
    });

    return status;
  }
}