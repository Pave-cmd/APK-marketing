import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { SECURITY_CONFIG } from '../config/config';

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
    const secretKey = Buffer.from(SECURITY_CONFIG.jwtSecret || 'default-secret-key', 'utf8');
    const token = jwt.sign({ id: userId } as object, secretKey);
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
    return res.status(500).json({
      success: false,
      message: 'Chyba při vytváření autentizačního tokenu'
    });
  }
  
  // Formátování odpovědi
  const userResponse = formatUserResponse(user);
  
  // Nastavení cookie pro autentizaci - přidáno toto nastavení
  console.log('[AUTH] Nastavuji cookie authToken pro uživatele:', user.email);
  res.cookie('authToken', token, { 
    maxAge: 24 * 60 * 60 * 1000, // 1 den
    httpOnly: true,
    path: '/'
  });
  
  console.log('[AUTH] Cookie byla nastavena, odesílám odpověď');
  console.log(`[AUTH] Odpověď má status: ${statusCode}, zpráva: ${message}`);
  
  // Odeslání odpovědi
  return res.status(statusCode).json({
    success: true,
    message,
    token,
    user: userResponse
  });
};

// Registrace nového uživatele
export const register = async (req: Request, res: Response) => {
  console.log('[AUTH] Začíná registrace nového uživatele');
  console.log('[AUTH] Příchozí data:', req.body);
  
  try {
    const { email, password, firstName, lastName, company, plan } = req.body;

    // Kontrola vstupních dat
    if (!email || !password || !firstName || !lastName) {
      console.error('[AUTH] Chybějící povinná data pro registraci:', { 
        email: !!email, 
        password: !!password, 
        firstName: !!firstName, 
        lastName: !!lastName 
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Chybí povinná data pro registraci' 
      });
    }

    // Kontrola, zda uživatel s tímto emailem již existuje
    console.log('[AUTH] Kontrola existujícího uživatele s emailem:', email);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('[AUTH] Uživatel s tímto emailem již existuje:', email);
      return res.status(400).json({ 
        success: false, 
        message: 'Uživatel s tímto emailem již existuje' 
      });
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

    // Typování uživatele a vytvoření odpovědi
    const typedUser = user as unknown as IUser;
    return createAuthResponse(
      typedUser,
      res,
      201,
      'Uživatel byl úspěšně zaregistrován'
    );
  } catch (error) {
    console.error('[AUTH] Chyba při registraci:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Při registraci došlo k chybě', 
      error: (error as Error).message 
    });
  }
};

// Přihlášení uživatele
export const login = async (req: Request, res: Response) => {
  console.log('[AUTH] Začíná přihlášení uživatele');
  console.log('[AUTH] Příchozí data:', { email: req.body.email, passwordLength: req.body.password?.length || 0 });
  
  try {
    const { email, password } = req.body;

    // Kontrola vstupních dat
    if (!email || !password) {
      console.error('[AUTH] Chybějící přihlašovací údaje');
      return res.status(400).json({ 
        success: false, 
        message: 'Email a heslo jsou povinné údaje' 
      });
    }

    // Vyhledání uživatele podle emailu
    console.log('[AUTH] Hledání uživatele podle emailu:', email);
    const user = await User.findOne({ email });
    if (!user) {
      console.log('[AUTH] Uživatel s emailem', email, 'nebyl nalezen');
      return res.status(401).json({ 
        success: false, 
        message: 'Neplatné přihlašovací údaje' 
      });
    }

    // Typovat uživatele
    const typedUser = user as unknown as IUser;

    // Ověření hesla
    console.log('[AUTH] Ověřování hesla pro uživatele:', email);
    const isPasswordValid = await typedUser.comparePassword(password);
    console.log('[AUTH] Výsledek ověření hesla:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('[AUTH] Neplatné heslo pro uživatele:', email);
      return res.status(401).json({ 
        success: false, 
        message: 'Neplatné přihlašovací údaje' 
      });
    }

    // Aktualizace posledního přihlášení
    console.log('[AUTH] Aktualizace času posledního přihlášení pro uživatele:', email);
    typedUser.lastLogin = new Date();
    await typedUser.save();

    // Vytvoření odpovědi
    return createAuthResponse(
      typedUser,
      res,
      200,
      'Přihlášení proběhlo úspěšně'
    );
  } catch (error) {
    console.error('[AUTH] Chyba při přihlášení:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Při přihlášení došlo k chybě', 
      error: (error as Error).message 
    });
  }
};