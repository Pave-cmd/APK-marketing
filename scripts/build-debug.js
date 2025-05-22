const fs = require('fs');
// path is actually used on line 89 to require package.json
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Build Debugging Script ===');

// Check Node version
console.log('\n=== Node Version ===');
try {
  console.log(execSync('node --version').toString());
} catch (error) {
  console.error('Error getting Node version:', error);
}

// Check npm version
console.log('\n=== NPM Version ===');
try {
  console.log(execSync('npm --version').toString());
} catch (error) {
  console.error('Error getting npm version:', error);
}

// Check current directory structure
console.log('\n=== Current Directory Structure ===');
try {
  console.log(execSync('ls -la').toString());
} catch (error) {
  console.error('Error listing directory:', error);
}

// Check for src directory
console.log('\n=== Source Directory ===');
if (fs.existsSync('src')) {
  console.log('src directory exists');
  try {
    console.log('Contents:');
    console.log(execSync('ls -la src').toString());
  } catch (error) {
    console.error('Error listing src directory:', error);
  }
} else {
  console.log('src directory does not exist');
}

// Check for dist directory
console.log('\n=== Dist Directory ===');
if (fs.existsSync('dist')) {
  console.log('dist directory exists');
  try {
    console.log('Contents:');
    console.log(execSync('ls -la dist').toString());
  } catch (error) {
    console.error('Error listing dist directory:', error);
  }
} else {
  console.log('dist directory does not exist');
}

// Check for views directory in both src and dist
console.log('\n=== Views Directories ===');
if (fs.existsSync('src/views')) {
  console.log('src/views directory exists');
  try {
    console.log('Contents:');
    console.log(execSync('ls -la src/views').toString());
  } catch (error) {
    console.error('Error listing src/views directory:', error);
  }
} else {
  console.log('src/views directory does not exist');
}

if (fs.existsSync('dist/views')) {
  console.log('dist/views directory exists');
  try {
    console.log('Contents:');
    console.log(execSync('ls -la dist/views').toString());
  } catch (error) {
    console.error('Error listing dist/views directory:', error);
  }
} else {
  console.log('dist/views directory does not exist');
}

// Check for package.json
console.log('\n=== Package.json ===');
if (fs.existsSync('package.json')) {
  try {
    const packageJson = require('../package.json');
    console.log('Scripts:', packageJson.scripts);
    console.log('Dependencies:', Object.keys(packageJson.dependencies).length);
    console.log('DevDependencies:', Object.keys(packageJson.devDependencies || {}).length);
  } catch (error) {
    console.error('Error reading package.json:', error);
  }
} else {
  console.log('package.json does not exist');
}

// Check for environment variables
console.log('\n=== Environment Variables ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);

console.log('\n=== Build Debug Complete ===');