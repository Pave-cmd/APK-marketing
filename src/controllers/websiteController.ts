import { Request, Response } from 'express';
import User from '../models/User';
import mongoose from 'mongoose';
import { PullOperator } from 'mongodb';
// Import utilit pro práci s URL
import { validateUrl, normalizeUrl, isUrlInList, findMatchingUrl } from '../utils/urlUtils';
// Import loggeru
import { logger, webLog } from '../utils/logger';

// TEST LOGGERU - uvidíme, zda se zapíše při startu serveru
logger.info('WebsiteController načten - test loggeru');
webLog('Test webLogu - měl by se zobrazit v logu');

/**
 * Přidá novou webovou stránku do uživatelského účtu
 * @param req Request obsahující URL webové stránky
 * @param res Response
 */
export const addWebsite = async (req: Request, res: Response) => {
  webLog('Začátek přidání nové webové stránky', { body: req.body, userId: req.user?.id || req.user?._id });
  console.log('[DEBUG addWebsite] Request tělo:', req.body);
  console.log('[DEBUG addWebsite] User objekt:', req.user);
  console.log('[DEBUG addWebsite] Request headers:', req.headers);
  console.log('[DEBUG addWebsite] Request cookies:', req.cookies);

  try {
    // Získáme ID uživatele z authentication middlewaru
    const userId = req.user?.id || req.user?._id;

    webLog('Nalezené ID uživatele', { userId });
    console.log('[DEBUG addWebsite] User ID:', userId);

    if (!userId) {
      logger.error('Chybějící ID uživatele pro přidání webové stránky');
      console.log('[DEBUG addWebsite] CHYBA: Chybí ID uživatele');
      return res.status(401).json({
        success: false,
        message: 'Pro tuto akci je nutné být přihlášen'
      });
    }

    let { url } = req.body;
    console.log('[DEBUG addWebsite] URL k přidání:', url);

    // Kontrola vstupních dat
    if (!url) {
      logger.error('Chybějící URL pro přidání webové stránky');
      console.log('[DEBUG addWebsite] CHYBA: Chybí URL');
      return res.status(400).json({
        success: false,
        message: 'URL webové stránky je povinný údaj'
      });
    }

    console.log('[DEBUG addWebsite] Přidávám URL:', url, 'pro uživatele s ID:', userId, 'a emailem:', req.user?.email);

    // Validace URL pomocí nové utility
    const urlValidation = validateUrl(url);

    if (!urlValidation.isValid) {
      logger.error('Neplatná URL', { url, error: urlValidation.message });
      console.log('[DEBUG addWebsite] CHYBA:', urlValidation.message);
      return res.status(400).json({
        success: false,
        message: urlValidation.message || 'Zadejte platnou URL webové stránky'
      });
    }

    // Normalizace URL pro jednotný formát ukládání
    url = normalizeUrl(url, { keepTrailingSlash: false });
    webLog('URL byla normalizována', { url });
    console.log('[DEBUG addWebsite] Normalizovaná URL:', url);

    const readyState = mongoose.connection.readyState;
    webLog('Aktivní připojení k MongoDB', { readyState });
    console.log('[DEBUG addWebsite] MongoDB readyState:', readyState);

    if (readyState !== 1) {
      console.log('[DEBUG addWebsite] KRITICKÁ CHYBA: MongoDB není připojeno!');
      return res.status(500).json({
        success: false,
        message: 'Databáze není dostupná, zkuste to prosím později'
      });
    }

    // NOVÝ PŘÍSTUP: Použití jednodušší metody přidání webu
    try {
      // Převedeme userId na ObjectId
      let userIdObj;
      try {
        userIdObj = new mongoose.Types.ObjectId(userId.toString());
        console.log('[DEBUG addWebsite] User ID jako ObjectId:', userIdObj);
      } catch (e) {
        console.log('[DEBUG addWebsite] CHYBA při konverzi ID:', e);
        return res.status(500).json({
          success: false,
          message: 'Chyba při zpracování ID uživatele'
        });
      }

      // Najdeme uživatele pomocí Mongoose (spolehlivější způsob)
      console.log('[DEBUG addWebsite] Hledám uživatele pomocí Mongoose');
      const user = await User.findById(userIdObj);

      if (!user) {
        console.log('[DEBUG addWebsite] CHYBA: Uživatel nenalezen, ID:', userIdObj);
        return res.status(404).json({
          success: false,
          message: 'Uživatel nebyl nalezen'
        });
      }

      console.log('[DEBUG addWebsite] Uživatel nalezen:', {
        id: user._id,
        email: user.email,
        websites: user.websites
      });

      // Kontrolujeme, zda už web není přidaný pomocí utility
      if (user.websites && user.websites.length > 0) {
        // Použití utility pro kontrolu URL v seznamu
        if (isUrlInList(url, user.websites)) {
          console.log('[DEBUG addWebsite] Web již existuje v seznamu');
          return res.status(400).json({
            success: false,
            message: 'Tato webová stránka je již přidána ve vašem účtu'
          });
        }
      }

      // Kontrola limitu webů podle plánu
      const maxWebsites = {
        'basic': 1,
        'standard': 1,
        'premium': 3,
        'enterprise': 10
      };

      const currentPlan = user.plan || 'basic';
      const maxAllowed = maxWebsites[currentPlan as keyof typeof maxWebsites] || 1;

      console.log('[DEBUG addWebsite] Plán:', currentPlan, 'Max webů:', maxAllowed, 'Aktuální počet:', user.websites ? user.websites.length : 0);

      if (user.websites && user.websites.length >= maxAllowed) {
        console.log('[DEBUG addWebsite] Překročen limit webů pro plán');
        return res.status(400).json({
          success: false,
          message: `Váš plán ${currentPlan} umožňuje maximálně ${maxAllowed} webových stránek. Pro přidání dalších stránek aktualizujte svůj plán.`
        });
      }

      // Přidáme web a uložíme
      if (!user.websites) {
        user.websites = [];
      }

      user.websites.push(url);
      console.log('[DEBUG addWebsite] Ukládám aktualizovaného uživatele, weby:', user.websites);

      // Uložení uživatele - zkusíme obejít možný problém s Mongoose
      try {
        // Ještě jednou zkontrolujeme, že user.websites je pole
        if (!Array.isArray(user.websites)) {
          console.error('[DEBUG addWebsite] user.websites není pole před uložením!', typeof user.websites);
          user.websites = Array.isArray(user.websites) ? user.websites : (user.websites ? [user.websites] : []);
        }

        console.log('[DEBUG addWebsite] Pokus o uložení uživatele, weby před uložením:', user.websites);

        // Zkusíme přímo aktualizovat pomocí MongoDB
        const result = await User.updateOne(
          { _id: user._id },
          { $addToSet: { websites: url } }
        );

        console.log('[DEBUG addWebsite] Výsledek přímé aktualizace MongoDB:', result);

        // Kontrola, zda aktualizace proběhla
        if (result.modifiedCount === 0 && result.matchedCount > 0) {
          console.log('[DEBUG addWebsite] Záznam nalezen, ale nebyl aktualizován - URL již možná existuje');
        }

        // Načteme aktualizovaného uživatele
        const updatedUser = await User.findById(user._id);
        console.log('[DEBUG addWebsite] Aktualizovaný uživatel načten, weby:', updatedUser?.websites);

        // Bezpečné přiřazení (TypeScript může protestovat proti přímému přiřazení)
        if (updatedUser) {
          user.websites = updatedUser.websites || [];
        }
      } catch (saveError) {
        console.error('[DEBUG addWebsite] KRITICKÁ CHYBA při ukládání:', saveError);
        return res.status(500).json({
          success: false,
          message: 'Chyba při ukládání do databáze',
          error: saveError instanceof Error ? saveError.message : 'Unknown error'
        });
      }

      // Vracíme úspěšnou odpověď s formatovanou zprávou
      console.log('[DEBUG addWebsite] Odesílám úspěšnou odpověď s weby:', user.websites);
      return res.status(201).json({
        success: true,
        message: 'Webová stránka byla úspěšně přidána!',
        websites: user.websites
      });
    } catch (dbError) {
      console.log('[DEBUG addWebsite] CHYBA při práci s databází:', dbError);

      return res.status(500).json({
        success: false,
        message: 'Při přidávání webové stránky došlo k chybě databáze',
        error: dbError instanceof Error ? dbError.message : 'Unknown error'
      });
    }
  } catch (error) {
    logger.error('Chyba při přidávání webové stránky', { error: error instanceof Error ? error.message : String(error) });
    console.log('[DEBUG addWebsite] KRITICKÁ CHYBA:', error);

    return res.status(500).json({
      success: false,
      message: 'Při přidávání webové stránky došlo k chybě',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Funkce odstraněna, protože je nahrazena přímou implementací v addWebsite

/**
 * Získá seznam webových stránek uživatele
 * @param req Request
 * @param res Response
 */
export const getWebsites = async (req: Request, res: Response) => {
  webLog('Začátek získávání seznamu webových stránek uživatele', { userId: req.user?.id || req.user?._id });
  console.log('[DEBUG getWebsites] Request začátek, User:', req.user);

  try {
    // Získáme ID uživatele z authentication middlewaru
    const userId = req.user?.id || req.user?._id;

    webLog('Nalezené ID uživatele v getWebsites', { userId });
    console.log('[DEBUG getWebsites] UserId:', userId);

    if (!userId) {
      logger.error('Chybějící ID uživatele pro získání webových stránek');
      console.log('[DEBUG getWebsites] CHYBA: Chybí ID uživatele');
      return res.status(401).json({
        success: false,
        message: 'Pro tuto akci je nutné být přihlášen'
      });
    }

    // Zjednodušený a více spolehlivý přístup - používáme přímo Mongoose
    try {
      console.log('[DEBUG getWebsites] Hledání uživatele přes Mongoose, ID:', userId);

      // Převedeme userId na ObjectId pro jistotu
      let userIdObj;
      try {
        userIdObj = new mongoose.Types.ObjectId(userId.toString());
        console.log('[DEBUG getWebsites] User ID jako ObjectId:', userIdObj);
      } catch (e) {
        console.log('[DEBUG getWebsites] CHYBA při konverzi ID:', e);
        return res.status(500).json({
          success: false,
          message: 'Chyba při zpracování ID uživatele'
        });
      }

      // Použití projekce pro získání pouze potřebných polí
      const user = await User.findById(userIdObj).select('websites plan email');

      if (!user) {
        console.log('[DEBUG getWebsites] CHYBA: Uživatel nenalezen, ID:', userIdObj);
        return res.status(404).json({
          success: false,
          message: 'Uživatel nebyl nalezen'
        });
      }

      console.log('[DEBUG getWebsites] Uživatel nalezen:', {
        id: user._id,
        email: user.email,
        websites: user.websites || []
      });

      // Nastavení maximálního počtu webů podle plánu
      const maxWebsites = {
        'basic': 1,
        'standard': 1,
        'premium': 3,
        'enterprise': 10
      };

      // Získání maximálního počtu webů pro uživatelův plán
      const currentPlan = user.plan || 'basic';
      const maxAllowed = maxWebsites[currentPlan as keyof typeof maxWebsites] || 1;

      const websites = user.websites || [];
      console.log('[DEBUG getWebsites] Vracím weby:', websites, 'Max limit:', maxAllowed);

      // Kontrola, že websites jsou skutečně pole
      if (!Array.isArray(websites)) {
        console.error('[DEBUG getWebsites] CHYBA: websites není pole!', typeof websites);
        // Pokusíme se o konverzi
        const websiteArray = Array.isArray(websites) ? websites :
                            websites ? [websites] : [];
        console.log('[DEBUG getWebsites] Konvertované weby:', websiteArray);

        // Vrácení seznamu webových stránek a limitu
        return res.status(200).json({
          success: true,
          websites: websiteArray,
          maxWebsites: maxAllowed
        });
      }

      // Vrácení seznamu webových stránek a limitu
      console.log('[DEBUG getWebsites] Odesílám odpověď s weby:', websites);
      return res.status(200).json({
        success: true,
        websites: websites,
        maxWebsites: maxAllowed
      });
    } catch (dbError) {
      console.log('[DEBUG getWebsites] CHYBA při práci s databází:', dbError);

      return res.status(500).json({
        success: false,
        message: 'Při získávání webových stránek došlo k chybě databáze',
        error: dbError instanceof Error ? dbError.message : 'Unknown error'
      });
    }
  } catch (error) {
    logger.error('Chyba při získávání webových stránek', { error: error instanceof Error ? error.message : String(error) });
    console.log('[DEBUG getWebsites] KRITICKÁ CHYBA:', error);

    return res.status(500).json({
      success: false,
      message: 'Při získávání webových stránek došlo k chybě',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Odstraní webovou stránku z účtu uživatele
 * @param req Request obsahující URL webové stránky
 * @param res Response
 */
export const removeWebsite = async (req: Request, res: Response) => {
  webLog('Začátek odstranění webové stránky', { body: req.body, userId: req.user?.id || req.user?._id });
  
  try {
    // Získáme ID uživatele z authentication middlewaru
    const userId = req.user?.id || req.user?._id;
    
    webLog('Nalezené ID uživatele', { userId });
    
    if (!userId) {
      logger.error('Chybějící ID uživatele pro odstranění webové stránky');
      return res.status(401).json({
        success: false,
        message: 'Pro tuto akci je nutné být přihlášen'
      });
    }
    
    const { url } = req.body;
    
    // Kontrola vstupních dat
    if (!url) {
      logger.error('Chybějící URL pro odstranění webové stránky');
      return res.status(400).json({
        success: false,
        message: 'URL webové stránky je povinný údaj'
      });
    }
    
    // NOVÝ PŘÍSTUP: Přímé dotazování MongoDB kolekce
    try {
      const usersCollection = mongoose.connection.collection('users');
      
      // Nejprve zkontrolujeme, zda uživatel s tímto ID existuje a má tuto URL
      const user = await usersCollection.findOne({ _id: new mongoose.Types.ObjectId(userId) });
      
      if (!user) {
        logger.error('Uživatel nebyl nalezen v MongoDB', { userId });
        return res.status(404).json({
          success: false,
          message: 'Uživatel nebyl nalezen'
        });
      }
      
      // Kontrola, zda pole websites existuje a obsahuje URL
      const userWebsites = user.websites || [];
      webLog('Aktuální seznam webů uživatele', { websites: userWebsites });
      
      // Normalizace a ověření URL pomocí utility
      const normalizedUrl = normalizeUrl(url);

      // Kontrola, zda web existuje v seznamu
      if (!isUrlInList(normalizedUrl, userWebsites)) {
        webLog('Webová stránka nebyla nalezena v seznamu uživatele', { url });
        return res.status(404).json({
          success: false,
          message: 'Tato webová stránka nebyla nalezena ve vašem účtu'
        });
      }

      // Najdeme přesný záznam URL v seznamu (pro přesné odstranění)
      const exactUrlToRemove = findMatchingUrl(normalizedUrl, userWebsites);

      if (!exactUrlToRemove) {
        webLog('Chyba při hledání přesné URL v seznamu', { url });
        return res.status(500).json({
          success: false,
          message: 'Došlo k chybě při zpracování požadavku'
        });
      }

      // Použijeme přesný tvar URL, který je uložen v databázi
      const urlToRemove = exactUrlToRemove;
      
      // Přímá aktualizace dokumentu v MongoDB
      webLog('Odstraňuji URL ze seznamu webů uživatele pomocí MongoDB', { url });
      
      // Použití správně typovaného objektu pro operaci pull
      const updateResult = await usersCollection.updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { $pull: { websites: urlToRemove } as PullOperator<{ websites: string[] }> }
      );
      
      webLog('Výsledek odstranění v MongoDB', { updateResult });
      
      if (updateResult.modifiedCount === 0) {
        logger.error('Nepodařilo se aktualizovat uživatele v MongoDB');
        return res.status(500).json({
          success: false,
          message: 'Nepodařilo se odstranit webovou stránku'
        });
      }
      
      // Získání aktualizovaného dokumentu
      const updatedUser = await usersCollection.findOne({ _id: new mongoose.Types.ObjectId(userId) });
      const updatedWebsites = updatedUser?.websites || [];
      
      webLog('Webová stránka úspěšně odstraněna z MongoDB');
      webLog('Aktualizovaný seznam webů', { websites: updatedWebsites });
      
      return res.status(200).json({
        success: true,
        message: 'Webová stránka byla úspěšně odstraněna',
        websites: updatedWebsites
      });
    } catch (dbError) {
      logger.error('Chyba při práci s MongoDB', { error: dbError });
      
      // Záložní metoda: Použití Mongoose modelu
      webLog('Zkouším záložní metodu s Mongoose modelem');
      
      const user = await User.findById(userId);
      
      if (!user) {
        logger.error('Uživatel nebyl nalezen přes Mongoose', { userId });
        return res.status(404).json({
          success: false,
          message: 'Uživatel nebyl nalezen'
        });
      }
      
      // Použití utility pro kontrolu URL v seznamu
      if (!user.websites || !isUrlInList(url, user.websites)) {
        webLog('Webová stránka nebyla nalezena v seznamu uživatele', { url });
        return res.status(404).json({
          success: false,
          message: 'Tato webová stránka nebyla nalezena ve vašem účtu'
        });
      }

      // Najít přesnou URL v seznamu
      const exactUrl = findMatchingUrl(url, user.websites);

      // Odebrání URL z pole a uložení
      user.websites = user.websites.filter(website => website !== exactUrl);
      await user.save();
      
      webLog('Webová stránka odstraněna pomocí Mongoose', { websites: user.websites });
      
      return res.status(200).json({
        success: true,
        message: 'Webová stránka byla úspěšně odstraněna (záložní metoda)',
        websites: user.websites
      });
    }
    
  } catch (error) {
    logger.error('Chyba při odstraňování webové stránky', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({
      success: false,
      message: 'Při odstraňování webové stránky došlo k chybě',
      error: (error as Error).message
    });
  }
};