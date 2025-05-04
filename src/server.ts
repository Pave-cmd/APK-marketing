import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import expressLayouts from 'express-ejs-layouts';
import { connectDB } from './config/db';
import { SERVER_CONFIG } from './config/config';
import authRoutes from './routes/authRoutes';

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

// Statické soubory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);

// EJS šablony a layout
app.use(expressLayouts);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Dashboard stránka po přihlášení
app.get('/dashboard', (req: Request, res: Response) => {
  res.render('dashboard/index', { 
    title: 'Dashboard | APK-marketing',
    description: 'Správa vaší AI marketingové kampaně',
    layout: 'layouts/dashboard'
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

// Spuštění serveru
app.listen(port, () => {
  console.log(`Server běží na portu ${port} v režimu ${SERVER_CONFIG.environment}`);
});