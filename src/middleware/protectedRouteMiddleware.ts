/**
 * Middleware pro chráněné stránky s autentizací
 */
import { Request, Response, NextFunction } from 'express';
import { auth } from './authMiddleware';
import { setAuthCookies } from '../utils/cookieUtils';

/**
 * Vytváří middleware pro chráněné stránky dashboardu
 * @param viewPath Cesta k šabloně pohledu
 * @param options Doplňující parametry pro šablonu
 * @returns Middleware funkce
 */
export function protectedDashboardRoute(viewPath: string, options: any) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Sledujeme, zda již byla odeslána odpověď
    let responseSent = false;
    
    // Zachytit případ, kdy middleware posílá odpověď přímo (musí být před voláním auth)
    const originalRedirect = res.redirect;
    const originalRender = res.render;
    
    // Přepisujeme metodu redirect, abychom mohli detekovat její použití
    res.redirect = function() {
      console.log('[DEBUG PROTECTED] Přesměrování na:', arguments[0]);
      responseSent = true;
      return originalRedirect.apply(this, arguments as any);
    };
    
    // Přepisujeme metodu render, abychom mohli detekovat její použití
    res.render = function() {
      console.log('[DEBUG PROTECTED] Rendering view:', arguments[0]);
      responseSent = true;
      return originalRender.apply(this, arguments as any);
    };

    try {
      // Přidáme kontrolu na token v URL parametru
      if (req.query.token && typeof req.query.token === 'string') {
        // Pokud je token v URL, uložíme ho do cookie pomocí sdílené utility
        setAuthCookies(res, req.query.token as string);

        // Přesměrování na stejnou stránku bez tokenu v URL (pro lepší bezpečnost)
        // Vytvoření čisté URL bez query parametru token
        const url = req.originalUrl.replace(/[?&]token=[^&]+(&|$)/, '$1');
        const cleanUrl = url === '' ? '/dashboard' : url;
        console.log('[DEBUG PROTECTED] Přesměrování z URL s tokenem na čistou URL:', cleanUrl);

        // Zabraňuje nekonečné smyčce - nesmí přesměrovat, když URL je stejná nebo už je vyčištěná
        if (req.originalUrl === cleanUrl) {
          console.log('[DEBUG PROTECTED] URL je už vyčištěná, pokračuji bez přesměrování');
          return next();
        }

        return res.redirect(cleanUrl);
      }

      // Použití await místo then/catch pro lepší zachytávání chyb
      console.log('[DEBUG PROTECTED] Volání auth middleware');

      // Musíme přidat vlastní callback, abychom nekontrolovali auth middleware přímo
      // auth middleware zavolá next() v případě úspěchu, což způsobí vykonání tohoto callbacku
      // nebo přesměruje/odpoví přímo v případě chyby
      const authResult = await new Promise<boolean>((resolve) => {
        // Vytvoření dočasného next callbacku - používáme ho přímo níže v auth middleware
        // const authNext = () => {
        //   console.log('[DEBUG PROTECTED] Auth middleware byl úspěšný a zavolal next()');
        //   resolve(true);
        // };

        // Použití auth middleware s našim dočasným callbackem
        try {
          // Kontrola headersSent před voláním auth - další bezpečnostní opatření
          if (res.headersSent) {
            console.log('[DEBUG PROTECTED] Hlavičky již odeslány před auth middleware');
            return resolve(false);
          }
          
          auth(req, res, () => {
            // Tento callback se spustí pouze pokud auth middleware úspěšně ověřil uživatele
            // a zavolal next() - což znamená, že uživatel je přihlášen
            console.log('[DEBUG PROTECTED] Auth middleware úspěšně ověřil uživatele a zavolal next()');
            
            // Kontrola headersSent i po volání auth callbacku
            if (res.headersSent) {
              console.log('[DEBUG PROTECTED] Hlavičky odeslány během auth middleware callbacku');
              return resolve(false);
            }
            
            resolve(true);
          }).then((result) => {
            // Pokud auth middleware vrátil Response, znamená to, že již odeslal odpověď
            if (result) {
              console.log('[DEBUG PROTECTED] Auth middleware vrátil odpověď přímo');
              resolve(false);
            }
          }).catch(error => {
            console.error('[DEBUG PROTECTED] Auth middleware vyhodil chybu:', error);
            resolve(false);
          });
        } catch (error) {
          console.error('[DEBUG PROTECTED] Zachycena chyba při volání auth middleware:', error);
          resolve(false);
        }
      });

      // Kontrola, zda auth middleware neodeslal odpověď sám nebo zda již není odpověď odeslána
      if (!authResult || responseSent || res.headersSent) {
        console.log('[DEBUG PROTECTED] Odpověď již byla odeslána auth middlewarem nebo auth selhal');
        return;
      }

      // Logování úspěšného přihlášení
      console.log('[DEBUG PROTECTED] Uživatel úspěšně ověřen, renderuji dashboard');

      // Kontrola, že req.user existuje před pokusem o renderování
      if (!req.user) {
        console.log('[DEBUG PROTECTED] VAROVÁNÍ: req.user není nastaven, ale autentizace proběhla úspěšně');
        // V případě chybějící user informace přesměrujeme na přihlášení
        return res.redirect('/prihlaseni');
      }

      console.log('[DEBUG PROTECTED] Renderování pohledu', viewPath, 'pro uživatele', req.user.email);

      // Kontrola, zda již nebyla odeslána odpověď před pokusem o renderování
      if (res.headersSent) {
        console.log('[DEBUG PROTECTED] Hlavičky již odeslány, nemohu renderovat');
        return;
      }
      
      // Renderování pohledu - odpověď ještě nebyla odeslána, takže můžeme renderovat
      try {
        res.render(viewPath, {
          ...options,
          layout: 'layouts/dashboard',
          user: req.user
        });
        // Nekombinujeme return s render, aby nedošlo k dvojitému volání
      } catch (renderError) {
        console.error('[DEBUG PROTECTED] Chyba při renderování pohledu:', renderError);
        if (!res.headersSent) {
          res.status(500).render('errors/500', {
            title: 'Chyba serveru | APK-marketing',
            description: 'Došlo k chybě při vykreslování stránky'
          });
        }
      }
    } catch (err) {
      // Pokud už byla odpověď odeslána, není potřeba znovu reagovat
      if (responseSent || res.headersSent) {
        console.log('[DEBUG PROTECTED] Chyba při ověřování, ale odpověď již byla odeslána:', err);
        return;
      }
      
      // Jinak předáme chybu dále
      console.log('[DEBUG PROTECTED] Chyba při ověřování:', err);
      return next(err);
    }
  };
}