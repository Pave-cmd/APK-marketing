/**
 * Migrační skript pro aktualizaci údajů o sociálních sítích
 * 
 * Tento skript aktualizuje strukturu dat o sociálních sítích v databázi
 * po rozšíření modelu pro podporu Twitter a LinkedIn.
 * 
 * Použití:
 * ts-node scripts/migrate-social-networks.ts
 */

import mongoose from 'mongoose';
import User from '../src/models/User';
import ApiConfig from '../src/models/ApiConfig';
import { logger } from '../src/utils/logger';
import dotenv from 'dotenv';

// Načtení prostředí
dotenv.config();

// Připojení k MongoDB
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI není nastaveno v prostředí');
    }
    
    await mongoose.connect(mongoUri);
    logger.info('Připojeno k MongoDB');
  } catch (error) {
    logger.error('Chyba při připojení k MongoDB:', error);
    process.exit(1);
  }
};

// Migrace sociálních sítí v modelech uživatelů
const migrateUserSocialNetworks = async () => {
  try {
    logger.info('Zahajuji migraci sociálních sítí v modelech uživatelů');
    
    // Najdeme všechny uživatele s připojenými sociálními sítěmi
    const users = await User.find({ 'socialNetworks.0': { $exists: true } });
    
    logger.info(`Nalezeno ${users.length} uživatelů s připojenými sociálními sítěmi`);
    
    let updated = 0;
    
    for (const user of users) {
      let modified = false;
      
      // Projdeme všechny sociální sítě uživatele
      for (const network of user.socialNetworks) {
        // Přidání chybějících polí s výchozími hodnotami
        
        // Přesun dat z accessToken a refreshToken do ApiConfig
        if (network.accessToken || network.refreshToken) {
          // Kontrola, zda existuje ApiConfig záznam pro tuto platformu
          const apiConfig = await ApiConfig.findOne({
            userId: user._id,
            platform: network.platform
          });
          
          if (!apiConfig && (network.accessToken || network.refreshToken)) {
            // Vytvoření nového záznamu ApiConfig
            logger.info(`Vytvářím ApiConfig pro uživatele ${user._id} a platformu ${network.platform}`);
            
            const newApiConfig = new ApiConfig({
              userId: user._id,
              platform: network.platform,
              accessToken: network.accessToken,
              refreshToken: network.refreshToken,
              configDetails: {}
            });
            
            // Přidání specifických dat pro platform
            if (network.platform === 'facebook' && network.pageId) {
              newApiConfig.configDetails = {
                ...newApiConfig.configDetails,
                pageId: network.pageId,
                pageName: network.pageName
              };
            }
            
            await newApiConfig.save();
            modified = true;
          }
          
          // Převedeme accessToken a refreshToken na nepovinná pole
          try {
            const networkObj = network.toObject();
            delete networkObj.accessToken;
            delete networkObj.refreshToken;
            
            // Přidání nových polí
            if (!network.status) {
              networkObj.status = 'active';
            }
            
            if (!network.metadata) {
              networkObj.metadata = {};
            }
            
            if (network.tokenExpiry) {
              networkObj.metadata.tokenExpiry = network.tokenExpiry;
              delete networkObj.tokenExpiry;
            }
            
            if (network.lastTokenRefresh) {
              networkObj.metadata.lastTokenRefresh = network.lastTokenRefresh;
              delete networkObj.lastTokenRefresh;
            }
            
            // Aktualizace uživatele
            await User.updateOne(
              { _id: user._id, 'socialNetworks._id': network._id },
              { $set: { 'socialNetworks.$': networkObj } }
            );
            
            modified = true;
          } catch (error) {
            logger.error(`Chyba při aktualizaci sociální sítě:`, error);
          }
        }
        
        // Pokud není nastaveno username, použijeme pageName nebo accountId
        if (!network.username) {
          let username = network.pageName || network.accountId || '';
          
          if (username) {
            await User.updateOne(
              { _id: user._id, 'socialNetworks._id': network._id },
              { $set: { 'socialNetworks.$.username': username } }
            );
            
            modified = true;
          }
        }
      }
      
      if (modified) {
        updated++;
      }
    }
    
    logger.info(`Aktualizováno ${updated} z ${users.length} uživatelů`);
    return updated;
  } catch (error) {
    logger.error('Chyba při migraci sociálních sítí:', error);
    throw error;
  }
};

// Migrace ApiConfig záznamů pro podporu nových polí
const migrateApiConfigs = async () => {
  try {
    logger.info('Zahajuji migraci ApiConfig záznamů');
    
    // Najdeme všechny ApiConfig záznamy
    const apiConfigs = await ApiConfig.find();
    
    logger.info(`Nalezeno ${apiConfigs.length} ApiConfig záznamů`);
    
    let updated = 0;
    
    for (const config of apiConfigs) {
      let modified = false;
      
      // Přidání chybějícího userId, pokud není nastaveno
      if (!config.userId && config.platform === 'facebook') {
        // Pokusíme se najít uživatele, který má připojenou tuto platformu
        const user = await User.findOne({
          'socialNetworks.platform': config.platform
        });
        
        if (user) {
          config.userId = user._id;
          modified = true;
        }
      }
      
      // Přidání configDetails, pokud neexistuje
      if (!config.configDetails) {
        config.configDetails = {};
        modified = true;
      }
      
      // Pro Facebook konfigurace přesuneme informace o stránkách do configDetails
      if (config.platform === 'facebook' && config.pageTokens && config.pageTokens.length > 0) {
        const firstPage = config.pageTokens[0];
        
        if (firstPage && !config.configDetails.pageId) {
          config.configDetails.pageId = firstPage.pageId;
          config.configDetails.pageName = firstPage.name;
          modified = true;
        }
      }
      
      if (modified) {
        await config.save();
        updated++;
      }
    }
    
    logger.info(`Aktualizováno ${updated} z ${apiConfigs.length} ApiConfig záznamů`);
    return updated;
  } catch (error) {
    logger.error('Chyba při migraci ApiConfig záznamů:', error);
    throw error;
  }
};

// Hlavní migrační funkce
const runMigration = async () => {
  try {
    // Připojení k databázi
    await connectDB();
    
    // Migrace sociálních sítí v modelech uživatelů
    const updatedUsers = await migrateUserSocialNetworks();
    
    // Migrace ApiConfig záznamů
    const updatedApiConfigs = await migrateApiConfigs();
    
    logger.info(`Migrace dokončena. Aktualizováno ${updatedUsers} uživatelů a ${updatedApiConfigs} ApiConfig záznamů.`);
    
    // Odpojení od databáze
    await mongoose.disconnect();
    
    process.exit(0);
  } catch (error) {
    logger.error('Chyba při migraci:', error);
    
    // Odpojení od databáze
    await mongoose.disconnect();
    
    process.exit(1);
  }
};

// Spuštění migrace
runMigration();