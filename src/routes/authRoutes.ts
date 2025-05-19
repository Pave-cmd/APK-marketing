import express, { RequestHandler } from 'express';
import * as authController from '../controllers/authController';
import { auth } from '../middleware/authMiddleware';

const router = express.Router();

// Registrace nového uživatele
router.post('/register', (authController.register as unknown) as RequestHandler);

// Přihlášení uživatele
router.post('/login', (authController.login as unknown) as RequestHandler);

// Odhlášení uživatele
router.get('/logout', (authController.logout as unknown) as RequestHandler);

// Testovací endpoint pro ověření autentizace
router.get('/test-auth',
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    auth(req, res, next).catch(next);
  },
  ((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.status(200).json({
      success: true,
      message: 'Autentizace úspěšná',
      user: {
        id: req.user?.id,
        email: req.user?.email
      }
    });
  }) as unknown as RequestHandler
);

export default router;