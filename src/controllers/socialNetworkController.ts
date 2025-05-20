import { Request, Response } from 'express';
import User from '../models/User';
import ApiConfig from '../models/ApiConfig';
import { webLog } from '../utils/logger';
import axios from 'axios';

export const addSocialNetwork = async (req: Request, res: Response) => {
  try {
    const { platform, accountId, profileUrl } = req.body;
    const userId = req.user._id;

    if (!platform || !accountId || !profileUrl) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: platform, accountId, profileUrl'
      });
    }

    webLog(`Adding social network ${platform} for user ${userId}`, { platform, accountId, profileUrl });

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if network already exists
    const existingNetwork = user.socialNetworks.find(
      net => net.platform === platform && net.accountId === accountId
    );
    
    if (existingNetwork) {
      return res.status(400).json({
        success: false,
        message: 'This social network is already connected'
      });
    }

    // Add the social network
    user.socialNetworks.push({
      platform,
      accountId,
      accessToken: 'temp-token', // In real app, this would be obtained through OAuth
      isConnected: true
    });

    await user.save();

    webLog(`Successfully added ${platform} for user ${userId}`);

    res.json({
      success: true,
      message: 'Social network added successfully',
      socialNetworks: user.socialNetworks
    });
  } catch (error) {
    webLog('Error adding social network', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to add social network'
    });
  }
};

export const removeSocialNetwork = async (req: Request, res: Response) => {
  try {
    const { networkId } = req.params;
    const userId = req.user._id;

    webLog(`Removing social network ${networkId} for user ${userId}`);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove the social network
    user.socialNetworks = user.socialNetworks.filter(
      (network: any) => network._id.toString() !== networkId
    );

    await user.save();

    webLog(`Successfully removed social network ${networkId} for user ${userId}`);

    res.json({
      success: true,
      message: 'Social network removed successfully',
      socialNetworks: user.socialNetworks
    });
  } catch (error) {
    webLog('Error removing social network', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to remove social network'
    });
  }
};

export const getSocialNetworks = async (req: Request, res: Response) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      socialNetworks: user.socialNetworks
    });
  } catch (error) {
    webLog('Error fetching social networks', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch social networks'
    });
  }
};

export const authenticateSocialNetwork = async (req: Request, res: Response) => {
  try {
    const { networkId } = req.params;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const network = user.socialNetworks.find(
      (net: any) => net._id.toString() === networkId
    );

    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'Social network not found'
      });
    }

    // Get API config from database
    const apiConfig = await ApiConfig.findOne({ platform: network.platform });
    
    if (!apiConfig) {
      return res.status(400).json({
        success: false,
        message: `API konfigurace pro ${network.platform} nebyla nalezena. Prosím nastavte API klíče v administraci.`
      });
    }
    
    const decryptedConfig = apiConfig.getDecryptedConfig();
    
    // Generate OAuth URL based on platform
    let authUrl = '';
    const redirectUri = process.env.APP_URL ? `${process.env.APP_URL}/api/social-networks/callback/${network.platform}` : `http://localhost:3000/api/social-networks/callback/${network.platform}`;
    
    switch (network.platform) {
      case 'facebook':
        if (!decryptedConfig.appId || !decryptedConfig.appSecret) {
          return res.status(400).json({
            success: false,
            message: 'Facebook API klíče nejsou nastaveny'
          });
        }
        authUrl = `https://www.facebook.com/v17.0/dialog/oauth?client_id=${decryptedConfig.appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=pages_read_engagement,public_profile&state=${networkId}`;
        break;
      case 'instagram':
        // Instagram uses Facebook login
        if (!decryptedConfig.appId || !decryptedConfig.appSecret) {
          return res.status(400).json({
            success: false,
            message: 'Instagram API klíče nejsou nastaveny'
          });
        }
        authUrl = `https://www.facebook.com/v17.0/dialog/oauth?client_id=${decryptedConfig.appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=instagram_basic,instagram_content_publish&state=${networkId}`;
        break;
      case 'twitter':
        // Twitter OAuth 2.0
        if (!decryptedConfig.clientId || !decryptedConfig.clientSecret) {
          return res.status(400).json({
            success: false,
            message: 'Twitter API klíče nejsou nastaveny'
          });
        }
        authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${decryptedConfig.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=tweet.read%20tweet.write%20users.read&state=${networkId}&code_challenge=${generateCodeChallenge()}&code_challenge_method=S256`;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Platform not supported for OAuth'
        });
    }

    res.json({
      success: true,
      authUrl
    });
  } catch (error) {
    webLog('Error generating auth URL', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to generate authentication URL'
    });
  }
};

function generateCodeChallenge(): string {
  // Simple code challenge generation for OAuth 2.0 PKCE
  return 'test-challenge-' + Date.now();
}

export const handleOAuthCallback = async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).redirect('/dashboard/socialni-site?error=missing_params');
    }
    
    // Find the network by state (networkId)
    const user = await User.findOne({ 'socialNetworks._id': state });
    if (!user) {
      return res.status(404).redirect('/dashboard/socialni-site?error=network_not_found');
    }
    
    const network = user.socialNetworks.find(
      (net: any) => net._id.toString() === state
    );
    
    if (!network) {
      return res.status(404).redirect('/dashboard/socialni-site?error=network_not_found');
    }
    
    // Exchange code for access token based on platform
    let accessToken = '';
    let refreshToken = '';
    
    try {
      switch (platform) {
        case 'facebook': {
          const apiConfig = await ApiConfig.findOne({ platform: 'facebook' });
          if (!apiConfig) {
            throw new Error('Facebook API config not found');
          }
          const decryptedConfig = apiConfig.getDecryptedConfig();
          
          const fbResponse = await axios.get(
            `https://graph.facebook.com/v17.0/oauth/access_token`,
            {
              params: {
                client_id: decryptedConfig.appId,
                client_secret: decryptedConfig.appSecret,
                code: code as string,
                redirect_uri: process.env.APP_URL ? `${process.env.APP_URL}/api/social-networks/callback/facebook` : `http://localhost:3000/api/social-networks/callback/facebook`
              }
            }
          );
          accessToken = fbResponse.data.access_token;
          
          // Exchange for long-lived token
          const longLivedResponse = await axios.get(
            `https://graph.facebook.com/v17.0/oauth/access_token`,
            {
              params: {
                grant_type: 'fb_exchange_token',
                client_id: decryptedConfig.appId,
                client_secret: decryptedConfig.appSecret,
                fb_exchange_token: accessToken
              }
            }
          );
          accessToken = longLivedResponse.data.access_token;
          break;
        }
          
        case 'twitter': {
          const apiConfig = await ApiConfig.findOne({ platform: 'twitter' });
          if (!apiConfig) {
            throw new Error('Twitter API config not found');
          }
          const decryptedConfig = apiConfig.getDecryptedConfig();
          
          const twitterResponse = await axios.post(
            'https://api.twitter.com/2/oauth2/token',
            new URLSearchParams({
              code: code as string,
              grant_type: 'authorization_code',
              client_id: decryptedConfig.clientId!,
              redirect_uri: `${process.env.APP_URL}/api/social-networks/callback/twitter`,
              code_verifier: 'test-challenge' // Should be stored and retrieved properly
            }),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(
                  `${decryptedConfig.clientId}:${decryptedConfig.clientSecret}`
                ).toString('base64')}`
              }
            }
          );
          accessToken = twitterResponse.data.access_token;
          refreshToken = twitterResponse.data.refresh_token || '';
          break;
        }
          
        case 'linkedin': {
          const apiConfig = await ApiConfig.findOne({ platform: 'linkedin' });
          if (!apiConfig) {
            throw new Error('LinkedIn API config not found');
          }
          const decryptedConfig = apiConfig.getDecryptedConfig();
          
          const linkedinResponse = await axios.post(
            'https://www.linkedin.com/oauth/v2/accessToken',
            new URLSearchParams({
              grant_type: 'authorization_code',
              code: code as string,
              client_id: decryptedConfig.clientId!,
              client_secret: decryptedConfig.clientSecret!,
              redirect_uri: `${process.env.APP_URL}/api/social-networks/callback/linkedin`
            }),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            }
          );
          accessToken = linkedinResponse.data.access_token;
          break;
        }
      }
      
      // Update the network with the access token
      network.accessToken = accessToken;
      network.refreshToken = refreshToken;
      network.isConnected = true;
      network.connectedAt = new Date();
      
      await user.save();
      
      webLog(`OAuth successful for ${platform}`, { userId: user._id, networkId: network._id });
      
      res.redirect('/dashboard/socialni-site?auth=success');
    } catch (error) {
      webLog(`OAuth error for ${platform}`, { error });
      res.redirect('/dashboard/socialni-site?auth=error');
    }
  } catch (error) {
    webLog('OAuth callback error', { error });
    res.redirect('/dashboard/socialni-site?error=server_error');
  }
};

export const publishToSocialNetwork = async (req: Request, res: Response) => {
  try {
    const { networkId } = req.params;
    const { content, imageUrl } = req.body;
    const userId = req.user._id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const network = user.socialNetworks.find(
      (net: any) => net._id.toString() === networkId
    );
    
    if (!network) {
      return res.status(404).json({
        success: false,
        message: 'Social network not found'
      });
    }
    
    if (!network.isConnected || !network.accessToken || network.accessToken === 'temp-token') {
      return res.status(400).json({
        success: false,
        message: 'Network not authenticated'
      });
    }
    
    let result;
    
    try {
      switch (network.platform) {
        case 'facebook': {
          // Get page access token if posting to page
          const pagesResponse = await axios.get(
            `https://graph.facebook.com/v17.0/me/accounts`,
            {
              params: {
                access_token: network.accessToken
              }
            }
          );
          
          const pages = pagesResponse.data.data;
          const pageAccessToken = pages.length > 0 ? pages[0].access_token : network.accessToken;
          const pageId = pages.length > 0 ? pages[0].id : 'me';
          
          // Post to Facebook
          result = await axios.post(
            `https://graph.facebook.com/v17.0/${pageId}/feed`,
            {
              message: content,
              ...(imageUrl && { picture: imageUrl })
            },
            {
              params: {
                access_token: pageAccessToken
              }
            }
          );
          break;
        }
          
        case 'twitter': {
          result = await axios.post(
            'https://api.twitter.com/2/tweets',
            {
              text: content
            },
            {
              headers: {
                'Authorization': `Bearer ${network.accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          break;
        }
          
        case 'linkedin': {
          const linkedinProfile = await axios.get(
            'https://api.linkedin.com/v2/me',
            {
              headers: {
                'Authorization': `Bearer ${network.accessToken}`
              }
            }
          );
          
          result = await axios.post(
            'https://api.linkedin.com/v2/ugcPosts',
            {
              author: `urn:li:person:${linkedinProfile.data.id}`,
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
            },
            {
              headers: {
                'Authorization': `Bearer ${network.accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
              }
            }
          );
          break;
        }
          
        default:
          return res.status(400).json({
            success: false,
            message: 'Platform not supported for publishing'
          });
      }
      
      webLog(`Successfully published to ${network.platform}`, { networkId, userId });
      
      res.json({
        success: true,
        message: 'Successfully published to ' + network.platform,
        result: result.data
      });
    } catch (error: any) {
      webLog(`Error publishing to ${network.platform}`, { error, networkId });
      res.status(500).json({
        success: false,
        message: 'Failed to publish to ' + network.platform,
        error: error.message
      });
    }
  } catch (error) {
    webLog('Error in publish endpoint', { error });
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};