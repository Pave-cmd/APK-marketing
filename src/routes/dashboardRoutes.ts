import express from 'express';
import { auth } from '../middleware/authMiddleware';
import { setCsrfToken } from '../middleware/csrfMiddleware';
import User from '../models/User';

const router = express.Router();

// Middleware pro GDPR status
const getGdprStatus = async (req: any, res: any, next: any) => {
  try {
    if (req.user && req.user._id) {
      const user = await User.findById(req.user._id);
      if (user) {
        res.locals.gdprStatus = {
          generalConsent: {
            given: user.consentGiven || false,
            date: user.consentDate || null
          },
          gdprConsent: user.gdprConsent || {},
          dataProcessingConsent: user.dataProcessingConsent || {
            contentGeneration: false,
            socialMediaPosting: false,
            websiteAnalysis: false
          },
          dataRequests: {
            lastExportRequest: user.dataExportRequest || null,
            deletionRequest: user.dataDeletionRequest || null,
            deletionScheduledFor: user.dataDeletionRequest ? 
              new Date(user.dataDeletionRequest.getTime() + 30 * 24 * 60 * 60 * 1000) : null
          }
        };
      }
    }
  } catch (error) {
    console.error('Chyba při získávání GDPR statusu:', error);
  }
  next();
};

// Všechny dashboard routes vyžadují autentizaci
router.use(auth as any);
router.use(setCsrfToken as any);
router.use(getGdprStatus);

// GDPR stránka
router.get('/settings/gdpr', (req, res) => {
  res.render('dashboard/gdpr', {
    title: 'GDPR & Ochrana dat | APK-marketing',
    description: 'Správa souhlasů a ochrany osobních údajů',
    layout: 'layouts/dashboard',
    user: req.user,
    csrfToken: res.locals.csrfToken || '',
    gdprStatus: res.locals.gdprStatus || {
      generalConsent: { given: false, date: null },
      gdprConsent: {},
      dataProcessingConsent: {
        contentGeneration: false,
        socialMediaPosting: false,
        websiteAnalysis: false
      },
      dataRequests: {}
    }
  });
});

// Consent stránka
router.get('/consent', (req, res) => {
  const platform = req.query.platform || 'general';
  const returnUrl = req.query.returnUrl || '/dashboard';
  const renew = req.query.renew === 'true';
  
  res.render('dashboard/consent', {
    title: 'Souhlas se zpracováním dat | APK-marketing',
    description: 'Udělte souhlas se zpracováním osobních údajů',
    layout: 'layouts/dashboard',
    user: req.user,
    platform,
    returnUrl,
    renew,
    csrfToken: res.locals.csrfToken || ''
  });
});

export default router;