import axios, { AxiosError, AxiosResponse } from 'axios';
import { webLog } from '../utils/logger';
import { TokenManagerService } from './tokenManagerService';

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
}