import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import expressLayouts from 'express-ejs-layouts';
import cookieParser from 'cookie-parser';  // přidáno pro správu cookies
import { connectDB } from './config/db';
import { SERVER_CONFIG } from './config/config';
import authRoutes from './routes/authRoutes';
import { auth } from './middleware/authMiddleware';  // import autentizačního middleware
import { runDuplicityCheck, formatDuplicityResults } from './utils/duplicateDetection';  // import kontroly duplicit

// Inicializace Express aplikace
const app: Express = express();
const port = SERVER_CONFIG.port;

// Připojení k databázi
connectDB();
console.log('Připojování k MongoDB Atlas...');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());  // přidání cookie parseru

// Statické soubory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);

// Endpoint pro kontrolu duplicit - pouze pro adminy nebo vývojáře
app.get('/api/check-duplicates', auth, async (req: Request, res: Response) => {
  // Kontrola, zda má uživatel oprávnění (pouze admin)
  if (req.user && req.user.role === 'admin') {
    try {
      // Spuštění kontroly duplicit
      const results = await runDuplicityCheck();
      const formattedResults = formatDuplicityResults(results);
      
      res.status(200).json({
        success: true,
        message: 'Kontrola duplicit dokončena',
        results: {
          formattedResults,
          rawResults: results
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Při kontrole duplicit došlo k chybě',
        error: (error as Error).message
      });
    }
  } else {
    res.status(403).json({
      success: false,
      message: 'Nemáte oprávnění pro tuto akci'
    });
  }
});

// EJS šablony a layout
app.use(expressLayouts);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Dashboard stránka po přihlášení - použití auth middleware
app.get('/dashboard', auth, (req: Request, res: Response) => {
  res.render('dashboard/index', { 
    title: 'Dashboard | APK-marketing',
    description: 'Správa vaší AI marketingové kampaně',
    layout: 'layouts/dashboard',
    user: req.user  // předání informací o uživateli do šablony
  });
});

// Základní cesta - Vykreslení úvodní stránky
app.get('/', (req: Request, res: Response) => {
  res.render('index', { 
    title: 'APK-marketing - AI Marketingová platforma',
    description: 'Automatizovaný marketing pro vaše webové stránky pomocí umělé inteligence'
  });
});

// Služby stránka
app.get('/sluzby', (req: Request, res: Response) => {
  res.render('services', { 
    title: 'Naše služby | APK-marketing',
    description: 'Kompletní přehled služeb AI marketingové platformy pro vaše webové stránky'
  });
});

// Cenové plány stránka
app.get('/ceny', (req: Request, res: Response) => {
  res.render('pricing', { 
    title: 'Cenové plány | APK-marketing',
    description: 'Vyberte si cenový plán, který nejlépe odpovídá vašim potřebám'
  });
});

// O nás stránka
app.get('/o-nas', (req: Request, res: Response) => {
  res.render('about', { 
    title: 'O nás | APK-marketing',
    description: 'Poznejte tým za AI marketingovou platformou APK-marketing'
  });
});

// Kontakt stránka
app.get('/kontakt', (req: Request, res: Response) => {
  res.render('contact', { 
    title: 'Kontaktujte nás | APK-marketing',
    description: 'Máte otázky? Kontaktujte náš tým APK-marketing'
  });
});

// Přihlášení stránka
app.get('/prihlaseni', (req: Request, res: Response) => {
  res.render('auth/login', { 
    title: 'Přihlášení | APK-marketing',
    description: 'Přihlášení do platformy APK-marketing',
    layout: 'layouts/auth'
  });
});

// Registrace stránka
app.get('/registrace', (req: Request, res: Response) => {
  const plan = req.query.plan || 'basic';
  res.render('auth/register', { 
    title: 'Registrace | APK-marketing',
    description: 'Vytvořte si účet na platformě APK-marketing',
    layout: 'layouts/auth',
    selectedPlan: plan
  });
});

// Chybová stránka 404
app.use((req: Request, res: Response) => {
  res.status(404).render('errors/404', { 
    title: 'Stránka nenalezena | APK-marketing',
    description: 'Stránka, kterou hledáte, nebyla nalezena'
  });
});

// Automatická kontrola duplicit při spuštění serveru
async function runInitialDuplicityCheck() {
  try {
    console.log('Spouštím kontrolu duplicit...');
    const results = await runDuplicityCheck();
    console.log(formatDuplicityResults(results));
    
    // Upozornění, pokud je procento duplicit příliš vysoké
    if (results.codeDuplicates.percentOfDuplication > 10) {
      console.warn('VAROVÁNÍ: Procento duplicitního kódu je vyšší než 10%!');
    }
    
    // Upozornění, pokud existují duplicitní soubory
    if (results.fileDuplicates.length > 0) {
      console.warn('VAROVÁNÍ: Byly nalezeny duplicitní soubory v projektu!');
    }
  } catch (error) {
    console.error('Chyba při počáteční kontrole duplicit:', error);
  }
}

// Spuštění serveru a inicializace kontroly duplicit
app.listen(port, () => {
  console.log(`Server běží na portu ${port} v režimu ${SERVER_CONFIG.environment}`);
  
  // Spuštění kontroly duplicit pouze v development režimu
  if (SERVER_CONFIG.environment === 'development') {
    runInitialDuplicityCheck();
    
    // Nastavení pravidelné kontroly duplicit každých 24 hodin
    const oneDayInMs = 24 * 60 * 60 * 1000;
    setInterval(runInitialDuplicityCheck, oneDayInMs);
  }
});