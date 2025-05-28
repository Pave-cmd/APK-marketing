import { Request, Response, NextFunction } from 'express';

/**
 * Middleware pro vynucení HTTPS v produkčním prostředí
 * Kontroluje x-forwarded-proto header, který nastavují reverse proxy servery
 */
export const httpsRedirect = (req: Request, res: Response, next: NextFunction) => {
  // Přeskočit v development prostředí
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Heroku a většina cloud providerů používají x-forwarded-proto header
  const proto = req.header('x-forwarded-proto');
  
  // Pokud request přišel přes HTTP, přesměrovat na HTTPS
  if (proto && proto !== 'https') {
    // Zachovat původní URL včetně query parametrů
    const redirectUrl = `https://${req.header('host')}${req.url}`;
    
    // Použít 301 (Moved Permanently) pro lepší SEO
    return res.redirect(301, redirectUrl);
  }

  // Přidat Strict-Transport-Security header pro HTTPS requesty
  if (proto === 'https') {
    // max-age=31536000 = 1 rok
    // includeSubDomains = aplikovat i na subdomény
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

/**
 * Alternativní implementace pro servery, které nepoužívají x-forwarded-proto
 * Používá req.secure vlastnost
 */
export const httpsRedirectAlternative = (req: Request, res: Response, next: NextFunction) => {
  // Přeskočit v development prostředí
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // req.secure je true pokud je spojení přes HTTPS
  if (!req.secure) {
    const redirectUrl = `https://${req.header('host')}${req.url}`;
    return res.redirect(301, redirectUrl);
  }

  // Přidat HSTS header
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  next();
};