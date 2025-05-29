import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import expressLayouts from 'express-ejs-layouts';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db';
import { SERVER_CONFIG, SECURITY_CONFIG } from './config/config';
import User from './models/User';
import authRoutes from './routes/authRoutes';
import websiteRoutes from './routes/websiteRoutes';
import socialNetworkRoutes from './routes/socialNetworkRoutes';
import apiConfigRoutes from './routes/apiConfigRoutes';
import webAnalysisRoutes from './routes/webAnalysisRoutes';
import scheduledPostRoutes from './routes/scheduledPostRoutes';
import legalRoutes from './routes/legalRoutes';
import gdprRoutes from './routes/gdprRoutes';
import jwt from 'jsonwebtoken';
import { setAuthCookies } from './utils/cookieUtils';
import { rateLimit } from './middleware/rateLimitMiddleware';
import { setCsrfToken, validateCsrfToken } from './middleware/csrfMiddleware';
import { httpsRedirect } from './middleware/httpsRedirect';
import helmet from 'helmet';

// Inicializace Express aplikace
const app: Express = express();
const port = SERVER_CONFIG.port;

// Připojení k databázi
connectDB();
console.log('Připojování k MongoDB Atlas...');

// HTTPS redirect musí být jako první middleware
app.use(httpsRedirect);

// Základní bezpečnostní middleware s vlastním CSP nastavením
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "*.bootstrapcdn.com"],
        scriptSrcAttr: ["'self'", "'unsafe-inline'"], // Povolit inline event handlery
        styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "*.bootstrapcdn.com", "*.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", "*.imgur.com", "*.cloudfront.net", "via.placeholder.com", "*.google.com", "*.googleapis.com"],
        fontSrc: ["'self'", "*.googleapis.com", "*.gstatic.com", "cdnjs.cloudflare.com"],
        connectSrc: ["'self'", "api.example.com", "*"], // povolit API volání
        frameSrc: ["'self'", "*.google.com", "www.google.com"], // Povolit iframe pro mapy
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

// Standardní middleware
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.originalUrl}`);
  next();
});

// CORS a parsery
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 
    ['https://apk-marketing.com', 'https://www.apk-marketing.com'] : 
    true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'CSRF-Token']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Rate limiting pro základní ochranu proti DoS útokům
app.use(rateLimit());

// Statické soubory
const staticPath = SERVER_CONFIG.environment === 'production'
  ? path.join(__dirname, 'public')
  : path.join(__dirname, '..', 'src', 'public');

console.log('[SERVER] Cesta ke statickým souborům:', staticPath);
app.use(express.static(staticPath));

// CSRF ochrana - nejprve nastavení tokenu, pak validace
// Nutno přidat před API routy, ale po parseování cookies
app.use(setCsrfToken);
app.use(validateCsrfToken);

// API Routes s různým rate limitingem pro různé typy API
console.log('[SERVER] Registering API routes');
app.use('/api/auth', rateLimit('auth'), authRoutes);
app.use('/api/websites', rateLimit('website'), websiteRoutes);
app.use('/api/social-networks', rateLimit('social'), socialNetworkRoutes);
app.use('/api/config', rateLimit('default'), (req, res, next) => {
  console.log('[SERVER] API config route hit:', req.method, req.path);
  next();
}, apiConfigRoutes);
app.use('/api/analysis', rateLimit('default'), webAnalysisRoutes);
app.use('/api/scheduled-posts', rateLimit('default'), scheduledPostRoutes);
import contentRoutes from './routes/contentRoutes';
app.use('/api/content', rateLimit('default'), setCsrfToken, validateCsrfToken, contentRoutes);

// Legal pages
app.use('/legal', legalRoutes);

// EJS šablony a layout - MUSÍ BÝT PŘED ROUTES!
app.use(expressLayouts);
const viewsPath = SERVER_CONFIG.environment === 'production'
  ? path.join(__dirname, 'views')
  : path.join(__dirname, '..', 'src', 'views');

console.log('[SERVER] Cesta k views:', viewsPath);
app.set('views', viewsPath);
app.set('view engine', 'ejs');
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// GDPR routes
app.use('/api/gdpr', rateLimit('default'), gdprRoutes);

// Dashboard routes
import dashboardRoutes from './routes/dashboardRoutes';
app.use('/dashboard', dashboardRoutes);

/**
 * Authentication middleware
 * Zkontroluje, zda je uživatel přihlášen
 */
const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  console.log('[AUTH] Kontroluji přihlášení na cestě:', req.path);
  
  // Speciální případ - přihlašovací stránka
  if (req.path === '/prihlaseni') {
    console.log('[AUTH] Stránka pro přihlášení, neověřuji');
    next();
    return;
  }
  
  try {
    // Kontrola, zda již nebyla odeslána odpověď
    if (res.headersSent) {
      console.log('[AUTH] Hlavičky již odeslány, nemohu provést autentizaci');
      return;
    }
    
    // Kontrola tokenu v cookie
    const token = req.cookies?.authToken;
    
    if (!token) {
      console.log('[AUTH] Token nenalezen v cookie, hledám v URL');
      
      // Pokud není v cookie, zkusíme URL parametry
      if (req.query.token && typeof req.query.token === 'string') {
        console.log('[AUTH] Token nalezen v URL, nastavuji cookie');
        
        // Uložíme token do cookie
        setAuthCookies(res, req.query.token);
        
        // Přesměrování bez URL parametrů
        const cleanUrl = req.originalUrl.replace(/[?&]token=[^&]+(&|$)/, '$1');
        console.log('[AUTH] Přesměrování na:', cleanUrl || '/dashboard');
        res.redirect(cleanUrl || '/dashboard');
        return;
      }
      
      console.log('[AUTH] Token nenalezen vůbec, přesměrování na login');
      res.redirect(`/prihlaseni?from=${encodeURIComponent(req.path)}`);
      return;
    }
    
    // Ověření JWT tokenu
    try {
      console.log('[AUTH] Ověřuji token z cookie');
      const secretKey = Buffer.from(SECURITY_CONFIG.jwtSecret || 'default-secret-key', 'utf8');
      const decoded = jwt.verify(token, secretKey) as { id: string };
      
      // Vyhledání uživatele
      const user = await User.findById(decoded.id);
      
      if (!user) {
        console.log('[AUTH] Uživatel nenalezen v DB');
        
        // Kontrola, zda již nebyla odeslána odpověď
        if (res.headersSent) {
          console.log('[AUTH] Hlavičky již odeslány, nemohu přesměrovat');
          return;
        }
        
        res.clearCookie('authToken');
        res.clearCookie('loggedIn');
        res.redirect('/prihlaseni');
        return;
      }
      
      // Kontrola, zda již nebyla odeslána odpověď
      if (res.headersSent) {
        console.log('[AUTH] Hlavičky již odeslány, nemohu pokračovat s autentizací');
        return;
      }
      
      // Uživatel nalezen, přidáme ho do requestu
      req.user = user;
      console.log('[AUTH] Uživatel nalezen a ověřen:', user.email);
      next();
      return;
      
    } catch (error) {
      console.error('[AUTH] Chyba při ověření tokenu:', error);
      
      // Kontrola, zda již nebyla odeslána odpověď
      if (res.headersSent) {
        console.log('[AUTH] Hlavičky již odeslány, nemohu přesměrovat po chybě tokenu');
        return;
      }
      
      res.clearCookie('authToken');
      res.clearCookie('loggedIn');
      res.redirect('/prihlaseni');
      return;
    }
    
  } catch (error) {
    console.error('[AUTH] Obecná chyba:', error);
    
    // Kontrola, zda již nebyla odeslána odpověď
    if (res.headersSent) {
      console.log('[AUTH] Hlavičky již odeslány, nemohu přesměrovat po obecné chybě');
      return;
    }
    
    res.redirect('/prihlaseni');
    return;
  }
};

// Základní stránky
app.get('/', (req: Request, res: Response): void => {
  try {
    // V produkčním prostředí zobrazit "Coming Soon" stránku
    if (SERVER_CONFIG.environment === 'production') {
      // Check if the view exists first
      const fs = require('fs');
      const path = require('path');
      const viewsPath = path.join(__dirname, 'views');
      const viewFile = path.join(viewsPath, 'coming-soon.ejs');

      console.log('[SERVER] Checking for coming-soon view at:', viewFile);
      console.log('[SERVER] Views directory contents:', fs.readdirSync(viewsPath));

      if (fs.existsSync(viewFile)) {
        console.log('[SERVER] Coming soon view exists, rendering it');
        return res.render('coming-soon', {
          title: 'BekpaShop - Ve výstavbě',
          description: 'Pracujeme na spuštění nové verze webu',
          layout: false // Bez layoutu pro čistou stránku
        });
      } else {
        console.log('[SERVER] Coming soon view does not exist, falling back to index');
        // Fallback to index if coming-soon doesn't exist
        return res.render('index', {
          title: 'BekpaShop',
          description: 'Online nákupy na BekpaShop'
        });
      }
    } else {
      return res.render('index', {
        title: 'APK-marketing - AI Marketingová platforma',
        description: 'Automatizovaný marketing pro vaše webové stránky pomocí umělé inteligence'
      });
    }
  } catch (error) {
    console.error('[SERVER] Error rendering homepage:', error);
    // Fallback to a basic HTML response
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>BekpaShop - Ve výstavbě</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            margin: 0;
            background-color: #f8f9fa;
          }
          .container {
            text-align: center;
            padding: 2rem;
            max-width: 600px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          }
          .btn {
            display: inline-block;
            padding: 10px 20px;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>BekpaShop</h1>
          <p>Pracujeme na spuštění nové verze webu.</p>
          <p>Děkujeme za trpělivost.</p>
          <a href="/dashboard" class="btn">Pokračovat</a>
        </div>
      </body>
      </html>
    `);
  }
});

// Přihlášení stránka
app.get('/prihlaseni', (req: Request, res: Response): void => {
  res.render('auth/login', {
    title: 'Přihlášení | APK-marketing',
    description: 'Přihlášení do platformy APK-marketing',
    layout: 'layouts/auth'
  });
});

// Registrace stránka
app.get('/registrace', (req: Request, res: Response): void => {
  const plan = req.query.plan || 'basic';
  res.render('auth/register', {
    title: 'Registrace | APK-marketing',
    description: 'Vytvořte si účet na platformě APK-marketing',
    layout: 'layouts/auth',
    selectedPlan: plan
  });
});

// Dashboard po přihlášení - použití auth middleware
app.get('/dashboard', authenticate, (req: Request, res: Response): void => {
  console.log('[SERVER] Vykreslení dashboardu pro uživatele:', req.user?.email);
  
  res.render('dashboard/index', {
    title: 'Dashboard | APK-marketing',
    description: 'Správa vaší AI marketingové kampaně',
    layout: 'layouts/dashboard',
    user: req.user
  });
});

// Správa webů
app.get('/dashboard/weby', authenticate, (req: Request, res: Response): void => {
  console.log('[SERVER] Vykreslení webs pro uživatele:', req.user?.email);
  
  res.render('dashboard/websites/index', {
    title: 'Moje weby | APK-marketing',
    description: 'Správa webových stránek pro AI marketing',
    layout: 'layouts/dashboard',
    user: req.user
  });
});

// Správa sociálních sítí
app.get('/dashboard/socialni-site', authenticate, (req: Request, res: Response): void => {
  console.log('[SERVER] Vykreslení sociálních sítí pro uživatele:', req.user?.email);
  
  // Vytvoření dummy dat pro sociální sítě, pokud uživatel nemá žádné
  if (req.user && !req.user.socialNetworks) {
    req.user.socialNetworks = [];
  }
  
  res.render('dashboard/socialni-site/index', {
    title: 'Sociální sítě | APK-marketing',
    description: 'Správa sociálních sítí pro AI marketing',
    layout: 'layouts/dashboard',
    user: req.user
  });
});

// API konfigurace
app.get('/dashboard/api-config', authenticate, (req: Request, res: Response): void => {
  console.log('[SERVER] Vykreslení API konfigurace pro uživatele:', req.user?.email);
  
  // Pouze admin může přistupovat k této stránce
  if (req.user?.email !== 'fa@fa.com') { // Změňte na správný admin email
    return res.status(403).render('errors/403', {
      title: 'Přístup odepřen | APK-marketing',
      description: 'Nemáte oprávnění k této stránce',
      layout: 'layouts/dashboard',
      user: req.user
    });
  }
  
  res.render('dashboard/api-config', {
    title: 'API konfigurace | APK-marketing',
    description: 'Správa API klíčů pro sociální sítě',
    layout: 'layouts/dashboard',
    user: req.user
  });
});

// Stránka příspěvků
app.get('/dashboard/prispevky', authenticate, (req: Request, res: Response): void => {
  console.log('[SERVER] Vykreslení příspěvků pro uživatele:', req.user?.email);
  
  res.render('dashboard/posts/index', {
    title: 'Příspěvky | APK-marketing',
    description: 'Správa a plánování příspěvků pro sociální sítě',
    layout: 'layouts/dashboard',
    user: req.user
  });
});

// Stránka generování obsahu
app.get('/dashboard/generovani-obsahu', authenticate, setCsrfToken, (req: Request, res: Response): void => {
  console.log('[SERVER] Vykreslení generování obsahu pro uživatele:', req.user?.email);
  
  res.render('dashboard/content/index', {
    title: 'Generování obsahu | APK-marketing',
    description: 'AI generování obsahu pro sociální sítě',
    layout: 'layouts/dashboard',
    user: req.user,
    csrfToken: res.locals.csrfToken || ''
  });
});

// Stránka analýzy
app.get('/dashboard/analyza', authenticate, (req: Request, res: Response): void => {
  console.log('[SERVER] Vykreslení analýzy pro uživatele:', req.user?.email);
  
  res.render('dashboard/analytics/index', {
    title: 'Analýza | APK-marketing',
    description: 'Přehled výkonnosti a statistik',
    layout: 'layouts/dashboard',
    user: req.user
  });
});

// Stránka nastavení
app.get('/dashboard/nastaveni', authenticate, (req: Request, res: Response): void => {
  console.log('[SERVER] Vykreslení nastavení pro uživatele:', req.user?.email);
  
  res.render('dashboard/settings/index', {
    title: 'Nastavení | APK-marketing',
    description: 'Nastavení účtu a aplikace',
    layout: 'layouts/dashboard',
    user: req.user
  });
});

// Stránka předplatného
app.get('/dashboard/predplatne', authenticate, (req: Request, res: Response): void => {
  console.log('[SERVER] Vykreslení předplatného pro uživatele:', req.user?.email);
  
  res.render('dashboard/subscription/index', {
    title: 'Předplatné | APK-marketing',
    description: 'Správa vašeho předplatného',
    layout: 'layouts/dashboard',
    user: req.user
  });
});

// Stránka podpory
app.get('/dashboard/podpora', authenticate, (req: Request, res: Response): void => {
  console.log('[SERVER] Vykreslení stránky podpory pro uživatele:', req.user?.email);
  
  res.render('dashboard/support/index', {
    title: 'Podpora | APK-marketing',
    description: 'Podpora a nápověda k používání aplikace',
    layout: 'layouts/dashboard',
    user: req.user
  });
});

// GDPR nastavení stránka je nyní v dashboardRoutes

// Alternativní cesty
app.get('/Dashboard', (req, res) => res.redirect('/dashboard'));
app.get('/dashboard/websites', (req, res) => res.redirect('/dashboard/weby'));
app.get('/dashboard/social-networks', (req, res) => res.redirect('/dashboard/socialni-site'));

// Importovat emergency controller (nouzové řešení)
import { renderEmergencyPage, directAdd } from './controllers/emergencyController';

// Nouzové cesty pro přidání webu
app.get('/dashboard/emergency-add', authenticate, renderEmergencyPage);
app.post('/api/direct-add', express.json(), directAdd);

// Další stránky
app.get('/sluzby', (req: Request, res: Response): void => {
  res.render('services', {
    title: 'Naše služby | APK-marketing',
    description: 'Kompletní přehled služeb AI marketingové platformy pro vaše webové stránky'
  });
});

app.get('/ceny', (req: Request, res: Response): void => {
  res.render('pricing', {
    title: 'Cenové plány | APK-marketing',
    description: 'Vyberte si cenový plán, který nejlépe odpovídá vašim potřebám'
  });
});

app.get('/o-nas', (req: Request, res: Response): void => {
  res.render('about', {
    title: 'O nás | APK-marketing',
    description: 'Poznejte tým za AI marketingovou platformou APK-marketing'
  });
});

app.get('/kontakt', (req: Request, res: Response): void => {
  res.render('contact', {
    title: 'Kontaktujte nás | APK-marketing',
    description: 'Máte otázky? Kontaktujte náš tým APK-marketing'
  });
});

// Chybová stránka 404
app.use((req: Request, res: Response): void => {
  res.status(404).render('errors/404', {
    title: 'Stránka nenalezena | APK-marketing',
    description: 'Stránka, kterou hledáte, nebyla nalezena'
  });
});

// Import cron služby
import { CronService } from './services/cronService';
import { setupTokenRefresh } from './services/tokenManagerService';

// Spuštění serveru
app.listen(port, () => {
  console.log(`Server běží na portu ${port} v režimu ${SERVER_CONFIG.environment}`);
  
  // Spuštění cron jobů
  const cronService = CronService.getInstance();
  cronService.startAllJobs();
  console.log('Cron joby spuštěny');
  
  // Inicializace obnovy tokenů
  setupTokenRefresh();
  console.log('Token refresh service initialized');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  const cronService = CronService.getInstance();
  cronService.stopAllJobs();
  process.exit(0);
});