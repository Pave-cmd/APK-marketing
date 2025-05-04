import mongoose from 'mongoose';
import { DB_CONFIG } from './config';

// Připojení k MongoDB
export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(DB_CONFIG.uri);
    console.log('MongoDB připojeno úspěšně');
  } catch (error) {
    console.error('Chyba při připojení k MongoDB:', error);
    process.exit(1);
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