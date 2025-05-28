import express from 'express';
import { auth } from '../middleware/authMiddleware';
import {
  updateConsent,
  exportUserData,
  requestDataDeletion,
  deleteUserDataImmediately,
  getGdprStatus
} from '../controllers/gdprController';

const router = express.Router();

// Všechny GDPR endpointy vyžadují autentizaci
router.use(auth);

// Aktualizace souhlasu
router.post('/consent', updateConsent);

// Export uživatelských dat
router.get('/export', exportUserData);

// Žádost o smazání dat (30denní lhůta)
router.post('/delete-request', requestDataDeletion);

// Okamžité smazání dat
router.delete('/delete-immediately', deleteUserDataImmediately);

// Získání GDPR statusu
router.get('/status', getGdprStatus);

export default router;