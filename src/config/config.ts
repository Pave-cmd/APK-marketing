import dotenv from 'dotenv';

// Načtení proměnných prostředí
dotenv.config();

// Konfigurace serveru
export const SERVER_CONFIG = {
  port: process.env.PORT || 3000,
  environment: process.env.NODE_ENV || 'development',
};

// Konfigurace MongoDB
export const DB_CONFIG = {
  // Heroku sets MONGODB_URI for MongoDB addons
  uri: process.env.MONGODB_URI || process.env.MONGODB_URI_HEROKU || process.env.MONGODB_URL || 'mongodb://localhost:27017/apk-marketing',
  // Add a larger timeout for Heroku and MongoDB Atlas
  options: {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000, // Socket timeout
    maxPoolSize: 10, // Maximum number of connections
  }
};

// Konfigurace zabezpečení
export const SECURITY_CONFIG = {
  jwtSecret: process.env.JWT_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production environment');
    }
    console.warn('WARNING: Using default JWT secret for development. DO NOT use in production!');
    return `dev-jwt-secret-${Date.now()}-${Math.random()}`;
  })(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtAlgorithm: 'HS256', // Explicitně nastavený algoritmus pro JWT
};

// Konfigurace API klíčů pro sociální sítě a AI služby
export const API_KEYS = {
  openai: process.env.OPENAI_API_KEY,
  facebook: process.env.FACEBOOK_API_KEY,
  twitter: process.env.TWITTER_API_KEY,
  instagram: process.env.INSTAGRAM_API_KEY,
  linkedin: process.env.LINKEDIN_API_KEY,
  pinterest: process.env.PINTEREST_API_KEY,
  tiktok: process.env.TIKTOK_API_KEY,
  youtube: process.env.YOUTUBE_API_KEY,
};

// Konfigurace cenových plánů
export const PRICING_PLANS = {
  basic: {
    name: 'Basic',
    websiteCount: 1,
    socialNetworksCount: 1,
    price: 19.99,
  },
  standard: {
    name: 'Standard',
    websiteCount: 1,
    socialNetworksCount: 3,
    price: 39.99,
  },
  premium: {
    name: 'Premium',
    websiteCount: 3,
    socialNetworksCount: 5,
    price: 79.99,
  },
  enterprise: {
    name: 'Enterprise',
    websiteCount: 10,
    socialNetworksCount: 10,
    price: 199.99,
  },
};