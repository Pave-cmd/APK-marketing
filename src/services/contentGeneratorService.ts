import axios from 'axios';
import { webLog } from '../utils/logger';
import { AdvancedScrapedContent, WebsiteSection, BlogPost, Product } from './advancedWebsiteScraperService';

/**
 * Formát příspěvku pro sociální sítě
 */
export interface SocialMediaPost {
  content: string;
  imagePrompt?: string;
  hashtags: string[];
  type: 'general' | 'product' | 'blog' | 'promotion' | 'announcement';
  platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin';
  language: string;
  url?: string;
  title?: string;
}

/**
 * Typ příspěvku pro generování
 */
export type PostGenerationType = 
  | 'general' 
  | 'product' 
  | 'blog'
  | 'promotion'
  | 'announcement'
  | 'news'
  | 'service';

/**
 * Nastavení tónu pro příspěvky
 */
export interface ToneSettings {
  formality: 'formal' | 'casual' | 'professional' | 'friendly';
  emoji: 'none' | 'minimal' | 'moderate' | 'heavy';
  hashtags: 'none' | 'minimal' | 'moderate' | 'many';
  style: 'informative' | 'promotional' | 'engaging' | 'storytelling';
  callToAction: boolean;
}

/**
 * Služba pro generování obsahu pomocí OpenAI
 */
export class ContentGeneratorService {
  private static instance: ContentGeneratorService;
  private readonly apiKey: string;
  private defaultTone: ToneSettings = {
    formality: 'professional',
    emoji: 'minimal',
    hashtags: 'moderate',
    style: 'engaging',
    callToAction: true
  };

  /**
   * Inicializace služby s API klíčem
   * @param apiKey - OpenAI API klíč
   */
  private constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Vrátí instanci služby, nebo vytvoří novou
   */
  public static getInstance(apiKey?: string): ContentGeneratorService {
    if (!ContentGeneratorService.instance) {
      if (!apiKey) {
        throw new Error('API klíč je vyžadován pro inicializaci ContentGeneratorService');
      }
      ContentGeneratorService.instance = new ContentGeneratorService(apiKey);
    }
    return ContentGeneratorService.instance;
  }

  /**
   * Generuje sadu příspěvků pro sociální sítě na základě dat z webu
   * @param websiteData - Data získaná z webu
   * @param count - Počet příspěvků k vygenerování
   * @param types - Typy příspěvků k vygenerování
   * @param platforms - Platformy, pro které generovat příspěvky
   * @param tone - Nastavení tónu příspěvků
   */
  public async generateSocialMediaPosts(
    websiteData: AdvancedScrapedContent,
    count: number = 5,
    types: PostGenerationType[] = ['general', 'product', 'blog'],
    platforms: ('facebook' | 'twitter' | 'instagram' | 'linkedin')[] = ['facebook', 'twitter', 'instagram', 'linkedin'],
    tone: Partial<ToneSettings> = {}
  ): Promise<SocialMediaPost[]> {
    try {
      webLog('Generuji příspěvky pro sociální sítě', { 
        websiteUrl: websiteData.url,
        count,
        types, 
        platforms 
      });

      // Kombinujeme výchozí tón s požadovaným
      const finalTone = { ...this.defaultTone, ...tone };

      // Rozdělíme generování podle typů příspěvků
      const postsToGenerate = this.distributePosts(count, types);
      const posts: SocialMediaPost[] = [];

      // Generujeme příspěvky po typech
      for (const type of types) {
        const typeCount = postsToGenerate[type] || 0;
        if (typeCount <= 0) continue;

        switch(type) {
          case 'product':
            if (websiteData.websiteType === 'e-shop' && websiteData.products.length > 0) {
              const productPosts = await this.generateProductPosts(
                websiteData, 
                typeCount, 
                platforms, 
                finalTone
              );
              posts.push(...productPosts);
            } else {
              // Pokud nemáme produkty, generujeme obecné příspěvky
              const replacementPosts = await this.generateGeneralPosts(
                websiteData, 
                typeCount, 
                platforms, 
                finalTone
              );
              posts.push(...replacementPosts);
            }
            break;

          case 'blog':
            if ((websiteData.websiteType === 'blog' || websiteData.websiteType === 'news') && 
                websiteData.blogPosts.length > 0) {
              const blogPosts = await this.generateBlogPosts(
                websiteData, 
                typeCount, 
                platforms, 
                finalTone
              );
              posts.push(...blogPosts);
            } else {
              // Pokud nemáme blogy, generujeme obecné příspěvky
              const replacementPosts = await this.generateGeneralPosts(
                websiteData, 
                typeCount, 
                platforms, 
                finalTone
              );
              posts.push(...replacementPosts);
            }
            break;

          case 'general':
          default:
            const generalPosts = await this.generateGeneralPosts(
              websiteData, 
              typeCount, 
              platforms, 
              finalTone
            );
            posts.push(...generalPosts);
            break;
        }
      }

      webLog(`Úspěšně vygenerováno ${posts.length} příspěvků`, { websiteUrl: websiteData.url });
      return posts;

    } catch (error) {
      webLog('Chyba při generování příspěvků', { error, websiteUrl: websiteData.url });
      throw new Error(`Nepodařilo se vygenerovat příspěvky: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }

  /**
   * Rozdělí počet příspěvků podle typů
   */
  private distributePosts(
    totalCount: number, 
    types: PostGenerationType[]
  ): Record<PostGenerationType, number> {
    const result: Record<PostGenerationType, number> = {
      general: 0,
      product: 0,
      blog: 0,
      promotion: 0,
      announcement: 0,
      news: 0,
      service: 0
    };

    // Pro každý typ alokujeme nějakou část příspěvků
    const postPerType = Math.floor(totalCount / types.length);
    const remainder = totalCount % types.length;

    types.forEach((type, index) => {
      result[type] = postPerType + (index < remainder ? 1 : 0);
    });

    return result;
  }

  /**
   * Generuje příspěvky o produktech
   */
  private async generateProductPosts(
    websiteData: AdvancedScrapedContent,
    count: number,
    platforms: ('facebook' | 'twitter' | 'instagram' | 'linkedin')[],
    tone: ToneSettings
  ): Promise<SocialMediaPost[]> {
    const posts: SocialMediaPost[] = [];
    
    // Vybíráme zajímavé produkty (preferujeme nové, v akci, s obrázky...)
    const sortedProducts = [...websiteData.products].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;
      
      if (a.isNew) scoreA += 5;
      if (b.isNew) scoreB += 5;
      
      if (a.isOnSale) scoreA += 4;
      if (b.isOnSale) scoreB += 4;
      
      if (a.image) scoreA += 3;
      if (b.image) scoreB += 3;
      
      if (a.description) scoreA += 2;
      if (b.description) scoreB += 2;
      
      if (a.price) scoreA += 1;
      if (b.price) scoreB += 1;
      
      return scoreB - scoreA;
    });
    
    // Vybrání nejlepších produktů, podle počtu požadovaných příspěvků
    const selectedProducts = sortedProducts.slice(0, count);
    
    // Iterujeme přes produkty a generujeme příspěvky
    for (const product of selectedProducts) {
      try {
        for (const platform of platforms) {
          const post = await this.generateProductPost(
            product, 
            websiteData.title, 
            websiteData.language, 
            platform, 
            tone
          );
          
          posts.push(post);
        }
      } catch (error) {
        webLog('Chyba při generování příspěvku o produktu', { 
          error, 
          productName: product.name 
        });
        // Pokračujeme s dalším produktem
        continue;
      }
    }
    
    return posts;
  }

  /**
   * Generuje příspěvek o konkrétním produktu
   */
  private async generateProductPost(
    product: Product,
    websiteName: string,
    language: string,
    platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin',
    tone: ToneSettings
  ): Promise<SocialMediaPost> {
    // Příprava systémové zprávy podle tónu
    const systemMessage = this.getSystemMessageForTone(tone, platform, language);
    
    // Omezení délky obsahu podle platformy
    const maxLength = this.getMaxLengthForPlatform(platform);
    
    // Vytvoření zprávy pro generování
    const contentPrompt = `
      Vygeneruj příspěvek o produktu "${product.name}" pro ${platform}.
      
      Informace o produktu:
      - Název: ${product.name}
      - Popis: ${product.description || 'Není k dispozici'}
      - Cena: ${product.price ? `${product.price} ${product.currency || 'Kč'}` : 'Není uvedena'}
      - Kategorie: ${product.category || 'Není uvedena'}
      - Dostupnost: ${product.availability || 'Není uvedena'}
      ${product.isNew ? '- Nový produkt!' : ''}
      ${product.isOnSale ? '- V akci!' : ''}
      
      Příspěvek je pro web: ${websiteName}
      URL produktu: ${product.url}
      
      Požadavky na příspěvek:
      - Maximální délka: ${maxLength} znaků
      - Jazyk: ${language === 'cs' ? 'Čeština' : 'Angličtina'}
      ${tone.callToAction ? '- Zahrnout výzvu k akci na konci' : ''}
      ${platform === 'instagram' ? '- Vhodný pro Instagram - kreativní a vizuálně popisný' : ''}
      ${platform === 'twitter' ? '- Stručný a výstižný, vhodný pro Twitter' : ''}
      ${platform === 'linkedin' ? '- Profesionální tón vhodný pro LinkedIn' : ''}
      ${platform === 'facebook' ? '- Konverzační styl vhodný pro Facebook' : ''}
      
      Uveďte pouze text příspěvku, bez dodatečných informací.
    `;
    
    // Generování příspěvku
    const generatedContent = await this.callOpenAI(systemMessage, contentPrompt);
    
    // Generování hashtagu
    const hashtagPrompt = `
      Vygeneruj ${tone.hashtags === 'many' ? '5-8' : tone.hashtags === 'moderate' ? '3-5' : tone.hashtags === 'minimal' ? '1-3' : '0'} 
      hashtagů pro příspěvek o produktu "${product.name}" v kategorii "${product.category || 'obchod'}".
      
      Hashtahy by měly být relevantní k produktu, jeho použití, a kategorii.
      Jazyk: ${language === 'cs' ? 'Čeština' : 'Angličtina'}
      
      Vrať pouze seznam hashtagů oddělených čárkami, bez # symbolu.
    `;
    
    let hashtags: string[] = [];
    
    if (tone.hashtags !== 'none') {
      const hashtagsResponse = await this.callOpenAI('You are a helpful assistant that generates relevant hashtags.', hashtagPrompt);
      hashtags = hashtagsResponse.split(',').map(tag => tag.trim());
    }
    
    // Generování obrazového promptu
    const imagePromptText = `
      Vygeneruj popis pro obrázek produktu "${product.name}" v kategorii "${product.category || 'obchod'}".
      
      Popis by měl být vhodný jako prompt pro DALL-E nebo jiný obrazový generátor.
      Popis by měl být detailní, zahrnovat styl obrazu, perspektivu, a atmosféru.
      Zaměř se na vizuální aspekty produktu, ne na text.
      
      Vrať pouze popis bez dalších informací, maximálně 100 slov.
    `;
    
    const imagePrompt = await this.callOpenAI('You are a helpful assistant that generates image descriptions for DALL-E.', imagePromptText);
    
    return {
      content: generatedContent.trim(),
      hashtags,
      imagePrompt,
      type: 'product',
      platform,
      language,
      url: product.url,
      title: product.name
    };
  }

  /**
   * Generuje příspěvky o blogu/článcích
   */
  private async generateBlogPosts(
    websiteData: AdvancedScrapedContent,
    count: number,
    platforms: ('facebook' | 'twitter' | 'instagram' | 'linkedin')[],
    tone: ToneSettings
  ): Promise<SocialMediaPost[]> {
    const posts: SocialMediaPost[] = [];
    
    // Vybíráme zajímavé články (preferujeme nové, s obsahem, s obrázky...)
    const sortedPosts = [...websiteData.blogPosts].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;
      
      // Novější články mají přednost
      if (a.date && b.date) {
        if (a.date > b.date) scoreA += 5;
        if (b.date > a.date) scoreB += 5;
      } else if (a.date) {
        scoreA += 5;
      } else if (b.date) {
        scoreB += 5;
      }
      
      if (a.isNew) scoreA += 4;
      if (b.isNew) scoreB += 4;
      
      if (a.content) scoreA += 3;
      if (b.content) scoreB += 3;
      
      if (a.image) scoreA += 2;
      if (b.image) scoreB += 2;
      
      if (a.author) scoreA += 1;
      if (b.author) scoreB += 1;
      
      return scoreB - scoreA;
    });
    
    // Vybrání nejlepších článků
    const selectedPosts = sortedPosts.slice(0, count);
    
    // Iterujeme přes články a generujeme příspěvky
    for (const blogPost of selectedPosts) {
      try {
        for (const platform of platforms) {
          const post = await this.generateBlogPost(
            blogPost, 
            websiteData.title, 
            websiteData.language, 
            platform, 
            tone
          );
          
          posts.push(post);
        }
      } catch (error) {
        webLog('Chyba při generování příspěvku o blogu', { 
          error, 
          blogTitle: blogPost.title 
        });
        // Pokračujeme s dalším článkem
        continue;
      }
    }
    
    return posts;
  }

  /**
   * Generuje příspěvek o konkrétním článku
   */
  private async generateBlogPost(
    blogPost: BlogPost,
    websiteName: string,
    language: string,
    platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin',
    tone: ToneSettings
  ): Promise<SocialMediaPost> {
    // Příprava systémové zprávy podle tónu
    const systemMessage = this.getSystemMessageForTone(tone, platform, language);
    
    // Omezení délky obsahu podle platformy
    const maxLength = this.getMaxLengthForPlatform(platform);
    
    // Vytvoření zprávy pro generování
    const contentPrompt = `
      Vygeneruj příspěvek o článku "${blogPost.title}" pro ${platform}.
      
      Informace o článku:
      - Název: ${blogPost.title}
      - Popis: ${blogPost.excerpt || 'Není k dispozici'}
      ${blogPost.content ? `- Obsah (ukázka): ${blogPost.content.substring(0, 500)}...` : ''}
      ${blogPost.author ? `- Autor: ${blogPost.author}` : ''}
      ${blogPost.date ? `- Datum publikace: ${blogPost.date.toLocaleDateString()}` : ''}
      ${blogPost.isNew ? '- Nový článek!' : ''}
      
      Příspěvek je pro web: ${websiteName}
      URL článku: ${blogPost.url}
      
      Požadavky na příspěvek:
      - Maximální délka: ${maxLength} znaků
      - Jazyk: ${language === 'cs' ? 'Čeština' : 'Angličtina'}
      ${tone.callToAction ? '- Zahrnout výzvu k akci na konci' : ''}
      ${platform === 'instagram' ? '- Vhodný pro Instagram - kreativní a vizuálně popisný' : ''}
      ${platform === 'twitter' ? '- Stručný a výstižný, vhodný pro Twitter' : ''}
      ${platform === 'linkedin' ? '- Profesionální tón vhodný pro LinkedIn' : ''}
      ${platform === 'facebook' ? '- Konverzační styl vhodný pro Facebook' : ''}
      
      Uveďte pouze text příspěvku, bez dodatečných informací.
    `;
    
    // Generování příspěvku
    const generatedContent = await this.callOpenAI(systemMessage, contentPrompt);
    
    // Generování hashtagu
    const hashtagPrompt = `
      Vygeneruj ${tone.hashtags === 'many' ? '5-8' : tone.hashtags === 'moderate' ? '3-5' : tone.hashtags === 'minimal' ? '1-3' : '0'} 
      hashtagů pro příspěvek o článku "${blogPost.title}".
      
      Hashtahy by měly být relevantní k tématu článku, jeho obsahu, a oboru.
      Jazyk: ${language === 'cs' ? 'Čeština' : 'Angličtina'}
      
      Vrať pouze seznam hashtagů oddělených čárkami, bez # symbolu.
    `;
    
    let hashtags: string[] = [];
    
    if (tone.hashtags !== 'none') {
      const hashtagsResponse = await this.callOpenAI('You are a helpful assistant that generates relevant hashtags.', hashtagPrompt);
      hashtags = hashtagsResponse.split(',').map(tag => tag.trim());
    }
    
    // Generování obrazového promptu
    const imagePromptText = `
      Vygeneruj popis pro obrázek k článku "${blogPost.title}".
      
      Popis by měl být vhodný jako prompt pro DALL-E nebo jiný obrazový generátor.
      Popis by měl být detailní, zahrnovat styl obrazu, perspektivu, a atmosféru.
      Zaměř se na vizuální aspekty týkající se tématu článku, ne na text.
      
      Ukázka z článku: ${blogPost.excerpt || blogPost.content?.substring(0, 200) || blogPost.title}
      
      Vrať pouze popis bez dalších informací, maximálně 100 slov.
    `;
    
    const imagePrompt = await this.callOpenAI('You are a helpful assistant that generates image descriptions for DALL-E.', imagePromptText);
    
    return {
      content: generatedContent.trim(),
      hashtags,
      imagePrompt,
      type: 'blog',
      platform,
      language,
      url: blogPost.url,
      title: blogPost.title
    };
  }

  /**
   * Generuje obecné příspěvky o webu
   */
  private async generateGeneralPosts(
    websiteData: AdvancedScrapedContent,
    count: number,
    platforms: ('facebook' | 'twitter' | 'instagram' | 'linkedin')[],
    tone: ToneSettings
  ): Promise<SocialMediaPost[]> {
    const posts: SocialMediaPost[] = [];
    
    // Vybíráme zajímavé sekce webu
    const sortedSections = [...websiteData.sections].sort((a, b) => {
      return b.importance - a.importance;
    });
    
    // Vybrání nejlepších sekcí
    const selectedSections = sortedSections.slice(0, count);
    
    // Pokud nemáme dostatek sekcí, použijeme obecné informace o webu
    if (selectedSections.length < count) {
      const generalCount = count - selectedSections.length;
      
      try {
        for (let i = 0; i < generalCount; i++) {
          for (const platform of platforms) {
            const post = await this.generateWebsitePost(
              websiteData, 
              platform, 
              tone
            );
            
            posts.push(post);
          }
        }
      } catch (error) {
        webLog('Chyba při generování obecného příspěvku o webu', { 
          error, 
          websiteUrl: websiteData.url 
        });
      }
    }
    
    // Iterujeme přes sekce a generujeme příspěvky
    for (const section of selectedSections) {
      try {
        for (const platform of platforms) {
          const post = await this.generateSectionPost(
            section, 
            websiteData.title,
            websiteData.url,
            websiteData.language, 
            platform, 
            tone
          );
          
          posts.push(post);
        }
      } catch (error) {
        webLog('Chyba při generování příspěvku o sekci', { 
          error, 
          sectionTitle: section.title 
        });
        // Pokračujeme s další sekcí
        continue;
      }
    }
    
    return posts;
  }

  /**
   * Generuje příspěvek o konkrétní sekci webu
   */
  private async generateSectionPost(
    section: WebsiteSection,
    websiteName: string,
    websiteUrl: string,
    language: string,
    platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin',
    tone: ToneSettings
  ): Promise<SocialMediaPost> {
    // Příprava systémové zprávy podle tónu
    const systemMessage = this.getSystemMessageForTone(tone, platform, language);
    
    // Omezení délky obsahu podle platformy
    const maxLength = this.getMaxLengthForPlatform(platform);
    
    // Vytvoření zprávy pro generování
    const contentPrompt = `
      Vygeneruj příspěvek o sekci "${section.title}" z webu pro ${platform}.
      
      Informace o sekci:
      - Název sekce: ${section.title}
      - Obsah: ${section.content.substring(0, 1000)}
      ${section.images.length > 0 ? `- Obsahuje ${section.images.length} obrázků` : ''}
      
      Příspěvek je pro web: ${websiteName}
      URL webu: ${websiteUrl}
      
      Požadavky na příspěvek:
      - Maximální délka: ${maxLength} znaků
      - Jazyk: ${language === 'cs' ? 'Čeština' : 'Angličtina'}
      ${tone.callToAction ? '- Zahrnout výzvu k akci na konci' : ''}
      ${platform === 'instagram' ? '- Vhodný pro Instagram - kreativní a vizuálně popisný' : ''}
      ${platform === 'twitter' ? '- Stručný a výstižný, vhodný pro Twitter' : ''}
      ${platform === 'linkedin' ? '- Profesionální tón vhodný pro LinkedIn' : ''}
      ${platform === 'facebook' ? '- Konverzační styl vhodný pro Facebook' : ''}
      
      Uveďte pouze text příspěvku, bez dodatečných informací.
    `;
    
    // Generování příspěvku
    const generatedContent = await this.callOpenAI(systemMessage, contentPrompt);
    
    // Generování hashtagu
    const hashtagPrompt = `
      Vygeneruj ${tone.hashtags === 'many' ? '5-8' : tone.hashtags === 'moderate' ? '3-5' : tone.hashtags === 'minimal' ? '1-3' : '0'} 
      hashtagů pro příspěvek o sekci "${section.title}" z webu ${websiteName}.
      
      Hashtahy by měly být relevantní k tématu sekce, obsahu webu, a oboru.
      Jazyk: ${language === 'cs' ? 'Čeština' : 'Angličtina'}
      
      Vrať pouze seznam hashtagů oddělených čárkami, bez # symbolu.
    `;
    
    let hashtags: string[] = [];
    
    if (tone.hashtags !== 'none') {
      const hashtagsResponse = await this.callOpenAI('You are a helpful assistant that generates relevant hashtags.', hashtagPrompt);
      hashtags = hashtagsResponse.split(',').map(tag => tag.trim());
    }
    
    // Generování obrazového promptu
    const imagePromptText = `
      Vygeneruj popis pro obrázek k sekci "${section.title}" z webu.
      
      Popis by měl být vhodný jako prompt pro DALL-E nebo jiný obrazový generátor.
      Popis by měl být detailní, zahrnovat styl obrazu, perspektivu, a atmosféru.
      Zaměř se na vizuální aspekty týkající se tématu sekce, ne na text.
      
      Obsah sekce: ${section.content.substring(0, 200)}
      
      Vrať pouze popis bez dalších informací, maximálně 100 slov.
    `;
    
    const imagePrompt = await this.callOpenAI('You are a helpful assistant that generates image descriptions for DALL-E.', imagePromptText);
    
    return {
      content: generatedContent.trim(),
      hashtags,
      imagePrompt,
      type: 'general',
      platform,
      language,
      url: websiteUrl,
      title: section.title
    };
  }

  /**
   * Generuje obecný příspěvek o webu
   */
  private async generateWebsitePost(
    websiteData: AdvancedScrapedContent,
    platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin',
    tone: ToneSettings
  ): Promise<SocialMediaPost> {
    // Příprava systémové zprávy podle tónu
    const systemMessage = this.getSystemMessageForTone(tone, platform, websiteData.language);
    
    // Omezení délky obsahu podle platformy
    const maxLength = this.getMaxLengthForPlatform(platform);
    
    // Vytvoření zprávy pro generování
    const contentPrompt = `
      Vygeneruj obecný příspěvek o webu pro ${platform}.
      
      Informace o webu:
      - Název: ${websiteData.title}
      - Popis: ${websiteData.description}
      - Typ webu: ${websiteData.websiteType}
      ${websiteData.sections.length > 0 ? `- Počet sekcí: ${websiteData.sections.length}` : ''}
      ${websiteData.products.length > 0 ? `- Počet produktů: ${websiteData.products.length}` : ''}
      ${websiteData.blogPosts.length > 0 ? `- Počet článků: ${websiteData.blogPosts.length}` : ''}
      
      URL webu: ${websiteData.url}
      
      Požadavky na příspěvek:
      - Maximální délka: ${maxLength} znaků
      - Jazyk: ${websiteData.language === 'cs' ? 'Čeština' : 'Angličtina'}
      ${tone.callToAction ? '- Zahrnout výzvu k akci na konci' : ''}
      ${platform === 'instagram' ? '- Vhodný pro Instagram - kreativní a vizuálně popisný' : ''}
      ${platform === 'twitter' ? '- Stručný a výstižný, vhodný pro Twitter' : ''}
      ${platform === 'linkedin' ? '- Profesionální tón vhodný pro LinkedIn' : ''}
      ${platform === 'facebook' ? '- Konverzační styl vhodný pro Facebook' : ''}
      
      Uveďte pouze text příspěvku, bez dodatečných informací.
    `;
    
    // Generování příspěvku
    const generatedContent = await this.callOpenAI(systemMessage, contentPrompt);
    
    // Generování hashtagu
    const hashtagPrompt = `
      Vygeneruj ${tone.hashtags === 'many' ? '5-8' : tone.hashtags === 'moderate' ? '3-5' : tone.hashtags === 'minimal' ? '1-3' : '0'} 
      hashtagů pro příspěvek o webu ${websiteData.title} (${websiteData.websiteType}).
      
      Hashtahy by měly být relevantní k typu webu, jeho obsahu, a oboru.
      Jazyk: ${websiteData.language === 'cs' ? 'Čeština' : 'Angličtina'}
      
      Vrať pouze seznam hashtagů oddělených čárkami, bez # symbolu.
    `;
    
    let hashtags: string[] = [];
    
    if (tone.hashtags !== 'none') {
      const hashtagsResponse = await this.callOpenAI('You are a helpful assistant that generates relevant hashtags.', hashtagPrompt);
      hashtags = hashtagsResponse.split(',').map(tag => tag.trim());
    }
    
    // Generování obrazového promptu
    const imagePromptText = `
      Vygeneruj popis pro obrázek k webu ${websiteData.title}.
      
      Popis by měl být vhodný jako prompt pro DALL-E nebo jiný obrazový generátor.
      Popis by měl být detailní, zahrnovat styl obrazu, perspektivu, a atmosféru.
      Zaměř se na vizuální aspekty týkající se typu webu (${websiteData.websiteType}), ne na text.
      
      Popis webu: ${websiteData.description}
      
      Vrať pouze popis bez dalších informací, maximálně 100 slov.
    `;
    
    const imagePrompt = await this.callOpenAI('You are a helpful assistant that generates image descriptions for DALL-E.', imagePromptText);
    
    return {
      content: generatedContent.trim(),
      hashtags,
      imagePrompt,
      type: 'general',
      platform,
      language: websiteData.language,
      url: websiteData.url,
      title: websiteData.title
    };
  }

  /**
   * Vytvoří systémovou zprávu podle nastavení tónu
   */
  private getSystemMessageForTone(
    tone: ToneSettings, 
    platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin',
    language: string
  ): string {
    const formalityMap = {
      'formal': language === 'cs' ? 'formální' : 'formal',
      'casual': language === 'cs' ? 'neformální' : 'casual',
      'professional': language === 'cs' ? 'profesionální' : 'professional',
      'friendly': language === 'cs' ? 'přátelský' : 'friendly'
    };
    
    const styleMap = {
      'informative': language === 'cs' ? 'informativní' : 'informative',
      'promotional': language === 'cs' ? 'propagační' : 'promotional',
      'engaging': language === 'cs' ? 'poutavý' : 'engaging',
      'storytelling': language === 'cs' ? 'vyprávěcí' : 'storytelling'
    };
    
    const emojiMap = {
      'none': '0',
      'minimal': '1-2',
      'moderate': '2-4',
      'heavy': '4-8'
    };
    
    return `
      You are a professional social media content writer that creates engaging posts.
      Your task is to write content for ${platform} platform.
      
      Your writing style is:
      - ${formalityMap[tone.formality]} tone
      - ${styleMap[tone.style]} style
      - Using ${emojiMap[tone.emoji]} emojis (appropriately placed within the text)
      
      ${language === 'cs' 
        ? 'Piš výhradně v českém jazyce, používej správnou gramatiku a interpunkci.'
        : 'Write exclusively in English, use proper grammar and punctuation.'}
      
      ${platform === 'twitter' 
        ? 'Create concise, impactful content suitable for Twitter\'s character limits.'
        : platform === 'instagram'
        ? 'Create visually descriptive content that would work well with an image on Instagram.'
        : platform === 'linkedin'
        ? 'Create professional, business-appropriate content suitable for LinkedIn\'s audience.'
        : 'Create conversational, engaging content suitable for Facebook\'s audience.'}
    `;
  }

  /**
   * Vrací maximální délku příspěvku pro danou platformu
   */
  private getMaxLengthForPlatform(platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin'): number {
    switch (platform) {
      case 'twitter':
        return 280;
      case 'instagram':
        return 2200;
      case 'linkedin':
        return 3000;
      case 'facebook':
      default:
        return 5000;
    }
  }

  /**
   * Volá OpenAI API pro generování obsahu
   */
  private async callOpenAI(systemMessage: string, userMessage: string): Promise<string> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4-turbo',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 1000
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      webLog('Chyba při volání OpenAI API', { error });
      throw new Error(`Chyba při komunikaci s OpenAI API: ${error instanceof Error ? error.message : 'Neznámá chyba'}`);
    }
  }
}