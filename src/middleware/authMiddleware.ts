// Middleware pro ověření uživatele pomocí JWT tokenu
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SECURITY_CONFIG } from '../config/config';
import User from '../models/User';
import { setAuthCookies } from '../utils/cookieUtils';

// Import typu uživatele
import { IUser } from '../models/User';

// Použijeme typ IUser namísto any
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      token?: string;
    }
  }
}

// Middleware pro ověření, že uživatel je přihlášen pomocí JWT tokenu
export const auth = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  try {
    console.log('[DEBUG AUTH] Auth middleware - začátek ověření');
    console.log('[DEBUG AUTH] Method:', req.method, 'Original URL:', req.originalUrl, 'Path:', req.path);

    // Zabránění nekonečné smyčce - pokud jdeme na přihlašovací stránku nebo je to opakované přesměrování,
    // nikdy nepřesměrováváme zpět na přihlášení
    if (req.path === '/prihlaseni' || req.path.includes('/prihlaseni?from=')) {
      console.log('[DEBUG AUTH] Přístup na přihlašovací stránku - neautentizujeme');
      return next();
    }

    // Detekce nekonečné smyčky přesměrování
    const redirectCount = req.get('X-Redirect-Count') ? parseInt(req.get('X-Redirect-Count') || '0', 10) : 0;
    if (redirectCount > 3) {
      console.log('[DEBUG AUTH] Detekována možná nekonečná smyčka přesměrování, stav:', redirectCount);
      return res.status(500).render('errors/500', {
        title: 'Chyba serveru | APK-marketing',
        description: 'Došlo k chybě při zpracování požadavku - příliš mnoho přesměrování'
      });
    }

    // Pro API requesty vracíme JSON chyby místo přesměrování
    const isApiRequest = req.originalUrl.startsWith('/api/');
    console.log('[DEBUG AUTH] Je to API request?', isApiRequest, 'path:', req.path, 'originalUrl:', req.originalUrl);

    // Získání tokenu z různých zdrojů (hlavička, cookie, query parametr)
    let token = '';
    const authHeader = req.headers.authorization;

    // Výpis všech cookies a hlaviček pro diagnostiku
    console.log('[DEBUG AUTH] Kompletní cookies:', req.cookies);
    console.log('[DEBUG AUTH] Auth cookie:', req.cookies?.authToken ? 'Existuje' : 'Chybí');
    console.log('[DEBUG AUTH] LoggedIn cookie:', req.cookies?.loggedIn ? 'Existuje' : 'Chybí');
    console.log('[DEBUG AUTH] Auth header:', req.headers.authorization ? 'Existuje' : 'Chybí');

    // Kontrola všech možných lokací tokenu
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Token z Authorization hlavičky
      token = authHeader.substring(7);
      console.log('[DEBUG AUTH] Token získán z Authorization hlavičky');
    } else if (req.cookies && req.cookies.authToken) {
      // Token z cookies
      token = req.cookies.authToken;
      console.log('[DEBUG AUTH] Token získán z cookies');
    } else if (req.query && req.query.token) {
      // Token z query parametru (z URL)
      token = req.query.token as string;
      console.log('[DEBUG AUTH] Token získán z query parametru');

      // Uložení tokenu do cookie pro další požadavky pomocí sdílené utility
      setAuthCookies(res, token);
    } else {
      // Kontrola všech cookies
      const allCookies = req.headers.cookie;
      console.log('[DEBUG AUTH] Všechny cookies v hlavičce:', allCookies);
    }

    // Pokud token neexistuje
    if (!token) {
      console.log('[DEBUG AUTH] Token nebyl nalezen');

      if (res.headersSent) {
        console.log('[DEBUG AUTH] Hlavičky již odeslány, nelze poslat odpověď');
        return;
      }
      
      if (isApiRequest) {
        return res.status(401).json({
          success: false,
          message: 'Nejste přihlášeni. Přihlaste se a zkuste to znovu.'
        });
      } else {
        // Přidání parametru from pro zabránění nekonečných přesměrování
        const redirectUrl = '/prihlaseni?from=' + encodeURIComponent(req.path);
        console.log('[DEBUG AUTH] Přesměrování na:', redirectUrl);
        return res.redirect(redirectUrl);
      }
    }

    console.log('[DEBUG AUTH] Token nalezen');

    // Ověření tokenu
    const secretKey = Buffer.from(SECURITY_CONFIG.jwtSecret || 'default-secret-key', 'utf8');

    try {
      console.log('[DEBUG AUTH] Ověřování JWT tokenu...');
      const decoded = jwt.verify(token, secretKey) as { id: string };
      console.log('[DEBUG AUTH] Token je platný, ID uživatele:', decoded.id);

      // Vyhledání uživatele podle ID
      const user = await User.findById(decoded.id) as { _id: string, [key: string]: any } | null;

      if (!user) {
        console.log('[DEBUG AUTH] Uživatel s ID', decoded.id, 'nebyl nalezen v databázi');

        if (res.headersSent) {
          console.log('[DEBUG AUTH] Hlavičky již odeslány, nelze poslat odpověď');
          return;
        }
        
        if (isApiRequest) {
          return res.status(401).json({
            success: false,
            message: 'Uživatel nebyl nalezen. Přihlaste se znovu.'
          });
        } else {
          const redirectUrl = '/prihlaseni';
          console.log('[DEBUG AUTH] Přesměrování na:', redirectUrl);
          return res.redirect(redirectUrl);
        }
      }

      // Přidání informací o uživateli a tokenu do požadavku
      // Důležité - převést ID na string pro konzistentní použití
      const userObj = user.toObject();
      req.user = {
        ...userObj,
        id: user._id.toString()
      };
      req.userId = user._id.toString(); // Pro kompatibilitu s AuthRequest interface
      req.token = token;

      console.log('[DEBUG AUTH] Uživatel úspěšně ověřen:', {
        id: req.user?.id,
        email: req.user?.email,
        websites: req.user?.websites || []
      });

      // Kontrola, zda již nebyla odeslána odpověď
      if (!res.headersSent) {
        console.log('[DEBUG AUTH] Pokračuji do next() pro vykreslení chráněného obsahu');
        next();
        // Důležité: Nepoužíváme return next() - způsobuje, že middleware pokračuje dál
        return;
      } else {
        console.log('[DEBUG AUTH] Hlavičky již byly odeslány, nevoláme next()');
      }
    } catch (error) {
      // Neplatný token
      console.error('[DEBUG AUTH] Chyba ověření tokenu:', error);

      if (res.headersSent) {
        console.log('[DEBUG AUTH] Hlavičky již odeslány, nelze poslat odpověď');
        return;
      }
      
      if (isApiRequest) {
        return res.status(401).json({
          success: false,
          message: 'Platnost vašeho přihlášení vypršela. Přihlaste se znovu.'
        });
      } else {
        // Přidání parametru from pro zabránění nekonečných přesměrování
        const redirectUrl = '/prihlaseni?from=' + encodeURIComponent(req.path);
        console.log('[DEBUG AUTH] Přesměrování na:', redirectUrl);
        return res.redirect(redirectUrl);
      }
    }
  } catch (error) {
    console.error('[DEBUG AUTH] Chyba v auth middleware:', error);

    if (res.headersSent) {
      console.log('[DEBUG AUTH] Hlavičky již odeslány, nelze poslat odpověď');
      return;
    }
    
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(500).json({
        success: false,
        message: 'Chyba při ověřování přihlášení.'
      });
    } else {
      const redirectUrl = '/prihlaseni';
      console.log('[DEBUG AUTH] Přesměrování na:', redirectUrl);
      return res.redirect(redirectUrl);
    }
  }
};

// Middleware pro přístupová práva administrátora
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).render('errors/403', { 
      title: 'Přístup odepřen | APK-marketing',
      description: 'Nemáte dostatečná oprávnění pro přístup k této stránce'
    });
  }
};

// Middleware pro API autentizaci
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  try {
    // Získání tokenu z cookies nebo hlavičky
    let token = '';
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.authToken) {
      token = req.cookies.authToken;
    }
    
    // Pokud token neexistuje
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - no token provided'
      });
    }
    
    // Ověření tokenu
    const secretKey = Buffer.from(SECURITY_CONFIG.jwtSecret || 'default-secret-key', 'utf8');
    
    try {
      const decoded = jwt.verify(token, secretKey) as { id: string };
      
      // Vyhledání uživatele podle ID
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized - user not found'
        });
      }
      
      // Přidání informací o uživateli do požadavku
      req.user = user;
      req.token = token;
      
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - invalid token'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication'
    });
  }
};