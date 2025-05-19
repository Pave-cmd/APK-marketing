import mongoose from 'mongoose';
import { connectDB } from './src/config/db';
import ApiConfig from './src/models/ApiConfig';

async function debugDatabase() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');
    
    // List all collections
    if (mongoose.connection.db) {
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log('\nAll collections in database:');
      collections.forEach(col => {
        console.log(`- ${col.name}`);
      });
    } else {
      console.log('Database connection not ready');
    }
    
    // Check ApiConfig collection
    console.log('\nChecking ApiConfig collection:');
    const configs = await ApiConfig.find({});
    console.log(`Found ${configs.length} API configs:`);
    
    configs.forEach(config => {
      console.log(`\nPlatform: ${config.platform}`);
      console.log(`App ID: ${config.appId}`);
      console.log(`Has App Secret: ${!!config.appSecret}`);
      console.log(`Created: ${config.createdAt}`);
      console.log(`Updated: ${config.updatedAt}`);
      console.log(`Raw document:`, JSON.stringify(config.toObject(), null, 2));
    });
    
    // Check raw documents
    if (mongoose.connection.db) {
      console.log('\nRaw documents from apiconfigs collection:');
      const rawDocs = await mongoose.connection.db.collection('apiconfigs').find({}).toArray();
      console.log(`Found ${rawDocs.length} raw documents:`);
      rawDocs.forEach(doc => {
        console.log(JSON.stringify(doc, null, 2));
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

debugDatabase();