import mongoose from 'mongoose';
import { DB_CONFIG } from './config';

// Připojení k MongoDB
export const connectDB = async (): Promise<void> => {
  try {
    const uri = DB_CONFIG.uri;
    console.log(`Connecting to MongoDB with URI: ${uri.substring(0, 20)}...`);
    
    await mongoose.connect(uri, DB_CONFIG.options);
    console.log('MongoDB připojeno úspěšně');
  } catch (error) {
    console.error('Chyba při připojení k MongoDB:', error);
    // Don't exit the process immediately to allow fallback server to start
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
};

// Odpojení od MongoDB
export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('MongoDB odpojeno úspěšně');
  } catch (error) {
    console.error('Chyba při odpojení od MongoDB:', error);
  }
};