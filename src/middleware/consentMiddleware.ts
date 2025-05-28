import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express';
import User from '../models/User';

// Middleware pro kontrolu souhlasu před OAuth flow
export const consentMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, error: 'Neautorizovaný přístup' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Uživatel nenalezen' });
    }

    // Kontrola, zda uživatel udělil souhlas
    if (!user.consentGiven) {
      // Přesměrování na stránku se souhlasem
      return res.redirect(`/dashboard/consent?platform=${req.params?.platform || ''}&returnUrl=${encodeURIComponent(req.originalUrl || '')}`);
    }

    // Kontrola stáří souhlasu (1 rok)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    if (user.consentDate && user.consentDate < oneYearAgo) {
      // Souhlas je starší než rok, vyžadujeme obnovení
      return res.redirect(`/dashboard/consent?platform=${req.params?.platform || ''}&returnUrl=${encodeURIComponent(req.originalUrl || '')}&renew=true`);
    }

    next();
  } catch (error) {
    console.error('Chyba v consent middleware:', error);
    res.status(500).json({ success: false, error: 'Interní chyba serveru' });
  }
};

// Middleware pro kontrolu souhlasu s datovým zpracováním
export const dataProcessingConsentMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, error: 'Neautorizovaný přístup' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Uživatel nenalezen' });
    }

    // Kontrola souhlasu s konkrétním typem zpracování
    const requiredConsent = req.get('x-required-consent');
    
    if (requiredConsent) {
      const consents = requiredConsent.split(',');
      for (const consent of consents) {
        if (consent === 'socialMediaPosting' && !user.dataProcessingConsent.socialMediaPosting) {
          return res.status(403).json({ 
            success: false, 
            error: 'Vyžadován souhlas s publikováním na sociálních sítích',
            requiredConsent: 'socialMediaPosting'
          });
        }
        if (consent === 'websiteAnalysis' && !user.dataProcessingConsent.websiteAnalysis) {
          return res.status(403).json({ 
            success: false, 
            error: 'Vyžadován souhlas s analýzou webových stránek',
            requiredConsent: 'websiteAnalysis'
          });
        }
        if (consent === 'contentGeneration' && !user.dataProcessingConsent.contentGeneration) {
          return res.status(403).json({ 
            success: false, 
            error: 'Vyžadován souhlas s generováním obsahu',
            requiredConsent: 'contentGeneration'
          });
        }
      }
    }

    next();
  } catch (error) {
    console.error('Chyba v data processing consent middleware:', error);
    res.status(500).json({ success: false, error: 'Interní chyba serveru' });
  }
};