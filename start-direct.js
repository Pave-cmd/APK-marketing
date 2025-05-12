// Skript pro přímé spuštění serveru bez kontrol kódu
const { spawn } = require('child_process');
const path = require('path');

console.log('Spouštím server přímo bez kontrol kódu...');

// Nastavení prostředí
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Cesta k ts-node a serveru
const tsNodePath = path.join(__dirname, 'node_modules', '.bin', 'ts-node');
const serverScript = path.join(__dirname, 'src', 'server.ts');

// Spuštění serveru
const server = spawn(tsNodePath, [serverScript], {
  stdio: 'inherit', // Sdílení std kanálů
  env: {
    ...process.env,
    SKIP_CODE_CHECKS: 'true', // Přidání vlastní proměnné pro přeskočení kontrol
  }
});

server.on('error', (err) => {
  console.error('Chyba při spuštění serveru:', err);
  process.exit(1);
});

// Zachytávání signálů pro korektní ukončení
['SIGINT', 'SIGTERM'].forEach(signal => {
  process.on(signal, () => {
    console.log(`Přijat signál ${signal}, ukončuji server...`);
    server.kill(signal);
    process.exit(0);
  });
});