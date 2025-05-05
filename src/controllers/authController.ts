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
    const secretKey = Buffer.from(SECURITY_CONFIG.jwtSecret || 'default-secret-key', 'utf8');
    return jwt.sign({ id: userId } as object, secretKey);
  } catch (error) {
    console.error('JWT signing error:', error);
    return null;
  }
};

/**
 * Formátování uživatelské odpovědi bez citlivých dat
 * @param user Uživatelský objekt
 * @returns Formátovaná odpověď
 */
const formatUserResponse = (user: IUser): UserResponse => {
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
  // Získání ID jako string
  const userId = String(user._id);
  
  // Vytvoření JWT tokenu
  const token = createToken(userId);
  
  if (!token) {
    return res.status(500).json({
      success: false,
      message: 'Chyba při vytváření autentizačního tokenu'
    });
  }
  
  // Formátování odpovědi
  const userResponse = formatUserResponse(user);
  
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
  try {
    const { email, password, firstName, lastName, company, plan } = req.body;

    // Kontrola, zda uživatel s tímto emailem již existuje
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Uživatel s tímto emailem již existuje' 
      });
    }

    // Vytvoření nového uživatele
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
    await user.save();

    // Typování uživatele a vytvoření odpovědi
    const typedUser = user as unknown as IUser;
    return createAuthResponse(
      typedUser,
      res,
      201,
      'Uživatel byl úspěšně zaregistrován'
    );
  } catch (error) {
    console.error('Chyba při registraci:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Při registraci došlo k chybě', 
      error: (error as Error).message 
    });
  }
};

// Přihlášení uživatele
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Vyhledání uživatele podle emailu
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Neplatné přihlašovací údaje' 
      });
    }

    // Typovat uživatele
    const typedUser = user as unknown as IUser;

    // Ověření hesla
    const isPasswordValid = await typedUser.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Neplatné přihlašovací údaje' 
      });
    }

    // Aktualizace posledního přihlášení
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
    console.error('Chyba při přihlášení:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Při přihlášení došlo k chybě', 
      error: (error as Error).message 
    });
  }
};