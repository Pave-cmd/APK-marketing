import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../utils/logger';
import { normalizeUrl } from '../utils/urlUtils';

export interface ScrapedContent {
  title: string;
  description: string;
  images: string[];
  mainText: string;
  keywords: string[];
  products: any[];
}

export class WebsiteScraperService {
  private static instance: WebsiteScraperService;

  private constructor() {}

  public static getInstance(): WebsiteScraperService {
    if (!WebsiteScraperService.instance) {
      WebsiteScraperService.instance = new WebsiteScraperService();
    }
    return WebsiteScraperService.instance;
  }

  /**
   * Skenuje webovou stránku a extrahuje obsah
   */
  public async scrapeWebsite(url: string): Promise<ScrapedContent> {
    try {
      logger.info(`Začínám skenování webu: ${url}`);
      
      // Normalizace URL
      const normalizedUrl = normalizeUrl(url);
      
      // Stažení HTML obsahu
      const response = await axios.get(normalizedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; APK-Marketing-Bot/1.0)'
        },
        timeout: 30000
      });

      const $ = cheerio.load(response.data);

      // Extrakce základních metadat
      const title = this.extractTitle($);
      const description = this.extractDescription($);
      const keywords = this.extractKeywords($);
      const images = this.extractImages($, normalizedUrl);
      const mainText = this.extractMainText($);
      const products = this.extractProducts($);

      logger.info(`Skenování webu dokončeno: ${url}`);

      return {
        title,
        description,
        images,
        mainText,
        keywords,
        products
      };
    } catch (error) {
      logger.error(`Chyba při skenování webu ${url}:`, error);
      throw new Error(`Nepodařilo se naskenovat web: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }

  /**
   * Extrahuje titulek stránky
   */
  private extractTitle($: cheerio.CheerioAPI): string {
    return $('title').text() || 
           $('meta[property="og:title"]').attr('content') || 
           $('h1').first().text() || 
           '';
  }

  /**
   * Extrahuje popis stránky
   */
  private extractDescription($: cheerio.CheerioAPI): string {
    return $('meta[name="description"]').attr('content') || 
           $('meta[property="og:description"]').attr('content') || 
           $('p').first().text().substring(0, 160) || 
           '';
  }

  /**
   * Extrahuje klíčová slova
   */
  private extractKeywords($: cheerio.CheerioAPI): string[] {
    const metaKeywords = $('meta[name="keywords"]').attr('content');
    if (metaKeywords) {
      return metaKeywords.split(',').map(k => k.trim()).filter(k => k);
    }

    // Extrakce z nadpisů
    const headings: string[] = [];
    $('h1, h2, h3').each((_, element) => {
      const text = $(element).text().trim();
      if (text && text.length < 50) {
        headings.push(text);
      }
    });

    return headings.slice(0, 10);
  }

  /**
   * Extrahuje obrázky
   */
  private extractImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const images: string[] = [];
    
    // OG image
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      images.push(this.makeAbsoluteUrl(ogImage, baseUrl));
    }

    // Všechny img tagy
    $('img').each((_, element) => {
      const src = $(element).attr('src');
      if (src && !src.includes('data:image')) {
        const absoluteUrl = this.makeAbsoluteUrl(src, baseUrl);
        if (!images.includes(absoluteUrl)) {
          images.push(absoluteUrl);
        }
      }
    });

    // Omezit na prvních 10 obrázků
    return images.slice(0, 10);
  }

  /**
   * Extrahuje hlavní text stránky
   */
  private extractMainText($: cheerio.CheerioAPI): string {
    // Odstranit skripty a styly
    $('script, style').remove();

    // Hledáme hlavní obsah
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '#content',
      '.main-content',
      '#main-content'
    ];

    let mainText = '';
    
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        mainText = element.text();
        break;
      }
    }

    // Pokud jsme nenašli hlavní obsah, vezmeme text z body
    if (!mainText) {
      mainText = $('body').text();
    }

    // Vyčištění textu
    return mainText
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 2000); // Omezit na 2000 znaků
  }

  /**
   * Extrahuje produkty (pokud je to e-shop)
   */
  private extractProducts($: cheerio.CheerioAPI): any[] {
    const products: any[] = [];

    // Hledáme strukturovaná data
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonLd = JSON.parse($(element).html() || '{}');
        if (jsonLd['@type'] === 'Product' || jsonLd['@type'] === 'ItemList') {
          products.push(jsonLd);
        }
      } catch (e) {
        // Ignorovat chyby parsování
      }
    });

    // Heuristické vyhledávání produktů
    const productSelectors = [
      '.product',
      '.product-item',
      '.product-card',
      '[itemtype*="schema.org/Product"]'
    ];

    productSelectors.forEach(selector => {
      $(selector).each((index, element) => {
        if (index >= 10) return; // Omezit na 10 produktů

        const $product = $(element);
        const product = {
          name: $product.find('.product-name, .product-title, h2, h3').first().text().trim(),
          price: $product.find('.price, .product-price').first().text().trim(),
          image: $product.find('img').first().attr('src'),
          url: $product.find('a').first().attr('href')
        };

        if (product.name) {
          products.push(product);
        }
      });
    });

    return products.slice(0, 10);
  }

  /**
   * Převede relativní URL na absolutní
   */
  private makeAbsoluteUrl(url: string, baseUrl: string): string {
    if (url.startsWith('http')) {
      return url;
    }
    
    try {
      const base = new URL(baseUrl);
      return new URL(url, base).href;
    } catch (e) {
      return url;
    }
  }
}