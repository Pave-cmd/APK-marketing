import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RateLimitWindow {
  timestamp: number;
  count: number;
}

// Úložiště pro rate limiting založené na IP adrese
const ipLimiters: Map<string, RateLimitWindow> = new Map();

// Úložiště pro rate limiting založené na uživatelském ID (vyžaduje autentizaci)
const userLimiters: Map<string, RateLimitWindow> = new Map();

// Konfigurace pro různé typy endpointů - dynamické hodnoty podle prostředí
const isDevelopment = process.env.NODE_ENV === 'development';

const rateLimitConfig = {
  // Pro vývojové prostředí jsou limity mnohem vyšší
  default: { windowMs: 60000, maxRequests: isDevelopment ? 1000 : 100 },
  auth: { windowMs: 60000, maxRequests: isDevelopment ? 100 : 10 },
  website: { windowMs: 60000, maxRequests: isDevelopment ? 200 : 20 },
  social: { windowMs: 60000, maxRequests: isDevelopment ? 200 : 20 }
};

// Čištění starých záznamů každou hodinu
const cleanupIntervalId = setInterval(() => {
  const now = Date.now();
  
  // Vyčisti IP záznamy starší než hodina
  for (const [ip, window] of ipLimiters.entries()) {
    if (now - window.timestamp > 3600000) {
      ipLimiters.delete(ip);
    }
  }
  
  // Vyčisti uživatelské záznamy starší než hodina
  for (const [userId, window] of userLimiters.entries()) {
    if (now - window.timestamp > 3600000) {
      userLimiters.delete(userId);
    }
  }
}, 3600000);

// Funkce pro správné ukončení
export const cleanupRateLimiters = () => {
  clearInterval(cleanupIntervalId);
  ipLimiters.clear();
  userLimiters.clear();
};

/**
 * Middleware pro omezení počtu požadavků
 * @param type Typ endpointu pro nastavení limitů
 */
export const rateLimit = (type: keyof typeof rateLimitConfig = 'default') => {
  const { windowMs, maxRequests } = rateLimitConfig[type];
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Získáme IP adresu nebo uživatelské ID
    const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
    const userId = req.user?._id?.toString();
    
    const now = Date.now();
    let limitExceeded = false;
    
    // Kontrola omezení pro IP adresu
    let ipWindow = ipLimiters.get(clientIp);
    if (!ipWindow) {
      ipWindow = { timestamp: now, count: 1 };
      ipLimiters.set(clientIp, ipWindow);
    } else {
      // Reset počítadla, pokud jsme v novém okně
      if (now - ipWindow.timestamp > windowMs) {
        ipWindow.timestamp = now;
        ipWindow.count = 1;
      } else if (ipWindow.count >= maxRequests) {
        limitExceeded = true;
      } else {
        ipWindow.count += 1;
      }
    }
    
    // Kontrola omezení pro uživatele (pouze pokud je přihlášený)
    if (userId) {
      let userWindow = userLimiters.get(userId);
      
      if (!userWindow) {
        userWindow = { timestamp: now, count: 1 };
        userLimiters.set(userId, userWindow);
      } else {
        // Reset počítadla, pokud jsme v novém okně
        if (now - userWindow.timestamp > windowMs) {
          userWindow.timestamp = now;
          userWindow.count = 1;
        } else if (userWindow.count >= maxRequests) {
          limitExceeded = true;
        } else {
          userWindow.count += 1;
        }
      }
    }
    
    // Pokud bylo překročeno omezení, odpovíme s chybou 429
    if (limitExceeded) {
      logger.warn(`Rate limit překročen: ${clientIp}, userId: ${userId || 'nepřihlášen'}, path: ${req.path}`);
      return res.status(429).json({
        success: false,
        message: 'Příliš mnoho požadavků. Zkuste to prosím znovu později.'
      });
    }
    
    next();
  };
};