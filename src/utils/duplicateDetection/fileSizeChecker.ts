import fs from 'fs';
import path from 'path';
import util from 'util';
import { formatFileSize } from '../formatters';

const stat = util.promisify(fs.stat);
const readdir = util.promisify(fs.readdir);

/**
 * Konfigurace limitů velikosti souborů podle typu
 */
export interface FileSizeConfig {
  maxLines: number;
  maxChars: number;
}

/**
 * Výchozí konfigurace limitů velikosti souborů podle typu
 */
export const DEFAULT_SIZE_CONFIG: Record<string, FileSizeConfig> = {
  // TypeScript soubory
  '.ts': {
    maxLines: 300,
    maxChars: 10000
  },
  // JavaScript soubory
  '.js': {
    maxLines: 300,
    maxChars: 10000
  },
  // CSS soubory
  '.css': {
    maxLines: 500,
    maxChars: 15000
  },
  // HTML/EJS soubory
  '.ejs': {
    maxLines: 400,
    maxChars: 12000
  },
  // JSON soubory
  '.json': {
    maxLines: 500,
    maxChars: 15000
  },
  // Výchozí limity pro ostatní typy souborů
  'default': {
    maxLines: 400,
    maxChars: 10000
  }
};

/**
 * Výsledek kontroly velikosti souboru
 */
export interface FileSizeCheckResult {
  filePath: string;
  fileType: string;
  lines: number;
  chars: number;
  sizeInBytes: number;
  exceededLines: boolean;
  exceededChars: boolean;
  allowed: {
    maxLines: number;
    maxChars: number;
  };
}

/**
 * Souhrnný výsledek kontroly velikosti souborů
 */
export interface FileSizeReport {
  timestamp: Date;
  scannedFiles: number;
  scannedDirectories: number;
  totalSizeInBytes: number;
  issues: FileSizeCheckResult[];
}

/**
 * Kontroluje zda soubor nepřekračuje limity velikosti
 * @param filePath Cesta k souboru
 * @param config Konfigurace limitů velikosti
 * @returns Výsledek kontroly velikosti souboru
 */
export async function checkFileSize(filePath: string, config: Record<string, FileSizeConfig> = DEFAULT_SIZE_CONFIG): Promise<FileSizeCheckResult> {
  // Získání statistik souboru
  const stats = await stat(filePath);
  const fileExt = path.extname(filePath);
  
  // Načtení obsahu souboru
  const content = await fs.promises.readFile(filePath, 'utf-8');
  const lines = content.split('\n').length;
  const chars = content.length;
  
  // Určení limitů pro daný typ souboru
  const limits = config[fileExt] || config['default'];
  
  return {
    filePath,
    fileType: fileExt,
    lines,
    chars,
    sizeInBytes: stats.size,
    exceededLines: lines > limits.maxLines,
    exceededChars: chars > limits.maxChars,
    allowed: {
      maxLines: limits.maxLines,
      maxChars: limits.maxChars
    }
  };
}

/**
 * Rekurzivně prochází adresáře a kontroluje velikost všech souborů
 * @param directory Cesta k adresáři
 * @param config Konfigurace limitů velikosti
 * @param ignoredFolders Ignorované složky
 * @returns Report o velikosti souborů
 */
export async function checkDirectoryFilesSizes(
  directory: string = process.cwd(),
  config: Record<string, FileSizeConfig> = DEFAULT_SIZE_CONFIG,
  ignoredFolders: string[] = ['node_modules', 'dist', '.git', 'jscpd-report']
): Promise<FileSizeReport> {
  const report: FileSizeReport = {
    timestamp: new Date(),
    scannedFiles: 0,
    scannedDirectories: 0,
    totalSizeInBytes: 0,
    issues: []
  };
  
  // Pomocná funkce pro rekurzivní procházení adresářů
  async function scanDirectory(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    report.scannedDirectories++;
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Přeskočení ignorovaných složek
        if (!ignoredFolders.includes(entry.name)) {
          await scanDirectory(fullPath);
        }
      } else if (entry.isFile()) {
        try {
          // Filtrace souborů podle přípony
          const ext = path.extname(entry.name);
          if (ext && (config[ext] || config['default'])) {
            const checkResult = await checkFileSize(fullPath, config);
            report.scannedFiles++;
            report.totalSizeInBytes += checkResult.sizeInBytes;
            
            // Přidání souborů s překročenými limity do reportu
            if (checkResult.exceededLines || checkResult.exceededChars) {
              report.issues.push(checkResult);
            }
          }
        } catch (error) {
          console.error(`Chyba při kontrole souboru ${fullPath}:`, error);
        }
      }
    }
  }
  
  await scanDirectory(directory);
  return report;
}

/**
 * Formátuje výsledky kontroly velikosti souborů do čitelného formátu
 * @param report Výsledek kontroly velikosti souborů
 * @returns Formátovaný textový výstup
 */
export function formatFileSizeReport(report: FileSizeReport): string {
  let output = `===== KONTROLA VELIKOSTI SOUBORŮ (${report.timestamp.toLocaleString()}) =====\n\n`;
  
  output += `Celkový přehled:\n`;
  output += `------------------\n`;
  output += `Kontrolované soubory: ${report.scannedFiles}\n`;
  output += `Kontrolované adresáře: ${report.scannedDirectories}\n`;
  output += `Celková velikost: ${formatFileSize(report.totalSizeInBytes)}\n`;
  output += `Počet souborů s problémy: ${report.issues.length}\n\n`;
  
  if (report.issues.length > 0) {
    output += `Soubory překračující limity:\n`;
    output += `----------------------------\n`;
    
    // Seřazení problémových souborů podle závažnosti
    const sortedIssues = [...report.issues].sort((a, b) => {
      // Nejprve podle procenta překročení limitu řádků
      const aLinePercent = a.lines / a.allowed.maxLines;
      const bLinePercent = b.lines / b.allowed.maxLines;
      
      return bLinePercent - aLinePercent;
    });
    
    sortedIssues.forEach((issue, index) => {
      const relativePath = path.relative(process.cwd(), issue.filePath);
      const linePercent = ((issue.lines / issue.allowed.maxLines) * 100).toFixed(1);
      const charPercent = ((issue.chars / issue.allowed.maxChars) * 100).toFixed(1);
      
      output += `${index + 1}. ${relativePath} [${issue.fileType}]\n`;
      output += `   Velikost: ${formatFileSize(issue.sizeInBytes)}\n`;
      
      if (issue.exceededLines) {
        output += `   Řádky: ${issue.lines} / ${issue.allowed.maxLines} (${linePercent}% limitu) ⚠️\n`;
      } else {
        output += `   Řádky: ${issue.lines} / ${issue.allowed.maxLines} (${linePercent}% limitu)\n`;
      }
      
      if (issue.exceededChars) {
        output += `   Znaky: ${issue.chars} / ${issue.allowed.maxChars} (${charPercent}% limitu) ⚠️\n`;
      } else {
        output += `   Znaky: ${issue.chars} / ${issue.allowed.maxChars} (${charPercent}% limitu)\n`;
      }
      
      output += `   Doporučení: Rozdělit soubor do menších logických celků.\n\n`;
    });
    
    output += `Poznámka: Soubory překračující stanovené limity mohou být obtížněji udržovatelné.\n`;
    output += `Zvažte rozdělení velkých souborů do menších modulů s jasně definovanou zodpovědností.\n`;
  } else {
    output += `Všechny soubory splňují stanovené limity velikosti. 👍\n`;
  }
  
  return output;
}

