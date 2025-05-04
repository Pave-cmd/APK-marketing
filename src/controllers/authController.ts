import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User, { IUser } from '../models/User';
import { SECURITY_CONFIG } from '../config/config';

// Typ pro JWT payload
interface JwtPayload {
  id: string;
}

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

    // Získání ID jako string a typování uživatele
    const typedUser = user as unknown as IUser;
    const userId = String(typedUser._id);

    // Vytvoření JWT tokenu - použití Buffer místo přímého string
    const secretKey = Buffer.from(SECURITY_CONFIG.jwtSecret || 'default-secret-key', 'utf8');
    
    // Vytvořit token s explicitním typováním
    let token = '';
    try {
      // Použití konkrétního přetížení jwt.sign s explicitním typováním
      token = jwt.sign({ id: userId } as object, secretKey);
    } catch (jwtError) {
      console.error('JWT signing error:', jwtError);
      return res.status(500).json({
        success: false,
        message: 'Chyba při vytváření autentizačního tokenu'
      });
    }

    // Odebrání hesla z odpovědi
    const userResponse = {
      id: userId,
      email: typedUser.email,
      firstName: typedUser.firstName,
      lastName: typedUser.lastName,
      company: typedUser.company,
      plan: typedUser.plan
    };

    // Odeslání odpovědi
    return res.status(201).json({
      success: true,
      message: 'Uživatel byl úspěšně zaregistrován',
      token,
      user: userResponse
    });
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

    // Získání ID jako string
    const userId = String(typedUser._id);

    // Vytvoření JWT tokenu - použití Buffer místo přímého string
    const secretKey = Buffer.from(SECURITY_CONFIG.jwtSecret || 'default-secret-key', 'utf8');
    
    // Vytvořit token s explicitním typováním
    let token = '';
    try {
      // Použití konkrétního přetížení jwt.sign s explicitním typováním
      token = jwt.sign({ id: userId } as object, secretKey);
    } catch (jwtError) {
      console.error('JWT signing error:', jwtError);
      return res.status(500).json({
        success: false,
        message: 'Chyba při vytváření autentizačního tokenu'
      });
    }

    // Odebrání hesla z odpovědi
    const userResponse = {
      id: userId,
      email: typedUser.email,
      firstName: typedUser.firstName,
      lastName: typedUser.lastName,
      company: typedUser.company,
      plan: typedUser.plan
    };

    // Odeslání odpovědi
    return res.status(200).json({
      success: true,
      message: 'Přihlášení proběhlo úspěšně',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Chyba při přihlášení:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Při přihlášení došlo k chybě', 
      error: (error as Error).message 
    });
  }
};