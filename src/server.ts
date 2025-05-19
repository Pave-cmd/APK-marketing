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
import jwt from 'jsonwebtoken';
import { setAuthCookies } from './utils/cookieUtils';

// Inicializace Express aplikace
const app: Express = express();
const port = SERVER_CONFIG.port;

// Připojení k databázi
connectDB();
console.log('Připojování k MongoDB Atlas...');

// Middleware
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.originalUrl}`);
  next();
});
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Statické soubory
const staticPath = SERVER_CONFIG.environment === 'production'
  ? path.join(__dirname, 'public')
  : path.join(__dirname, '..', 'src', 'public');

console.log('[SERVER] Cesta ke statickým souborům:', staticPath);
app.use(express.static(staticPath));

// API Routes
console.log('[SERVER] Registering API routes');
app.use('/api/auth', authRoutes);
app.use('/api/websites', websiteRoutes);
app.use('/api/social-networks', socialNetworkRoutes);
app.use('/api/config', (req, res, next) => {
  console.log('[SERVER] API config route hit:', req.method, req.path);
  next();
}, apiConfigRoutes);
app.use('/api/analysis', webAnalysisRoutes);

// EJS šablony a layout
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

/**
 * Authentication middleware
 * Zkontroluje, zda je uživatel přihlášen
 */
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  console.log('[AUTH] Kontroluji přihlášení na cestě:', req.path);
  
  // Speciální případ - přihlašovací stránka
  if (req.path === '/prihlaseni') {
    console.log('[AUTH] Stránka pro přihlášení, neověřuji');
    return next();
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
        return res.redirect(cleanUrl || '/dashboard');
      }
      
      console.log('[AUTH] Token nenalezen vůbec, přesměrování na login');
      return res.redirect(`/prihlaseni?from=${encodeURIComponent(req.path)}`);
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
        return res.redirect('/prihlaseni');
      }
      
      // Kontrola, zda již nebyla odeslána odpověď
      if (res.headersSent) {
        console.log('[AUTH] Hlavičky již odeslány, nemohu pokračovat s autentizací');
        return;
      }
      
      // Uživatel nalezen, přidáme ho do requestu
      req.user = user;
      console.log('[AUTH] Uživatel nalezen a ověřen:', user.email);
      next(); // Voláme next() bez return, abychom zabránili dvojitému volání response
      
    } catch (error) {
      console.error('[AUTH] Chyba při ověření tokenu:', error);
      
      // Kontrola, zda již nebyla odeslána odpověď
      if (res.headersSent) {
        console.log('[AUTH] Hlavičky již odeslány, nemohu přesměrovat po chybě tokenu');
        return;
      }
      
      res.clearCookie('authToken');
      res.clearCookie('loggedIn');
      return res.redirect('/prihlaseni');
    }
    
  } catch (error) {
    console.error('[AUTH] Obecná chyba:', error);
    
    // Kontrola, zda již nebyla odeslána odpověď
    if (res.headersSent) {
      console.log('[AUTH] Hlavičky již odeslány, nemohu přesměrovat po obecné chybě');
      return;
    }
    
    return res.redirect('/prihlaseni');
  }
};

// Základní stránky
app.get('/', (req: Request, res: Response): void => {
  res.render('index', {
    title: 'APK-marketing - AI Marketingová platforma',
    description: 'Automatizovaný marketing pro vaše webové stránky pomocí umělé inteligence'
  });
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
  console.log('[SERVER] Vykreslení dashboardu pro uživatele:', req.user.email);
  
  res.render('dashboard/index', {
    title: 'Dashboard | APK-marketing',
    description: 'Správa vaší AI marketingové kampaně',
    layout: 'layouts/dashboard',
    user: req.user
  });
});

// Správa webů
app.get('/dashboard/weby', authenticate, (req: Request, res: Response): void => {
  console.log('[SERVER] Vykreslení webs pro uživatele:', req.user.email);
  
  res.render('dashboard/websites/index', {
    title: 'Moje weby | APK-marketing',
    description: 'Správa webových stránek pro AI marketing',
    layout: 'layouts/dashboard',
    user: req.user
  });
});

// Správa sociálních sítí
app.get('/dashboard/socialni-site', authenticate, (req: Request, res: Response): void => {
  console.log('[SERVER] Vykreslení sociálních sítí pro uživatele:', req.user.email);
  
  // Vytvoření dummy dat pro sociální sítě, pokud uživatel nemá žádné
  if (!req.user.socialNetworks) {
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
  console.log('[SERVER] Vykreslení API konfigurace pro uživatele:', req.user.email);
  
  // Pouze admin může přistupovat k této stránce
  if (req.user.email !== 'fa@fa.com') { // Změňte na správný admin email
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

// Spuštění serveru
app.listen(port, () => {
  console.log(`Server běží na portu ${port} v režimu ${SERVER_CONFIG.environment}`);
  
  // Spuštění cron jobů
  const cronService = CronService.getInstance();
  cronService.startAllJobs();
  console.log('Cron joby spuštěny');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  const cronService = CronService.getInstance();
  cronService.stopAllJobs();
  process.exit(0);
});