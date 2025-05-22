/**
 * Emergency Controller - slouží jako nouzové řešení pro přidání webu
 */
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import { normalizeUrl, validateUrl } from '../utils/urlUtils';

/**
 * Přímé přidání webové stránky s minimem závislostí
 */
export const directAdd = async (req: Request, res: Response): Promise<void> => {
  console.log('🚨 [EMERGENCY] Začátek přidání webu:', req.body);

  try {
    const { url, userId } = req.body;

    // Validace vstupu
    if (!url) {
      console.log('🚨 [EMERGENCY] Chybí URL');
      res.status(400).json({
        success: false,
        message: 'URL je povinný údaj'
      });
      return;
    }

    if (!userId) {
      console.log('🚨 [EMERGENCY] Chybí ID uživatele');
      res.status(400).json({
        success: false,
        message: 'ID uživatele je povinný údaj'
      });
      return;
    }

    // Validace URL
    const urlValidation = validateUrl(url);
    if (!urlValidation.isValid) {
      console.log('🚨 [EMERGENCY] Neplatná URL:', url);
      res.status(400).json({
        success: false,
        message: urlValidation.message || 'Zadejte platnou URL webové stránky'
      });
      return;
    }

    // Normalizace URL
    const normalizedUrl = normalizeUrl(url, { keepTrailingSlash: false });
    console.log('🚨 [EMERGENCY] Normalizovaná URL:', normalizedUrl);

    // Kontrola připojení k databázi
    if (mongoose.connection.readyState !== 1) {
      console.log('🚨 [EMERGENCY] Databáze není připojena');
      res.status(500).json({
        success: false,
        message: 'Databáze není dostupná, zkuste to prosím později'
      });
      return;
    }

    try {
      // Validace userId je validním MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.log('🚨 [EMERGENCY] Neplatné ID uživatele:', userId);
        res.status(400).json({
          success: false,
          message: 'Neplatné ID uživatele'
        });
        return;
      }
      
      const userObjectId = new mongoose.Types.ObjectId(userId);
      
      // Přímý update MongoDB dokumentu (obejití Mongoose)
      console.log('🚨 [EMERGENCY] Přidávání do MongoDB, uživatel:', userId);
      
      // Nejprve zkontrolujeme, zda uživatel existuje
      const user = await User.findById(userObjectId);
      if (!user) {
        console.log('🚨 [EMERGENCY] Uživatel nenalezen:', userId);
        res.status(404).json({
          success: false,
          message: 'Uživatel nebyl nalezen'
        });
        return;
      }

      // Zkontrolujeme limity
      const maxWebsites = {
        'basic': 1,
        'standard': 1,
        'premium': 3,
        'enterprise': 10
      };
      const currentPlan = user.plan || 'basic';
      const maxAllowed = maxWebsites[currentPlan as keyof typeof maxWebsites] || 1;

      // Zkusíme najít web v seznamu
      const currentWebsites = user.websites || [];
      const websitesArray = Array.isArray(currentWebsites) ? currentWebsites : [currentWebsites];

      console.log('🚨 [EMERGENCY] Aktuální weby:', websitesArray);
      console.log('🚨 [EMERGENCY] Limit webů:', maxAllowed);

      if (websitesArray.length >= maxAllowed) {
        console.log('🚨 [EMERGENCY] Dosažen limit webů');
        res.status(400).json({
          success: false,
          message: `Váš plán ${currentPlan} umožňuje maximálně ${maxAllowed} webových stránek. Pro přidání dalších stránek aktualizujte svůj plán.`
        });
        return;
      }

      // Zkontrolovat, zda web již není v seznamu
      if (websitesArray.includes(normalizedUrl)) {
        console.log('🚨 [EMERGENCY] Web již existuje v seznamu');
        res.status(400).json({
          success: false,
          message: 'Tato webová stránka je již přidána ve vašem účtu'
        });
        return;
      }

      // Přidání webu pomocí MongoDB přímého přístupu
      console.log('🚨 [EMERGENCY] Přidávám web pomocí updateOne');

      // Nejprve zkontrolujeme, zda web již existuje - používáme validovaný ObjectId
      const existingWebsiteCheck = await User.findOne(
        {
          _id: userObjectId,
          websites: normalizedUrl
        }
      );

      if (existingWebsiteCheck) {
        console.log('🚨 [EMERGENCY] Web již existuje při druhé kontrole');
        res.status(400).json({
          success: false,
          message: 'Tato webová stránka je již přidána ve vašem účtu (potvrzeno druhou kontrolou)'
        });
        return;
      }

      // URL není v seznamu, přidáme ji
      // Použijeme $addToSet místo $push, aby nedošlo k duplikaci
      // Používáme validovaný ObjectId a sanitizovaný URL string
      const result = await User.updateOne(
        { _id: userObjectId },
        { $addToSet: { websites: normalizedUrl } }
      );

      console.log('🚨 [EMERGENCY] Výsledek updateOne:', result);

      if (result.matchedCount === 0) {
        console.log('🚨 [EMERGENCY] Uživatel nebyl nalezen při aktualizaci');
        res.status(404).json({
          success: false,
          message: 'Uživatel nebyl nalezen'
        });
        return;
      }

      if (result.modifiedCount === 0) {
        console.log('🚨 [EMERGENCY] Uživatel nebyl aktualizován');
        res.status(500).json({
          success: false,
          message: 'Nepodařilo se aktualizovat uživatele'
        });
        return;
      }

      // Opětovné načtení uživatele pro kontrolu
      const updatedUser = await User.findById(userId);
      console.log('🚨 [EMERGENCY] Aktualizovaný uživatel:', updatedUser?.websites);

      res.status(200).json({
        success: true,
        message: 'Webová stránka byla úspěšně přidána!',
        websites: updatedUser?.websites || []
      });
      return;
    } catch (dbError) {
      console.error('🚨 [EMERGENCY] Chyba při práci s databází:', dbError);
      res.status(500).json({
        success: false,
        message: 'Při přidávání webové stránky došlo k chybě databáze',
        error: dbError instanceof Error ? dbError.message : 'Unknown error'
      });
      return;
    }
  } catch (error) {
    console.error('🚨 [EMERGENCY] Kritická chyba:', error);
    res.status(500).json({
      success: false,
      message: 'Při přidávání webové stránky došlo k chybě',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
};

/**
 * Zobrazení stránky pro přidání nového webu
 */
export const renderEmergencyPage = (req: Request, res: Response) => {
  console.log('🔵 [WEBSITE] Renderování stránky pro přidání webu uživateli:', req.user?.email);

  // Zobrazit aktuální weby uživatele
  const websites = req.user?.websites || [];
  console.log('🔵 [WEBSITE] Aktuální weby uživatele:', websites);

  res.render('dashboard/emergency-add', {
    title: 'Přidání nového webu | APK-marketing',
    description: 'Přidání nové webové stránky do vaší kampaně',
    user: req.user,
    layout: 'layouts/dashboard'
  });
};