import { Router, Request, Response } from 'express';

const router = Router();

// Privacy Policy route
router.get('/privacy', (req: Request, res: Response) => {
  res.render('legal/privacy', {
    title: 'Zásady ochrany osobních údajů',
    description: 'Zásady ochrany osobních údajů pro APK Marketing',
    pageTitle: 'Privacy Policy'
  });
});

// Terms of Service route
router.get('/terms', (req: Request, res: Response) => {
  res.render('legal/terms', {
    title: 'Obchodní podmínky',
    description: 'Obchodní podmínky pro APK Marketing',
    pageTitle: 'Terms of Service'
  });
});

// Cookie Policy route
router.get('/cookies', (req: Request, res: Response) => {
  res.render('legal/cookies', {
    title: 'Zásady používání cookies',
    description: 'Zásady používání cookies pro APK Marketing',
    pageTitle: 'Zásady používání cookies'
  });
});

export default router;