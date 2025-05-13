import express, { RequestHandler } from 'express';
import { addWebsite, getWebsites, removeWebsite } from '../controllers/websiteController';
import { auth } from '../middleware/authMiddleware';
import jwt from 'jsonwebtoken';
import User from '../models/User';

const router = express.Router();

// Všechny routy vyžadují autentizaci
router.use(async (req, res, next) => {
  try {
    console.log('[DEBUG websiteRoutes] Ověřování autentizace pro cestu:', req.path);
    console.log('[DEBUG websiteRoutes] Metoda:', req.method);
    console.log('[DEBUG websiteRoutes] Cookies:', req.cookies);
    console.log('[DEBUG websiteRoutes] Headers:', req.headers);

    if (req.path === '/add' && req.method === 'POST') {
      console.log('[DEBUG websiteRoutes] Tělo požadavku pro přidání webu:', req.body);
    }

    // Přímo nastavíme uživatele, pokud máme token v cookie
    if (req.cookies && req.cookies.authToken) {
      try {
        const secretKey = Buffer.from(process.env.JWT_SECRET || 'default-secret-key', 'utf8');
        const decoded = jwt.verify(req.cookies.authToken, secretKey) as { id: string };

        // Vyhledání uživatele
        const user = await User.findById(decoded.id);

        if (user) {
          // Uživatel nalezen, přidáme ho do requestu
          req.user = user;
          console.log('[DEBUG websiteRoutes] Uživatel byl ověřen přímo z cookie:', user.email);
          return next();
        }
      } catch (e) {
        console.error('[DEBUG websiteRoutes] Chyba při verifikaci tokenu z cookie:', e);
      }
    }

    // Pokud přímé ověření nefungovalo, použijeme standardní auth middleware
    await auth(req, res, next);

    // Pokud auth middleware neodešle odpověď, pokračujeme dál
    if (!res.headersSent) {
      console.log('[DEBUG websiteRoutes] Autentizace úspěšná, pokračuji');
      return next();
    } else {
      console.log('[DEBUG websiteRoutes] Hlavičky již odeslány, nevolám next()');
    }
  } catch (error) {
    console.error('[DEBUG websiteRoutes] Chyba při ověřování:', error);
    return next(error);
  }
});

// Routy pro správu webových stránek
router.post('/add', (addWebsite as unknown) as RequestHandler);
router.get('/', (getWebsites as unknown) as RequestHandler); // Hlavní GET endpoint pro výpis
router.get('/list', (getWebsites as unknown) as RequestHandler); // Ponecháno pro zpětnou kompatibilitu
router.delete('/remove', (removeWebsite as unknown) as RequestHandler);

export default router;