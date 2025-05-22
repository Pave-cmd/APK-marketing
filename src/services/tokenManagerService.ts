import axios from 'axios';
import { webLog } from '../utils/logger';
import ApiConfig from '../models/ApiConfig';
import User from '../models/User';
import mongoose from 'mongoose';

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
      
      // Kontrola Twitter tokenů
      await this.refreshTwitterTokens();
      
      // Kontrola LinkedIn tokenů
      await this.refreshLinkedInTokens();
      
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

  /**
   * Získání a uložení tokenů pro Twitter
   * @param userId - ID uživatele v systému
   * @param oauthToken - OAuth token získaný z autorizačního procesu
   * @param oauthTokenSecret - OAuth token secret získaný z autorizačního procesu
   */
  public static async storeTwitterTokens(
    userId: string,
    oauthToken: string,
    oauthTokenSecret: string,
    twitterUserId: string,
    twitterUsername: string
  ): Promise<boolean> {
    try {
      webLog('Ukládám tokeny pro Twitter', { userId, twitterUsername });
      
      // Získání nebo vytvoření konfigurace pro Twitter
      let twitterConfig = await ApiConfig.findOne({ 
        userId: new mongoose.Types.ObjectId(userId),
        platform: 'twitter' 
      });
      
      if (!twitterConfig) {
        twitterConfig = new ApiConfig({
          userId: new mongoose.Types.ObjectId(userId),
          platform: 'twitter',
          appId: process.env.TWITTER_API_KEY,
          appSecret: process.env.TWITTER_API_SECRET,
          configDetails: {}
        });
      }
      
      // Uložení tokenů do konfigurace
      twitterConfig.accessToken = oauthToken;
      twitterConfig.accessTokenSecret = oauthTokenSecret;
      twitterConfig.configDetails = {
        ...twitterConfig.configDetails,
        twitterUserId,
        twitterUsername
      };
      
      await twitterConfig.save();
      
      // Aktualizace uživatelského profilu
      const user = await User.findById(userId);
      
      if (!user) {
        webLog('Uživatel nenalezen', { userId });
        return false;
      }
      
      // Najdeme záznam sociální sítě nebo vytvoříme nový
      const existingNetwork = user.socialNetworks.find(
        (net: any) => net.platform === 'twitter'
      );
      
      if (existingNetwork) {
        existingNetwork.username = twitterUsername;
        existingNetwork.status = 'active';
        existingNetwork.lastChecked = new Date();
        existingNetwork.metadata = {
          ...existingNetwork.metadata,
          userId: twitterUserId
        };
      } else {
        user.socialNetworks.push({
          platform: 'twitter',
          username: twitterUsername,
          status: 'active',
          lastChecked: new Date(),
          metadata: {
            userId: twitterUserId
          }
        });
      }
      
      await user.save();
      
      webLog('Twitter tokeny úspěšně uloženy', { 
        userId, 
        twitterUsername 
      });
      
      return true;
    } catch (error) {
      webLog('Chyba při ukládání Twitter tokenů', { error });
      return false;
    }
  }

  /**
   * Získání Twitter tokenů pro uživatele
   * @param userId - ID uživatele v systému
   */
  public static async getTwitterTokens(userId: string): Promise<any> {
    try {
      const twitterConfig = await ApiConfig.findOne({ 
        userId: new mongoose.Types.ObjectId(userId),
        platform: 'twitter' 
      });
      
      if (!twitterConfig) {
        webLog('Twitter konfigurace nenalezena', { userId });
        return null;
      }
      
      // Vracíme objekt s tokeny a dalšími důležitými údaji
      return {
        userId,
        apiKey: process.env.TWITTER_API_KEY,
        apiSecret: process.env.TWITTER_API_SECRET,
        accessToken: twitterConfig.getDecryptedAccessToken(),
        accessTokenSecret: twitterConfig.getDecryptedAccessTokenSecret(),
        twitterUserId: twitterConfig.configDetails.twitterUserId,
        twitterUsername: twitterConfig.configDetails.twitterUsername
      };
    } catch (error) {
      webLog('Chyba při získávání Twitter tokenů', { error, userId });
      return null;
    }
  }

  /**
   * Obnovení Twitter tokenu pro uživatele
   * Pozn: Twitter používá OAuth 1.0a, tokeny tak v podstatě neexpirují,
   * ale tato metoda může být použita v případě, že uživatel zneplatní tokeny
   * @param userId - ID uživatele v systému
   */
  public static async refreshTwitterToken(userId: string): Promise<boolean> {
    try {
      webLog('Aktualizuji stav Twitter tokenu', { userId });
      
      // Twitter OAuth 1.0a tokeny neexpirují, ale můžeme zkontrolovat jejich platnost
      // voláním jednoduchého API endpointu
      const tokens = await this.getTwitterTokens(userId);
      
      if (!tokens) {
        webLog('Twitter tokeny nenalezeny', { userId });
        return false;
      }
      
      // Aktualizujeme čas poslední kontroly
      const twitterNetwork = await User.findOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { socialNetworks: { $elemMatch: { platform: 'twitter' } } }
      );
      
      if (twitterNetwork && twitterNetwork.socialNetworks[0]) {
        twitterNetwork.socialNetworks[0].lastChecked = new Date();
        await twitterNetwork.save();
      }
      
      return true;
    } catch (error) {
      webLog('Chyba při aktualizaci Twitter tokenu', { error, userId });
      return false;
    }
  }

  /**
   * Obnova Twitter tokenů - obecná metoda
   */
  private static async refreshTwitterTokens(): Promise<void> {
    try {
      webLog('Kontroluji Twitter tokeny');
      
      // Získáme všechny Twitter API konfigurace
      const twitterConfigs = await ApiConfig.find({ platform: 'twitter' });
      
      if (twitterConfigs.length === 0) {
        webLog('Nenalezeny žádné Twitter konfigurace');
        return;
      }
      
      for (const config of twitterConfigs) {
        await this.refreshTwitterToken(config.userId.toString());
      }
      
      webLog(`Zkontrolováno ${twitterConfigs.length} Twitter konfigurací`);
    } catch (error) {
      webLog('Chyba při kontrole Twitter tokenů', { error });
    }
  }

  /**
   * Získání a uložení tokenů pro LinkedIn
   * @param userId - ID uživatele v systému
   * @param accessToken - Access token získaný z autorizačního procesu
   * @param expiresIn - Doba platnosti tokenu v sekundách
   * @param refreshToken - Refresh token pro obnovu access tokenu
   */
  public static async storeLinkedInTokens(
    userId: string,
    accessToken: string,
    expiresIn: number,
    refreshToken: string,
    linkedinUserId: string,
    linkedinName: string
  ): Promise<boolean> {
    try {
      webLog('Ukládám tokeny pro LinkedIn', { userId, linkedinName });
      
      // Získání nebo vytvoření konfigurace pro LinkedIn
      let linkedinConfig = await ApiConfig.findOne({ 
        userId: new mongoose.Types.ObjectId(userId),
        platform: 'linkedin' 
      });
      
      if (!linkedinConfig) {
        linkedinConfig = new ApiConfig({
          userId: new mongoose.Types.ObjectId(userId),
          platform: 'linkedin',
          appId: process.env.LINKEDIN_CLIENT_ID,
          appSecret: process.env.LINKEDIN_CLIENT_SECRET,
          configDetails: {}
        });
      }
      
      // Výpočet času expirace
      const expiryDate = new Date();
      expiryDate.setSeconds(expiryDate.getSeconds() + expiresIn);
      
      // Uložení tokenů do konfigurace
      linkedinConfig.accessToken = accessToken;
      linkedinConfig.refreshToken = refreshToken;
      linkedinConfig.tokenExpiry = expiryDate;
      linkedinConfig.configDetails = {
        ...linkedinConfig.configDetails,
        linkedinUserId,
        linkedinName
      };
      
      await linkedinConfig.save();
      
      // Aktualizace uživatelského profilu
      const user = await User.findById(userId);
      
      if (!user) {
        webLog('Uživatel nenalezen', { userId });
        return false;
      }
      
      // Najdeme záznam sociální sítě nebo vytvoříme nový
      const existingNetwork = user.socialNetworks.find(
        (net: any) => net.platform === 'linkedin'
      );
      
      if (existingNetwork) {
        existingNetwork.username = linkedinName;
        existingNetwork.status = 'active';
        existingNetwork.lastChecked = new Date();
        existingNetwork.metadata = {
          ...existingNetwork.metadata,
          userId: linkedinUserId
        };
      } else {
        user.socialNetworks.push({
          platform: 'linkedin',
          username: linkedinName,
          status: 'active',
          lastChecked: new Date(),
          metadata: {
            userId: linkedinUserId
          }
        });
      }
      
      await user.save();
      
      webLog('LinkedIn tokeny úspěšně uloženy', { 
        userId, 
        linkedinName,
        expiryDate
      });
      
      return true;
    } catch (error) {
      webLog('Chyba při ukládání LinkedIn tokenů', { error });
      return false;
    }
  }

  /**
   * Získání LinkedIn tokenu pro uživatele
   * @param userId - ID uživatele v systému
   */
  public static async getLinkedInToken(userId: string): Promise<any> {
    try {
      const linkedinConfig = await ApiConfig.findOne({ 
        userId: new mongoose.Types.ObjectId(userId),
        platform: 'linkedin' 
      });
      
      if (!linkedinConfig) {
        webLog('LinkedIn konfigurace nenalezena', { userId });
        return null;
      }
      
      // Kontrola expirace tokenu
      if (linkedinConfig.tokenExpiry && linkedinConfig.tokenExpiry < new Date()) {
        // Token expiroval, zkusíme ho obnovit
        const refreshed = await this.refreshLinkedInToken(userId);
        if (!refreshed) {
          webLog('Nepodařilo se obnovit LinkedIn token', { userId });
          return null;
        }
        
        // Načteme aktualizovanou konfiguraci
        return await this.getLinkedInToken(userId);
      }
      
      // Vracíme objekt s tokenem a dalšími důležitými údaji
      return {
        userId,
        clientId: process.env.LINKEDIN_CLIENT_ID,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
        accessToken: linkedinConfig.getDecryptedAccessToken(),
        refreshToken: linkedinConfig.getDecryptedRefreshToken(),
        tokenExpiry: linkedinConfig.tokenExpiry,
        linkedinUserId: linkedinConfig.configDetails.linkedinUserId,
        linkedinName: linkedinConfig.configDetails.linkedinName
      };
    } catch (error) {
      webLog('Chyba při získávání LinkedIn tokenu', { error, userId });
      return null;
    }
  }

  /**
   * Obnovení LinkedIn tokenu pro uživatele
   * @param userId - ID uživatele v systému
   */
  public static async refreshLinkedInToken(userId: string): Promise<boolean> {
    try {
      webLog('Obnovuji LinkedIn token', { userId });
      
      const linkedinConfig = await ApiConfig.findOne({ 
        userId: new mongoose.Types.ObjectId(userId),
        platform: 'linkedin' 
      });
      
      if (!linkedinConfig) {
        webLog('LinkedIn konfigurace nenalezena', { userId });
        return false;
      }
      
      // Pokud není refresh token, nemůžeme obnovit
      if (!linkedinConfig.refreshToken) {
        webLog('LinkedIn refresh token nenalezen', { userId });
        return false;
      }
      
      // Pokus o obnovu tokenu pomocí refresh tokenu
      const response = await axios.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        null,
        {
          params: {
            grant_type: 'refresh_token',
            refresh_token: linkedinConfig.getDecryptedRefreshToken(),
            client_id: process.env.LINKEDIN_CLIENT_ID,
            client_secret: process.env.LINKEDIN_CLIENT_SECRET
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      // Uložení nových tokenů
      const expiryDate = new Date();
      expiryDate.setSeconds(expiryDate.getSeconds() + response.data.expires_in);
      
      linkedinConfig.accessToken = response.data.access_token;
      linkedinConfig.refreshToken = response.data.refresh_token || linkedinConfig.refreshToken; // Někdy LinkedIn nevrací nový refresh token
      linkedinConfig.tokenExpiry = expiryDate;
      
      await linkedinConfig.save();
      
      // Aktualizace času poslední kontroly v uživatelském profilu
      const user = await User.findById(userId);
      if (user) {
        const linkedinNetwork = user.socialNetworks.find(
          (net: any) => net.platform === 'linkedin'
        );
        
        if (linkedinNetwork) {
          linkedinNetwork.lastChecked = new Date();
          await user.save();
        }
      }
      
      webLog('LinkedIn token úspěšně obnoven', { 
        userId, 
        expiryDate 
      });
      
      return true;
    } catch (error) {
      webLog('Chyba při obnově LinkedIn tokenu', { error, userId });
      return false;
    }
  }

  /**
   * Obnova expirovaných LinkedIn tokenů
   */
  private static async refreshLinkedInTokens(): Promise<void> {
    try {
      webLog('Kontroluji LinkedIn tokeny');
      
      // Získáme všechny LinkedIn konfigurace s expirovanými tokeny
      const now = new Date();
      const linkedinConfigs = await ApiConfig.find({ 
        platform: 'linkedin',
        tokenExpiry: { $lt: now }
      });
      
      if (linkedinConfigs.length === 0) {
        webLog('Nenalezeny žádné expirované LinkedIn tokeny');
        return;
      }
      
      // Projdeme všechny expirované konfigurace a pokusíme se obnovit tokeny
      for (const config of linkedinConfigs) {
        await this.refreshLinkedInToken(config.userId.toString());
      }
      
      webLog(`Zkontrolováno ${linkedinConfigs.length} LinkedIn konfigurací`);
    } catch (error) {
      webLog('Chyba při kontrole LinkedIn tokenů', { error });
    }
  }
}

// Proměnná pro uložení ID intervalu (pro možnost zrušení)
let tokenRefreshIntervalId: NodeJS.Timeout | null = null;

// Registrace pravidelné kontroly tokenů (každých 24 hodin)
export const setupTokenRefresh = () => {
  const REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24 hodin v milisekundách
  
  // Zrušíme případný existující interval
  if (tokenRefreshIntervalId) {
    clearInterval(tokenRefreshIntervalId);
  }
  
  // Vytvoříme nový interval a uložíme jeho ID
  tokenRefreshIntervalId = setInterval(() => {
    TokenManagerService.refreshExpiredTokens()
      .catch(error => webLog('Chyba při plánované obnově tokenů', { error }));
  }, REFRESH_INTERVAL);
  
  // První kontrola hned při startu serveru
  TokenManagerService.refreshExpiredTokens()
    .catch(error => webLog('Chyba při inicializační obnově tokenů', { error }));
};

// Funkce pro zrušení intervalu (pro případné vypnutí serveru nebo testování)
export const stopTokenRefresh = () => {
  if (tokenRefreshIntervalId) {
    clearInterval(tokenRefreshIntervalId);
    tokenRefreshIntervalId = null;
  }
};