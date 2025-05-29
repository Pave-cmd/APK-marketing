import { logger } from '../utils/logger';
import axios from 'axios';
import { SocialContent } from '../models/Content';
import { OpenAI } from 'openai';

/**
 * Service for generating social media content using AI
 */
export class SocialContentGeneratorService {
  private apiKey: string;
  private openai: OpenAI;

  constructor(apiKey: string, apiEndpoint?: string) {
    this.apiKey = apiKey;
    this.openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: apiEndpoint
    });
  }

  /**
   * Generate social media content based on website data and target platform
   * @param websiteUrl The URL of the website to generate content for
   * @param platform The social media platform (facebook, twitter, instagram, linkedin)
   * @param tone The tone of the content (professional, casual, humorous, informative)
   * @param contentType The type of content (post, ad, story)
   * @param userId Optional user ID to associate with the generated content
   * @returns Generated content object
   */
  async generateContent(
    websiteUrl: string,
    platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin',
    tone: 'professional' | 'casual' | 'humorous' | 'informative',
    contentType: 'post' | 'ad' | 'story',
    userId?: string
  ): Promise<SocialContent> {
    try {
      console.log('[CONTENT-SERVICE] generateContent called with:', { websiteUrl, platform, tone, contentType, userId });
      logger.info(`Generating ${platform} ${contentType} content for ${websiteUrl} with ${tone} tone`);
      
      // This would be replaced with actual API call to AI service
      const response = await this.callContentGenerationAPI(websiteUrl, platform, tone, contentType, userId);
      
      const newContent: SocialContent = {
        websiteUrl,
        platform,
        tone,
        contentType,
        text: response.text,
        hashtags: response.hashtags,
        images: response.imageUrls,
        createdAt: new Date(),
        userId: response.userId
      };
      
      return newContent;
    } catch (error) {
      logger.error(`Error generating content: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to generate content: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Make API call to content generation service
   * @param websiteUrl Website to generate content for
   * @param platform Target social media platform
   * @param tone Content tone
   * @param contentType Type of content
   * @param userId Optional user ID to associate with the generated content
   * @returns Generated content data
   */
  private async callContentGenerationAPI(
    websiteUrl: string,
    platform: string,
    tone: string,
    contentType: string,
    userId?: string
  ): Promise<{
    text: string;
    hashtags: string[];
    imageUrls: string[];
    userId: string;
  }> {
    try {
      console.log('[CONTENT-SERVICE] callContentGenerationAPI called with:', { websiteUrl, platform, tone, contentType, userId });
      
      // First, try to fetch some basic information about the website
      console.log('[CONTENT-SERVICE] Fetching website info...');
      const websiteInfo = await this.fetchWebsiteInfo(websiteUrl);
      console.log('[CONTENT-SERVICE] Website info fetched:', websiteInfo);
      
      // Create a prompt based on the website information
      const systemMessage = `You are a professional social media content creator specializing in creating ${tone} content for ${platform}. Your goal is to create engaging, high-quality content that drives engagement and conversions.`;
      
      const userMessage = `
        Create a ${tone} ${contentType} for ${platform} about the website ${websiteUrl}.
        
        Website information:
        Title: ${websiteInfo.title || 'Unknown'}
        Description: ${websiteInfo.description || 'No description available'}
        Content: ${websiteInfo.content ? websiteInfo.content.substring(0, 500) + '...' : 'No content available'}
        
        Please follow these guidelines:
        1. The content should be in the ${tone} tone.
        2. It should be appropriate for ${platform}.
        3. For ${contentType} type of content, make it ${contentType === 'ad' ? 'promotional and action-oriented' : contentType === 'story' ? 'engaging and visual' : 'informative and shareable'}.
        4. Include 3-5 relevant hashtags at the end.
        5. Keep it concise and engaging.
        6. Do not use any placeholder text - generate real, usable content.
        7. Include a call-to-action appropriate for ${platform}.
        8. The content should be in Czech language.
        
        Format your response as follows:
        CONTENT: [the main text content]
        HASHTAGS: [comma-separated list of hashtags without the # symbol]
      `;
      
      // Call OpenAI API
      console.log('[CONTENT-SERVICE] Calling OpenAI API...');
      console.log('[CONTENT-SERVICE] System message:', systemMessage);
      console.log('[CONTENT-SERVICE] User message:', userMessage);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 500
      });
      
      console.log('[CONTENT-SERVICE] OpenAI response received:', response.choices[0]);
      
      const responseText = response.choices[0].message.content || '';
      
      // Parse the response to extract content and hashtags
      const contentMatch = responseText.match(/CONTENT:\s*([\s\S]*?)(?=HASHTAGS:|$)/i);
      const hashtagsMatch = responseText.match(/HASHTAGS:\s*([\s\S]*?)$/i);
      
      const text = contentMatch ? contentMatch[1].trim() : responseText;
      let hashtags: string[] = [];
      
      if (hashtagsMatch && hashtagsMatch[1]) {
        hashtags = hashtagsMatch[1].split(',').map(tag => tag.trim());
      } else {
        // Extract hashtags from text if not explicitly provided
        const hashtagRegex = /#(\w+)/g;
        const matches = text.match(hashtagRegex);
        if (matches) {
          hashtags = matches.map(tag => tag.substring(1));
        }
      }
      
      return {
        text,
        hashtags,
        imageUrls: [],
        userId: userId || 'user123' // Use provided userId or default to 'user123'
      };
    } catch (error) {
      logger.error(`API call failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Content generation API call failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate multiple content variations
   * @param websiteUrl Website URL
   * @param platform Social platform
   * @param count Number of variations to generate
   * @param userId Optional user ID to associate with the generated content
   * @returns Array of content variations
   */
  async generateContentVariations(
    websiteUrl: string,
    platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin',
    count: number = 3,
    userId?: string
  ): Promise<SocialContent[]> {
    const tones: Array<'professional' | 'casual' | 'humorous' | 'informative'> = [
      'professional', 'casual', 'humorous', 'informative'
    ];
    
    const contentTypes: Array<'post' | 'ad' | 'story'> = ['post', 'ad', 'story'];
    const variations: SocialContent[] = [];
    
    try {
      for (let i = 0; i < count; i++) {
        // Select random tone and content type for variety
        const tone = tones[Math.floor(Math.random() * tones.length)];
        const contentType = contentTypes[Math.floor(Math.random() * contentTypes.length)];
        
        const content = await this.generateContent(websiteUrl, platform, tone, contentType, userId);
        variations.push(content);
      }
      
      return variations;
    } catch (error) {
      logger.error(`Error generating content variations: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to generate content variations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fetch basic information about a website
   * @param url Website URL
   * @returns Basic website information
   */
  private async fetchWebsiteInfo(url: string): Promise<{
    title: string;
    description: string;
    content: string;
  }> {
    try {
      // Use axios to fetch the page content
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; APKMarketingBot/1.0; +https://apk-marketing.com)'
        }
      });
      
      const html = response.data;
      
      // Extract title
      const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : '';
      
      // Extract meta description
      const descriptionMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
      const description = descriptionMatch ? descriptionMatch[1] : '';
      
      // Extract some content (simple approach - get text from p tags)
      const bodyContent = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                             .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
      
      const contentMatches = bodyContent.match(/<p\b[^>]*>([^<]*)<\/p>/gi);
      let content = '';
      
      if (contentMatches) {
        content = contentMatches
          .map((p: string) => p.replace(/<\/?p\b[^>]*>/gi, ''))
          .join(' ')
          .substring(0, 1000);
      }
      
      return {
        title,
        description,
        content
      };
    } catch (error) {
      logger.error(`Error fetching website info for ${url}: ${error instanceof Error ? error.message : String(error)}`);
      return {
        title: '',
        description: '',
        content: ''
      };
    }
  }
}