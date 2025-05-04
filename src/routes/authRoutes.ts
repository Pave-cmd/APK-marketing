import express, { RequestHandler } from 'express';
import * as authController from '../controllers/authController';

const router = express.Router();

// Registrace nového uživatele
router.post('/register', (authController.register as unknown) as RequestHandler);

// Přihlášení uživatele
router.post('/login', (authController.login as unknown) as RequestHandler);

export default router;