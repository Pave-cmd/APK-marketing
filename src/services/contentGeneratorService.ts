import { logger } from '../utils/logger';
import { ScrapedContent } from './websiteScraperService';

export interface GeneratedContent {
  facebook?: {
    text: string;
    image?: string;
  };
  twitter?: {
    text: string;
    image?: string;
  };
  linkedin?: {
    text: string;
    image?: string;
  };
}

export class ContentGeneratorService {
  private static instance: ContentGeneratorService;

  private constructor() {}

  public static getInstance(): ContentGeneratorService {
    if (!ContentGeneratorService.instance) {
      ContentGeneratorService.instance = new ContentGeneratorService();
    }
    return ContentGeneratorService.instance;
  }

  /**
   * Generuje obsah pro sociální sítě na základě naskenovaného obsahu
   */
  public async generateSocialContent(scrapedContent: ScrapedContent, websiteUrl: string): Promise<GeneratedContent> {
    logger.info(`Generuji obsah pro web: ${websiteUrl}`);

    try {
      const generatedContent: GeneratedContent = {};

      // Generování obsahu pro Facebook
      if (scrapedContent.title || scrapedContent.description) {
        generatedContent.facebook = await this.generateFacebookContent(scrapedContent, websiteUrl);
      }

      // Generování obsahu pro Twitter
      if (scrapedContent.title) {
        generatedContent.twitter = await this.generateTwitterContent(scrapedContent, websiteUrl);
      }

      // Generování obsahu pro LinkedIn
      if (scrapedContent.description || scrapedContent.mainText) {
        generatedContent.linkedin = await this.generateLinkedInContent(scrapedContent, websiteUrl);
      }

      logger.info(`Obsah úspěšně vygenerován pro web: ${websiteUrl}`);
      return generatedContent;
    } catch (error) {
      logger.error(`Chyba při generování obsahu:`, error);
      throw new Error(`Nepodařilo se vygenerovat obsah: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }

  /**
   * Generuje obsah pro Facebook
   */
  private async generateFacebookContent(content: ScrapedContent, websiteUrl: string): Promise<{ text: string; image?: string }> {
    // Speciální šablona pro herní weby
    if (this.isGamingWebsite(content)) {
      return this.generateGamingFacebookContent(content, websiteUrl);
    }

    // Obecná šablona
    let text = '';

    if (content.title) {
      text += `🌟 ${content.title}\n\n`;
    }

    if (content.description) {
      text += `${content.description}\n\n`;
    }

    // Přidáme nejdůležitější klíčová slova jako hashtagy
    if (content.keywords && content.keywords.length > 0) {
      const hashtags = content.keywords
        .slice(0, 5)
        .map(keyword => `#${keyword.replace(/\s+/g, '')}`)
        .join(' ');
      text += `${hashtags}\n\n`;
    }

    text += `👉 Hrát hry na: ${websiteUrl}`;

    return {
      text: text.trim(),
      image: content.images?.[0]
    };
  }

  /**
   * Generuje obsah pro herní weby na Facebook
   */
  private generateGamingFacebookContent(content: ScrapedContent, websiteUrl: string): { text: string; image?: string } {
    let text = '🎮 Objevte nejlepší online hry!\n\n';

    if (content.title?.includes('Hry') || content.title?.includes('Games')) {
      text = `🎮 ${content.title}\n\n`;
    }

    // Pokud máme seznam her
    if (content.products && content.products.length > 0) {
      text += '🔥 Nejoblíbenější hry:\n';
      content.products.slice(0, 5).forEach((game, index) => {
        text += `${index + 1}. ${game.name || 'Skvělá hra'}\n`;
      });
      text += '\n';
    }

    // Výhody hraní
    text += '✨ Proč hrát u nás?\n';
    text += '✅ Tisíce her zdarma\n';
    text += '✅ Žádná registrace\n';
    text += '✅ Nové hry každý týden\n\n';

    // Hashtagy specifické pro hry
    const gamingHashtags = ['#hryzdarma', '#onlinehry', '#hryonline', '#českéhry', '#gaming'];
    text += `${gamingHashtags.join(' ')}\n\n`;

    text += `🎯 Hraj teď: ${websiteUrl}`;

    return {
      text: text.trim(),
      image: content.images?.[0]
    };
  }

  /**
   * Zjistí, zda se jedná o herní web
   */
  private isGamingWebsite(content: ScrapedContent): boolean {
    const gamingKeywords = ['hry', 'games', 'gaming', 'hrát', 'play', 'online hry', 'hry zdarma'];
    
    const titleLower = content.title?.toLowerCase() || '';
    const descriptionLower = content.description?.toLowerCase() || '';
    
    return gamingKeywords.some(keyword => 
      titleLower.includes(keyword) || 
      descriptionLower.includes(keyword) ||
      content.keywords?.some(k => k.toLowerCase().includes(keyword))
    );
  }

  /**
   * Generuje obsah pro Twitter
   */
  private async generateTwitterContent(content: ScrapedContent, websiteUrl: string): Promise<{ text: string; image?: string }> {
    // Speciální šablona pro herní weby
    if (this.isGamingWebsite(content)) {
      return this.generateGamingTwitterContent(content, websiteUrl);
    }

    let text = '';

    if (content.title) {
      // Twitter má limit 280 znaků
      const shortTitle = content.title.length > 100 ? 
        content.title.substring(0, 97) + '...' : 
        content.title;
      text += `${shortTitle}\n\n`;
    }

    // Přidáme 2-3 hashtagy
    if (content.keywords && content.keywords.length > 0) {
      const hashtags = content.keywords
        .slice(0, 3)
        .map(keyword => `#${keyword.replace(/\s+/g, '')}`)
        .join(' ');
      text += `${hashtags}\n\n`;
    }

    // Zkrácená URL
    text += `🔗 ${websiteUrl}`;

    // Zajistíme, že text nepřekročí 280 znaků
    if (text.length > 280) {
      text = text.substring(0, 277) + '...';
    }

    return {
      text: text.trim(),
      image: content.images?.[0]
    };
  }

  /**
   * Generuje obsah pro herní weby na Twitter
   */
  private generateGamingTwitterContent(content: ScrapedContent, websiteUrl: string): { text: string; image?: string } {
    let text = '🎮 Hrajte tisíce her ZDARMA! Žádná registrace, žádné stahování.\n\n';

    // Emojis pro větší engagement
    text += '🔥 Nové hry každý den\n';
    text += '💎 Premium hry zdarma\n';
    text += '🎯 Okamžité hraní\n\n';

    // Gaming hashtagy pro Twitter
    const hashtags = ['#hryzdarma', '#onlinegames', '#czechgames'];
    text += `${hashtags.join(' ')}\n\n`;

    text += `🕹️ ${websiteUrl}`;

    // Zajistíme, že text nepřekročí 280 znaků
    if (text.length > 280) {
      text = text.substring(0, 277) + '...';
    }

    return {
      text: text.trim(),
      image: content.images?.[0]
    };
  }

  /**
   * Generuje obsah pro LinkedIn
   */
  private async generateLinkedInContent(content: ScrapedContent, websiteUrl: string): Promise<{ text: string; image?: string }> {
    let text = '';

    if (content.title) {
      text += `📢 ${content.title}\n\n`;
    }

    if (content.description) {
      text += `${content.description}\n\n`;
    } else if (content.mainText) {
      // Použijeme prvních 200 znaků hlavního textu
      const excerpt = content.mainText.substring(0, 200);
      text += `${excerpt}...\n\n`;
    }

    // Profesionální hashtagy
    if (content.keywords && content.keywords.length > 0) {
      const hashtags = content.keywords
        .slice(0, 5)
        .map(keyword => `#${keyword.replace(/\s+/g, '')}`)
        .join(' ');
      text += `${hashtags}\n\n`;
    }

    text += `🔍 Zjistěte více: ${websiteUrl}`;

    return {
      text: text.trim(),
      image: content.images?.[0]
    };
  }

  /**
   * Vylepší obsah pomocí AI (placeholder pro budoucí implementaci)
   */
  private async enhanceWithAI(content: string, platform: string): Promise<string> {
    // Zde by byla integrace s OpenAI nebo jiným AI API
    // Pro teď vrátíme původní obsah
    return content;
  }
}