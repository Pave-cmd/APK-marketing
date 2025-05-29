import axios from 'axios';
import * as cheerio from 'cheerio';
import { webLog } from '../utils/logger';
import { normalizeUrl } from '../utils/urlUtils';
import { WebsiteScraperService, ScrapedContent } from './websiteScraperService';
import { JSDOM } from 'jsdom';
import { URL } from 'url';
import { Readability } from '@mozilla/readability';

/**
 * Rozšířený výsledek scrapingu webu
 */
export interface AdvancedScrapedContent extends ScrapedContent {
  websiteType: 'e-shop' | 'blog' | 'company' | 'news' | 'portfolio' | 'other';
  sections: WebsiteSection[];
  blogPosts: BlogPost[];
  products: Product[];
  lastScrapedAt: Date;
  language: string;
  contactInfo: ContactInfo;
  pageLinks: { url: string; title: string; type: 'internal' | 'external' }[];
  internalLinks: string[];
}

/**
 * Sekce webu
 */
export interface WebsiteSection {
  title: string;
  content: string;
  importance: number;
  images: string[];
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
  image?: string;
  isNew?: boolean;
}

/**
 * Produkt
 */
export interface Product {
  name: string;
  description?: string;
  price?: string;
  currency?: string;
  image?: string;
  url: string;
  sku?: string;
  availability?: string;
  category?: string;
  isNew?: boolean;
  isOnSale?: boolean;
  rating?: number;
}

/**
 * Kontaktní informace
 */
export interface ContactInfo {
  email?: string;
  phone?: string;
  address?: string;
  socialLinks: { platform: string; url: string }[];
}

/**
 * Pokročilá služba pro scraping webů
 */
export class AdvancedWebsiteScraperService {
  private static instance: AdvancedWebsiteScraperService;
  private readonly maxPagesToVisit = 10;
  private readonly maxProductsToScrape = 20;
  private readonly maxBlogPostsToScrape = 10;
  private readonly crawlDelay = 1000; // 1 sekunda mezi požadavky
  
  private visitedUrls: Set<string> = new Set();
  private baseUrl: string = '';
  private domainName: string = '';

  private constructor() {}

  public static getInstance(): AdvancedWebsiteScraperService {
    if (!AdvancedWebsiteScraperService.instance) {
      AdvancedWebsiteScraperService.instance = new AdvancedWebsiteScraperService();
    }
    return AdvancedWebsiteScraperService.instance;
  }

  /**
   * Provede pokročilý scraping webu včetně podstránek
   */
  public async scrapeWebsiteAdvanced(url: string): Promise<AdvancedScrapedContent> {
    try {
      this.visitedUrls.clear();
      webLog(`Začínám pokročilé skenování webu: ${url}`, { url });
      
      // Normalizace URL
      const normalizedUrl = normalizeUrl(url);
      this.baseUrl = normalizedUrl;
      
      try {
        this.domainName = new URL(normalizedUrl).hostname;
      } catch {
        this.domainName = '';
      }
      
      // Nejprve naskenujeme hlavní stránku
      const basicScraper = WebsiteScraperService.getInstance();
      const basicContent = await basicScraper.scrapeWebsite(normalizedUrl);
      
      webLog('Základní scraping dokončen, pokračuji s rozšířenou analýzou', { url: normalizedUrl });
      
      // Inicializace pokročilého výsledku
      const result: AdvancedScrapedContent = {
        ...basicContent,
        websiteType: await this.detectWebsiteType(normalizedUrl, basicContent),
        sections: [],
        blogPosts: [],
        products: [],
        lastScrapedAt: new Date(),
        language: await this.detectLanguage(basicContent),
        contactInfo: await this.extractContactInfo(normalizedUrl),
        pageLinks: [],
        internalLinks: []
      };
      
      // Přidáme hlavní URL do navštívených
      this.visitedUrls.add(normalizedUrl);
      
      // Získáme odkazy z hlavní stránky
      const links = await this.extractLinks(normalizedUrl);
      result.pageLinks = links;
      result.internalLinks = links
        .filter(link => link.type === 'internal')
        .map(link => link.url);
      
      // Na základě typu webu provádíme různé typy scrapingu
      switch (result.websiteType) {
        case 'e-shop':
          await this.scrapeEcommerce(result);
          break;
        case 'blog':
          await this.scrapeBlog(result);
          break;
        case 'news':
          await this.scrapeNews(result);
          break;
        case 'company':
          await this.scrapeCompany(result);
          break;
        default:
          await this.scrapeGeneric(result);
      }
      
      // Extrahujeme hlavní sekce webu
      result.sections = await this.extractSections(normalizedUrl);
      
      webLog(`Pokročilé skenování webu dokončeno: ${url}`, { 
        websiteType: result.websiteType,
        productCount: result.products.length,
        blogPostCount: result.blogPosts.length,
        sectionsCount: result.sections.length,
        internalLinksCount: result.internalLinks.length
      });
      
      return result;
    } catch (error) {
      webLog(`Chyba při pokročilém skenování webu ${url}:`, { error });
      throw new Error(`Nepodařilo se naskenovat web: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }
  
  /**
   * Detekuje typ webu
   */
  private async detectWebsiteType(url: string, content: ScrapedContent): Promise<'e-shop' | 'blog' | 'company' | 'news' | 'portfolio' | 'other'> {
    // Kontrola přítomnosti typických produktových vlastností
    if (content.products && content.products.length > 0) {
      return 'e-shop';
    }
    
    try {
      const $ = await this.fetchAndLoad(url);
      
      // Kontrola klíčových elementů pro e-shop
      const hasCart = Boolean(
        $('.cart').length ||
        $('[class*="cart"]').length ||
        $('[id*="cart"]').length ||
        $('*:contains("košík")').length ||
        $('*:contains("cart")').length
      );
      
      const hasProducts = Boolean(
        $('.product').length ||
        $('[class*="product"]').length ||
        $('[itemtype*="Product"]').length ||
        $('*:contains("produkt")').length
      );
      
      if (hasCart && hasProducts) {
        return 'e-shop';
      }
      
      // Kontrola pro blog
      const hasBlogElements = Boolean(
        $('article').length ||
        $('.post').length ||
        $('[class*="blog"]').length ||
        $('[class*="article"]').length ||
        $('.entry').length
      );
      
      const hasDates = $('time').length > 0 || $('[datetime]').length > 0;
      
      if (hasBlogElements && hasDates) {
        return 'blog';
      }
      
      // Kontrola pro zpravodajský web
      const hasNewsElements = Boolean(
        $('.news').length ||
        $('[class*="news"]').length ||
        $('*:contains("zprávy")').length ||
        $('*:contains("aktuality")').length
      );
      
      if (hasNewsElements) {
        return 'news';
      }
      
      // Kontrola pro firemní web
      const hasCompanyElements = Boolean(
        $('*:contains("o nás")').length ||
        $('*:contains("o společnosti")').length ||
        $('*:contains("about us")').length ||
        $('.team').length ||
        $('[class*="service"]').length
      );
      
      if (hasCompanyElements) {
        return 'company';
      }
      
      // Kontrola pro portfolio
      const hasPortfolioElements = Boolean(
        $('.portfolio').length ||
        $('[class*="portfolio"]').length ||
        $('[class*="project"]').length ||
        $('.gallery').length
      );
      
      if (hasPortfolioElements) {
        return 'portfolio';
      }
      
      // Výchozí typ
      return 'other';
    } catch (error) {
      webLog('Chyba při detekci typu webu', { error, url });
      return 'other';
    }
  }
  
  /**
   * Detekuje jazyk stránky
   */
  private async detectLanguage(content: ScrapedContent): Promise<string> {
    // Analýza textu pro detekci jazyka
    const text = content.mainText + ' ' + content.title + ' ' + content.description;
    
    const czechWords = ['a', 'se', 'na', 'v', 'je', 'že', 'to', 'o', 'do', 'z', 'jsem', 'když'];
    const englishWords = ['the', 'and', 'a', 'to', 'of', 'in', 'is', 'it', 'you', 'for', 'that', 'with'];
    
    let czechCount = 0;
    let englishCount = 0;
    
    const words = text.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      if (czechWords.includes(word)) czechCount++;
      if (englishWords.includes(word)) englishCount++;
    }
    
    // Pro jednodušší detekci využijeme i html lang atribut pokud je dostupný
    try {
      const response = await axios.get(this.baseUrl);
      const html = response.data;
      const $ = cheerio.load(html);
      const htmlLang = $('html').attr('lang');
      
      if (htmlLang) {
        if (htmlLang.startsWith('cs') || htmlLang.startsWith('cz')) return 'cs';
        if (htmlLang.startsWith('en')) return 'en';
      }
    } catch {
      // Ignorujeme chyby při získání HTML
    }
    
    // Rozhodnutí na základě počtu nalezených slov
    if (czechCount > englishCount) return 'cs';
    return 'en';
  }
  
  /**
   * Extrahuje kontaktní informace z webu
   */
  private async extractContactInfo(url: string): Promise<ContactInfo> {
    const contactInfo: ContactInfo = {
      email: undefined,
      phone: undefined,
      address: undefined,
      socialLinks: []
    };
    
    try {
      const $ = await this.fetchAndLoad(url);
      
      // Hledání e-mailu na stránce
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const pageText = $('body').text();
      const emails = pageText.match(emailRegex);
      
      if (emails && emails.length > 0) {
        contactInfo.email = emails[0];
      }
      
      // Hledání telefonního čísla
      const phoneRegex = /(\+\d{3}|\d{3})[ ]?\d{3}[ ]?\d{3}[ ]?\d{3}|\d{3}[ ]?\d{3}[ ]?\d{3}/g;
      const phones = pageText.match(phoneRegex);
      
      if (phones && phones.length > 0) {
        contactInfo.phone = phones[0];
      }
      
      // Hledání adresy (zjednodušeně)
      $('[itemtype*="PostalAddress"], address, .address, [class*="address"]').each((_, el) => {
        const addressText = $(el).text().trim();
        if (addressText && addressText.length > 10 && addressText.length < 200) {
          contactInfo.address = addressText;
          return false; // break the loop
        }
      });
      
      // Hledání sociálních sítí
      const socialPatterns = [
        { platform: 'facebook', pattern: /facebook\.com/ },
        { platform: 'instagram', pattern: /instagram\.com/ },
        { platform: 'twitter', pattern: /twitter\.com|x\.com/ },
        { platform: 'linkedin', pattern: /linkedin\.com/ },
        { platform: 'youtube', pattern: /youtube\.com/ }
      ];
      
      $('a[href*="://"]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        
        for (const social of socialPatterns) {
          if (social.pattern.test(href)) {
            contactInfo.socialLinks.push({
              platform: social.platform,
              url: href
            });
            break;
          }
        }
      });
      
      return contactInfo;
    } catch (error) {
      webLog('Chyba při extrakci kontaktních informací', { error, url });
      return contactInfo;
    }
  }
  
  /**
   * Extrahuje odkazy ze stránky
   */
  private async extractLinks(url: string): Promise<{ url: string; title: string; type: 'internal' | 'external' }[]> {
    const links: { url: string; title: string; type: 'internal' | 'external' }[] = [];
    
    try {
      const $ = await this.fetchAndLoad(url);
      
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
          return;
        }
        
        let fullUrl = href;
        
        // Převedení relativních URL na absolutní
        if (!href.startsWith('http')) {
          try {
            fullUrl = new URL(href, this.baseUrl).href;
          } catch {
            return;
          }
        }
        
        // Určení, zda je odkaz interní nebo externí
        let type: 'internal' | 'external' = 'external';
        
        try {
          const linkDomain = new URL(fullUrl).hostname;
          if (linkDomain === this.domainName) {
            type = 'internal';
          }
        } catch {
          return;
        }
        
        const title = $(el).text().trim() || $(el).attr('title') || fullUrl;
        
        // Přidání odkazu do seznamu
        links.push({
          url: fullUrl,
          title: title.substring(0, 100), // Omezení délky
          type
        });
      });
      
      return links;
    } catch (error) {
      webLog('Chyba při extrakci odkazů', { error, url });
      return links;
    }
  }
  
  /**
   * Scrapuje e-shop
   */
  private async scrapeEcommerce(result: AdvancedScrapedContent): Promise<void> {
    webLog('Začínám scraping e-shopu', { url: this.baseUrl });
    
    try {
      // Hledáme stránky kategorií a produktů
      const productPageLinks = result.internalLinks.filter(link => 
        link.includes('product') || 
        link.includes('produkt') || 
        link.includes('zbozi') || 
        link.includes('katalog') || 
        link.includes('shop') || 
        link.includes('eshop') || 
        link.includes('category')
      );
      
      // Prioritizujeme a omezíme počet stránek k návštěvě
      const pagesToVisit = productPageLinks.slice(0, this.maxPagesToVisit);
      
      webLog(`Nalezeno ${productPageLinks.length} potenciálních produktových stránek, navštívím ${pagesToVisit.length}`, {
        baseUrl: this.baseUrl
      });
      
      // Postupně navštívíme každou stránku a extrahujeme produkty
      for (const pageUrl of pagesToVisit) {
        if (this.visitedUrls.has(pageUrl)) continue;
        this.visitedUrls.add(pageUrl);
        
        try {
          // Přidáme zpoždění mezi požadavky
          await new Promise(resolve => setTimeout(resolve, this.crawlDelay));
          
          // Získáme produkty z aktuální stránky
          const productsFromPage = await this.extractProductsFromPage(pageUrl);
          
          // Přidáme produkty do výsledku
          result.products = [...result.products, ...productsFromPage];
          
          // Omezíme počet produktů
          if (result.products.length >= this.maxProductsToScrape) {
            result.products = result.products.slice(0, this.maxProductsToScrape);
            break;
          }
        } catch {
          webLog('Chyba při scrapingu produktové stránky', { url: pageUrl });
          continue;
        }
      }
      
      webLog(`Dokončen scraping e-shopu, získáno ${result.products.length} produktů`, {
        baseUrl: this.baseUrl
      });
    } catch (error) {
      webLog('Chyba při scrapingu e-shopu', { error, url: this.baseUrl });
    }
  }
  
  /**
   * Extrahuje produkty ze stránky
   */
  private async extractProductsFromPage(url: string): Promise<Product[]> {
    const products: Product[] = [];
    
    try {
      const $ = await this.fetchAndLoad(url);
      
      // Hledáme strukturovaná data
      $('script[type="application/ld+json"]').each((_, element) => {
        try {
          const jsonLd = JSON.parse($(element).html() || '{}');
          
          if (jsonLd['@type'] === 'Product') {
            products.push(this.parseProductFromJsonLd(jsonLd, url));
          } else if (jsonLd['@type'] === 'ItemList' && jsonLd.itemListElement) {
            // Procházíme seznam produktů
            for (const item of jsonLd.itemListElement) {
              if (item['@type'] === 'ListItem' && item.item && item.item['@type'] === 'Product') {
                products.push(this.parseProductFromJsonLd(item.item, url));
              }
            }
          }
        } catch {
          // Ignorovat chyby parsování
        }
      });
      
      // Heuristické vyhledávání produktů
      const productSelectors = [
        '.product',
        '.product-item',
        '.product-card',
        '[itemtype*="schema.org/Product"]',
        '.woocommerce-product-details',
        '.shoptet-product',
        '.product-detail',
        '.product-info'
      ];
      
      for (const selector of productSelectors) {
        $(selector).each((_, element) => {
          const product = this.extractProductFromElement($, element, url);
          if (product && product.name) {
            products.push(product);
          }
        });
      }
      
      // Detekce zda je to stránka detailu produktu
      const isProductPage = 
        $('body.product-page').length > 0 || 
        $('body.product-detail').length > 0 ||
        $('.product-detail').length === 1 ||
        $('.product-info').length === 1;
      
      if (isProductPage && products.length === 0) {
        // Pokusíme se extrahovat produkt z celé stránky
        const productName = $('h1').first().text().trim() || $('title').text().trim();
        
        if (productName) {
          const productImage = $('img.product-image, .product-gallery img, .product-photo img').first().attr('src') || 
                              $('meta[property="og:image"]').attr('content');
                              
          const priceElement = $('.price, .product-price, [itemprop="price"]').first();
          const priceText = priceElement.text().trim();
          const currency = priceElement.attr('content') || 'CZK';
          
          const descriptionElement = $('[itemprop="description"], .product-description, .description').first();
          const description = descriptionElement.text().trim();
          
          const product: Product = {
            name: productName,
            description: description || undefined,
            price: priceText || undefined,
            currency: currency || undefined,
            image: productImage ? this.makeAbsoluteUrl(productImage, url) : undefined,
            url: url,
            isNew: $('.new-product, .badge-new').length > 0,
            isOnSale: $('.sale, .discount, .badge-sale').length > 0
          };
          
          products.push(product);
        }
      }
      
      return products;
    } catch (error) {
      webLog('Chyba při extrakci produktů ze stránky', { error, url });
      return products;
    }
  }
  
  /**
   * Parsuje produkt z JSON-LD
   */
  private parseProductFromJsonLd(jsonLd: any, baseUrl: string): Product {
    let price = '';
    let currency = '';
    
    if (jsonLd.offers) {
      const offers = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
      price = offers.price?.toString() || '';
      currency = offers.priceCurrency || '';
    }
    
    const image = jsonLd.image ? 
      (Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image) : 
      undefined;
    
    return {
      name: jsonLd.name || '',
      description: jsonLd.description || undefined,
      price: price,
      currency: currency,
      image: image ? this.makeAbsoluteUrl(image, baseUrl) : undefined,
      url: jsonLd.url || baseUrl,
      sku: jsonLd.sku || jsonLd.mpn || undefined,
      availability: typeof jsonLd.offers?.availability === 'string' ? 
        jsonLd.offers.availability.replace('http://schema.org/', '') : undefined,
      category: jsonLd.category || undefined
    };
  }
  
  /**
   * Extrahuje produkt z HTML elementu
   */
  private extractProductFromElement($: cheerio.CheerioAPI, element: any, baseUrl: string): Product | null {
    const $product = $(element);
    
    const nameElement = $product.find('.product-name, .product-title, h2, h3, [itemprop="name"]').first();
    const name = nameElement.text().trim();
    
    if (!name) return null;
    
    const priceElement = $product.find('.price, .product-price, [itemprop="price"]').first();
    const price = priceElement.text().trim();
    
    const imageElement = $product.find('img').first();
    const image = imageElement.attr('src') || imageElement.attr('data-src') || undefined;
    
    const linkElement = $product.find('a').first();
    const url = linkElement.attr('href') || baseUrl;
    
    const descriptionElement = $product.find('.description, .product-description, [itemprop="description"]').first();
    const description = descriptionElement.text().trim();
    
    return {
      name,
      description: description || undefined,
      price: price || undefined,
      image: image ? this.makeAbsoluteUrl(image, baseUrl) : undefined,
      url: this.makeAbsoluteUrl(url, baseUrl),
      isNew: $product.find('.new, .badge-new').length > 0,
      isOnSale: $product.find('.sale, .discount, .badge-sale').length > 0
    };
  }
  
  /**
   * Scrapuje blog
   */
  private async scrapeBlog(result: AdvancedScrapedContent): Promise<void> {
    webLog('Začínám scraping blogu', { url: this.baseUrl });
    
    try {
      // Hledáme stránky s články
      const blogPageLinks = result.internalLinks.filter(link => 
        link.includes('blog') || 
        link.includes('clanek') || 
        link.includes('clanky') || 
        link.includes('article') || 
        link.includes('post') || 
        link.includes('news')
      );
      
      // Prioritizujeme a omezíme počet stránek k návštěvě
      const pagesToVisit = blogPageLinks.slice(0, this.maxPagesToVisit);
      
      webLog(`Nalezeno ${blogPageLinks.length} potenciálních blogových stránek, navštívím ${pagesToVisit.length}`, {
        baseUrl: this.baseUrl
      });
      
      // Získáme blogové příspěvky z hlavní stránky
      const mainPagePosts = await this.extractBlogPostsFromPage(this.baseUrl);
      result.blogPosts = [...result.blogPosts, ...mainPagePosts];
      
      // Postupně navštívíme každou stránku a extrahujeme články
      for (const pageUrl of pagesToVisit) {
        if (this.visitedUrls.has(pageUrl)) continue;
        this.visitedUrls.add(pageUrl);
        
        try {
          // Přidáme zpoždění mezi požadavky
          await new Promise(resolve => setTimeout(resolve, this.crawlDelay));
          
          // Získáme články z aktuální stránky
          const postsFromPage = await this.extractBlogPostsFromPage(pageUrl);
          
          // Přidáme články do výsledku (bez duplicit URL)
          for (const post of postsFromPage) {
            if (!result.blogPosts.some(p => p.url === post.url)) {
              result.blogPosts.push(post);
            }
          }
          
          // Pro některé články získáme plný obsah
          if (postsFromPage.length > 0) {
            const postToFetch = postsFromPage[0];
            try {
              const fullPost = await this.fetchFullBlogPost(postToFetch.url);
              // Aktualizujeme záznam v seznamu
              const index = result.blogPosts.findIndex(p => p.url === postToFetch.url);
              if (index !== -1) {
                result.blogPosts[index] = { ...result.blogPosts[index], ...fullPost };
              }
            } catch {
              webLog('Chyba při získávání plného obsahu článku', { url: postToFetch.url });
            }
          }
          
          // Omezíme počet článků
          if (result.blogPosts.length >= this.maxBlogPostsToScrape) {
            result.blogPosts = result.blogPosts.slice(0, this.maxBlogPostsToScrape);
            break;
          }
        } catch {
          webLog('Chyba při scrapingu blogové stránky', { url: pageUrl });
          continue;
        }
      }
      
      webLog(`Dokončen scraping blogu, získáno ${result.blogPosts.length} článků`, {
        baseUrl: this.baseUrl
      });
    } catch (error) {
      webLog('Chyba při scrapingu blogu', { error, url: this.baseUrl });
    }
  }
  
  /**
   * Extrahuje blogové příspěvky ze stránky
   */
  private async extractBlogPostsFromPage(url: string): Promise<BlogPost[]> {
    const posts: BlogPost[] = [];
    
    try {
      const $ = await this.fetchAndLoad(url);
      
      // Hledáme strukturovaná data
      $('script[type="application/ld+json"]').each((_, element) => {
        try {
          const jsonLd = JSON.parse($(element).html() || '{}');
          
          if (jsonLd['@type'] === 'BlogPosting' || jsonLd['@type'] === 'Article') {
            const post: BlogPost = {
              title: jsonLd.headline || jsonLd.name || '',
              url: jsonLd.url || url,
              date: jsonLd.datePublished ? new Date(jsonLd.datePublished) : undefined,
              excerpt: jsonLd.description || '',
              author: jsonLd.author?.name || undefined,
              image: jsonLd.image ? (Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image) : undefined
            };
            
            if (post.title && post.url) {
              posts.push(post);
            }
          }
        } catch {
          // Ignorovat chyby parsování
        }
      });
      
      // Heuristické vyhledávání článků
      const articleSelectors = [
        'article',
        '.post',
        '.blog-post',
        '.entry',
        '[itemtype*="BlogPosting"]',
        '[itemtype*="Article"]',
        '.article',
        '.blog-item'
      ];
      
      for (const selector of articleSelectors) {
        $(selector).each((_, element) => {
          const post = this.extractBlogPostFromElement($, element, url);
          if (post && post.title && post.url) {
            posts.push(post);
          }
        });
      }
      
      // Detekce zda je to stránka detailu článku
      const isArticlePage = 
        $('body.single-post').length > 0 || 
        $('body.single-article').length > 0 ||
        $('article.post').length === 1 ||
        $('.post-content').length === 1;
      
      if (isArticlePage && posts.length === 0) {
        // Pokusíme se extrahovat článek z celé stránky
        const title = $('h1').first().text().trim() || $('title').text().trim();
        
        if (title) {
          const dateElement = $('time, [datetime], .date, .post-date, [itemprop="datePublished"]').first();
          const dateStr = dateElement.attr('datetime') || dateElement.text().trim();
          
          const excerptElement = $('meta[name="description"], meta[property="og:description"]');
          const excerpt = excerptElement.attr('content') || $('p').first().text().trim();
          
          const authorElement = $('[itemprop="author"], .author, .post-author').first();
          const author = authorElement.text().trim();
          
          const imageElement = $('meta[property="og:image"]');
          const image = imageElement.attr('content') || $('img').first().attr('src') || undefined;
          
          const post: BlogPost = {
            title,
            url,
            excerpt: excerpt || '',
            author: author || undefined,
            image: image ? this.makeAbsoluteUrl(image, url) : undefined
          };
          
          if (dateStr) {
            try {
              post.date = new Date(dateStr);
            } catch {
              // Pokud nelze datum parsovat, ignorujeme
            }
          }
          
          posts.push(post);
        }
      }
      
      return posts;
    } catch (error) {
      webLog('Chyba při extrakci blogových příspěvků ze stránky', { error, url });
      return posts;
    }
  }
  
  /**
   * Extrahuje blogový příspěvek z HTML elementu
   */
  private extractBlogPostFromElement($: cheerio.CheerioAPI, element: any, baseUrl: string): BlogPost | null {
    const $article = $(element);
    
    const titleElement = $article.find('h1, h2, h3, .title, .entry-title, [itemprop="headline"]').first();
    const title = titleElement.text().trim();
    
    if (!title) return null;
    
    const linkElement = titleElement.is('a') ? titleElement : $article.find('a').first();
    const url = linkElement.attr('href') || baseUrl;
    
    const dateElement = $article.find('time, [datetime], .date, .entry-date, [itemprop="datePublished"]').first();
    let date: Date | undefined = undefined;
    
    if (dateElement.length) {
      const dateStr = dateElement.attr('datetime') || dateElement.text().trim();
      if (dateStr) {
        try {
          date = new Date(dateStr);
        } catch {
          // Pokud nelze datum parsovat, ignorujeme
        }
      }
    }
    
    const excerptElement = $article.find('.excerpt, .entry-summary, .summary, [itemprop="description"]').first();
    const excerpt = excerptElement.text().trim() || $article.find('p').first().text().trim();
    
    const authorElement = $article.find('[itemprop="author"], .author, .entry-author').first();
    const author = authorElement.text().trim();
    
    const imageElement = $article.find('img').first();
    const image = imageElement.attr('src') || imageElement.attr('data-src') || undefined;
    
    return {
      title,
      url: this.makeAbsoluteUrl(url, baseUrl),
      date,
      excerpt: excerpt || '',
      author: author || undefined,
      image: image ? this.makeAbsoluteUrl(image, baseUrl) : undefined
    };
  }
  
  /**
   * Získá plný obsah blogového příspěvku
   */
  private async fetchFullBlogPost(url: string): Promise<Partial<BlogPost>> {
    try {
      webLog('Získávám plný obsah blogového příspěvku', { url });
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; APK-Marketing-Bot/1.0)'
        },
        timeout: 30000
      });
      
      // Použití Readability pro extrakci obsahu
      const dom = new JSDOM(response.data, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      
      if (!article) {
        throw new Error('Nepodařilo se extrahovat obsah článku');
      }
      
      return {
        content: article.content || undefined,
        excerpt: article.excerpt || '',
        title: article.title || ''
      };
    } catch (error) {
      webLog('Chyba při získávání plného obsahu blogového příspěvku', { error, url });
      throw error;
    }
  }
  
  /**
   * Scrapuje zpravodajský web
   */
  private async scrapeNews(result: AdvancedScrapedContent): Promise<void> {
    // Zpravodajské weby scrapujeme podobně jako blogy
    await this.scrapeBlog(result);
  }
  
  /**
   * Scrapuje firemní web
   */
  private async scrapeCompany(result: AdvancedScrapedContent): Promise<void> {
    webLog('Začínám scraping firemního webu', { url: this.baseUrl });
    
    try {
      // Pro firemní web nás zajímají hlavně sekce
      result.sections = await this.extractSections(this.baseUrl);
      
      // Také nás zajímají případné novinky
      // Hledáme stránky s novinkami
      const newsPageLinks = result.internalLinks.filter(link => 
        link.includes('news') || 
        link.includes('novinky') || 
        link.includes('aktuality') || 
        link.includes('o-nas') || 
        link.includes('about-us')
      );
      
      // Navštívíme několik stránek a extrahujeme obsah
      for (const pageUrl of newsPageLinks.slice(0, 3)) {
        if (this.visitedUrls.has(pageUrl)) continue;
        this.visitedUrls.add(pageUrl);
        
        try {
          // Přidáme zpoždění mezi požadavky
          await new Promise(resolve => setTimeout(resolve, this.crawlDelay));
          
          // Extrahujeme sekce ze stránky
          const sections = await this.extractSections(pageUrl);
          result.sections = [...result.sections, ...sections];
        } catch {
          webLog('Chyba při scrapingu stránky firemního webu', { url: pageUrl });
          continue;
        }
      }
      
      webLog(`Dokončen scraping firemního webu, získáno ${result.sections.length} sekcí`, {
        baseUrl: this.baseUrl
      });
    } catch (error) {
      webLog('Chyba při scrapingu firemního webu', { error, url: this.baseUrl });
    }
  }
  
  /**
   * Scrapuje generický web
   */
  private async scrapeGeneric(result: AdvancedScrapedContent): Promise<void> {
    webLog('Začínám scraping generického webu', { url: this.baseUrl });
    
    try {
      // Pro generický web kombinujeme přístupy
      // Kontrolujeme, jestli nemá produkty
      const productCount = await this.countProductsOnPage(this.baseUrl);
      
      if (productCount > 3) {
        webLog('Web obsahuje produkty, provádím scraping jako e-shop', { url: this.baseUrl });
        await this.scrapeEcommerce(result);
        return;
      }
      
      // Kontrolujeme, jestli nemá články
      const blogPostCount = await this.countBlogPostsOnPage(this.baseUrl);
      
      if (blogPostCount > 2) {
        webLog('Web obsahuje články, provádím scraping jako blog', { url: this.baseUrl });
        await this.scrapeBlog(result);
        return;
      }
      
      // Pokud nemá ani jedno, extrahujeme sekce
      result.sections = await this.extractSections(this.baseUrl);
      
      // Navštívíme několik dalších stránek pro získání obsahu
      const pagesToVisit = result.internalLinks
        .filter(link => !link.includes('kontakt') && !link.includes('contact'))
        .slice(0, 3);
      
      for (const pageUrl of pagesToVisit) {
        if (this.visitedUrls.has(pageUrl)) continue;
        this.visitedUrls.add(pageUrl);
        
        try {
          // Přidáme zpoždění mezi požadavky
          await new Promise(resolve => setTimeout(resolve, this.crawlDelay));
          
          // Extrahujeme sekce ze stránky
          const sections = await this.extractSections(pageUrl);
          result.sections = [...result.sections, ...sections];
        } catch {
          webLog('Chyba při scrapingu stránky generického webu', { url: pageUrl });
          continue;
        }
      }
      
      webLog(`Dokončen scraping generického webu, získáno ${result.sections.length} sekcí`, {
        baseUrl: this.baseUrl
      });
    } catch (error) {
      webLog('Chyba při scrapingu generického webu', { error, url: this.baseUrl });
    }
  }
  
  /**
   * Počítá produkty na stránce
   */
  private async countProductsOnPage(url: string): Promise<number> {
    try {
      const $ = await this.fetchAndLoad(url);
      
      const productSelectors = [
        '.product',
        '.product-item',
        '.product-card',
        '[itemtype*="schema.org/Product"]',
        '.woocommerce-product-details',
        '.shoptet-product',
        '.product-detail',
        '.product-info'
      ];
      
      let count = 0;
      
      for (const selector of productSelectors) {
        count += $(selector).length;
      }
      
      // Kontrolujeme strukturovaná data
      $('script[type="application/ld+json"]').each((_, element) => {
        try {
          const jsonLd = JSON.parse($(element).html() || '{}');
          if (jsonLd['@type'] === 'Product' || 
             (jsonLd['@type'] === 'ItemList' && jsonLd.itemListElement)) {
            count++;
          }
        } catch {
          // Ignorovat chyby parsování
        }
      });
      
      return count;
    } catch (error) {
      webLog('Chyba při počítání produktů na stránce', { error, url });
      return 0;
    }
  }
  
  /**
   * Počítá blogové příspěvky na stránce
   */
  private async countBlogPostsOnPage(url: string): Promise<number> {
    try {
      const $ = await this.fetchAndLoad(url);
      
      const articleSelectors = [
        'article',
        '.post',
        '.blog-post',
        '.entry',
        '[itemtype*="BlogPosting"]',
        '[itemtype*="Article"]',
        '.article',
        '.blog-item'
      ];
      
      let count = 0;
      
      for (const selector of articleSelectors) {
        count += $(selector).length;
      }
      
      // Kontrolujeme strukturovaná data
      $('script[type="application/ld+json"]').each((_, element) => {
        try {
          const jsonLd = JSON.parse($(element).html() || '{}');
          if (jsonLd['@type'] === 'BlogPosting' || jsonLd['@type'] === 'Article') {
            count++;
          }
        } catch {
          // Ignorovat chyby parsování
        }
      });
      
      return count;
    } catch (error) {
      webLog('Chyba při počítání blogových příspěvků na stránce', { error, url });
      return 0;
    }
  }
  
  /**
   * Extrahuje sekce webu
   */
  private async extractSections(url: string): Promise<WebsiteSection[]> {
    const sections: WebsiteSection[] = [];
    
    try {
      const $ = await this.fetchAndLoad(url);
      
      // Odstraníme nepotřebné elementy
      $('script, style, noscript, iframe, svg').remove();
      
      // Potenciální kontejnery sekcí
      const sectionSelectors = [
        'section',
        '.section',
        '.block',
        '.content-block',
        '.row',
        'main > *',
        '#content > *',
        '[class*="section"]',
        '[id*="section"]',
        '[class*="block"]',
        '.service',
        '.feature',
        '.about',
        '.team',
        '[id*="section-"]'
      ];
      
      // Procházíme potenciální sekce
      for (const selector of sectionSelectors) {
        $(selector).each((_, element) => {
          if ($(element).children().length < 2) return; // Ignorujeme jednoduché elementy
          
          // Získáme titulek sekce
          let sectionTitle = '';
          const headingElement = $(element).find('h1, h2, h3').first();
          
          if (headingElement.length) {
            sectionTitle = headingElement.text().trim();
          } else {
            // Pokud nemá nadpis, zkusíme najít jiný identifikátor
            const idAttribute = $(element).attr('id');
            const classAttribute = $(element).attr('class');
            
            if (idAttribute) {
              sectionTitle = this.formatIdAsTitle(idAttribute);
            } else if (classAttribute) {
              sectionTitle = this.formatClassAsTitle(classAttribute);
            }
          }
          
          // Pokud nemáme titulek, přeskočíme
          if (!sectionTitle) return;
          
          // Získáme obsah sekce
          const content = $(element).text().trim().replace(/\s+/g, ' ');
          
          // Ignorujeme příliš krátké sekce
          if (content.length < 50 || content.length > 5000) return;
          
          // Získáme obrázky v sekci
          const images: string[] = [];
          $(element).find('img').each((_, img) => {
            const src = $(img).attr('src');
            if (src && !src.includes('data:image')) {
              images.push(this.makeAbsoluteUrl(src, url));
            }
          });
          
          // Určíme důležitost sekce
          let importance = 1;
          
          // Sekce s nadpisem h1 nebo h2 jsou důležitější
          if ($(element).find('h1').length > 0) importance += 2;
          if ($(element).find('h2').length > 0) importance += 1;
          
          // Sekce s obrázky jsou důležitější
          if (images.length > 0) importance += 1;
          
          // Sekce v horní části stránky jsou důležitější
          // We don't have direct access to offset in cheerio, so skip this importance check
          // const parentOffset = $(element).parent().offset();
          // if (parentOffset && parentOffset.top < 1000) importance += 1;
          
          // Přidáme sekci do výsledku
          sections.push({
            title: sectionTitle,
            content: content,
            importance,
            images: images.slice(0, 5) // Omezíme počet obrázků
          });
        });
      }
      
      // Seřadíme sekce podle důležitosti
      return sections.sort((a, b) => b.importance - a.importance);
    } catch (error) {
      webLog('Chyba při extrakci sekcí webu', { error, url });
      return sections;
    }
  }
  
  /**
   * Formátuje ID atribut jako titulek
   */
  private formatIdAsTitle(id: string): string {
    return id
      .replace(/[-_]/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();
  }
  
  /**
   * Formátuje třídní atribut jako titulek
   */
  private formatClassAsTitle(classAttr: string): string {
    const classes = classAttr.split(/\s+/);
    
    // Hledáme třídu, která může reprezentovat smysluplný název
    const relevantClasses = classes.filter(c => 
      c.includes('section') || 
      c.includes('block') || 
      c.includes('feature') || 
      c.includes('service') || 
      c.includes('about') || 
      c.includes('team')
    );
    
    if (relevantClasses.length === 0) return '';
    
    return this.formatIdAsTitle(relevantClasses[0]);
  }
  
  /**
   * Načte stránku a vytvoří Cheerio instanci
   */
  private async fetchAndLoad(url: string): Promise<cheerio.CheerioAPI> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; APK-Marketing-Bot/1.0)'
        },
        timeout: 30000
      });
      
      return cheerio.load(response.data);
    } catch (error) {
      webLog('Chyba při načítání stránky', { error, url });
      throw error;
    }
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
    } catch {
      return url;
    }
  }
}