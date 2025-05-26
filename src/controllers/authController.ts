import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { SECURITY_CONFIG } from '../config/config';
import { setAuthCookies } from '../utils/cookieUtils';
import { logger } from '../utils/logger';
import { handleApiError, sendSuccess, asyncHandler } from '../utils/errorHandler';

// Typ pro odpověď uživatele
interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  plan: string;
}

/**
 * Vytvoření JWT tokenu pro uživatele
 * @param userId ID uživatele
 * @returns JWT token nebo null v případě chyby
 */
const createToken = (userId: string): string | null => {
  try {
    console.log('[AUTH] Vytváření tokenu pro uživatele s ID:', userId);
    const secretKey = Buffer.from(SECURITY_CONFIG.jwtSecret, 'utf8');
    
    // Přidáváme expiraci a explicitně definujeme algoritmus
    const token = jwt.sign(
      { id: userId, iat: Math.floor(Date.now() / 1000) }, 
      secretKey,
      { 
        expiresIn: SECURITY_CONFIG.jwtExpiresIn,
        algorithm: SECURITY_CONFIG.jwtAlgorithm as jwt.Algorithm
      }
    );
    
    console.log('[AUTH] Token byl úspěšně vytvořen');
    return token;
  } catch (error) {
    console.error('[AUTH] JWT signing error:', error);
    return null;
  }
};

/**
 * Formátování uživatelské odpovědi bez citlivých dat
 * @param user Uživatelský objekt
 * @returns Formátovaná odpověď
 */
const formatUserResponse = (user: IUser): UserResponse => {
  console.log('[AUTH] Formátování odpovědi pro uživatele:', user.email);
  return {
    id: String(user._id),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    company: user.company,
    plan: user.plan
  };
};

/**
 * Zpracování autentizace a vytvoření odpovědi
 * @param user Uživatelský objekt
 * @param res Response objekt
 * @param statusCode HTTP status kód
 * @param message Zpráva pro uživatele
 * @returns HTTP odpověď
 */
const createAuthResponse = (
  user: IUser,
  res: Response,
  statusCode: number,
  message: string
) => {
  console.log('[AUTH] Vytváření autentizační odpovědi pro uživatele:', user.email);
  
  // Získání ID jako string
  const userId = String(user._id);
  
  // Vytvoření JWT tokenu
  const token = createToken(userId);
  
  if (!token) {
    console.error('[AUTH] Nepodařilo se vytvořit JWT token');
    return handleApiError(
      res,
      500,
      'Chyba při vytváření autentizačního tokenu',
      null,
      '[AUTH]'
    );
  }
  
  // Formátování odpovědi
  const userResponse = formatUserResponse(user);
  
  // Nastavení cookie pro autentizaci - vylepšená verze
  console.log('[AUTH] Nastavuji cookie authToken pro uživatele:', user.email);
  res.cookie('authToken', token, {
    maxAge: 24 * 60 * 60 * 1000, // 1 den
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' // 'strict' může blokovat přesměrování z jiných domén
  });

  // Nastavení druhé cookie (klientské) pro sledování přihlášení
  res.cookie('loggedIn', 'true', {
    maxAge: 24 * 60 * 60 * 1000, // 1 den
    httpOnly: false, // Dostupné pro JavaScript
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  
  console.log('[AUTH] Cookie byla nastavena, odesílám odpověď');
  console.log(`[AUTH] Odpověď má status: ${statusCode}, zpráva: ${message}`);
  
  // Odeslání odpovědi s využitím centrální funkce
  return sendSuccess(
    res, 
    message, 
    { token, user: userResponse }, 
    statusCode
  );
};

// Registrace nového uživatele
export const register = asyncHandler(async (req: Request, res: Response) => {
  console.log('[AUTH] Začíná registrace nového uživatele');
  console.log('[AUTH] Příchozí data:', req.body);
  
  const { email, password, firstName, lastName, company, plan } = req.body;

  // Kontrola vstupních dat
  if (!email || !password || !firstName || !lastName) {
    console.error('[AUTH] Chybějící povinná data pro registraci:', { 
      email: !!email, 
      password: !!password, 
      firstName: !!firstName, 
      lastName: !!lastName 
    });
    return handleApiError(
      res,
      400,
      'Chybí povinná data pro registraci',
      null,
      '[AUTH]'
    );
  }

  // Kontrola, zda uživatel s tímto emailem již existuje
  console.log('[AUTH] Kontrola existujícího uživatele s emailem:', email);
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    console.log('[AUTH] Uživatel s tímto emailem již existuje:', email);
    return handleApiError(
      res,
      400,
      'Uživatel s tímto emailem již existuje',
      null,
      '[AUTH]'
    );
  }

  // Vytvoření nového uživatele
  console.log('[AUTH] Vytváření nového uživatele:', email);
  const user = new User({
    email,
    password, // heslo bude hashováno v pre-save middlewaru
    firstName,
    lastName,
    company,
    plan: plan || 'basic',
    websites: [],
    socialNetworks: []
  });

  // Uložení uživatele do databáze
  console.log('[AUTH] Ukládání uživatele do databáze:', email);
  await user.save();
  console.log('[AUTH] Uživatel byl úspěšně uložen do databáze:', email);

  // Bezpečné získání dokumentu pro vytvoření odpovědi
  const savedUser = await User.findById(user._id);
  if (!savedUser) {
    return handleApiError(
      res,
      500,
      'Chyba při načítání nového uživatele',
      null,
      '[AUTH]'
    );
  }
  
  return createAuthResponse(
    savedUser,
    res,
    201,
    'Uživatel byl úspěšně zaregistrován'
  );
});

// Přihlášení uživatele
export const login = asyncHandler(async (req: Request, res: Response) => {
  console.log('[AUTH] Začíná přihlášení uživatele');
  console.log('[AUTH] Příchozí data:', { email: req.body.email, passwordLength: req.body.password?.length || 0 });
  
  const { email, password } = req.body;

  // Kontrola vstupních dat
  if (!email || !password) {
    console.error('[AUTH] Chybějící přihlašovací údaje');
    return handleApiError(
      res,
      400,
      'Email a heslo jsou povinné údaje',
      null,
      '[AUTH]'
    );
  }

  // Vyhledání uživatele podle emailu
  console.log('[AUTH] Hledání uživatele podle emailu:', email);
  const user = await User.findOne({ email });
  if (!user) {
    console.log('[AUTH] Uživatel s emailem', email, 'nebyl nalezen');
    return handleApiError(
      res,
      401,
      'Neplatné přihlašovací údaje',
      null,
      '[AUTH]'
    );
  }

  // Ověření hesla
  console.log('[AUTH] Ověřování hesla pro uživatele:', email);
  const isPasswordValid = await user.comparePassword(password);
  console.log('[AUTH] Výsledek ověření hesla:', isPasswordValid);
  
  if (!isPasswordValid) {
    console.log('[AUTH] Neplatné heslo pro uživatele:', email);
    return handleApiError(
      res,
      401,
      'Neplatné přihlašovací údaje',
      null,
      '[AUTH]'
    );
  }

  // Aktualizace posledního přihlášení
  console.log('[AUTH] Aktualizace času posledního přihlášení pro uživatele:', email);
  user.lastLogin = new Date();
  await user.save();

  // Vytvoření odpovědi
  return createAuthResponse(
    user,
    res,
    200,
    'Přihlášení proběhlo úspěšně'
  );
});

// Odhlášení uživatele
export const logout = asyncHandler(async (req: Request, res: Response) => {
  console.log('[AUTH] Začíná odhlášení uživatele');
  
  // Nastavení cookie options
  const isDevelopment = process.env.NODE_ENV === 'development';
  const cookieOptions = {
    httpOnly: true,
    secure: !isDevelopment,
    sameSite: 'strict' as const,
    path: '/'
  };
  
  // Vymažeme cookies s aktualizovanými bezpečnostními nastaveními
  res.clearCookie('authToken', cookieOptions);
  
  res.clearCookie('loggedIn', {
    ...cookieOptions,
    httpOnly: false // Tato cookie je čitelná klientem
  });
  
  console.log('[AUTH] Cookies byly vymazány, uživatel odhlášen');
  
  // Přesměrování na hlavní stránku po odhlášení
  return res.redirect('/');
});

// Aktualizace GDPR souhlasu
export const updateConsent = asyncHandler(async (req: Request, res: Response) => {
  console.log('[GDPR] Aktualizace souhlasu cookies');
  
  const { necessary, functional, analytics, marketing } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  
  // Pokud je uživatel přihlášen, uložíme do jeho profilu
  const token = req.cookies?.authToken;
  if (token) {
    try {
      const secretKey = Buffer.from(SECURITY_CONFIG.jwtSecret, 'utf8');
      const decoded = jwt.verify(token, secretKey) as any;
      
      const user = await User.findById(decoded.id);
      if (user) {
        user.gdprConsent = {
          analytics: !!analytics,
          marketing: !!marketing,
          functional: !!functional,
          consentDate: new Date(),
          ipAddress: clientIP,
          userAgent: userAgent
        };
        await user.save();
        console.log('[GDPR] Souhlas uložen pro uživatele:', user.email);
      }
    } catch (error) {
      console.log('[GDPR] Chyba při ukládání souhlasu pro přihlášeného uživatele:', error);
    }
  }
  
  return sendSuccess(res, 'Souhlas byl úspěšně uložen', { 
    consent: { necessary, functional, analytics, marketing } 
  });
});

// Export uživatelských dat (GDPR Článek 20)
export const exportUserData = asyncHandler(async (req: Request, res: Response) => {
  console.log('[GDPR] Export dat - začátek, cookies:', req.cookies);
  
  // Ručně ověřit autentizaci
  const token = req.cookies?.authToken;
  if (!token) {
    console.log('[GDPR] Chybí auth token');
    return handleApiError(res, 401, 'Nejste přihlášeni', null, '[GDPR]');
  }
  
  try {
    const secretKey = Buffer.from(SECURITY_CONFIG.jwtSecret, 'utf8');
    const decoded = jwt.verify(token, secretKey) as any;
    
    const user = await User.findById(decoded.id);
    if (!user) {
      console.log('[GDPR] Uživatel nebyl nalezen');
      return handleApiError(res, 401, 'Uživatel nebyl nalezen', null, '[GDPR]');
    }
    
    console.log('[GDPR] Uživatel ověřen:', user.email);
    
    // Sestavení kompletních dat uživatele
    const userData = {
      personalInfo: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        company: user.company,
        plan: user.plan,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        isActive: user.isActive
      },
      websites: user.websites,
      gdprConsent: user.gdprConsent,
      dataProcessingConsent: user.dataProcessingConsent,
      socialNetworks: user.socialNetworks?.map(sn => ({
        platform: sn.platform,
        username: sn.username,
        status: sn.status,
        connectedAt: sn.connectedAt,
        lastPostAt: sn.lastPostAt,
        publishSettings: sn.publishSettings
        // Nezahrnujeme tokeny z bezpečnostních důvodů
      })),
      exportInfo: {
        exportDate: new Date().toISOString(),
        version: '1.0',
        format: 'JSON'
      }
    };
    
    // Nastavení hlaviček pro stažení
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="user-data-${user._id}-${Date.now()}.json"`);
    
    console.log('[GDPR] Data exportována pro uživatele:', user.email);
    return res.json(userData);
    
  } catch (error) {
    console.log('[GDPR] Chyba ověření tokenu:', error);
    return handleApiError(res, 401, 'Neplatný token', null, '[GDPR]');
  }
});

// Smazání účtu (GDPR Článek 17 - Právo na výmaz)
export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  
  if (!user) {
    return handleApiError(res, 401, 'Uživatel není přihlášen', null, '[GDPR]');
  }
  
  console.log('[GDPR] Žádost o smazání účtu od uživatele:', user.email);
  
  const { confirmPassword } = req.body;
  
  // Ověření hesla pro bezpečnost
  if (!confirmPassword) {
    return handleApiError(res, 400, 'Pro smazání účtu je nutné zadat heslo', null, '[GDPR]');
  }
  
  const isPasswordValid = await user.comparePassword(confirmPassword);
  if (!isPasswordValid) {
    return handleApiError(res, 401, 'Neplatné heslo', null, '[GDPR]');
  }
  
  // Smazání všech souvisejících dat
  try {
    // Smazání naplánovaných příspěvků
    const ScheduledPost = require('../models/ScheduledPost').default;
    await ScheduledPost.deleteMany({ userId: user._id });
    
    // Smazání analýz webů
    const WebAnalysis = require('../models/WebAnalysis').default;
    await WebAnalysis.deleteMany({ userId: user._id });
    
    // Smazání API konfigurací
    const ApiConfig = require('../models/ApiConfig').default;
    await ApiConfig.deleteMany({ userId: user._id });
    
    // Smazání uživatelského účtu
    await User.findByIdAndDelete(user._id);
    
    console.log('[GDPR] Účet a všechna související data byla smazána pro uživatele:', user.email);
    
    // Vymazání cookies
    res.clearCookie('authToken');
    res.clearCookie('loggedIn');
    
    return sendSuccess(res, 'Váš účet a všechna data byla trvale smazána', null);
    
  } catch (error) {
    console.error('[GDPR] Chyba při mazání účtu:', error);
    return handleApiError(res, 500, 'Chyba při mazání účtu', error, '[GDPR]');
  }
});