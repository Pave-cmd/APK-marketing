/**
 * Skript pro přímou manipulaci s MongoDB bez Mongoose
 */
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

// Načtení proměnných prostředí
dotenv.config();

async function updateMongoDirectly() {
  // Získat connection string z proměnných prostředí
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/apk-marketing';
  console.log('Connection string (zamaskovaný):', uri.replace(/\/\/([^:]+):[^@]+@/, '//***:***@'));

  // Připojení k MongoDB
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Připojeno k MongoDB přímo.');

    // Získáme databázi a kolekci
    const db = client.db();
    const usersCollection = db.collection('users');

    // Výpis všech uživatelů
    console.log('\n📋 Všichni uživatelé v systému:');
    const users = await usersCollection.find({}).toArray();
    users.forEach((user, index) => {
      console.log(`\nUživatel #${index + 1}:`);
      console.log(`ID: ${user._id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Plán: ${user.plan}`);
      console.log(`Weby:`, user.websites);
    });

    // Najít konkrétního uživatele podle ID
    const userId = '68230b5e60874129907eb037'; // ID uživatele fa@fa.com
    console.log(`\n🔍 Hledám uživatele s ID: ${userId}`);
    
    const targetUser = await usersCollection.findOne({ _id: new ObjectId(userId) });
    
    if (targetUser) {
      console.log('✅ Uživatel nalezen:');
      console.log(`Email: ${targetUser.email}`);
      console.log(`Plán: ${targetUser.plan}`);
      console.log(`Weby:`, targetUser.websites);
      
      // Přímá aktualizace uživatele
      const urlToAdd = 'https://example.com/' + Date.now();
      console.log(`\n📝 Přidávám web: ${urlToAdd}`);
      
      // Použijeme typově správnou verzi MongoDB update operace
      const updateResult = await usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $push: { websites: urlToAdd } as any }
      );
      
      console.log('Výsledek aktualizace:', updateResult);
      
      // Kontrola výsledku
      const updatedUser = await usersCollection.findOne({ _id: new ObjectId(userId) });
      console.log('\n✅ Aktualizovaný uživatel:');
      console.log(`Email: ${updatedUser?.email}`);
      console.log(`Weby:`, updatedUser?.websites);
    } else {
      console.log('❌ Uživatel nenalezen');
    }
  } catch (error) {
    console.error('❌ Chyba:', error);
  } finally {
    // Uzavření spojení
    await client.close();
    console.log('\n✅ Spojení s MongoDB ukončeno.');
  }
}

// Spuštění skriptu
updateMongoDirectly().catch(console.error);