import axios from 'axios';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { logger, webLog } from '../utils/logger';
import { normalizeUrl, makeAbsoluteUrl } from '../utils/urlUtils';
import { Singleton } from '../utils/singleton';
import * as path from 'path';
import { URL } from 'url';
import puppeteer from 'puppeteer';

/**
 * Vylepšený výsledek scrapingu webu se zaměřením na sociální sítě
 */
export interface EnhancedScrapedContent {
  url: string;                         // Původní URL webu
  title: string;                       // Titulek stránky
  description: string;                 // Meta popis nebo extrahovaný popis
  mainText: string;                    // Hlavní obsah stránky
  images: ContentImage[];              // Obrázky s metadaty
  websiteType: WebsiteType;            // Typ webové stránky
  language: string;                    // Detekovaný jazyk obsahu
  socialShareable: SocialShareable[];  // Obsah vhodný pro sdílení
  blogPosts: BlogPost[];               // Nalezené blogové příspěvky
  products: Product[];                 // Nalezené produkty
  contactInfo: ContactInfo;            // Kontaktní informace
  keywords: string[];                  // Klíčová slova extrahovaná z obsahu
  socialLinks: SocialLink[];           // Odkazy na sociální sítě webu
  lastModified?: Date;                 // Poslední změna obsahu (pokud je k dispozici)
  scrapedAt: Date;                     // Datum a čas scrapování
  pageScore: PageScore;                // Skóre obsahu stránky
  changes: ContentChange[];            // Změny od posledního scrapování
}

/**
 * Typy webových stránek
 */
export type WebsiteType = 
  'e-shop' | 
  'blog' | 
  'company' | 
  'news' | 
  'portfolio' | 
  'personal' | 
  'education' | 
  'entertainment' | 
  'other';

/**
 * Obrázek s metadaty
 */
export interface ContentImage {
  url: string;                   // URL obrázku
  alt?: string;                  // Alt text
  title?: string;                // Title atribut
  width?: number;                // Šířka obrázku
  height?: number;               // Výška obrázku
  prominence: number;            // Hodnocení důležitosti (0-100)
  isHero: boolean;               // Zda je to hlavní obrázek stránky
  isLogo: boolean;               // Zda je to logo
  colors?: string[];             // Dominantní barvy
  aspectRatio?: number;          // Poměr stran
  format?: string;               // Formát souboru
  socialMediaReady: boolean;     // Vhodnost pro sociální média
}

/**
 * Obsah vhodný pro sdílení na sociálních sítích
 */
export interface SocialShareable {
  type: 'quote' | 'stat' | 'tip' | 'announcement' | 'product' | 'blogPost';
  content: string;
  image?: string;
  url?: string;
  prominence: number;           // Hodnocení důležitosti (0-100)
  socialNetworks: string[];     // Vhodné sociální sítě
}

/**
 * Blogový příspěvek
 */
export interface BlogPost {
  title: string;
  url: string;
  date?: Date;
  excerpt: string;
  content?: string;
  author?: string;
  categories?: string[];
  tags?: string[];
  image?: string;
  readingTime?: number;         // Odhadovaný čas čtení v minutách
  engagement?: {
    comments?: number,
    shares?: number,
    likes?: number
  };
  isNew: boolean;               // Nový od posledního scrapování
  socialScore: number;          // Skóre vhodnosti pro sociální sítě (0-100)
}

/**
 * Produkt
 */
export interface Product {
  name: string;
  description?: string;
  price?: string;
  originalPrice?: string;       // Původní cena (pro slevy)
  currency?: string;
  image?: string;
  additionalImages?: string[];  // Další obrázky produktu
  url: string;
  sku?: string;
  availability?: string;
  category?: string[];
  brand?: string;
  isNew: boolean;               // Nový od posledního scrapování
  isOnSale: boolean;            // Zda je v akci
  discountPercentage?: number;  // Procentuální sleva
  rating?: number;
  reviewCount?: number;
  attributes?: Record<string, string>; // Vlastnosti produktu (barva, velikost, atd.)
  socialScore: number;          // Skóre vhodnosti pro sociální sítě (0-100)
}

/**
 * Kontaktní informace
 */
export interface ContactInfo {
  email?: string;
  phone?: string;
  address?: string;
  openingHours?: string;
  socialLinks: SocialLink[];
}

/**
 * Odkazy na sociální sítě
 */
export interface SocialLink {
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'pinterest' | 'youtube' | 'tiktok' | 'other';
  url: string;
  followers?: number;
}

/**
 * Skóre stránky
 */
export interface PageScore {
  overall: number;             // Celkové skóre (0-100)
  contentQuality: number;      // Kvalita obsahu
  visualAppeal: number;        // Vizuální přitažlivost
  socialShareability: number;  // Vhodnost pro sdílení
  seoScore: number;            // SEO skóre
}

/**
 * Změny obsahu
 */
export interface ContentChange {
  type: 'new' | 'updated' | 'removed';
  elementType: 'product' | 'blogPost' | 'page' | 'image' | 'section';
  id: string;                  // Identifikátor elementu (URL nebo jiný unikátní identifikátor)
  title?: string;
  changeDescription?: string;
  socialPriority: number;      // Priorita pro sdílení na sociálních sítích (0-100)
}

/**
 * Nastavení pro scraping
 */
export interface ScraperOptions {
  depth?: number;              // Hloubka scrapování (1 = pouze hlavní stránka)
  maxPages?: number;           // Maximální počet stránek ke scrapování
  useJsRendering?: boolean;    // Použít JavaScript rendering
  focusAreas?: string[];       // Konkrétní oblasti zájmu (např. 'products', 'blog')
  previousScrape?: EnhancedScrapedContent; // Předchozí výsledek scrapování pro detekci změn
  customHeaders?: Record<string, string>; // Vlastní HTTP hlavičky pro požadavky
  timeout?: number;            // Timeout pro požadavky v ms
  respectRobotsTxt?: boolean;  // Respektovat robots.txt
}

/**
 * Vylepšená služba pro scraping webů se zaměřením na AI marketing pro sociální sítě
 */
export class EnhancedWebScraperService extends Singleton {
  
  /**
   * Provede scraping webové stránky s pokročilými možnostmi
   */
  public async scrapeWebsite(
    url: string, 
    options: ScraperOptions = {}
  ): Promise<EnhancedScrapedContent> {
    const startTime = Date.now();
    webLog(`Začínám vylepšený scraping webu: ${url}`);
    
    try {
      // Výchozí hodnoty nastavení
      const mergedOptions: Required<ScraperOptions> = {
        depth: options.depth ?? 1,
        maxPages: options.maxPages ?? 10,
        useJsRendering: options.useJsRendering ?? false,
        focusAreas: options.focusAreas ?? ['all'],
        previousScrape: options.previousScrape ?? undefined,
        customHeaders: options.customHeaders ?? {},
        timeout: options.timeout ?? 30000,
        respectRobotsTxt: options.respectRobotsTxt ?? true
      };
      
      // Normalizace URL
      const normalizedUrl = normalizeUrl(url);
      
      // Iniciální výsledek
      const result: EnhancedScrapedContent = {
        url: normalizedUrl,
        title: '',
        description: '',
        mainText: '',
        images: [],
        websiteType: 'other',
        language: 'cs', // Výchozí jazyk (českým) - později detekován
        socialShareable: [],
        blogPosts: [],
        products: [],
        contactInfo: {
          socialLinks: []
        },
        keywords: [],
        socialLinks: [],
        scrapedAt: new Date(),
        pageScore: {
          overall: 0,
          contentQuality: 0,
          visualAppeal: 0,
          socialShareability: 0,
          seoScore: 0
        },
        changes: []
      };
      
      // HTML obsah stránky (podle vybraného režimu)
      let html: string;
      let $: cheerio.CheerioAPI;
      
      if (mergedOptions.useJsRendering) {
        html = await this.getRenderedHtml(normalizedUrl);
      } else {
        html = await this.getStaticHtml(normalizedUrl, mergedOptions);
      }
      
      // Načtení do Cheerio pro zpracování
      $ = cheerio.load(html);
      
      // Extrakce základních metadat
      result.title = this.extractTitle($);
      result.description = this.extractDescription($);
      result.mainText = this.extractMainText($, html);
      result.language = this.detectLanguage($);
      result.keywords = this.extractKeywords($, result.mainText);
      
      // Detekce typu webu
      result.websiteType = this.detectWebsiteType($, result.title, result.description, result.mainText);
      
      // Extrakce obrázků a určení nejlepších pro sociální sítě
      result.images = await this.extractAndAnalyzeImages($, normalizedUrl);
      
      // Extrakce kontaktních informací
      result.contactInfo = this.extractContactInfo($, normalizedUrl);
      
      // Extrakce sociálních odkazů
      result.socialLinks = this.extractSocialLinks($, normalizedUrl);
      
      // Zpracování podle typu webu a oblastí zájmu
      if (this.shouldProcessArea('products', mergedOptions.focusAreas, result.websiteType)) {
        result.products = await this.extractProducts($, normalizedUrl, mergedOptions);
      }
      
      if (this.shouldProcessArea('blog', mergedOptions.focusAreas, result.websiteType)) {
        result.blogPosts = await this.extractBlogPosts($, normalizedUrl, mergedOptions);
      }
      
      // Extrakce obsahu vhodného pro sdílení na sociálních sítích
      result.socialShareable = this.extractSocialShareableContent($, result, normalizedUrl);
      
      // Výpočet skóre stránky
      result.pageScore = this.calculatePageScore(result);
      
      // Detekce změn oproti předchozímu scrapování
      if (mergedOptions.previousScrape) {
        result.changes = this.detectChanges(result, mergedOptions.previousScrape);
      }
      
      // Úspěšný scraping
      const duration = Date.now() - startTime;
      webLog(`Vylepšený scraping webu ${url} dokončen za ${duration}ms`, {
        type: result.websiteType,
        products: result.products.length,
        blogPosts: result.blogPosts.length,
        images: result.images.length,
        changes: result.changes.length
      });
      
      return result;
      
    } catch (error) {
      webLog(`Chyba při vylepšeném scrapingu webu: ${url}`, { error });
      throw error;
    }
  }
  
  /**
   * Získá statický HTML obsah stránky
   */
  private async getStaticHtml(url: string, options: Required<ScraperOptions>): Promise<string> {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; APK-Marketing-Bot/1.0)',
      'Accept': 'text/html,application/xhtml+xml,application/xml',
      'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
      ...options.customHeaders
    };
    
    const response = await axios.get(url, {
      headers,
      timeout: options.timeout,
      maxRedirects: 5
    });
    
    return response.data;
  }
  
  /**
   * Získá HTML s JavaScript renderingem pomocí puppeteer
   */
  private async getRenderedHtml(url: string): Promise<string> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      
      // Nastavení User-Agent
      await page.setUserAgent('Mozilla/5.0 (compatible; APK-Marketing-Bot/1.0)');
      
      // Nastavení viewport pro simulaci normálního prohlížeče
      await page.setViewport({ width: 1280, height: 800 });
      
      // Přechod na stránku s timeoutem 30 sekund
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Počkáme chvíli pro načtení dynamického obsahu
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Získání plně renderovaného HTML
      const content = await page.content();
      
      return content;
    } finally {
      await browser.close();
    }
  }
  
  /**
   * Extrahuje titulek stránky
   */
  private extractTitle($: cheerio.CheerioAPI): string {
    // Prioritně použít Open Graph titulek
    const ogTitle = $('meta[property="og:title"]').attr('content');
    if (ogTitle) return ogTitle.trim();
    
    // Poté Twitter card titulek
    const twitterTitle = $('meta[name="twitter:title"]').attr('content');
    if (twitterTitle) return twitterTitle.trim();
    
    // Poté klasický HTML titulek
    const htmlTitle = $('title').text();
    if (htmlTitle) return htmlTitle.trim();
    
    // Případně hlavní nadpis
    const h1 = $('h1').first().text();
    if (h1) return h1.trim();
    
    return '';
  }
  
  /**
   * Extrahuje popis stránky
   */
  private extractDescription($: cheerio.CheerioAPI): string {
    // Prioritně použít Open Graph popis
    const ogDescription = $('meta[property="og:description"]').attr('content');
    if (ogDescription) return ogDescription.trim();
    
    // Poté Twitter card popis
    const twitterDescription = $('meta[name="twitter:description"]').attr('content');
    if (twitterDescription) return twitterDescription.trim();
    
    // Poté klasický meta popis
    const metaDescription = $('meta[name="description"]').attr('content');
    if (metaDescription) return metaDescription.trim();
    
    return '';
  }
  
  /**
   * Extrahuje hlavní text stránky pomocí Readability
   */
  private extractMainText($: cheerio.CheerioAPI, html: string): string {
    try {
      // Pokusíme se použít Readability pro získání hlavního obsahu
      const dom = new JSDOM(html);
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      
      if (article && article.textContent) {
        return article.textContent.trim().substring(0, 10000); // Omezení délky
      }
    } catch (error) {
      webLog('Chyba při extrakci hlavního textu pomocí Readability', { error });
    }
    
    // Fallback na vlastní extrakci
    // Nejprve odstranit skripty, styly a další nepotřebné elementy
    $('script, style, noscript, iframe, img, svg, canvas, nav, footer, header, aside').remove();
    
    // Hledání hlavního obsahu podle běžných selektorů
    const contentSelectors = [
      'main',
      'article',
      '.content',
      '#content',
      '.main-content',
      '#main-content',
      '.post-content',
      '.entry-content',
      '.article-content',
      '.page-content'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        return element.text().trim().replace(/\s+/g, ' ').substring(0, 10000);
      }
    }
    
    // Pokud nenajdeme podle selektorů, vezmeme všechen text z body
    return $('body').text().trim().replace(/\s+/g, ' ').substring(0, 10000);
  }
  
  /**
   * Detekuje jazyk obsahu
   */
  private detectLanguage($: cheerio.CheerioAPI): string {
    // HTML lang atribut
    const htmlLang = $('html').attr('lang');
    if (htmlLang) {
      const lang = htmlLang.split('-')[0].toLowerCase();
      return lang || 'cs';
    }
    
    // Meta tag s jazykem
    const metaLang = $('meta[http-equiv="content-language"]').attr('content');
    if (metaLang) {
      return metaLang.split(',')[0].trim().toLowerCase() || 'cs';
    }
    
    // Defaultní jazyk
    return 'cs';
  }
  
  /**
   * Extrahuje klíčová slova z obsahu
   */
  private extractKeywords($: cheerio.CheerioAPI, text: string): string[] {
    // Nejprve zkusíme meta keywords
    const metaKeywords = $('meta[name="keywords"]').attr('content');
    if (metaKeywords) {
      const keywords = metaKeywords.split(',')
        .map(kw => kw.trim())
        .filter(kw => kw.length > 0);
      
      if (keywords.length > 0) {
        return keywords.slice(0, 20); // Max 20 klíčových slov
      }
    }
    
    // Pokud nemáme meta keywords, zkusíme extrakt ze semantických prvků
    const headings: string[] = [];
    $('h1, h2, h3').each((_, el) => {
      headings.push($(el).text().trim());
    });
    
    // Extrahovat pouze významná slova z nadpisů
    const stopWords = ['a', 'the', 'v', 'na', 'je', 'se', 'o', 'do', 'za', 'pro'];
    const keywords = headings
      .join(' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.includes(word))
      .slice(0, 20);
    
    return [...new Set(keywords)]; // Odstranění duplicit
  }
  
  /**
   * Určuje typ webové stránky
   */
  private detectWebsiteType(
    $: cheerio.CheerioAPI, 
    title: string, 
    description: string, 
    mainText: string
  ): WebsiteType {
    // Detekce e-shopu
    const hasEcommerceFeatures = 
      $('button:contains("Koupit"), button:contains("Do košíku"), a:contains("košík"), a:contains("nákupní košík")').length > 0 ||
      $('#cart, .cart, .add-to-cart, .product-price, .product-gallery').length > 0 ||
      $('.price, .product, .shop, .store, .checkout, .shopping-cart').length > 0;
    
    if (hasEcommerceFeatures) {
      return 'e-shop';
    }
    
    // Detekce blogu
    const hasBlogFeatures =
      $('article, .post, .blog-post, .article, .entry').length > 0 ||
      $('.author, .date, .published, .blog-title').length > 0 ||
      title.toLowerCase().includes('blog') ||
      $('a:contains("archiv"), a:contains("kategorie"), a:contains("tags")').length > 0;
    
    if (hasBlogFeatures) {
      return 'blog';
    }
    
    // Detekce firemního webu
    const hasCompanyFeatures =
      $('.about-us, .about, .team, .company, .services, .clients, .testimonials').length > 0 ||
      $('section:contains("O nás"), section:contains("Služby"), section:contains("Kontakt")').length > 0 ||
      $('h1:contains("O společnosti"), h2:contains("O společnosti")').length > 0;
    
    if (hasCompanyFeatures) {
      return 'company';
    }
    
    // Detekce zpravodajského webu
    const hasNewsFeatures =
      $('.news, .article, .headline, .featured-news').length > 0 ||
      $('time, .published, .date').length > 5 ||
      title.toLowerCase().includes('zprávy') || 
      title.toLowerCase().includes('novinky');
    
    if (hasNewsFeatures) {
      return 'news';
    }
    
    // Detekce portfolia
    const hasPortfolioFeatures =
      $('.portfolio, .projects, .gallery, .work, .showcase').length > 0 ||
      $('img.project, .portfolio-item').length > 0;
    
    if (hasPortfolioFeatures) {
      return 'portfolio';
    }
    
    // Detekce vzdělávacího webu
    const hasEducationFeatures =
      $('.course, .lesson, .training, .academy, .school, .university, .study').length > 0 ||
      $('h1:contains("Kurzy"), h2:contains("Kurzy"), h1:contains("Vzdělávání")').length > 0;
    
    if (hasEducationFeatures) {
      return 'education';
    }
    
    // Defaultně ostatní
    return 'other';
  }
  
  /**
   * Extrahuje a analyzuje obrázky ze stránky
   */
  private async extractAndAnalyzeImages(
    $: cheerio.CheerioAPI, 
    baseUrl: string
  ): Promise<ContentImage[]> {
    const images: ContentImage[] = [];
    const seenUrls = new Set<string>();
    
    // Open Graph image
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      const absoluteUrl = makeAbsoluteUrl(ogImage, baseUrl);
      seenUrls.add(absoluteUrl);
      
      images.push({
        url: absoluteUrl,
        alt: 'Open Graph Image',
        prominence: 100, // Nejvyšší důležitost
        isHero: true,
        isLogo: false,
        socialMediaReady: true
      });
    }
    
    // Twitter image
    const twitterImage = $('meta[name="twitter:image"]').attr('content');
    if (twitterImage && !seenUrls.has(makeAbsoluteUrl(twitterImage, baseUrl))) {
      const absoluteUrl = makeAbsoluteUrl(twitterImage, baseUrl);
      seenUrls.add(absoluteUrl);
      
      images.push({
        url: absoluteUrl,
        alt: 'Twitter Card Image',
        prominence: 95,
        isHero: true,
        isLogo: false,
        socialMediaReady: true
      });
    }
    
    // Logo
    const logoSelectors = [
      '.logo img', 
      'header img', 
      'img.logo', 
      'img[alt*="logo"]',
      'a[href="/"] img'
    ];
    
    for (const selector of logoSelectors) {
      const logoImg = $(selector).first();
      const logoSrc = logoImg.attr('src');
      
      if (logoSrc && !seenUrls.has(makeAbsoluteUrl(logoSrc, baseUrl))) {
        const absoluteUrl = makeAbsoluteUrl(logoSrc, baseUrl);
        seenUrls.add(absoluteUrl);
        
        images.push({
          url: absoluteUrl,
          alt: logoImg.attr('alt') || 'Logo',
          prominence: 90,
          isHero: false,
          isLogo: true,
          socialMediaReady: false // Loga obvykle nejsou ideální pro sociální sítě
        });
        
        break; // Stačí najít jedno logo
      }
    }
    
    // Hero image
    const heroSelectors = [
      '.hero img', 
      '.banner img', 
      '.header-image img', 
      '.hero-image', 
      '.jumbotron img',
      'section:first-child img'
    ];
    
    for (const selector of heroSelectors) {
      const heroImg = $(selector).first();
      const heroSrc = heroImg.attr('src');
      
      if (heroSrc && !seenUrls.has(makeAbsoluteUrl(heroSrc, baseUrl))) {
        const absoluteUrl = makeAbsoluteUrl(heroSrc, baseUrl);
        seenUrls.add(absoluteUrl);
        
        images.push({
          url: absoluteUrl,
          alt: heroImg.attr('alt') || 'Hero Image',
          title: heroImg.attr('title'),
          prominence: 85,
          isHero: true,
          isLogo: false,
          socialMediaReady: true
        });
        
        break; // Stačí jeden hero image
      }
    }
    
    // Všechny další obrázky s analýzou
    $('img').each((_, element) => {
      const img = $(element);
      const src = img.attr('src');
      
      if (!src || src.includes('data:image') || seenUrls.has(makeAbsoluteUrl(src, baseUrl))) {
        return;
      }
      
      const absoluteUrl = makeAbsoluteUrl(src, baseUrl);
      seenUrls.add(absoluteUrl);
      
      // Analýza pozice a důležitosti obrázku
      const alt = img.attr('alt') || '';
      const title = img.attr('title');
      const width = parseInt(img.attr('width') || '0', 10);
      const height = parseInt(img.attr('height') || '0', 10);
      
      // Prominence score based on various factors
      let prominence = 0;
      
      // Velikost obrázku (pouze pokud je specifikována)
      if (width > 0 && height > 0) {
        const size = width * height;
        prominence += Math.min(size / 10000, 40); // Max 40 bodů za velikost
      }
      
      // Pozice v dokumentu (obrázky výše jsou důležitější)
      const parents = img.parents().length;
      prominence += Math.max(0, 20 - parents); // Max 20 bodů za pozici
      
      // Alt text a title (důležité pro SEO a přístupnost)
      if (alt && alt.length > 3) prominence += 10;
      if (title && title.length > 3) prominence += 5;
      
      // Obrázek je v článku nebo produktu
      if (img.parents('article, .product, .product-item, .blog-post').length > 0) {
        prominence += 15;
      }
      
      // Aspekt ratio vhodné pro sociální sítě (blízko 1.91:1 pro Facebook/Twitter)
      const aspectRatio = width && height ? width / height : null;
      const socialMediaReady = aspectRatio
        ? (aspectRatio > 1.8 && aspectRatio < 2.1)
        : false;
      
      if (socialMediaReady) prominence += 10;
      
      // Vytvoření objektu obrázku
      images.push({
        url: absoluteUrl,
        alt,
        title,
        width: width || undefined,
        height: height || undefined,
        prominence,
        isHero: false,
        isLogo: alt.toLowerCase().includes('logo'),
        aspectRatio,
        socialMediaReady
      });
    });
    
    // Seřazení obrázků podle důležitosti
    return images
      .sort((a, b) => b.prominence - a.prominence)
      .slice(0, 20); // Omezení na 20 nejdůležitějších obrázků
  }
  
  /**
   * Extrahuje kontaktní informace ze stránky
   */
  private extractContactInfo($: cheerio.CheerioAPI, baseUrl: string): ContactInfo {
    const contactInfo: ContactInfo = {
      socialLinks: []
    };
    
    // Email
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const emailSelectors = [
      'a[href^="mailto:"]',
      '.email',
      '.contact-email',
      '.contact a',
      'footer a'
    ];
    
    for (const selector of emailSelectors) {
      const emailElements = $(selector);
      
      emailElements.each((_, element) => {
        const el = $(element);
        const href = el.attr('href');
        const text = el.text().trim();
        
        // Check href attribute for mailto
        if (href && href.startsWith('mailto:')) {
          contactInfo.email = href.replace('mailto:', '').trim();
          return false; // break each loop
        }
        
        // Check text content for email pattern
        if (emailRegex.test(text)) {
          const matches = text.match(emailRegex);
          if (matches && matches.length > 0) {
            contactInfo.email = matches[0];
          }
          return false; // break each loop
        }
      });
      
      if (contactInfo.email) break;
    }
    
    // Phone
    const phoneRegex = /(\+\d{1,3}\s?)?(\(?\d{3}\)?[\s.-]?)?[\d\s.-]{7,}/;
    const phoneSelectors = [
      'a[href^="tel:"]',
      '.phone',
      '.contact-phone',
      '.contact'
    ];
    
    for (const selector of phoneSelectors) {
      const phoneElements = $(selector);
      
      phoneElements.each((_, element) => {
        const el = $(element);
        const href = el.attr('href');
        const text = el.text().trim();
        
        // Check href attribute for tel:
        if (href && href.startsWith('tel:')) {
          contactInfo.phone = href.replace('tel:', '').trim();
          return false; // break each loop
        }
        
        // Check text content for phone pattern
        if (phoneRegex.test(text)) {
          const matches = text.match(phoneRegex);
          if (matches && matches.length > 0) {
            contactInfo.phone = matches[0].trim();
          }
          return false; // break each loop
        }
      });
      
      if (contactInfo.phone) break;
    }
    
    // Address
    const addressSelectors = [
      'address',
      '.address',
      '.contact-address',
      'footer .address',
      '.contact-info address',
      '.contact p',
      '.location'
    ];
    
    for (const selector of addressSelectors) {
      const addressEl = $(selector).first();
      if (addressEl.length > 0) {
        contactInfo.address = addressEl.text().replace(/\s+/g, ' ').trim();
        break;
      }
    }
    
    return contactInfo;
  }
  
  /**
   * Extrahuje odkazy na sociální sítě
   */
  private extractSocialLinks($: cheerio.CheerioAPI, baseUrl: string): SocialLink[] {
    const socialLinks: SocialLink[] = [];
    
    // Seznam srovnávacích URL chunků pro hledání sociálních sítí
    const socialPlatforms = [
      { platform: 'facebook', patterns: ['facebook.com', 'fb.com', 'fb.me'] },
      { platform: 'instagram', patterns: ['instagram.com', 'instagr.am'] },
      { platform: 'twitter', patterns: ['twitter.com', 'x.com', 't.co'] },
      { platform: 'linkedin', patterns: ['linkedin.com', 'lnkd.in'] },
      { platform: 'pinterest', patterns: ['pinterest.com', 'pin.it'] },
      { platform: 'youtube', patterns: ['youtube.com', 'youtu.be'] },
      { platform: 'tiktok', patterns: ['tiktok.com', 'vm.tiktok.com'] }
    ] as const;
    
    // Selektory, kde se často vyskytují odkazy na sociální sítě
    const socialSelectors = [
      '.social a', 
      '.social-links a', 
      '.social-media a', 
      'footer a', 
      '.footer-social a',
      'header .social a',
      '.follow-us a'
    ];
    
    // Procházení všech selektorů
    for (const selector of socialSelectors) {
      $(selector).each((_, element) => {
        const link = $(element);
        const href = link.attr('href');
        
        if (!href) return;
        
        // Zkontrolujeme, zda odkaz pasuje na nějakou sociální síť
        for (const { platform, patterns } of socialPlatforms) {
          if (patterns.some(pattern => href.includes(pattern))) {
            // Kontrola, zda už tento odkaz máme
            const exists = socialLinks.some(sl => sl.platform === platform);
            if (!exists) {
              socialLinks.push({
                platform,
                url: href.startsWith('http') ? href : makeAbsoluteUrl(href, baseUrl)
              });
            }
            break;
          }
        }
      });
    }
    
    return socialLinks;
  }
  
  /**
   * Extrahuje produkty z e-shopu
   */
  private async extractProducts(
    $: cheerio.CheerioAPI, 
    baseUrl: string,
    options: Required<ScraperOptions>
  ): Promise<Product[]> {
    const products: Product[] = [];
    
    // Strukturovaná data produktů (JSON-LD)
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonData = JSON.parse($(element).html() || '{}');
        
        // Zpracování schématu produktu
        if (jsonData['@type'] === 'Product' || 
            (Array.isArray(jsonData['@graph']) && 
             jsonData['@graph'].some((item: any) => item['@type'] === 'Product'))) {
          
          const productData = jsonData['@type'] === 'Product' 
            ? jsonData 
            : jsonData['@graph'].find((item: any) => item['@type'] === 'Product');
          
          if (productData) {
            const name = productData.name || '';
            if (!name) return; // Přeskočit produkty bez názvu
            
            // Zpracování ceny
            let price = '';
            let currency = '';
            let originalPrice = '';
            
            if (productData.offers) {
              const offers = Array.isArray(productData.offers) 
                ? productData.offers[0] 
                : productData.offers;
              
              price = offers.price || '';
              currency = offers.priceCurrency || '';
              
              // Pokud je nastavena akční cena, předpokládáme že původní je v poli výhodných cen
              if (Array.isArray(productData.offers) && productData.offers.length > 1) {
                originalPrice = productData.offers[1].price || '';
              }
            }
            
            // Získání hlavního obrázku
            let image = '';
            if (productData.image) {
              image = Array.isArray(productData.image) 
                ? productData.image[0] 
                : productData.image;
            }
            
            // Kontrola, zda je produkt nový
            const isNew = options.previousScrape?.products.every(p => p.name !== name) || false;
            
            // Vytvoření objektu produktu
            products.push({
              name,
              description: productData.description || '',
              price: price ? `${price}` : '',
              originalPrice: originalPrice ? `${originalPrice}` : '',
              currency,
              image: image ? makeAbsoluteUrl(image, baseUrl) : '',
              url: productData.url ? makeAbsoluteUrl(productData.url, baseUrl) : baseUrl,
              sku: productData.sku || productData.productID || '',
              brand: productData.brand?.name || '',
              availability: productData.offers?.availability || '',
              category: [],
              isNew,
              isOnSale: Boolean(originalPrice && price && Number(originalPrice) > Number(price)),
              rating: productData.aggregateRating?.ratingValue || 0,
              reviewCount: productData.aggregateRating?.reviewCount || 0,
              socialScore: 0 // Bude doplněno později
            });
          }
        }
      } catch (error) {
        webLog('Chyba při parsování JSON-LD produktu', { error });
      }
    });
    
    // HTML selektory pro různé formáty produktů
    const productSelectors = [
      '.product',
      '.product-item',
      '.product-card',
      '.product-box',
      '[itemtype*="Product"]',
      '.woocommerce-product-gallery', // WooCommerce
      '.single-product', // další WooCommerce
      '.shoptet-product', // Shoptet
      '.p-block' // Český systém Webareal
    ];
    
    // Procházení selektorů
    for (const selector of productSelectors) {
      $(selector).each((_, element) => {
        const productElement = $(element);
        const nameElement = productElement.find('.product-name, .product-title, h2, h3, .name').first();
        const name = nameElement.text().trim();
        
        if (!name) return;
        
        // Kontrola, zda už tento produkt nemáme
        if (products.some(p => p.name === name)) return;
        
        // Hledání URL
        let url = '';
        const linkElement = nameElement.is('a') ? nameElement : productElement.find('a').first();
        if (linkElement.length > 0) {
          url = makeAbsoluteUrl(linkElement.attr('href') || '', baseUrl);
        }
        
        // Hledání ceny
        let price = '';
        let originalPrice = '';
        let isOnSale = false;
        
        const priceElement = productElement.find('.price, .product-price, .actual-price, .current-price');
        if (priceElement.length > 0) {
          // Kontrola, zda existuje prvek s původní cenou
          const oldPriceElement = priceElement.find('.old-price, .original-price, del, .price-before-discount');
          if (oldPriceElement.length > 0) {
            originalPrice = oldPriceElement.text().trim()
              .replace(/[^\d,.]/g, '') // Ponechá jen čísla, čárky a tečky
              .trim();
            isOnSale = true;
          }
          
          // Aktuální cena
          let priceText = priceElement.text().trim();
          
          // Pokud existuje původní cena, musíme ji odstranit z textu ceny
          if (originalPrice && priceText.includes(originalPrice)) {
            priceText = priceText.replace(originalPrice, '').trim();
          }
          
          // Vyčištění textu ceny
          price = priceText
            .replace(/[^\d,.]/g, '') // Ponechá jen čísla, čárky a tečky
            .trim();
          
          // Pokud máme původní cenu, ale nemáme aktuální, prohodíme je
          if (originalPrice && !price) {
            price = originalPrice;
            originalPrice = '';
            isOnSale = false;
          }
        }
        
        // Hledání obrázku
        let image = '';
        const imgElement = productElement.find('img').first();
        if (imgElement.length > 0) {
          const imgSrc = imgElement.attr('src') || imgElement.attr('data-src');
          if (imgSrc) {
            image = makeAbsoluteUrl(imgSrc, baseUrl);
          }
        }
        
        // Hledání popisu
        let description = '';
        const descriptionElement = productElement.find('.description, .product-description, .short-description');
        if (descriptionElement.length > 0) {
          description = descriptionElement.text().trim();
        }
        
        // Kontrola, zda je produkt nový
        const isNew = options.previousScrape?.products.every(p => p.name !== name) || false;
        
        // Určení slevy
        let discountPercentage: number | undefined;
        if (originalPrice && price) {
          const priceNum = parseFloat(price.replace(',', '.'));
          const originalPriceNum = parseFloat(originalPrice.replace(',', '.'));
          
          if (!isNaN(priceNum) && !isNaN(originalPriceNum) && originalPriceNum > priceNum) {
            discountPercentage = Math.round((1 - priceNum / originalPriceNum) * 100);
          }
        }
        
        // Přidání produktu
        products.push({
          name,
          description,
          price,
          originalPrice,
          image,
          url: url || baseUrl,
          isNew,
          isOnSale,
          discountPercentage,
          socialScore: 0 // Bude doplněno později
        });
      });
    }
    
    // Výpočet social score pro produkty
    return products.map(product => ({
      ...product,
      socialScore: this.calculateProductSocialScore(product)
    }));
  }
  
  /**
   * Vypočítá sociální skóre produktu
   */
  private calculateProductSocialScore(product: Product): number {
    let score = 0;
    
    // Základní body
    score += 50;
    
    // Body za různé vlastnosti
    if (product.isNew) score += 25;
    if (product.isOnSale) score += 20;
    if (product.discountPercentage && product.discountPercentage > 20) score += 15;
    if (product.image) score += 15;
    if (product.description && product.description.length > 50) score += 10;
    if (product.rating && product.rating > 4) score += 10;
    if (product.reviewCount && product.reviewCount > 10) score += 5;
    
    // Omezení na 0-100
    return Math.min(100, Math.max(0, score));
  }
  
  /**
   * Extrahuje blogové příspěvky
   */
  private async extractBlogPosts(
    $: cheerio.CheerioAPI, 
    baseUrl: string,
    options: Required<ScraperOptions>
  ): Promise<BlogPost[]> {
    const blogPosts: BlogPost[] = [];
    
    // Strukturovaná data článků (JSON-LD)
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const jsonData = JSON.parse($(element).html() || '{}');
        
        // Zpracování schématu článku
        if ((jsonData['@type'] === 'BlogPosting' || jsonData['@type'] === 'Article') || 
            (Array.isArray(jsonData['@graph']) && 
             jsonData['@graph'].some((item: any) => 
               item['@type'] === 'BlogPosting' || item['@type'] === 'Article'
             ))) {
          
          const articleData = (jsonData['@type'] === 'BlogPosting' || jsonData['@type'] === 'Article')
            ? jsonData 
            : jsonData['@graph'].find((item: any) => 
                item['@type'] === 'BlogPosting' || item['@type'] === 'Article'
              );
          
          if (articleData) {
            const title = articleData.headline || articleData.title || '';
            if (!title) return; // Přeskočit články bez titulku
            
            // Datum
            let date: Date | undefined;
            if (articleData.datePublished) {
              date = new Date(articleData.datePublished);
            }
            
            // Autor
            let author = '';
            if (articleData.author) {
              author = typeof articleData.author === 'string' 
                ? articleData.author 
                : articleData.author.name || '';
            }
            
            // Obrázek
            let image = '';
            if (articleData.image) {
              image = Array.isArray(articleData.image) 
                ? articleData.image[0] 
                : typeof articleData.image === 'string'
                  ? articleData.image
                  : articleData.image.url || '';
            }
            
            // Kontrola, zda je příspěvek nový
            const isNew = options.previousScrape?.blogPosts.every(p => p.title !== title) || false;
            
            // Přidání blogového příspěvku
            blogPosts.push({
              title,
              url: articleData.url ? makeAbsoluteUrl(articleData.url, baseUrl) : baseUrl,
              date,
              excerpt: articleData.description || '',
              content: articleData.articleBody || '',
              author,
              image: image ? makeAbsoluteUrl(image, baseUrl) : '',
              isNew,
              tags: [],
              socialScore: 0 // Bude doplněno později
            });
          }
        }
      } catch (error) {
        webLog('Chyba při parsování JSON-LD článku', { error });
      }
    });
    
    // HTML selektory pro různé formáty blogových příspěvků
    const blogPostSelectors = [
      'article',
      '.post',
      '.blog-post',
      '.article',
      '.entry',
      '.blog-entry',
      '[itemtype*="BlogPosting"]',
      '[itemtype*="Article"]'
    ];
    
    // Procházení selektorů
    for (const selector of blogPostSelectors) {
      $(selector).each((_, element) => {
        const postElement = $(element);
        const titleElement = postElement.find('h1, h2, .post-title, .entry-title, .title').first();
        const title = titleElement.text().trim();
        
        if (!title) return;
        
        // Kontrola, zda už tento příspěvek nemáme
        if (blogPosts.some(p => p.title === title)) return;
        
        // Hledání URL
        let url = '';
        const linkElement = titleElement.is('a') ? titleElement : postElement.find('a').first();
        if (linkElement.length > 0) {
          url = makeAbsoluteUrl(linkElement.attr('href') || '', baseUrl);
        }
        
        // Hledání datumu
        let date: Date | undefined;
        const dateElement = postElement.find('time, .date, .published, .entry-date, .post-date');
        if (dateElement.length > 0) {
          const dateString = dateElement.attr('datetime') || dateElement.text().trim();
          try {
            date = new Date(dateString);
            if (isNaN(date.getTime())) date = undefined;
          } catch {
            date = undefined;
          }
        }
        
        // Hledání autora
        let author = '';
        const authorElement = postElement.find('.author, .entry-author, .post-author');
        if (authorElement.length > 0) {
          author = authorElement.text().trim()
            .replace(/^by\s+/i, '') // Odstranění "by" nebo "od"
            .replace(/^od\s+/i, '');
        }
        
        // Hledání obrázku
        let image = '';
        const imgElement = postElement.find('img').first();
        if (imgElement.length > 0) {
          const imgSrc = imgElement.attr('src') || imgElement.attr('data-src');
          if (imgSrc) {
            image = makeAbsoluteUrl(imgSrc, baseUrl);
          }
        }
        
        // Hledání excerptů
        let excerpt = '';
        const excerptElement = postElement.find('.excerpt, .entry-summary, .post-excerpt, .summary');
        if (excerptElement.length > 0) {
          excerpt = excerptElement.text().trim();
        } else {
          // Pokud nemáme excerpt, vezmeme první paragraf
          const firstP = postElement.find('p').first();
          if (firstP.length > 0) {
            excerpt = firstP.text().trim().substring(0, 150) + '...';
          }
        }
        
        // Hledání kategorií a tagů
        const categories: string[] = [];
        const tagElements = postElement.find('.tags a, .categories a, .post-categories a, .entry-categories a');
        tagElements.each((_, el) => {
          const tag = $(el).text().trim();
          if (tag) categories.push(tag);
        });
        
        // Kontrola, zda je příspěvek nový
        const isNew = options.previousScrape?.blogPosts.every(p => p.title !== title) || false;
        
        // Přidání blogového příspěvku
        blogPosts.push({
          title,
          url: url || baseUrl,
          date,
          excerpt: excerpt || title,
          author,
          categories,
          image,
          isNew,
          readingTime: excerpt ? Math.ceil(excerpt.split(' ').length / 200) : 1, // ~200 slov za minutu
          socialScore: 0 // Bude doplněno později
        });
      });
    }
    
    // Výpočet social score pro blogové příspěvky
    return blogPosts.map(post => ({
      ...post,
      socialScore: this.calculateBlogPostSocialScore(post)
    }));
  }
  
  /**
   * Vypočítá sociální skóre blogového příspěvku
   */
  private calculateBlogPostSocialScore(post: BlogPost): number {
    let score = 0;
    
    // Základní body
    score += 50;
    
    // Body za různé vlastnosti
    if (post.isNew) score += 30;
    if (post.image) score += 20;
    if (post.excerpt && post.excerpt.length > 50) score += 15;
    if (post.author) score += 5;
    if (post.date && (new Date().getTime() - post.date.getTime()) < 7 * 24 * 60 * 60 * 1000) {
      // Extra body za příspěvky mladší než týden
      score += 20;
    }
    
    // Omezení na 0-100
    return Math.min(100, Math.max(0, score));
  }
  
  /**
   * Extrahuje obsah vhodný pro sdílení na sociálních sítích
   */
  private extractSocialShareableContent(
    $: cheerio.CheerioAPI, 
    content: EnhancedScrapedContent,
    baseUrl: string
  ): SocialShareable[] {
    const shareables: SocialShareable[] = [];
    
    // 1. Vytvoření sdílitelného obsahu z blogu
    content.blogPosts
      .filter(post => post.socialScore > 60) // Jen ty s vysokým skóre
      .slice(0, 5) // Max 5 příspěvků
      .forEach(post => {
        shareables.push({
          type: 'blogPost',
          content: post.title,
          image: post.image,
          url: post.url,
          prominence: post.socialScore,
          socialNetworks: ['facebook', 'twitter', 'linkedin'] // Vhodné pro tyto sítě
        });
      });
    
    // 2. Vytvoření sdílitelného obsahu z produktů
    content.products
      .filter(product => product.socialScore > 60) // Jen ty s vysokým skóre
      .slice(0, 5) // Max 5 produktů
      .forEach(product => {
        shareables.push({
          type: 'product',
          content: `${product.name}${product.price ? ' - ' + product.price : ''}`,
          image: product.image,
          url: product.url,
          prominence: product.socialScore,
          socialNetworks: ['facebook', 'instagram', 'pinterest'] // Vhodné pro tyto sítě
        });
      });
    
    // 3. Citáty z textu
    const quotations = this.extractQuotations($, content.mainText);
    quotations.forEach(quote => {
      shareables.push({
        type: 'quote',
        content: quote,
        prominence: 70,
        socialNetworks: ['twitter', 'facebook', 'instagram'] // Vhodné pro tyto sítě
      });
    });
    
    // 4. Statistiky
    const stats = this.extractStats($, content.mainText);
    stats.forEach(stat => {
      shareables.push({
        type: 'stat',
        content: stat,
        prominence: 75,
        socialNetworks: ['twitter', 'linkedin', 'facebook'] // Vhodné pro tyto sítě
      });
    });
    
    // 5. Tipy
    const tips = this.extractTips($, content.mainText);
    tips.forEach(tip => {
      shareables.push({
        type: 'tip',
        content: tip,
        prominence: 65,
        socialNetworks: ['twitter', 'facebook', 'instagram'] // Vhodné pro tyto sítě
      });
    });
    
    // Řazení podle prominence
    return shareables.sort((a, b) => b.prominence - a.prominence);
  }
  
  /**
   * Extrahuje citáty z textu
   */
  private extractQuotations($: cheerio.CheerioAPI, text: string): string[] {
    const quotes: string[] = [];
    
    // Hledání HTML blockquote elementů
    $('blockquote, q, .quote, .testimonial, .review-text').each((_, element) => {
      const quote = $(element).text().trim().replace(/\s+/g, ' ');
      if (quote && quote.length > 10 && quote.length < 280) {
        quotes.push(quote);
      }
    });
    
    // Hledání uvozovkových citací v textu
    const quoteRegex = /"([^"]{10,280})"/g;
    const matches = text.match(quoteRegex);
    
    if (matches) {
      matches.forEach(match => {
        const quote = match.replace(/"/g, '').trim();
        if (quote.length > 10 && !quotes.includes(quote)) {
          quotes.push(quote);
        }
      });
    }
    
    return quotes.slice(0, 5); // Vrátíme max 5 citátů
  }
  
  /**
   * Extrahuje statistiky z textu
   */
  private extractStats($: cheerio.CheerioAPI, text: string): string[] {
    const stats: string[] = [];
    
    // Hledání statistik v textu pomocí regulárních výrazů
    const statRegexes = [
      /\d+(\.\d+)?%/g, // procenta
      /\d+ (z|ze|of) \d+/g, // X z Y
      /(více než|více jak|přes|over|more than) \d+/g // více než X
    ];
    
    statRegexes.forEach(regex => {
      const matches = text.match(regex);
      if (matches) {
        // Pro každý match najdeme celou větu
        matches.forEach(match => {
          const index = text.indexOf(match);
          if (index !== -1) {
            // Hledáme začátek a konec věty
            let start = text.lastIndexOf('.', index);
            start = start === -1 ? 0 : start + 1;
            
            let end = text.indexOf('.', index + match.length);
            end = end === -1 ? text.length : end + 1;
            
            const sentence = text.substring(start, end).trim();
            if (sentence && sentence.length > 10 && sentence.length < 280) {
              stats.push(sentence);
            }
          }
        });
      }
    });
    
    return [...new Set(stats)].slice(0, 3); // Odstranění duplicit a max 3 statistiky
  }
  
  /**
   * Extrahuje tipy z textu
   */
  private extractTips($: cheerio.CheerioAPI, text: string): string[] {
    const tips: string[] = [];
    
    // Hledání seznamů (li elementů) a nadpisů (h3, h4)
    $('li, h3, h4').each((_, element) => {
      const el = $(element);
      const content = el.text().trim();
      
      // Filtrování obsahů, které vypadají jako tipy
      if (content && content.length > 10 && content.length < 280 &&
          (content.toLowerCase().includes('tip') || 
           content.toLowerCase().includes('rada') || 
           content.toLowerCase().includes('doporučení') ||
           (el.parent('ul, ol').length > 0 && el.parent().prev('h2, h3, h4').text().toLowerCase().includes('tip')))) {
        
        tips.push(content);
      }
    });
    
    return tips.slice(0, 5); // Vrátíme max 5 tipů
  }
  
  /**
   * Vypočítá celkové skóre stránky
   */
  private calculatePageScore(content: EnhancedScrapedContent): PageScore {
    // Skóre kvality obsahu
    let contentQualityScore = 0;
    if (content.title) contentQualityScore += 10;
    if (content.description) contentQualityScore += 10;
    if (content.mainText.length > 500) contentQualityScore += 20;
    if (content.keywords.length > 5) contentQualityScore += 10;
    
    // Blogové příspěvky a produkty zvyšují skóre
    contentQualityScore += Math.min(30, content.blogPosts.length * 5);
    contentQualityScore += Math.min(30, content.products.length * 5);
    
    // Omezení na 0-100
    contentQualityScore = Math.min(100, contentQualityScore);
    
    // Skóre vizuální přitažlivosti
    let visualAppealScore = 0;
    if (content.images.length > 0) {
      // Body podle počtu obrázků
      visualAppealScore += Math.min(50, content.images.length * 10);
      
      // Body za kvalitní obrázky
      const qualityImages = content.images.filter(img => img.prominence > 70).length;
      visualAppealScore += Math.min(50, qualityImages * 15);
    }
    
    // Omezení na 0-100
    visualAppealScore = Math.min(100, visualAppealScore);
    
    // Skóre vhodnosti pro sdílení
    let shareabilityScore = 0;
    if (content.socialShareable.length > 0) {
      // Body podle počtu sdílitelných obsahů
      shareabilityScore += Math.min(50, content.socialShareable.length * 10);
      
      // Body za kvalitní sdílitelné obsahy
      const qualityShareables = content.socialShareable.filter(item => item.prominence > 70).length;
      shareabilityScore += Math.min(50, qualityShareables * 15);
    }
    
    // Omezení na 0-100
    shareabilityScore = Math.min(100, shareabilityScore);
    
    // SEO skóre
    let seoScore = 0;
    if (content.title) seoScore += 20;
    if (content.description) seoScore += 20;
    if (content.images.some(img => img.alt)) seoScore += 15;
    if (content.keywords.length > 5) seoScore += 15;
    if (content.socialLinks.length > 0) seoScore += 15;
    if (content.mainText.length > 1000) seoScore += 15;
    
    // Omezení na 0-100
    seoScore = Math.min(100, seoScore);
    
    // Celkové skóre - průměr všech 4 metrik
    const overall = Math.round((contentQualityScore + visualAppealScore + shareabilityScore + seoScore) / 4);
    
    return {
      overall,
      contentQuality: contentQualityScore,
      visualAppeal: visualAppealScore,
      socialShareability: shareabilityScore,
      seoScore
    };
  }
  
  /**
   * Detekuje změny oproti předchozímu scrapování
   */
  private detectChanges(
    current: EnhancedScrapedContent, 
    previous: EnhancedScrapedContent
  ): ContentChange[] {
    const changes: ContentChange[] = [];
    
    // 1. Kontrola nových produktů
    current.products
      .filter(product => product.isNew)
      .forEach(product => {
        changes.push({
          type: 'new',
          elementType: 'product',
          id: product.url,
          title: product.name,
          changeDescription: `Nový produkt: ${product.name}`,
          socialPriority: product.isOnSale ? 90 : 80
        });
      });
    
    // 2. Kontrola nových blogových příspěvků
    current.blogPosts
      .filter(post => post.isNew)
      .forEach(post => {
        changes.push({
          type: 'new',
          elementType: 'blogPost',
          id: post.url,
          title: post.title,
          changeDescription: `Nový článek: ${post.title}`,
          socialPriority: 85
        });
      });
    
    // 3. Kontrola změny popisu stránky
    if (previous.description !== current.description) {
      changes.push({
        type: 'updated',
        elementType: 'page',
        id: current.url,
        title: 'Změna popisu webu',
        changeDescription: 'Popis webu byl aktualizován',
        socialPriority: 40
      });
    }
    
    // 4. Kontrola nových obrázků
    const previousImageUrls = previous.images.map(img => img.url);
    const newImages = current.images
      .filter(img => !previousImageUrls.includes(img.url) && img.prominence > 70);
    
    newImages.forEach(img => {
      changes.push({
        type: 'new',
        elementType: 'image',
        id: img.url,
        title: img.alt || 'Nový obrázek',
        changeDescription: `Nový obrázek: ${img.alt || ''}`,
        socialPriority: img.isHero ? 75 : 50
      });
    });
    
    // Řazení podle priority
    return changes.sort((a, b) => b.socialPriority - a.socialPriority);
  }
  
  /**
   * Rozhoduje, zda zpracovat danou oblast podle typu webu a nastavení
   */
  private shouldProcessArea(
    area: string,
    focusAreas: string[],
    websiteType: WebsiteType
  ): boolean {
    // Pokud je specifikováno "all", zpracujeme vše
    if (focusAreas.includes('all')) return true;
    
    // Pokud je tato oblast explicitně vybrána
    if (focusAreas.includes(area)) return true;
    
    // Pokud je web typu "e-shop", vždy zpracujeme produkty
    if (area === 'products' && websiteType === 'e-shop') return true;
    
    // Pokud je web typu "blog", vždy zpracujeme blogové příspěvky
    if (area === 'blog' && websiteType === 'blog') return true;
    
    return false;
  }
}

export default EnhancedWebScraperService.getInstance;