import mongoose from 'mongoose';
import { DB_CONFIG } from './config';

// Připojení k MongoDB
export const connectDB = async (): Promise<void> => {
  try {
    const uri = DB_CONFIG.uri;
    console.log(`Connecting to MongoDB with URI: ${uri.substring(0, 20)}...`);
    
    // Check if URI contains actual credentials (not placeholder)
    if (uri.includes('username:password')) {
      console.warn('⚠️  WARNING: Using placeholder MongoDB URI. Please configure MONGODB_URI in .env file with your actual MongoDB Atlas connection string.');
      console.log('📝 Steps to fix:');
      console.log('1. Create a MongoDB Atlas account at https://www.mongodb.com/atlas');
      console.log('2. Create a new cluster');
      console.log('3. Get the connection string and replace the MONGODB_URI in .env');
      console.log('4. Make sure to replace <username>, <password>, and <cluster-url> with actual values');
      console.log('🚀 For now, the server will continue to run without database functionality.');
      return;
    }
    
    // For local development without MongoDB, continue without database
    if (uri === 'mongodb://localhost:27017/apk-marketing') {
      console.warn('⚠️  Local MongoDB not available. Server will run without database.');
      console.log('💡 Options:');
      console.log('1. Use MongoDB Atlas (recommended): Set MONGODB_URI to your Atlas connection string');
      console.log('2. Install Docker and run: docker run -d -p 27017:27017 mongo:6.0');
      console.log('🚀 Server will continue running without database for development...');
      return;
    }
    
    // Disable buffering to avoid timeout errors
    mongoose.set('bufferCommands', false);
    
    await mongoose.connect(uri, DB_CONFIG.options);
    console.log('✅ MongoDB připojeno úspěšně');
  } catch (error) {
    console.error('❌ Chyba při připojení k MongoDB:', error);
    console.log('💡 Tip: Check your MongoDB URI and network connection');
    
    // Don't exit the process in development to allow server to continue
    if (process.env.NODE_ENV !== 'production') {
      console.log('🚀 Server will continue running without database for development...');
      return;
    }
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