import puppeteer from 'puppeteer';
import { logger } from '../utils/logger';
import { normalizeUrl } from '../utils/urlUtils';
import { ScrapedContent } from './websiteScraperService';

export class AdvancedWebsiteScraperService {
  private static instance: AdvancedWebsiteScraperService;

  private constructor() {}

  public static getInstance(): AdvancedWebsiteScraperService {
    if (!AdvancedWebsiteScraperService.instance) {
      AdvancedWebsiteScraperService.instance = new AdvancedWebsiteScraperService();
    }
    return AdvancedWebsiteScraperService.instance;
  }

  /**
   * Skenuje webovou stránku pomocí headless browseru
   */
  public async scrapeWebsite(url: string): Promise<ScrapedContent> {
    let browser;
    
    try {
      logger.info(`Začínám pokročilé skenování webu: ${url}`);
      
      // Normalizace URL
      const normalizedUrl = normalizeUrl(url);
      
      // Spuštění headless browseru
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Nastavení user-agenta
      await page.setUserAgent('Mozilla/5.0 (compatible; APK-Marketing-Bot/1.0)');
      
      // Navigace na stránku
      await page.goto(normalizedUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Počkáme na načtení dynamického obsahu
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Extrakce dat z plně načtené stránky
      const content = await page.evaluate(() => {
        // Pomocné funkce pro extrakci
        const getText = (selector: string): string => {
          const element = document.querySelector(selector);
          return element?.textContent?.trim() || '';
        };
        
        const getAllText = (selector: string): string[] => {
          const elements = document.querySelectorAll(selector);
          return Array.from(elements).map(el => el.textContent?.trim() || '').filter(text => text);
        };
        
        // Extrakce titulku
        const title = document.title || 
                     getText('meta[property="og:title"]') || 
                     getText('h1') || 
                     '';
        
        // Extrakce popisu
        const description = getText('meta[name="description"]') || 
                           getText('meta[property="og:description"]') || 
                           '';
        
        // Extrakce obrázků
        const images: string[] = [];
        const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content;
        if (ogImage) images.push(ogImage);
        
        document.querySelectorAll('img').forEach(img => {
          const src = img.src;
          if (src && !src.includes('data:image') && !images.includes(src)) {
            images.push(src);
          }
        });
        
        // Extrakce klíčových slov
        const metaKeywords = getText('meta[name="keywords"]');
        const keywords = metaKeywords ? metaKeywords.split(',').map(k => k.trim()) : [];
        
        // Přidání nadpisů jako klíčových slov
        const headings = getAllText('h1, h2, h3');
        headings.forEach(heading => {
          if (heading.length < 50 && !keywords.includes(heading)) {
            keywords.push(heading);
          }
        });
        
        // Extrakce hlavního textu
        let mainText = '';
        const mainSelectors = [
          'main',
          'article',
          '[role="main"]',
          '.content',
          '#content',
          '.main-content',
          '#main-content'
        ];
        
        for (const selector of mainSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            mainText = element.textContent || '';
            break;
          }
        }
        
        if (!mainText) {
          mainText = document.body.textContent || '';
        }
        
        // Čištění textu
        mainText = mainText.replace(/\s+/g, ' ').trim();
        
        // Extrakce produktů (pro herní weby)
        const products: any[] = [];
        
        // Strukturovaná data
        document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
          try {
            const jsonLd = JSON.parse(script.textContent || '{}');
            if (jsonLd['@type'] === 'Product' || jsonLd['@type'] === 'Game' || jsonLd['@type'] === 'ItemList') {
              products.push(jsonLd);
            }
          } catch (e) {
            // Ignorovat chyby parsování
          }
        });
        
        // Hledání herních karet
        const gameSelectors = [
          '.game-card',
          '.game-item',
          '.game',
          '[class*="game-"]',
          '.card-game',
          '.item'
        ];
        
        gameSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach((element, index) => {
            if (index >= 20) return; // Omezit na 20 her
            
            const game: any = {
              name: element.querySelector('h2, h3, h4, .title, .game-title, .name')?.textContent?.trim(),
              image: element.querySelector('img')?.src,
              url: element.querySelector('a')?.href,
              category: element.querySelector('.category, .genre, .tags')?.textContent?.trim()
            };
            
            if (game.name) {
              products.push(game);
            }
          });
        });
        
        return {
          title,
          description,
          images: images.slice(0, 10),
          mainText: mainText.substring(0, 5000),
          keywords: keywords.slice(0, 30),
          products: products.slice(0, 20)
        };
      });
      
      logger.info(`Pokročilé skenování webu dokončeno: ${url}`);
      
      return content;
      
    } catch (error) {
      logger.error(`Chyba při pokročilém skenování webu ${url}:`, error);
      throw new Error(`Nepodařilo se naskenovat web: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}