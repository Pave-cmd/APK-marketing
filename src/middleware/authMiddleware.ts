// Middleware pro ověření uživatele pomocí JWT tokenu
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SECURITY_CONFIG } from '../config/config';
import User from '../models/User';

// Rozšíření typů Express Request
declare global {
  namespace Express {
    interface Request {
      user?: any;
      token?: string;
    }
  }
}

// Middleware pro ověření, že uživatel je přihlášen pomocí JWT tokenu
export const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Auth middleware - začátek ověření');
    
    // Získání tokenu z různých zdrojů (hlavička, cookie, query parametr)
    let token = '';
    const authHeader = req.headers.authorization;
    
    // Výpis všech cookies pro diagnostiku
    console.log('Cookies:', req.cookies);
    console.log('Query params:', req.query);
    console.log('Headers:', req.headers);
    
    // Kontrola všech možných lokací tokenu
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Token z Authorization hlavičky
      token = authHeader.substring(7);
      console.log('Token získán z Authorization hlavičky');
    } else if (req.cookies && req.cookies.authToken) {
      // Token z cookies
      token = req.cookies.authToken;
      console.log('Token získán z cookies');
    } else if (req.query && req.query.token) {
      // Token z query parametru (z URL)
      token = req.query.token as string;
      console.log('Token získán z query parametru');
      
      // Uložení tokenu do cookie pro další požadavky
      res.cookie('authToken', token, { 
        maxAge: 24 * 60 * 60 * 1000, // 1 den
        httpOnly: true,
        path: '/'
      });
    } else {
      // Kontrola všech cookies
      const allCookies = req.headers.cookie;
      console.log('Všechny cookies v hlavičce:', allCookies);
    }

    // Pokud token neexistuje
    if (!token) {
      console.log('Token nebyl nalezen, přesměrování na přihlášení');
      return res.redirect('/prihlaseni');
    }

    console.log('Token nalezen');

    // Ověření tokenu
    const secretKey = Buffer.from(SECURITY_CONFIG.jwtSecret || 'default-secret-key', 'utf8');
    
    try {
      console.log('Ověřování JWT tokenu...');
      const decoded = jwt.verify(token, secretKey) as { id: string };
      console.log('Token je platný, ID uživatele:', decoded.id);
      
      // Vyhledání uživatele podle ID
      const user = await User.findById(decoded.id);
      
      if (!user) {
        console.log('Uživatel s ID', decoded.id, 'nebyl nalezen v databázi');
        return res.redirect('/prihlaseni');
      }
      
      // Přidání informací o uživateli a tokenu do požadavku
      req.user = user;
      req.token = token;
      
      console.log('Uživatel úspěšně ověřen, pokračuji dál...');
      next();
    } catch (error) {
      // Neplatný token
      console.error('Chyba ověření tokenu:', error);
      return res.redirect('/prihlaseni');
    }
  } catch (error) {
    console.error('Chyba v auth middleware:', error);
    return res.redirect('/prihlaseni');
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