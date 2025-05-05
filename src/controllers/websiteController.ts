import { Request, Response } from 'express';
import User, { IUser } from '../models/User';

/**
 * Přidá novou webovou stránku do uživatelského účtu
 * @param req Request obsahující URL webové stránky
 * @param res Response
 */
export const addWebsite = async (req: Request, res: Response) => {
  console.log('[WEBSITE] Začátek přidání nové webové stránky');
  console.log('[WEBSITE] Příchozí data:', req.body);
  console.log('[WEBSITE] User objekt:', req.user);
  
  try {
    // Získáme ID uživatele z authentication middlewaru
    // Podpora pro různé formáty ID v objektu user
    const userId = req.user?.id || req.user?._id;
    
    console.log('[WEBSITE] Nalezené ID uživatele:', userId);
    
    if (!userId) {
      console.error('[WEBSITE] Chybějící ID uživatele pro přidání webové stránky');
      return res.status(401).json({
        success: false,
        message: 'Pro tuto akci je nutné být přihlášen'
      });
    }
    
    const { url } = req.body;
    
    // Kontrola vstupních dat
    if (!url) {
      console.error('[WEBSITE] Chybějící URL pro přidání webové stránky');
      return res.status(400).json({
        success: false,
        message: 'URL webové stránky je povinný údaj'
      });
    }
    
    // Validace URL formátu
    try {
      new URL(url);
    } catch (e) {
      console.error('[WEBSITE] Neplatný formát URL:', url);
      return res.status(400).json({
        success: false,
        message: 'Zadejte platnou URL webové stránky'
      });
    }
    
    // Vyhledání uživatele podle ID
    console.log('[WEBSITE] Vyhledávání uživatele s ID:', userId);
    const user = await User.findById(userId);
    
    if (!user) {
      console.error('[WEBSITE] Uživatel nebyl nalezen:', userId);
      return res.status(404).json({
        success: false,
        message: 'Uživatel nebyl nalezen'
      });
    }
    
    console.log('[WEBSITE] Uživatel nalezen:', user.email);
    console.log('[WEBSITE] Aktuální seznam webů uživatele:', user.websites);
    
    // Kontrola, zda uživatel již nemá tuto URL přidanou
    if (user.websites.includes(url)) {
      console.log('[WEBSITE] Webová stránka již existuje v seznamu uživatele:', url);
      return res.status(400).json({
        success: false,
        message: 'Tato webová stránka je již přidána ve vašem účtu'
      });
    }
    
    // Kontrola počtu webových stránek podle plánu uživatele
    const maxWebsites = {
      'basic': 1,
      'standard': 1,
      'premium': 3,
      'enterprise': 10
    };
    
    // Získání maximálního počtu webů pro uživatelův plán
    const currentPlan = user.plan || 'basic';
    const maxAllowed = maxWebsites[currentPlan as keyof typeof maxWebsites];
    
    // Kontrola limitu webových stránek podle plánu
    if (user.websites.length >= maxAllowed) {
      console.error('[WEBSITE] Překročen limit webových stránek pro plán:', currentPlan);
      return res.status(400).json({
        success: false,
        message: `Váš plán ${currentPlan} umožňuje maximálně ${maxAllowed} webových stránek. Pro přidání dalších stránek aktualizujte svůj plán.`
      });
    }
    
    // Přidání nové URL do pole websites
    user.websites.push(url);
    console.log('[WEBSITE] Přidávám URL do seznamu webů uživatele:', url);
    console.log('[WEBSITE] Nový seznam webů uživatele před uložením:', user.websites);
    
    // Uložení změn
    await user.save();
    console.log('[WEBSITE] Webová stránka úspěšně přidána a uložena do DB:', url);
    console.log('[WEBSITE] Aktualizovaný seznam webů po uložení:', user.websites);
    
    return res.status(201).json({
      success: true,
      message: 'Webová stránka byla úspěšně přidána',
      websites: user.websites
    });
    
  } catch (error) {
    console.error('[WEBSITE] Chyba při přidávání webové stránky:', error);
    return res.status(500).json({
      success: false,
      message: 'Při přidávání webové stránky došlo k chybě',
      error: (error as Error).message
    });
  }
};

/**
 * Získá seznam webových stránek uživatele
 * @param req Request
 * @param res Response
 */
export const getWebsites = async (req: Request, res: Response) => {
  console.log('[WEBSITE] Začátek získávání seznamu webových stránek uživatele');
  console.log('[WEBSITE] User objekt v getWebsites:', req.user);
  
  try {
    // Získáme ID uživatele z authentication middlewaru
    // Podpora pro různé formáty ID v objektu user
    const userId = req.user?.id || req.user?._id;
    
    console.log('[WEBSITE] Nalezené ID uživatele v getWebsites:', userId);
    
    if (!userId) {
      console.error('[WEBSITE] Chybějící ID uživatele pro získání webových stránek');
      return res.status(401).json({
        success: false,
        message: 'Pro tuto akci je nutné být přihlášen'
      });
    }
    
    // Vyhledání uživatele podle ID
    console.log('[WEBSITE] Vyhledávání uživatele s ID:', userId);
    const user = await User.findById(userId);
    
    if (!user) {
      console.error('[WEBSITE] Uživatel nebyl nalezen:', userId);
      return res.status(404).json({
        success: false,
        message: 'Uživatel nebyl nalezen'
      });
    }
    
    console.log('[WEBSITE] Uživatel nalezen:', user.email);
    console.log('[WEBSITE] Aktuální seznam webů uživatele v getWebsites:', user.websites);
    
    // Nastavení maximálního počtu webů podle plánu
    const maxWebsites = {
      'basic': 1,
      'standard': 1,
      'premium': 3,
      'enterprise': 10
    };
    
    // Získání maximálního počtu webů pro uživatelův plán
    const currentPlan = user.plan || 'basic';
    const maxAllowed = maxWebsites[currentPlan as keyof typeof maxWebsites];
    
    // Vrácení seznamu webových stránek a limitu
    console.log('[WEBSITE] Vracení seznamu webových stránek pro uživatele:', userId);
    return res.status(200).json({
      success: true,
      websites: user.websites,
      maxWebsites: maxAllowed
    });
    
  } catch (error) {
    console.error('[WEBSITE] Chyba při získávání webových stránek:', error);
    return res.status(500).json({
      success: false,
      message: 'Při získávání webových stránek došlo k chybě',
      error: (error as Error).message
    });
  }
};

/**
 * Odstraní webovou stránku z účtu uživatele
 * @param req Request obsahující URL webové stránky
 * @param res Response
 */
export const removeWebsite = async (req: Request, res: Response) => {
  console.log('[WEBSITE] Začátek odstranění webové stránky');
  
  try {
    // Získáme ID uživatele z authentication middlewaru
    const userId = req.user?.id;
    
    if (!userId) {
      console.error('[WEBSITE] Chybějící ID uživatele pro odstranění webové stránky');
      return res.status(401).json({
        success: false,
        message: 'Pro tuto akci je nutné být přihlášen'
      });
    }
    
    const { url } = req.body;
    
    // Kontrola vstupních dat
    if (!url) {
      console.error('[WEBSITE] Chybějící URL pro odstranění webové stránky');
      return res.status(400).json({
        success: false,
        message: 'URL webové stránky je povinný údaj'
      });
    }
    
    // Vyhledání uživatele podle ID
    console.log('[WEBSITE] Vyhledávání uživatele s ID:', userId);
    const user = await User.findById(userId);
    
    if (!user) {
      console.error('[WEBSITE] Uživatel nebyl nalezen:', userId);
      return res.status(404).json({
        success: false,
        message: 'Uživatel nebyl nalezen'
      });
    }
    
    // Kontrola, zda uživatel má tuto URL v seznamu
    if (!user.websites.includes(url)) {
      console.log('[WEBSITE] Webová stránka nebyla nalezena v seznamu uživatele:', url);
      return res.status(404).json({
        success: false,
        message: 'Tato webová stránka nebyla nalezena ve vašem účtu'
      });
    }
    
    // Odstranění URL ze seznamu
    user.websites = user.websites.filter(website => website !== url);
    
    // Uložení změn
    await user.save();
    console.log('[WEBSITE] Webová stránka úspěšně odstraněna:', url);
    
    return res.status(200).json({
      success: true,
      message: 'Webová stránka byla úspěšně odstraněna',
      websites: user.websites
    });
    
  } catch (error) {
    console.error('[WEBSITE] Chyba při odstraňování webové stránky:', error);
    return res.status(500).json({
      success: false,
      message: 'Při odstraňování webové stránky došlo k chybě',
      error: (error as Error).message
    });
  }
};