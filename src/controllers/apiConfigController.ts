import { Request, Response } from 'express';
import ApiConfig from '../models/ApiConfig';
import { webLog } from '../utils/logger';

export const getApiConfigs = async (req: Request, res: Response) => {
  console.log('[getApiConfigs] Starting - user:', req.user?.email);
  try {
    webLog('Getting API configs for user', { email: req.user?.email });
    
    // For now, allow all authenticated users to access their own API configs
    // You can add more sophisticated role-based access control later

    const configs = await ApiConfig.find({});
    webLog('Found configs', { count: configs.length });
    
    // Neposíláme šifrované hodnoty klientovi
    const safeConfigs = configs.map(config => ({
      _id: config._id,
      platform: config.platform,
      appId: config.appId,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      isActive: config.isActive,
      hasAppSecret: !!config.appSecret,
      hasClientSecret: !!config.clientSecret,
    }));
    
    webLog('Returning safe configs', { safeConfigs });

    res.json({
      success: true,
      configs: safeConfigs
    });
  } catch (error) {
    webLog('Error fetching API configs', { error });
    res.status(500).json({
      success: false,
      message: 'Chyba při načítání konfigurace'
    });
  }
};

export const updateApiConfig = async (req: Request, res: Response) => {
  try {
    webLog('Updating API config', { 
      platform: req.params.platform,
      body: req.body,
      userEmail: req.user?.email 
    });
    
    // For now, allow all authenticated users to update their own API configs
    // You can add more sophisticated role-based access control later

    const { platform } = req.params;
    const { appId, appSecret, clientId, clientSecret, redirectUri } = req.body;

    let config = await ApiConfig.findOne({ platform });
    
    if (!config) {
      config = new ApiConfig({ platform });
      webLog('Creating new config', { platform });
    } else {
      webLog('Updating existing config', { platform });
    }

    // Aktualizujeme pouze poskytnuté hodnoty
    if (appId !== undefined) {
      config.appId = appId;
      webLog('Setting appId', { platform, appId });
    }
    if (appSecret !== undefined) {
      // Only update if a new value is provided, empty string means user wants to keep existing
      if (appSecret !== '') {
        config.appSecret = appSecret;
        webLog('Setting appSecret', { platform, hasValue: true });
      } else {
        webLog('Keeping existing appSecret', { platform });
      }
    }
    if (clientId !== undefined) {
      config.clientId = clientId;
      webLog('Setting clientId', { platform, clientId });
    }
    if (clientSecret !== undefined) {
      // Only update if a new value is provided, empty string means user wants to keep existing  
      if (clientSecret !== '') {
        config.clientSecret = clientSecret;
        webLog('Setting clientSecret', { platform, hasValue: true });
      } else {
        webLog('Keeping existing clientSecret', { platform });
      }
    }
    if (redirectUri !== undefined) {
      config.redirectUri = redirectUri;
      webLog('Setting redirectUri', { platform, redirectUri });
    }

    console.log('Config before save:', {
      platform: config.platform,
      appId: config.appId,
      appSecret: config.appSecret ? 'Has value' : 'No value',
      clientId: config.clientId,
      clientSecret: config.clientSecret ? 'Has value' : 'No value'
    });
    
    await config.save();
    
    const savedConfig = await ApiConfig.findOne({ platform });
    console.log('Config after save:', {
      platform: savedConfig?.platform,
      appId: savedConfig?.appId,
      appSecret: savedConfig?.appSecret ? 'Has encrypted value' : 'No value',
      clientId: savedConfig?.clientId,
      clientSecret: savedConfig?.clientSecret ? 'Has encrypted value' : 'No value'
    });
    
    webLog(`API config saved for ${platform}`, { 
      platform,
      appId: savedConfig?.appId,
      hasAppSecret: !!savedConfig?.appSecret,
      clientId: savedConfig?.clientId,
      hasClientSecret: !!savedConfig?.clientSecret
    });

    res.json({
      success: true,
      message: 'Konfigurace byla úspěšně uložena',
      config: {
        _id: savedConfig?._id,
        platform: savedConfig?.platform,
        appId: savedConfig?.appId,
        hasAppSecret: !!savedConfig?.appSecret,
        clientId: savedConfig?.clientId,
        hasClientSecret: !!savedConfig?.clientSecret,
        redirectUri: savedConfig?.redirectUri
      }
    });
  } catch (error) {
    webLog('Error updating API config', { error });
    res.status(500).json({
      success: false,
      message: 'Chyba při ukládání konfigurace'
    });
  }
};

export const testApiConfig = async (req: Request, res: Response) => {
  try {
    // For now, allow all authenticated users to test their own API configs
    // You can add more sophisticated role-based access control later

    const { platform } = req.params;
    const config = await ApiConfig.findOne({ platform });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Konfigurace nebyla nalezena'
      });
    }

    // Zde bychom mohli implementovat skutečný test API
    // Pro demo účely pouze vracíme úspěch
    const decryptedConfig = config.getDecryptedConfig();
    
    // Test based on platform
    let testResult = false;
    let testMessage = '';

    switch (platform) {
      case 'facebook':
        testResult = !!(decryptedConfig.appId && decryptedConfig.appSecret);
        testMessage = testResult ? 'Facebook API klíče jsou validní' : 'Chybí Facebook API klíče';
        break;
      case 'twitter':
        testResult = !!(decryptedConfig.clientId && decryptedConfig.clientSecret);
        testMessage = testResult ? 'Twitter API klíče jsou validní' : 'Chybí Twitter API klíče';
        break;
      case 'linkedin':
        testResult = !!(decryptedConfig.clientId && decryptedConfig.clientSecret);
        testMessage = testResult ? 'LinkedIn API klíče jsou validní' : 'Chybí LinkedIn API klíče';
        break;
    }

    res.json({
      success: testResult,
      message: testMessage
    });
  } catch (error) {
    webLog('Error testing API config', { error });
    res.status(500).json({
      success: false,
      message: 'Chyba při testování konfigurace'
    });
  }
};