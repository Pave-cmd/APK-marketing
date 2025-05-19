import { Request, Response } from 'express';
import { WebAnalysisService } from '../services/webAnalysisService';
import { logger } from '../utils/logger';

const webAnalysisService = new WebAnalysisService();

/**
 * Spustí analýzu webu
 */
export const startAnalysis = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { websiteUrl } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Pro tuto akci je nutné být přihlášen'
      });
    }

    if (!websiteUrl) {
      return res.status(400).json({
        success: false,
        message: 'URL webové stránky je povinný údaj'
      });
    }

    logger.info(`Spouštím analýzu pro web: ${websiteUrl}`);

    // Spustíme analýzu asynchronně
    webAnalysisService.analyzeWebsite(userId.toString(), websiteUrl)
      .then(() => {
        logger.info(`Analýza dokončena pro web: ${websiteUrl}`);
      })
      .catch(error => {
        logger.error(`Chyba při analýze webu ${websiteUrl}:`, error);
      });

    // Okamžitě vrátíme odpověď
    return res.status(200).json({
      success: true,
      message: 'Analýza byla zahájena. O průběhu budete informováni.'
    });

  } catch (error) {
    logger.error('Chyba při spuštění analýzy:', error);
    return res.status(500).json({
      success: false,
      message: 'Při spuštění analýzy došlo k chybě',
      error: error instanceof Error ? error.message : 'Neznámá chyba'
    });
  }
};

/**
 * Získá stav analýzy
 */
export const getAnalysisStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { websiteUrl } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Pro tuto akci je nutné být přihlášen'
      });
    }

    const analysis = await webAnalysisService.getAnalysisStatus(
      userId.toString(), 
      decodeURIComponent(websiteUrl)
    );

    return res.status(200).json({
      success: true,
      analysis
    });

  } catch (error) {
    logger.error('Chyba při získávání stavu analýzy:', error);
    return res.status(500).json({
      success: false,
      message: 'Při získávání stavu analýzy došlo k chybě',
      error: error instanceof Error ? error.message : 'Neznámá chyba'
    });
  }
};

/**
 * Získá všechny analýzy uživatele
 */
export const getUserAnalyses = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Pro tuto akci je nutné být přihlášen'
      });
    }

    const analyses = await webAnalysisService.getUserAnalyses(userId.toString());

    return res.status(200).json({
      success: true,
      analyses
    });

  } catch (error) {
    logger.error('Chyba při získávání analýz uživatele:', error);
    return res.status(500).json({
      success: false,
      message: 'Při získávání analýz došlo k chybě',
      error: error instanceof Error ? error.message : 'Neznámá chyba'
    });
  }
};

/**
 * Manuálně spustí analýzu všech webů uživatele (debugovací endpoint)
 */
export const runUserAnalyses = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Pro tuto akci je nutné být přihlášen'
      });
    }

    logger.info(`Manuální spuštění analýzy pro uživatele: ${userId}`);

    // Získáme seznam webů z uživatele
    const User = require('../models/User').default;
    const user = await User.findById(userId);
    
    if (!user || !user.websites || user.websites.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Uživatel nemá žádné weby k analýze'
      });
    }

    // Spustíme analýzu pro každý web
    const analysisPromises = user.websites.map((websiteUrl: string) => 
      webAnalysisService.analyzeWebsite(userId.toString(), websiteUrl)
        .catch(error => {
          logger.error(`Chyba při analýze ${websiteUrl}:`, error);
          return null;
        })
    );

    const results = await Promise.all(analysisPromises);
    const successful = results.filter(r => r !== null).length;

    return res.status(200).json({
      success: true,
      message: `Analýza spuštěna pro ${successful} z ${user.websites.length} webů`,
      analyses: results.filter(r => r !== null)
    });

  } catch (error) {
    logger.error('Chyba při manuálním spuštění analýz:', error);
    return res.status(500).json({
      success: false,
      message: 'Při spouštění analýz došlo k chybě',
      error: error instanceof Error ? error.message : 'Neznámá chyba'
    });
  }
};