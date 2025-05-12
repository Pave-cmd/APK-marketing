require('dotenv').config();
const mongoose = require('mongoose');

console.log('MongoDB URI:', process.env.MONGODB_URI);

async function testConnection() {
  try {
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Successfully connected to MongoDB!');
    
    // Zkusíme přečíst kolekci users
    const usersCollection = mongoose.connection.collection('users');
    const count = await usersCollection.countDocuments();
    console.log('Number of users in collection:', count);
    
    // Zkusíme vypsat první uživatele, abychom viděli, jak vypadá dokument
    if (count > 0) {
      const firstUser = await usersCollection.findOne();
      console.log('Sample user (without sensitive data):', {
        id: firstUser._id,
        email: firstUser.email,
        websites: firstUser.websites || [],
        plan: firstUser.plan
      });
    }
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

testConnection();
