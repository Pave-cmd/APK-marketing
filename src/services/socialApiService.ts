import axios, { AxiosError, AxiosResponse } from 'axios';
import { webLog } from '../utils/logger';
import { TokenManagerService } from './tokenManagerService';
import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import FormData from 'form-data';

/**
 * Služba pro volání API sociálních sítí s pokročilým error handlingem
 */
export class SocialApiService {
  // Maximální počet pokusů pro retry mechanismus
  private static MAX_RETRIES = 3;
  
  // Typy FB API chyb, které můžeme zkusit opravit
  private static FB_RECOVERABLE_ERRORS = [
    190, // Invalid access token
    4,   // Application request limit reached
    32,  // Page request limit reached
    10,  // Application does not have permission for this action
    200  // Permission error
  ];
  
  // Typy Twitter API chyb, které můžeme zkusit opravit
  private static TW_RECOVERABLE_ERRORS = [
    88,  // Rate limit exceeded
    64,  // Account suspended
    89,  // Invalid or expired token
    187  // Status is a duplicate
  ];
  
  /**
   * Publikuje příspěvek na Facebook stránku
   * @param pageId - ID stránky
   * @param content - Text příspěvku
   * @param mediaUrl - URL obrázku (volitelné)
   * @param link - URL odkazu (volitelné)
   */
  public static async publishFacebookPost(
    pageId: string, 
    content: string, 
    mediaUrl?: string, 
    link?: string
  ): Promise<any> {
    try {
      webLog('Publikuji příspěvek na Facebook', { pageId });
      
      // Získání tokenu pro stránku
      const pageToken = await TokenManagerService.getFacebookPageToken(pageId);
      
      if (!pageToken) {
        throw new Error('Nenalezen platný token pro stránku');
      }
      
      // Podle typu příspěvku určíme endpoint a data
      let endpoint = `/${pageId}/feed`;
      let postData: any = { message: content };
      
      // Přidání odkazu, pokud existuje
      if (link) {
        postData.link = link;
      }
      
      // Pokud máme obrázek, použijeme /photos endpoint místo /feed
      if (mediaUrl) {
        endpoint = `/${pageId}/photos`;
        postData.url = mediaUrl;
      }
      
      // Pokus o publikování s retry mechanismem
      return await this.fbApiCallWithRetry(
        'post',
        `https://graph.facebook.com/v17.0${endpoint}`,
        postData,
        { access_token: pageToken }
      );
    } catch (error) {
      webLog('Chyba při publikování na Facebook', { error, pageId });
      throw error;
    }
  }
  
  /**
   * Volání Facebook API s retry logikou a error handlingem
   */
  private static async fbApiCallWithRetry(
    method: 'get' | 'post', 
    url: string, 
    data: any, 
    params: any, 
    retryCount = 0
  ): Promise<any> {
    try {
      let response: AxiosResponse;
      
      if (method === 'get') {
        response = await axios.get(url, { params });
      } else {
        response = await axios.post(url, data, { params });
      }
      
      return response.data;
    } catch (error) {
      // Typování error jako AxiosError pro přístup k response
      const axiosError = error as AxiosError;
      
      // Zpracování Facebook API chyb
      if (axiosError.response && axiosError.response.status === 400) {
        const fbError = axiosError.response.data as any;
        const errorCode = fbError.error?.code;
        const errorMessage = fbError.error?.message;
        
        webLog('Facebook API chyba', { 
          errorCode, 
          errorMessage, 
          url,
          retryCount 
        });
        
        // Pokud je to obnovitelná chyba a nepřekročili jsme maximální počet pokusů
        if (
          this.FB_RECOVERABLE_ERRORS.includes(errorCode) && 
          retryCount < this.MAX_RETRIES
        ) {
          webLog('Pokus o obnovení po FB API chybě', { 
            errorCode, 
            retryCount: retryCount + 1 
          });
          
          // Delay před retry (exponenciální backoff)
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Pokud jde o problém s tokenem, pokusíme se ho obnovit
          if (errorCode === 190) {
            await TokenManagerService.refreshExpiredTokens();
            
            // Získáme nový token, pokud je to chyba s tokenem
            if (params.access_token) {
              // Tady bychom museli identifikovat stránku z URL, pro jednoduchost necháme stejný token
              // V reálné implementaci by se zde měl získat nový token pro danou stránku
              webLog('Problém s tokenem, pokus o získání nového.');
            }
          }
          
          // Rekurzivní volání s incrementovaným počtem pokusů
          return this.fbApiCallWithRetry(method, url, data, params, retryCount + 1);
        }
      }
      
      // Pokud jsme sem došli, nemůžeme se zotavit z chyby
      throw error;
    }
  }
  
  /**
   * Získá informace o Facebook stránce
   */
  public static async getFacebookPageInfo(pageId: string): Promise<any> {
    try {
      webLog('Získávám informace o Facebook stránce', { pageId });
      
      const pageToken = await TokenManagerService.getFacebookPageToken(pageId);
      
      if (!pageToken) {
        throw new Error('Nenalezen platný token pro stránku');
      }
      
      return await this.fbApiCallWithRetry(
        'get',
        `https://graph.facebook.com/v17.0/${pageId}`,
        null,
        { 
          access_token: pageToken,
          fields: 'id,name,fan_count,link,category,about,picture' 
        }
      );
    } catch (error) {
      webLog('Chyba při získávání informací o Facebook stránce', { error, pageId });
      throw error;
    }
  }
  
  /**
   * Získá analytiku příspěvků z Facebook stránky
   */
  public static async getFacebookPageInsights(pageId: string): Promise<any> {
    try {
      webLog('Získávám analytiku Facebook stránky', { pageId });
      
      const pageToken = await TokenManagerService.getFacebookPageToken(pageId);
      
      if (!pageToken) {
        throw new Error('Nenalezen platný token pro stránku');
      }
      
      // Získáme posledních 5 příspěvků
      const postsResponse = await this.fbApiCallWithRetry(
        'get',
        `https://graph.facebook.com/v17.0/${pageId}/posts`,
        null,
        { 
          access_token: pageToken,
          limit: 5
        }
      );
      
      // Pro každý příspěvek získáme statistiky
      const postsWithInsights = [];
      
      for (const post of postsResponse.data) {
        const insights = await this.fbApiCallWithRetry(
          'get',
          `https://graph.facebook.com/v17.0/${post.id}/insights`,
          null,
          {
            access_token: pageToken,
            metric: 'post_impressions,post_reactions_by_type_total'
          }
        );
        
        postsWithInsights.push({
          id: post.id,
          created_time: post.created_time,
          message: post.message,
          insights: insights.data
        });
      }
      
      return {
        posts: postsWithInsights
      };
    } catch (error) {
      webLog('Chyba při získávání Facebook insights', { error, pageId });
      throw error;
    }
  }

  /**
   * Publikuje tweet na Twitter
   * @param userId - ID uživatele v systému
   * @param content - Text tweetu
   * @param mediaUrl - URL obrázku (volitelné)
   */
  public static async publishTwitterPost(
    userId: string,
    content: string,
    mediaUrl?: string
  ): Promise<any> {
    try {
      webLog('Publikuji příspěvek na Twitter', { userId });
      
      // Získání tokenů pro uživatele
      const tokens = await TokenManagerService.getTwitterTokens(userId);
      
      if (!tokens) {
        throw new Error('Nenalezeny platné tokeny pro Twitter');
      }

      // Vytvoření OAuth instance pro Twitter API
      const oauth = new OAuth({
        consumer: {
          key: tokens.apiKey,
          secret: tokens.apiSecret
        },
        signature_method: 'HMAC-SHA1',
        hash_function(baseString, key) {
          return crypto
            .createHmac('sha1', key)
            .update(baseString)
            .digest('base64');
        }
      });

      // Příprava dat pro tweet
      let tweetData: any = { text: content };
      let endpoint = 'https://api.twitter.com/2/tweets';
      
      // Pokud máme obrázek, musíme ho nejdříve nahrát a získat media_id
      if (mediaUrl) {
        const mediaId = await this.uploadTwitterMedia(mediaUrl, tokens);
        if (mediaId) {
          tweetData.media = { media_ids: [mediaId] };
        }
      }
      
      // Autorizační hlavičky pomocí OAuth
      const requestData = {
        url: endpoint,
        method: 'POST'
      };
      
      const headers = oauth.toHeader(oauth.authorize(requestData, {
        key: tokens.accessToken,
        secret: tokens.accessTokenSecret
      }));

      // Volání Twitter API s retry mechanismem
      const response = await this.twitterApiCallWithRetry(
        'post',
        endpoint,
        tweetData,
        {
          headers: {
            ...headers,
            'Content-Type': 'application/json'
          }
        },
        tokens
      );
      
      return {
        success: true,
        id: response.data.id,
        text: response.data.text
      };
    } catch (error) {
      webLog('Chyba při publikování na Twitter', { error, userId });
      throw error;
    }
  }

  /**
   * Nahraje médium na Twitter a vrátí media_id
   */
  private static async uploadTwitterMedia(
    mediaUrl: string,
    tokens: any
  ): Promise<string | null> {
    try {
      webLog('Nahrávám médium na Twitter', { mediaUrl });
      
      // Stažení média z URL
      const mediaResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(mediaResponse.data, 'binary');
      
      // Vytvoření OAuth instance pro Twitter API
      const oauth = new OAuth({
        consumer: {
          key: tokens.apiKey,
          secret: tokens.apiSecret
        },
        signature_method: 'HMAC-SHA1',
        hash_function(baseString, key) {
          return crypto
            .createHmac('sha1', key)
            .update(baseString)
            .digest('base64');
        }
      });
      
      // Upload API endpoint
      const endpoint = 'https://upload.twitter.com/1.1/media/upload.json';
      
      // Autorizační hlavičky pomocí OAuth
      const requestData = {
        url: endpoint,
        method: 'POST'
      };
      
      const headers = oauth.toHeader(oauth.authorize(requestData, {
        key: tokens.accessToken,
        secret: tokens.accessTokenSecret
      }));
      
      // Formát média
      const mediaType = mediaUrl.toLowerCase().endsWith('.png') ? 'image/png' : 
                        mediaUrl.toLowerCase().endsWith('.gif') ? 'image/gif' : 
                        'image/jpeg';
      
      // Vytvoření form data pro upload - použijeme multipart/form-data
      const formData = new FormData();
      // V Node.js prostředí používáme buffer přímo
      formData.append('media', buffer, {
        filename: 'media.jpg',
        contentType: mediaType
      });
      
      // Upload média
      const uploadResponse = await axios.post(endpoint, formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return uploadResponse.data.media_id_string;
    } catch (error) {
      webLog('Chyba při nahrávání média na Twitter', { error, mediaUrl });
      return null;
    }
  }

  /**
   * Volání Twitter API s retry logikou a error handlingem
   */
  private static async twitterApiCallWithRetry(
    method: 'get' | 'post',
    url: string,
    data: any,
    config: any,
    tokens: any,
    retryCount = 0
  ): Promise<any> {
    try {
      let response: AxiosResponse;
      
      if (method === 'get') {
        response = await axios.get(url, config);
      } else {
        response = await axios.post(url, data, config);
      }
      
      return response.data;
    } catch (error) {
      // Typování error jako AxiosError pro přístup k response
      const axiosError = error as AxiosError;
      
      // Zpracování Twitter API chyb
      if (axiosError.response) {
        const twError = axiosError.response.data as any;
        const errorCode = twError.errors && twError.errors[0] ? twError.errors[0].code : null;
        const errorMessage = twError.errors && twError.errors[0] ? twError.errors[0].message : 'Neznámá chyba';
        
        webLog('Twitter API chyba', { 
          errorCode, 
          errorMessage, 
          url,
          retryCount 
        });
        
        // Pokud je to obnovitelná chyba a nepřekročili jsme maximální počet pokusů
        if (
          errorCode && 
          this.TW_RECOVERABLE_ERRORS.includes(errorCode) && 
          retryCount < this.MAX_RETRIES
        ) {
          webLog('Pokus o obnovení po Twitter API chybě', { 
            errorCode, 
            retryCount: retryCount + 1 
          });
          
          // Delay před retry (exponenciální backoff)
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Pokud jde o problém s tokenem, pokusíme se ho obnovit
          if (errorCode === 89) {
            await TokenManagerService.refreshTwitterToken(tokens.userId);
            // Získáme nové tokeny
            const newTokens = await TokenManagerService.getTwitterTokens(tokens.userId);
            if (newTokens) {
              tokens = newTokens;
              
              // Aktualizujeme autorizační hlavičky
              const oauth = new OAuth({
                consumer: {
                  key: tokens.apiKey,
                  secret: tokens.apiSecret
                },
                signature_method: 'HMAC-SHA1',
                hash_function(baseString, key) {
                  return crypto
                    .createHmac('sha1', key)
                    .update(baseString)
                    .digest('base64');
                }
              });
              
              const requestData = {
                url,
                method: method.toUpperCase()
              };
              
              const headers = oauth.toHeader(oauth.authorize(requestData, {
                key: tokens.accessToken,
                secret: tokens.accessTokenSecret
              }));
              
              config.headers = {
                ...config.headers,
                ...headers
              };
            }
          }
          
          // Rekurzivní volání s incrementovaným počtem pokusů
          return this.twitterApiCallWithRetry(method, url, data, config, tokens, retryCount + 1);
        }
      }
      
      // Pokud jsme sem došli, nemůžeme se zotavit z chyby
      throw error;
    }
  }

  /**
   * Získá analytiku Twitter účtu
   * @param userId - ID uživatele v systému
   */
  public static async getTwitterInsights(userId: string): Promise<any> {
    try {
      webLog('Získávám Twitter analytiku', { userId });
      
      const tokens = await TokenManagerService.getTwitterTokens(userId);
      
      if (!tokens) {
        throw new Error('Nenalezeny platné tokeny pro Twitter');
      }
      
      // Vytvoření OAuth instance pro Twitter API
      const oauth = new OAuth({
        consumer: {
          key: tokens.apiKey,
          secret: tokens.apiSecret
        },
        signature_method: 'HMAC-SHA1',
        hash_function(baseString, key) {
          return crypto
            .createHmac('sha1', key)
            .update(baseString)
            .digest('base64');
        }
      });
      
      // Endpoint pro získání analytiky uživatele
      const endpoint = `https://api.twitter.com/2/users/${tokens.twitterUserId}/tweets`;
      
      // Autorizační hlavičky pomocí OAuth
      const requestData = {
        url: endpoint,
        method: 'GET'
      };
      
      const headers = oauth.toHeader(oauth.authorize(requestData, {
        key: tokens.accessToken,
        secret: tokens.accessTokenSecret
      }));
      
      // Získáme posledních 5 tweetů s metrikami
      const response = await this.twitterApiCallWithRetry(
        'get',
        endpoint,
        null,
        {
          headers,
          params: {
            max_results: 5,
            'tweet.fields': 'public_metrics,created_at,text'
          }
        },
        tokens
      );
      
      return {
        tweets: response.data
      };
    } catch (error) {
      webLog('Chyba při získávání Twitter analytiky', { error, userId });
      throw error;
    }
  }

  /**
   * Publikuje příspěvek na LinkedIn
   * @param userId - ID uživatele v systému
   * @param content - Text příspěvku
   * @param mediaUrl - URL obrázku (volitelné)
   * @param link - URL odkazu (volitelné)
   */
  public static async publishLinkedInPost(
    userId: string,
    content: string,
    mediaUrl?: string,
    link?: string
  ): Promise<any> {
    try {
      webLog('Publikuji příspěvek na LinkedIn', { userId });
      
      // Získání tokenů pro LinkedIn
      const token = await TokenManagerService.getLinkedInToken(userId);
      
      if (!token) {
        throw new Error('Nenalezen platný token pro LinkedIn');
      }
      
      // LinkedIn API endpoint
      const endpoint = 'https://api.linkedin.com/v2/ugcPosts';
      
      // Základní struktura příspěvku
      const postData: any = {
        author: `urn:li:person:${token.linkedinUserId}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content
            },
            shareMediaCategory: 'NONE'
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      };
      
      // Pokud máme odkaz, přidáme ho
      if (link) {
        postData.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'ARTICLE';
        postData.specificContent['com.linkedin.ugc.ShareContent'].media = [
          {
            status: 'READY',
            originalUrl: link
          }
        ];
      }
      
      // Pokud máme obrázek, musíme ho nejprve nahrát
      if (mediaUrl) {
        const mediaId = await this.uploadLinkedInMedia(mediaUrl, token);
        if (mediaId) {
          postData.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
          postData.specificContent['com.linkedin.ugc.ShareContent'].media = [
            {
              status: 'READY',
              media: mediaId
            }
          ];
        }
      }
      
      // Volání LinkedIn API
      const response = await axios.post(endpoint, postData, {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      });
      
      return {
        success: true,
        id: response.data.id
      };
    } catch (error) {
      webLog('Chyba při publikování na LinkedIn', { error, userId });
      throw error;
    }
  }

  /**
   * Nahraje médium na LinkedIn a vrátí media_id
   */
  private static async uploadLinkedInMedia(
    mediaUrl: string,
    token: any
  ): Promise<string | null> {
    try {
      webLog('Nahrávám médium na LinkedIn', { mediaUrl });
      
      // 1. Získáme upload URL
      const initResponse = await axios.post(
        'https://api.linkedin.com/v2/assets?action=registerUpload',
        {
          registerUploadRequest: {
            recipes: [
              'urn:li:digitalmediaRecipe:feedshare-image'
            ],
            owner: `urn:li:person:${token.linkedinUserId}`,
            serviceRelationships: [
              {
                relationshipType: 'OWNER',
                identifier: 'urn:li:userGeneratedContent'
              }
            ]
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token.accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0'
          }
        }
      );
      
      // Získání upload URL a asset URN
      const uploadUrl = initResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
      const assetId = initResponse.data.value.asset;
      
      // 2. Stažení média z URL
      const mediaResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(mediaResponse.data, 'binary');
      
      // 3. Nahrání média na LinkedIn
      await axios.put(uploadUrl, buffer, {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': mediaUrl.toLowerCase().endsWith('.png') ? 'image/png' : 
                         mediaUrl.toLowerCase().endsWith('.gif') ? 'image/gif' : 
                         'image/jpeg'
        }
      });
      
      return assetId;
    } catch (error) {
      webLog('Chyba při nahrávání média na LinkedIn', { error, mediaUrl });
      return null;
    }
  }

  /**
   * Získá analytiku LinkedIn účtu
   * @param userId - ID uživatele v systému
   */
  public static async getLinkedInInsights(userId: string): Promise<any> {
    try {
      webLog('Získávám LinkedIn analytiku', { userId });
      
      const token = await TokenManagerService.getLinkedInToken(userId);
      
      if (!token) {
        throw new Error('Nenalezen platný token pro LinkedIn');
      }
      
      // Získáme poslední příspěvky
      const postsResponse = await axios.get(
        'https://api.linkedin.com/v2/ugcPosts',
        {
          headers: {
            'Authorization': `Bearer ${token.accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0'
          },
          params: {
            q: 'authors',
            authors: `List(urn:li:person:${token.linkedinUserId})`,
            count: 5
          }
        }
      );
      
      // Získáme statistiky pro každý příspěvek
      const postsWithStats = [];
      
      for (const post of postsResponse.data.elements) {
        try {
          const statsResponse = await axios.get(
            `https://api.linkedin.com/v2/socialActions/${post.id}`,
            {
              headers: {
                'Authorization': `Bearer ${token.accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0'
              },
              params: {
                count: 0
              }
            }
          );
          
          postsWithStats.push({
            id: post.id,
            created: post.created.time,
            content: post.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text,
            stats: {
              likes: statsResponse.data.likesSummary.totalLikes,
              comments: statsResponse.data.commentsSummary.totalComments
            }
          });
        } catch (error) {
          webLog('Chyba při získávání statistik příspěvku na LinkedIn', { 
            error, 
            postId: post.id 
          });
          // Pokračujeme s dalším příspěvkem
          continue;
        }
      }
      
      return {
        posts: postsWithStats
      };
    } catch (error) {
      webLog('Chyba při získávání LinkedIn analytiky', { error, userId });
      throw error;
    }
  }
}