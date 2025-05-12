// Simple script to start the server
const { spawn } = require('child_process');
const path = require('path');

console.log('Starting the fixed server...');

// Start the server
const server = spawn('npx', ['ts-node', 'src/server-new.ts'], {
  stdio: 'inherit'
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
});

server.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
});