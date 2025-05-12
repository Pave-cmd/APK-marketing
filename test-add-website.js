require('dotenv').config();
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

// Test funkce pro přidání webové stránky
async function testAddWebsite() {
  try {
    console.log('MongoDB URI:', process.env.MONGODB_URI);
    console.log('Připojuji se k MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Úspěšně připojeno k MongoDB!');
    
    // Zobrazení všech dostupných kolekcí
    const collections = await mongoose.connection.db.collections();
    console.log('Dostupné kolekce:');
    for (const collection of collections) {
      console.log(' -', collection.collectionName);
    }
    
    // Najdeme existujícího uživatele
    const usersCollection = mongoose.connection.collection('users');
    const users = await usersCollection.find({}).limit(3).toArray();
    
    console.log('\nNalezení uživatelé:', users.length);
    users.forEach((user, index) => {
      console.log(`\nUser ${index + 1}:`, {
        _id: user._id,
        email: user.email,
        websites: user.websites || []
      });
    });
    
    // Vybereme prvního uživatele pro testovací aktualizaci
    if (users.length > 0) {
      const testUser = users[0];
      const userWebsites = testUser.websites || [];
      const newWebsite = 'https://www.bekpagames.com';
      
      console.log(`\nPřidávám web "${newWebsite}" pro uživatele ${testUser._id}`);
      
      // Kontrola, zda web už existuje
      if (userWebsites.includes(newWebsite)) {
        console.log('Webová stránka už existuje v seznamu uživatele');
      } else {
        // Přidáme nový web přímo do MongoDB kolekce
        const updateResult = await usersCollection.updateOne(
          { _id: testUser._id },
          { $set: { websites: [...userWebsites, newWebsite] } }
        );
        
        console.log('Výsledek aktualizace:', updateResult);
        
        // Ověření aktualizace
        const updatedUser = await usersCollection.findOne({ _id: testUser._id });
        console.log('Aktualizovaný uživatel:', {
          _id: updatedUser._id,
          email: updatedUser.email,
          websites: updatedUser.websites || []
        });
      }
    } else {
      console.log('Nebyli nalezeni žádní uživatelé pro testování');
    }
    
  } catch (error) {
    console.error('Chyba během testu:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nOdpojeno od MongoDB');
  }
}

// Spustíme test
testAddWebsite();
