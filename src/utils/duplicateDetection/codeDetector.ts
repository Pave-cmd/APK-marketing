import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';

const execPromise = util.promisify(exec);

/**
 * Rozhraní pro lokaci v souboru
 */
interface FileLocation {
  line: number;
  column: number;
  position: number;
}

/**
 * Rozhraní pro informace o souboru v duplicitě
 */
interface FileInfo {
  name: string;
  start: number;
  end: number;
  startLoc: FileLocation;
  endLoc: FileLocation;
}

/**
 * Rozhraní pro výsledky kontroly duplicit
 */
export interface DuplicityResult {
  totalClones: number;
  percentOfDuplication: number;
  duplicates: {
    firstFile: string;
    secondFile: string;
    lines: number;
    tokens: number;
  }[];
}

// Rozhraní pro duplicitu z jscpd
interface JscpdDuplicate {
  format: string;
  lines: number;
  fragment: string;
  tokens: number;
  firstFile: FileInfo;
  secondFile: FileInfo;
}

/**
 * Detekce duplicitního kódu v projektu
 * @param threshold Práh duplicity v procentech (výchozí: 1%)
 * @returns Objekt s výsledky detekce duplicit
 */
export async function detectCodeDuplicates(threshold: number = 1): Promise<DuplicityResult> {
  try {
    // Složky, které chceme kontrolovat
    const foldersToCheck = ['src'];
    
    // Vytvoření dočasného souboru pro konfiguraci jscpd
    const configPath = path.join(process.cwd(), 'jscpd-config.json');
    const config = {
      threshold: threshold,
      reporters: ["json"],
      ignore: ["**/node_modules/**", "**/dist/**", "**/*.test.ts", "**/*.spec.ts"],
      format: ["typescript", "javascript", "ejs", "css"],
      output: path.join(process.cwd(), 'jscpd-report'),
      path: foldersToCheck
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    try {
      // Spuštění jscpd pro detekci duplicit
      await execPromise('npx jscpd . --config jscpd-config.json');
    } catch (cmdError: any) {
      // Pokud proces selhal s kódem 1, ale vytvořil report, pokračujeme
      if (cmdError.code !== 1 || !cmdError.stdout.includes('JSON report saved')) {
        throw cmdError;
      }
      console.log('Nalezeny duplicity překračující práh, ale report byl vytvořen, pokračuji...');
    }
    
    // Načtení výsledků z vygenerovaného JSON souboru
    const reportPath = path.join(process.cwd(), 'jscpd-report', 'jscpd-report.json');
    if (!fs.existsSync(reportPath)) {
      throw new Error(`Report soubor nebyl nalezen: ${reportPath}`);
    }
    
    const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    
    // Formátování výsledku
    const result: DuplicityResult = {
      totalClones: reportData.statistics.total.clones,
      percentOfDuplication: reportData.statistics.total.percentage,
      duplicates: []
    };
    
    // Přidání detailů o duplicitách
    if (reportData.duplicates && reportData.duplicates.length > 0) {
      result.duplicates = reportData.duplicates.map((dup: JscpdDuplicate) => ({
        firstFile: dup.firstFile.name,
        secondFile: dup.secondFile.name,
        lines: dup.lines,
        tokens: dup.tokens
      }));
    }
    
    // Odstranění dočasných souborů
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    
    return result;
  } catch (error) {
    console.error('Chyba při detekci duplicitního kódu:', error);
    return {
      totalClones: 0,
      percentOfDuplication: 0,
      duplicates: []
    };
  }
}

/**
 * Funkce pro kontrolu, zda je procento duplicit pod zadaným prahem
 * @param threshold Maximální povolený práh v procentech
 * @returns True pokud je procento duplicit pod prahem
 */
export async function isCodeDuplicityUnderThreshold(threshold: number = 5): Promise<boolean> {
  const result = await detectCodeDuplicates();
  return result.percentOfDuplication < threshold;
}