import { Request, Response } from 'express';
import { ScheduledPostService } from '../services/scheduledPostService';
import { webLog } from '../utils/logger';
import { IScheduledPost } from '../models/ScheduledPost';

// Inicializace služby
const scheduledPostService = ScheduledPostService.getInstance();

/**
 * Vytvoří nový naplánovaný příspěvek
 */
export const createScheduledPost = async (req: Request, res: Response) => {
  try {
    const { 
      socialNetworkId, 
      websiteUrl, 
      title, 
      content, 
      imageUrl, 
      platform, 
      scheduledFor,
      recurrence,
      metadata
    } = req.body;
    const userId = req.user?._id;

    // Validace vstupu
    if (!socialNetworkId || !websiteUrl || !title || !content || !platform || !scheduledFor) {
      return res.status(400).json({
        success: false,
        message: 'Chybí povinné parametry: socialNetworkId, websiteUrl, title, content, platform, scheduledFor'
      });
    }

    // Převod scheduledFor na datum
    const scheduledDate = new Date(scheduledFor);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Neplatný formát data pro scheduledFor'
      });
    }

    // Vytvoření naplánovaného příspěvku
    const scheduledPost = await scheduledPostService.createScheduledPost(userId, {
      socialNetworkId,
      websiteUrl,
      title,
      content,
      imageUrl,
      platform,
      scheduledFor: scheduledDate,
      recurrence,
      metadata
    });

    return res.status(201).json({
      success: true,
      message: 'Příspěvek byl úspěšně naplánován',
      scheduledPost
    });
  } catch (error) {
    webLog('Chyba při vytváření naplánovaného příspěvku', { error });
    return res.status(500).json({
      success: false,
      message: 'Nepodařilo se naplánovat příspěvek',
      error: error instanceof Error ? error.message : 'Neznámá chyba'
    });
  }
};

/**
 * Získá seznam naplánovaných příspěvků uživatele
 */
export const getUserScheduledPosts = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id;
    const { status, platform, limit, offset, fromDate, toDate } = req.query;

    // Připravíme filtry
    const filters: any = {};
    
    if (status) {
      filters.status = status as string;
    }
    
    if (platform) {
      filters.platform = platform as string;
    }
    
    if (limit) {
      filters.limit = parseInt(limit as string, 10);
    }
    
    if (offset) {
      filters.offset = parseInt(offset as string, 10);
    }
    
    if (fromDate) {
      filters.fromDate = new Date(fromDate as string);
    }
    
    if (toDate) {
      filters.toDate = new Date(toDate as string);
    }

    // Získání naplánovaných příspěvků
    const scheduledPosts = await scheduledPostService.getUserScheduledPosts(userId as string, filters);

    // Získání statistik
    const stats = await scheduledPostService.getScheduledPostStats(userId as string);

    return res.json({
      success: true,
      scheduledPosts,
      stats
    });
  } catch (error) {
    webLog('Chyba při získávání naplánovaných příspěvků', { error });
    return res.status(500).json({
      success: false,
      message: 'Nepodařilo se získat naplánované příspěvky',
      error: error instanceof Error ? error.message : 'Neznámá chyba'
    });
  }
};

/**
 * Aktualizuje naplánovaný příspěvek
 */
export const updateScheduledPost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = req.user?._id;
    const updates = req.body;

    // Provést aktualizaci
    const updatedPost = await scheduledPostService.updateScheduledPost(postId as string, userId as string, updates);

    if (!updatedPost) {
      return res.status(404).json({
        success: false,
        message: 'Naplánovaný příspěvek nebyl nalezen nebo nemůže být aktualizován'
      });
    }

    return res.json({
      success: true,
      message: 'Naplánovaný příspěvek byl úspěšně aktualizován',
      scheduledPost: updatedPost
    });
  } catch (error) {
    webLog('Chyba při aktualizaci naplánovaného příspěvku', { error });
    return res.status(500).json({
      success: false,
      message: 'Nepodařilo se aktualizovat naplánovaný příspěvek',
      error: error instanceof Error ? error.message : 'Neznámá chyba'
    });
  }
};

/**
 * Smaže naplánovaný příspěvek
 */
export const deleteScheduledPost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = req.user?._id;

    // Smazat příspěvek
    const deleted = await scheduledPostService.deleteScheduledPost(postId as string, userId as string);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Naplánovaný příspěvek nebyl nalezen nebo nemůže být smazán'
      });
    }

    return res.json({
      success: true,
      message: 'Naplánovaný příspěvek byl úspěšně smazán'
    });
  } catch (error) {
    webLog('Chyba při mazání naplánovaného příspěvku', { error });
    return res.status(500).json({
      success: false,
      message: 'Nepodařilo se smazat naplánovaný příspěvek',
      error: error instanceof Error ? error.message : 'Neznámá chyba'
    });
  }
};

/**
 * Zruší naplánovaný příspěvek (změní stav na zrušený)
 */
export const cancelScheduledPost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = req.user?._id;

    // Zrušit příspěvek
    const cancelledPost = await scheduledPostService.cancelScheduledPost(postId as string, userId as string);

    if (!cancelledPost) {
      return res.status(404).json({
        success: false,
        message: 'Naplánovaný příspěvek nebyl nalezen nebo nemůže být zrušen'
      });
    }

    return res.json({
      success: true,
      message: 'Naplánovaný příspěvek byl úspěšně zrušen',
      scheduledPost: cancelledPost
    });
  } catch (error) {
    webLog('Chyba při rušení naplánovaného příspěvku', { error });
    return res.status(500).json({
      success: false,
      message: 'Nepodařilo se zrušit naplánovaný příspěvek',
      error: error instanceof Error ? error.message : 'Neznámá chyba'
    });
  }
};

/**
 * Publikuje naplánovaný příspěvek okamžitě
 */
export const publishScheduledPostNow = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = req.user?._id;

    // Nejprve ověříme, že příspěvek patří uživateli
    const posts = await scheduledPostService.getUserScheduledPosts(userId as string, {
      limit: 1,
      offset: 0
    });

    const post = posts.find(p => (p._id as unknown as string).toString() === postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Naplánovaný příspěvek nebyl nalezen'
      });
    }

    // Publikovat příspěvek
    const publishedPost = await scheduledPostService.publishScheduledPost(postId as string);

    return res.json({
      success: true,
      message: 'Příspěvek byl úspěšně publikován',
      scheduledPost: publishedPost
    });
  } catch (error) {
    webLog('Chyba při okamžité publikaci naplánovaného příspěvku', { error });
    return res.status(500).json({
      success: false,
      message: 'Nepodařilo se publikovat příspěvek',
      error: error instanceof Error ? error.message : 'Neznámá chyba'
    });
  }
};

/**
 * Vypočítá optimální čas pro publikaci
 */
export const calculateBestTimeToPost = async (req: Request, res: Response) => {
  try {
    const { platform, timezone } = req.body;

    if (!platform) {
      return res.status(400).json({
        success: false,
        message: 'Chybí povinný parametr platform'
      });
    }

    // Vypočítat optimální čas
    const bestTime = scheduledPostService.calculateBestTimeToPost(
      platform,
      timezone || 'Europe/Prague'
    );

    return res.json({
      success: true,
      bestTime
    });
  } catch (error) {
    webLog('Chyba při výpočtu optimálního času publikace', { error });
    return res.status(500).json({
      success: false,
      message: 'Nepodařilo se vypočítat optimální čas publikace',
      error: error instanceof Error ? error.message : 'Neznámá chyba'
    });
  }
};