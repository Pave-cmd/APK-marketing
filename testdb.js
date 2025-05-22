const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/apk-marketing', {})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Get the WebAnalysis model
const WebAnalysis = require('./dist/models/WebAnalysis').default;

async function checkAnalysis() {
  try {
    console.log('MONGODB_URI from env:', process.env.MONGODB_URI);
    
    // Find the latest analysis for bekpagames.com
    const analysis = await WebAnalysis.findOne({
      websiteUrl: 'https://www.bekpagames.com/'
    }).sort({ createdAt: -1 });

    console.log('Analysis found:', analysis);
    
    // Update status if it's stuck in generating
    if (analysis && analysis.status === 'generating') {
      console.log('Updating stuck analysis to completed');
      analysis.status = 'completed';
      await analysis.save();
      console.log('Analysis updated successfully');
    }

    mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
    mongoose.disconnect();
  }
}

checkAnalysis();