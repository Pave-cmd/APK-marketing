import axios from 'axios';
import { webLog } from '../utils/logger';
import ApiConfig from '../models/ApiConfig';
import User from '../models/User';

/**
 * Služba pro správu přístupových tokenů sociálních sítí
 */
export class TokenManagerService {
  
  /**
   * Získání a uložení dlouhodobého Page Access Tokenu pro Facebook
   * @param userAccessToken - Krátkodobý uživatelský token získaný z OAuth
   * @param userId - ID uživatele v systému
   * @param networkId - ID sociální sítě v profilu uživatele
   */
  public static async getFacebookPageTokens(userAccessToken: string, userId: string, networkId: string): Promise<boolean> {
    try {
      webLog('Získávání Page Access Tokenů', { userId, networkId });
      
      // 1. Získání seznamu stránek, ke kterým má uživatel přístup
      const pagesResponse = await axios.get(
        'https://graph.facebook.com/v17.0/me/accounts',
        {
          params: {
            access_token: userAccessToken,
            fields: 'id,name,access_token'
          }
        }
      );
      
      const pages = pagesResponse.data.data;
      
      if (!pages || pages.length === 0) {
        webLog('Uživatel nemá přístup k žádným stránkám', { userId });
        return false;
      }
      
      webLog(`Nalezeno ${pages.length} stránek, které má uživatel k dispozici`, { userId });
      
      // 2. Uložení tokenů pro stránky do konfigurace API
      const apiConfig = await ApiConfig.findOne({ platform: 'facebook' });
      
      if (!apiConfig) {
        webLog('Facebook API konfigurace nenalezena', { userId });
        return false;
      }
      
      // Příprava pole tokenů pro stránky
      const pageTokens = pages.map((page: any) => ({
        pageId: page.id,
        name: page.name,
        accessToken: page.access_token,
        expiresAt: null // Page tokeny jsou dlouhodobé, není nutné specifikovat expiraci
      }));
      
      // Aktualizace konfigurace
      apiConfig.pageTokens = pageTokens;
      
      // Převod User Access Tokenu na dlouhodobý Long-Lived User Access Token
      const longLivedTokenResponse = await this.getLongLivedUserToken(userAccessToken, apiConfig.getDecryptedConfig());
      
      if (longLivedTokenResponse) {
        apiConfig.longLivedToken = longLivedTokenResponse.token;
        apiConfig.tokenExpiry = new Date(Date.now() + (longLivedTokenResponse.expiresIn * 1000));
        
        webLog('Dlouhodobý token získán a uložen', { 
          userId,
          expiresIn: longLivedTokenResponse.expiresIn,
          expiresAt: apiConfig.tokenExpiry
        });
      }
      
      await apiConfig.save();
      
      // 3. Aktualizace uživatelské sociální sítě s primární stránkou
      const user = await User.findById(userId);
      
      if (!user) {
        webLog('Uživatel nenalezen', { userId });
        return false;
      }
      
      const network = user.socialNetworks.find(
        (net: any) => net._id.toString() === networkId
      );
      
      if (!network) {
        webLog('Sociální síť nenalezena', { userId, networkId });
        return false;
      }
      
      // Pokud má uživatel stránky, nastavíme primární stránku
      if (pages.length > 0) {
        network.pageId = pages[0].id;
        network.pageName = pages[0].name;
        
        webLog('Primární stránka nastavena', { 
          userId, 
          networkId,
          pageId: pages[0].id,
          pageName: pages[0].name
        });
      }
      
      await user.save();
      
      return true;
    } catch (error) {
      webLog('Chyba při získávání Page Access Tokenů', { error });
      return false;
    }
  }
  
  /**
   * Kontrola a obnova expirovaných tokenů pro všechny platformy
   */
  public static async refreshExpiredTokens(): Promise<void> {
    try {
      webLog('Spouštím kontrolu expirovaných tokenů');
      
      // Kontrola Facebook tokenů
      await this.refreshFacebookTokens();
      
      // Zde budou v budoucnu implementace pro další platformy
      // await this.refreshTwitterTokens();
      // await this.refreshLinkedInTokens();
      
      webLog('Kontrola expirovaných tokenů dokončena');
    } catch (error) {
      webLog('Chyba při obnově expirovaných tokenů', { error });
    }
  }
  
  /**
   * Obnova expirovaných Facebook tokenů
   */
  private static async refreshFacebookTokens(): Promise<void> {
    try {
      const fbConfig = await ApiConfig.findOne({ platform: 'facebook' });
      
      if (!fbConfig) {
        webLog('Facebook API konfigurace nenalezena');
        return;
      }
      
      const config = fbConfig.getDecryptedConfig();
      
      // Pokud máme dlouhodobý token a je blízko expirace (3 dny)
      if (config.longLivedToken && config.tokenExpiry) {
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
        
        if (config.tokenExpiry < threeDaysFromNow) {
          webLog('Long-lived token expiruje brzy, pokus o obnovení');
          
          // Pokus o obnovení dlouhodobého tokenu (Facebook umožňuje obnovit long-lived token ještě jednou)
          const response = await this.getLongLivedUserToken(config.longLivedToken, config);
          
          if (response) {
            fbConfig.longLivedToken = response.token;
            fbConfig.tokenExpiry = new Date(Date.now() + (response.expiresIn * 1000));
            
            await fbConfig.save();
            
            webLog('Long-lived token úspěšně obnoven', {
              expiresIn: response.expiresIn,
              expiresAt: fbConfig.tokenExpiry
            });
          }
        }
      }
    } catch (error) {
      webLog('Chyba při obnově Facebook tokenů', { error });
    }
  }
  
  /**
   * Získání dlouhodobého tokenu pro uživatele
   */
  private static async getLongLivedUserToken(shortLivedToken: string, config: any): Promise<{ token: string, expiresIn: number } | null> {
    try {
      if (!config.appId || !config.appSecret) {
        webLog('Chybí Facebook App ID nebo App Secret');
        return null;
      }
      
      const response = await axios.get(
        'https://graph.facebook.com/v17.0/oauth/access_token',
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: config.appId,
            client_secret: config.appSecret,
            fb_exchange_token: shortLivedToken
          }
        }
      );
      
      return {
        token: response.data.access_token,
        expiresIn: response.data.expires_in || 5184000 // Default je 60 dní (v sekundách)
      };
    } catch (error) {
      webLog('Chyba při získávání dlouhodobého tokenu', { error });
      return null;
    }
  }
  
  /**
   * Získá platný token pro publikování příspěvku na stránku
   */
  public static async getFacebookPageToken(pageId: string): Promise<string | null> {
    try {
      const fbConfig = await ApiConfig.findOne({ platform: 'facebook' });
      
      if (!fbConfig) {
        webLog('Facebook API konfigurace nenalezena');
        return null;
      }
      
      const config = fbConfig.getDecryptedConfig();
      
      if (!config.pageTokens || config.pageTokens.length === 0) {
        webLog('Nenalezeny žádné tokeny pro stránky');
        return null;
      }
      
      // Najdeme token pro danou stránku
      const pageToken = config.pageTokens.find(token => token.pageId === pageId);
      
      if (!pageToken) {
        webLog('Token pro stránku nenalezen', { pageId });
        return null;
      }
      
      return pageToken.accessToken || null;
    } catch (error) {
      webLog('Chyba při získávání tokenu pro stránku', { error, pageId });
      return null;
    }
  }
}

// Registrace pravidelné kontroly tokenů (každých 24 hodin)
export const setupTokenRefresh = () => {
  const REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24 hodin v milisekundách
  
  setInterval(() => {
    TokenManagerService.refreshExpiredTokens()
      .catch(error => webLog('Chyba při plánované obnově tokenů', { error }));
  }, REFRESH_INTERVAL);
  
  // První kontrola hned při startu serveru
  TokenManagerService.refreshExpiredTokens()
    .catch(error => webLog('Chyba při inicializační obnově tokenů', { error }));
};