/**
 * Tento skript slouží k přímé diagnostice problémů s databází
 */
import mongoose from 'mongoose';
import User from './src/models/User';
import { connectDB } from './src/config/db';

// Spustit testy databáze
async function runDatabaseTests() {
  try {
    // Připojení k databázi
    await connectDB();
    console.log('✅ Připojeno k MongoDB.');

    // TEST 1: Načtení uživatelů
    console.log('\n🔎 TEST 1: Načítání uživatelů');
    const users = await User.find({});
    console.log(`Počet uživatelů v databázi: ${users.length}`);
    
    if (users.length === 0) {
      console.log('❌ Žádní uživatelé nenalezeni. Databáze může být prázdná.');
      process.exit(1);
    }

    // Vypsání detailů uživatelů
    users.forEach((user, index) => {
      console.log(`\nUživatel #${index + 1}:`);
      console.log(`ID: ${user._id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Plán: ${user.plan}`);
      console.log(`Weby: ${JSON.stringify(user.websites || [])}`);
      console.log(`Typ websites: ${typeof user.websites}`);
      console.log(`Je websites pole: ${Array.isArray(user.websites)}`);
      
      // Ukázat schema
      const schemaObj = (User.schema as any).obj;
      console.log(`Schema pole websites:`, schemaObj.websites);
    });

    // TEST 2: Zkusit přidat web přímo - první uživatel
    const testUserId = users[0]._id;
    const testUrl = 'https://test-web-' + Date.now() + '.com';
    
    console.log(`\n🔎 TEST 2: Přidání webu ${testUrl} uživateli ${testUserId}`);
    
    // 2.1: Přidat web pomocí findByIdAndUpdate
    console.log('METODA 1: findByIdAndUpdate');
    const updateResult1 = await User.findByIdAndUpdate(
      testUserId,
      { $push: { websites: testUrl + '-method1' } },
      { new: true }
    );
    
    console.log('Výsledek:', updateResult1?.websites || 'chyba');
    
    // 2.2: Přidat web pomocí updateOne
    console.log('\nMETODA 2: updateOne');
    const updateResult2 = await User.updateOne(
      { _id: testUserId },
      { $push: { websites: testUrl + '-method2' } }
    );
    
    console.log('Výsledek:', updateResult2);
    
    // 2.3: Načíst, upravit, uložit
    console.log('\nMETODA 3: findById, .save()');
    const user = await User.findById(testUserId);
    
    if (user) {
      const websitesArray = Array.isArray(user.websites) ? user.websites : [];
      websitesArray.push(testUrl + '-method3');
      user.websites = websitesArray;
      
      const saveResult = await user.save();
      console.log('Výsledek:', saveResult.websites);
    } else {
      console.log('❌ Uživatel nenalezen.');
    }
    
    // 2.4 Načíst uživatele znovu pro kontrolu
    console.log('\nKontrola aktualizací:');
    const updatedUser = await User.findById(testUserId);
    console.log('Aktuální weby:', updatedUser?.websites);
    
    console.log('\n✅ Testy dokončeny.');
  } catch (error) {
    console.error('❌ Chyba při testování:', error);
  } finally {
    // Ukončit připojení
    await mongoose.disconnect();
    console.log('Odpojeno od MongoDB.');
    process.exit(0);
  }
}

// Spustit testy
runDatabaseTests();