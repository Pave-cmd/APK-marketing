const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting Heroku startup script...');

// Check if dist/views directory exists
if (!fs.existsSync(path.join(__dirname, '../dist/views'))) {
  console.log('Creating dist/views directory...');
  fs.mkdirSync(path.join(__dirname, '../dist/views'), { recursive: true });
}

// Check if src/views directory exists
if (fs.existsSync(path.join(__dirname, '../src/views'))) {
  console.log('Copying view files from src to dist...');
  try {
    // Create dist/views if it doesn't exist
    if (!fs.existsSync(path.join(__dirname, '../dist/views'))) {
      fs.mkdirSync(path.join(__dirname, '../dist/views'), { recursive: true });
    }
    
    // Copy all view files
    execSync('cp -R src/views/* dist/views/', { stdio: 'inherit' });
    console.log('View files copied successfully!');
  } catch (error) {
    console.error('Error copying view files:', error);
  }
}

// Check if dist/public directory exists
if (!fs.existsSync(path.join(__dirname, '../dist/public'))) {
  console.log('Creating dist/public directory...');
  fs.mkdirSync(path.join(__dirname, '../dist/public'), { recursive: true });
}

// Check if src/public directory exists
if (fs.existsSync(path.join(__dirname, '../src/public'))) {
  console.log('Copying public files from src to dist...');
  try {
    // Copy all public files
    execSync('cp -R src/public/* dist/public/', { stdio: 'inherit' });
    console.log('Public files copied successfully!');
  } catch (error) {
    console.error('Error copying public files:', error);
  }
}

// Start the application
console.log('Starting the application...');
require('../dist/server.js');