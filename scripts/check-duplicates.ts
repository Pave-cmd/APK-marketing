import { runDuplicityCheck, formatDuplicityResults } from '../src/utils/duplicateDetection';

/**
 * Skript pro kontrolu duplicit v projektu
 * Spustitelný příkazem: npm run check-duplicates
 */
async function main() {
  console.log('Spouštím komplexní kontrolu kódu...\n');
  
  try {
    // Spuštění kontroly duplicit, velikosti souborů a nevyužitého kódu
    const results = await runDuplicityCheck();
    
    // Výpis formátovaných výsledků
    console.log(formatDuplicityResults(results));
    
    // Extrahování problémů
    const hasDuplicityIssues = results.codeDuplicates.percentOfDuplication > 5;
    const hasDuplicateFileIssues = results.fileDuplicates.length > 0;
    const hasFileSizeIssues = results.fileSizeReport.issues.length > 0;
    const hasUnusedFileIssues = results.unusedCodeReport.unusedFiles.length > 0;
    const hasUnusedCodeIssues = results.unusedCodeReport.unusedCode.length > 0;
    
    // Kontrola výsledků a vrácení správného exit kódu
    if (hasDuplicityIssues || hasDuplicateFileIssues || hasFileSizeIssues || hasUnusedFileIssues || hasUnusedCodeIssues) {
      console.error(`VAROVÁNÍ: Byly nalezeny problémy v kódu.`);
      
      if (hasDuplicityIssues) {
        console.error(`- Duplicitní kód: ${results.codeDuplicates.percentOfDuplication.toFixed(2)}% kódu`);
      }
      
      if (hasDuplicateFileIssues) {
        console.error(`- Duplicitní soubory: ${results.fileDuplicates.length} skupin`);
      }
      
      if (hasFileSizeIssues) {
        console.error(`- Soubory překračující limity velikosti: ${results.fileSizeReport.issues.length} souborů`);
      }
      
      if (hasUnusedFileIssues) {
        console.error(`- Nevyužité soubory: ${results.unusedCodeReport.unusedFiles.length} souborů`);
      }
      
      if (hasUnusedCodeIssues) {
        console.error(`- Nevyužitý kód: ${results.unusedCodeReport.unusedCode.length} instancí`);
      }
      
      process.exit(1); // Neúspěch - vrátí nenulový kód
    } else {
      console.log('OK: Kontrola kódu dokončena, vše v pořádku.');
      process.exit(0); // Úspěch
    }
  } catch (error) {
    console.error('Chyba při kontrole kódu:', error);
    process.exit(2); // Chyba při zpracování
  }
}

// Spuštění hlavní funkce
main();