import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

// Úložiště pro CSRF tokeny (token -> {userId, expires})
interface TokenEntry {
  userId: string;
  expires: number;
}

const csrfTokens: Map<string, TokenEntry> = new Map();

// Doba platnosti tokenu - 2 hodiny
const TOKEN_EXPIRY = 2 * 60 * 60 * 1000; 

// Seznam cest, které jsou osvobozeny od CSRF ochrany
const CSRF_EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/webhook/',
  '/api/emergency',
  '/api/direct-add',      // Přidána cesta pro přímé přidání webu
  '/api/websites/add',    // Přidána cesta pro standardní přidání webu
  '/api/test'             // Testovací cesta
];

/**
 * Generování CSRF tokenu
 * @param userId ID přihlášeného uživatele
 * @returns Vygenerovaný CSRF token
 */
export const generateCsrfToken = (userId: string): string => {
  // Generování náhodného tokenu
  const token = crypto.randomBytes(32).toString('hex');
  
  // Uložení tokenu s informacemi o uživateli a expirace
  csrfTokens.set(token, {
    userId,
    expires: Date.now() + TOKEN_EXPIRY
  });
  
  return token;
};

/**
 * Middleware pro nastavení CSRF tokenu do cookies a response
 */
export const setCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  // Pokud uživatel není přihlášený, pokračujeme bez CSRF tokenu
  if (!req.user || !req.user._id) {
    return next();
  }
  
  const userId = req.user._id.toString();
  const token = generateCsrfToken(userId);
  
  // Přidání CSRF tokenu do cookies
  res.cookie('csrf-token', token, {
    httpOnly: false, // Musí být dostupné pro JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_EXPIRY
  });
  
  // Předáme token do response
  res.locals.csrfToken = token;
  
  next();
};

/**
 * Middleware pro validaci CSRF tokenu
 */
export const validateCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  // DEVELOPMENT ONLY: V development módu můžeme CSRF ochranu úplně přeskočit pro jednodušší testování
  const isDevelopment = process.env.NODE_ENV === 'development';
  const disableCsrfInDev = true; // Změňte na false pokud chcete testovat CSRF ochranu i v development módu
  
  if (isDevelopment && disableCsrfInDev) {
    return next();
  }
  
  // Kontrola, zda metoda vyžaduje CSRF token
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Kontrola, zda cesta je vyjmuta z CSRF ochrany
  for (const exemptPath of CSRF_EXEMPT_PATHS) {
    if (req.path.startsWith(exemptPath)) {
      return next();
    }
  }
  
  // Získání CSRF tokenu z hlavičky nebo těla
  const token = 
    req.headers['x-csrf-token'] || 
    req.headers['csrf-token'] || 
    req.body._csrf;
  
  if (!token || typeof token !== 'string') {
    logger.warn(`CSRF token chybí: ${req.method} ${req.path}`);
    return res.status(403).json({
      success: false,
      message: 'CSRF token chybí'
    });
  }
  
  // Validace tokenu
  const tokenEntry = csrfTokens.get(token);
  
  if (!tokenEntry) {
    logger.warn(`Neplatný CSRF token: ${req.method} ${req.path}`);
    return res.status(403).json({
      success: false,
      message: 'Neplatný CSRF token'
    });
  }
  
  // Kontrola expirace
  if (Date.now() > tokenEntry.expires) {
    csrfTokens.delete(token);
    logger.warn(`Expirovaný CSRF token: ${req.method} ${req.path}`);
    return res.status(403).json({
      success: false,
      message: 'CSRF token expiroval, načtěte stránku znovu'
    });
  }
  
  // Kontrola, zda token patří přihlášenému uživateli
  if (req.user && req.user._id && req.user._id.toString() !== tokenEntry.userId) {
    logger.warn(`CSRF token patří jinému uživateli: ${req.method} ${req.path}`);
    return res.status(403).json({
      success: false,
      message: 'Neplatný CSRF token'
    });
  }
  
  next();
};

// Čištění expirovaných tokenů každou hodinu
const cleanupIntervalId = setInterval(() => {
  const now = Date.now();
  
  for (const [token, entry] of csrfTokens.entries()) {
    if (now > entry.expires) {
      csrfTokens.delete(token);
    }
  }
}, 60 * 60 * 1000);

// Funkce pro správné ukončení
export const cleanupCsrfTokens = () => {
  clearInterval(cleanupIntervalId);
  csrfTokens.clear();
};