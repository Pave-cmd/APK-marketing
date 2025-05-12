import { detectCodeDuplicates, DuplicityResult } from './codeDetector';
import { detectDuplicateFiles, DuplicateFile } from './fileDetector';
import { checkDirectoryFilesSizes, FileSizeReport, formatFileSizeReport } from './fileSizeChecker';
import { formatFileSize } from '../formatters';
import { runUnusedCodeCheck, UnusedCodeReport, formatUnusedCodeReport } from './unusedCodeDetector';

/**
 * Rozhraní pro kompletní výsledky kontroly duplicit
 */
export interface DuplicityCheckResult {
  codeDuplicates: DuplicityResult;
  fileDuplicates: DuplicateFile[];
  fileSizeReport: FileSizeReport;
  unusedCodeReport: UnusedCodeReport;
  timestamp: Date;
}

/**
 * Spuštění kompletní kontroly duplicit - kód i soubory
 * @returns Objekt s výsledky obou kontrol
 */
export async function runDuplicityCheck(): Promise<DuplicityCheckResult> {
  // Spuštění kontroly duplicitního kódu
  const codeDuplicates = await detectCodeDuplicates(5); // Zvýšení prahu na 5%
  
  // Spuštění kontroly duplicitních souborů
  const fileDuplicates = await detectDuplicateFiles();
  
  // Spuštění kontroly velikosti souborů
  const fileSizeReport = await checkDirectoryFilesSizes();
  
  // Spuštění kontroly nevyužitého kódu
  const unusedCodeReport = await runUnusedCodeCheck();
  
  return {
    codeDuplicates,
    fileDuplicates,
    fileSizeReport,
    unusedCodeReport,
    timestamp: new Date()
  };
}

/**
 * Funkce pro zobrazení přehledného výpisu výsledků kontroly duplicit
 * @param results Výsledky kontroly duplicit
 * @returns Formátovaný textový výstup s výsledky
 */
export function formatDuplicityResults(results: DuplicityCheckResult): string {
  let output = `===== VÝSLEDKY KONTROLY KÓDU (${results.timestamp.toLocaleString()}) =====\n\n`;
  
  // Výpis duplicitního kódu
  output += `DUPLICITNÍ KÓD:\n`;
  output += `------------------\n`;
  output += `Celkový počet duplicit: ${results.codeDuplicates.totalClones}\n`;
  output += `Procento duplicitního kódu: ${results.codeDuplicates.percentOfDuplication.toFixed(2)}%\n\n`;
  
  if (results.codeDuplicates.duplicates.length > 0) {
    output += `Detaily duplicit:\n`;
    results.codeDuplicates.duplicates.forEach((dup, index) => {
      output += `${index + 1}. Duplicita mezi soubory:\n`;
      output += `   - ${dup.firstFile}\n`;
      output += `   - ${dup.secondFile}\n`;
      output += `   Počet duplicitních řádků: ${dup.lines}\n`;
      output += `   Počet duplicitních tokenů: ${dup.tokens}\n\n`;
    });
  } else {
    output += `Nebyly nalezeny žádné významné duplicity v kódu.\n\n`;
  }
  
  // Výpis duplicitních souborů
  output += `DUPLICITNÍ SOUBORY:\n`;
  output += `-------------------\n`;
  
  if (results.fileDuplicates.length > 0) {
    output += `Počet skupin duplicitních souborů: ${results.fileDuplicates.length}\n\n`;
    
    results.fileDuplicates.forEach((dup, index) => {
      output += `${index + 1}. Skupina duplicitních souborů (velikost: ${formatFileSize(dup.size)}):\n`;
      dup.paths.forEach(filePath => {
        output += `   - ${filePath}\n`;
      });
      output += `\n`;
    });
  } else {
    output += `Nebyly nalezeny žádné duplicitní soubory.\n`;
  }
  
  // Přidání sekce pro velikost souborů
  output += `\n${formatFileSizeReport(results.fileSizeReport)}`;
  
  // Přidání sekce pro nevyužitý kód
  output += `\n${formatUnusedCodeReport(results.unusedCodeReport)}`;
  
  return output;
}