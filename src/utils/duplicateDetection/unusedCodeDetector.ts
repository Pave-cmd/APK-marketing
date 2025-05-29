import fs from 'fs';
import path from 'path';
import util from 'util';
import { exec } from 'child_process';
import { formatFileSize } from '../formatters';

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const stat = util.promisify(fs.stat);
const execPromise = util.promisify(exec);

/**
 * Výsledek kontroly nevyužitého souboru
 */
export interface UnusedFileResult {
  filePath: string;
  fileType: string;
  sizeInBytes: number;
  reason: string;
}

/**
 * Výsledek kontroly nevyužitého kódu
 */
export interface UnusedCodeResult {
  filePath: string;
  lineStart: number;
  lineEnd: number;
  codeSnippet: string;
  reason: string;
}

/**
 * Souhrnná zpráva o kontrole nevyužitého kódu a souborů
 */
export interface UnusedCodeReport {
  timestamp: Date;
  unusedFiles: UnusedFileResult[];
  unusedCode: UnusedCodeResult[];
}

/**
 * Konfigurace pro kontrolu nevyužitého kódu a souborů
 */
export interface UnusedCodeConfig {
  ignoreDirs: string[];
  ignoreFiles: string[];
  ignorePatterns: string[];
  includedExtensions: string[];
}

/**
 * Výchozí konfigurace
 */
export const DEFAULT_UNUSED_CONFIG: UnusedCodeConfig = {
  ignoreDirs: ['node_modules', 'dist', '.git', 'jscpd-report'],
  ignoreFiles: ['package-lock.json', 'package.json', 'README.md', 'tsconfig.json', 'jscpd-config.json', 'nodemon.json', '.eslintrc.json'],
  ignorePatterns: ['^_', '\\.d\\.ts$', '\\.test\\.(ts|js)$', '\\.spec\\.(ts|js)$'],
  includedExtensions: ['.ts', '.js', '.ejs', '.css', '.json']
};

/**
 * Vytvoří regex pro ignorované vzory
 * @param patterns Pole vzorů pro ignorování
 * @returns Regex pro testování cest
 */
function createIgnoreRegex(patterns: string[]): RegExp {
  return new RegExp(patterns.join('|'));
}

/**
 * Kontroluje, zda je soubor importován v jiných souborech
 * @param filePath Cesta k souboru
 * @param allFiles Všechny soubory v projektu
 * @returns True, pokud je soubor importován
 */
async function isFileImported(filePath: string, allFiles: string[]): Promise<boolean> {
  // Normalizace cesty pro porovnání
  const normalizedPath = path.normalize(filePath);
  const fileName = path.basename(normalizedPath);
  const fileNameWithoutExt = path.basename(normalizedPath, path.extname(normalizedPath));
  
  // Kontrola všech souborů, zda importují tento soubor
  for (const file of allFiles) {
    if (file === normalizedPath) continue; // Přeskočit sám sebe
    
    // Načtení obsahu souboru
    const content = await readFile(file, 'utf-8');
    
    // Seznam vzorů importů, které je třeba zkontrolovat
    const importPatterns = [
      // TypeScript/JavaScript importy
      `import .* from ['"].*${fileNameWithoutExt}['"]`,
      `require\\(['"].*${fileNameWithoutExt}['"]\\)`,
      // EJS vložení
      `include\\(['"].*${fileNameWithoutExt}['"]\\)`,
      `include.*['"].*${fileName}['"]`,
      // HTML/CSS odkazy
      `href=['"].*${fileName}['"]`,
      `src=['"].*${fileName}['"]`,
      // Běžné reference v kódu
      `['"].*${fileNameWithoutExt}['"]`,
    ];
    
    // Vytvoření regulárního výrazu pro importy
    const importRegex = new RegExp(importPatterns.join('|'), 'i');
    
    // Kontrola, zda obsah souboru obsahuje import
    if (importRegex.test(content)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Kontroluje, zda je soubor spustitelný nebo vstupní bod aplikace
 * @param filePath Cesta k souboru
 * @returns True, pokud je soubor spustitelný
 */
function isEntryPointFile(filePath: string): boolean {
  const normalizedPath = path.normalize(filePath);
  
  // Seznam souborů, které jsou vstupními body
  const entryPoints = [
    'server.ts',
    'index.ts',
    'app.ts',
    'main.ts'
  ];
  
  // Kontrola, zda je soubor vstupním bodem
  const fileName = path.basename(normalizedPath);
  if (entryPoints.includes(fileName)) return true;
  
  // Kontrola souborů v scripts/
  if (normalizedPath.includes('/scripts/')) return true;
  
  return false;
}

/**
 * Kontroluje, zda je soubor v package.json
 * @param filePath Cesta k souboru
 * @returns True, pokud je soubor v package.json
 */
async function isInPackageJson(filePath: string): Promise<boolean> {
  try {
    const normalizedPath = path.normalize(filePath);
    const fileName = path.basename(normalizedPath, path.extname(normalizedPath));
    
    // Načtení package.json
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
    
    // Kontrola scripts
    if (packageJson.scripts) {
      const scriptValues = Object.values(packageJson.scripts) as string[];
      for (const script of scriptValues) {
        if (script.includes(fileName)) return true;
      }
    }
    
    // Kontrola dependencies a devDependencies
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    
    if (allDeps[fileName]) return true;
    
    // Kontrola main, bin a dalších polí
    const fieldsToCheck = ['main', 'bin', 'types', 'typings'];
    for (const field of fieldsToCheck) {
      if (packageJson[field] && packageJson[field].includes(fileName)) return true;
    }
    
    return false;
  } catch (error) {
    console.error('Chyba při kontrole package.json:', error);
    return false;
  }
}

/**
 * Kontroluje, zda je soubor v routách Express
 * @param filePath Cesta k souboru
 * @param allFiles Všechny soubory v projektu
 * @returns True, pokud je soubor v routách
 */
async function isRouteController(filePath: string, allFiles: string[]): Promise<boolean> {
  try {
    const normalizedPath = path.normalize(filePath);
    
    // Kontrola, zda je soubor v controllers/
    if (normalizedPath.includes('/controllers/')) {
      const fileName = path.basename(normalizedPath, path.extname(normalizedPath));
      
      // Prohledat soubory route
      const routeFiles = allFiles.filter(file => file.includes('/routes/'));
      for (const routeFile of routeFiles) {
        const content = await readFile(routeFile, 'utf-8');
        if (content.includes(fileName)) return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Chyba při kontrole rout:', error);
    return false;
  }
}

/**
 * Kontroluje, zda je model využíván v projektu
 * @param filePath Cesta k souboru
 * @param allFiles Všechny soubory v projektu
 * @returns True, pokud je model využíván
 */
async function isModelUsed(filePath: string, allFiles: string[]): Promise<boolean> {
  try {
    const normalizedPath = path.normalize(filePath);
    
    // Kontrola, zda je soubor v models/
    if (normalizedPath.includes('/models/')) {
      const modelName = path.basename(normalizedPath, path.extname(normalizedPath));
      
      // Kontrola použití v controllers/ a services/
      const targetFiles = allFiles.filter(file => 
        file.includes('/controllers/') || 
        file.includes('/services/') || 
        file.includes('/routes/')
      );
      
      for (const file of targetFiles) {
        const content = await readFile(file, 'utf-8');
        if (content.includes(modelName)) return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Chyba při kontrole modelů:', error);
    return false;
  }
}

/**
 * Kontroluje, zda je soubor view (EJS) použit v routách
 * @param filePath Cesta k souboru
 * @param allFiles Všechny soubory v projektu
 * @returns True, pokud je view použito
 */
async function isViewUsed(filePath: string, allFiles: string[]): Promise<boolean> {
  try {
    const normalizedPath = path.normalize(filePath);
    
    // Kontrola, zda je soubor v views/
    if (normalizedPath.includes('/views/')) {
      const viewName = path.basename(normalizedPath, path.extname(normalizedPath));
      
      // Kontrola použití v controllers/ a routes/
      const targetFiles = allFiles.filter(file => 
        file.includes('/controllers/') || 
        file.includes('/routes/') ||
        file.includes('/server.ts') ||
        file.includes('/app.ts')
      );
      
      for (const file of targetFiles) {
        const content = await readFile(file, 'utf-8');
        // Kontrola různých způsobů renderování views
        if (
          content.includes(`render('${viewName}`) ||
          content.includes(`render("${viewName}`) ||
          content.includes(`render('${path.dirname(normalizedPath).split('/').pop()}/${viewName}`) ||
          content.includes(`render("${path.dirname(normalizedPath).split('/').pop()}/${viewName}`)
        ) {
          return true;
        }
      }
      
      // Kontrola, zda je součástí layoutu nebo partials
      if (
        normalizedPath.includes('/layouts/') ||
        normalizedPath.includes('/partials/')
      ) {
        // Kontrola, zda jej nějaká jiná šablona vkládá pomocí include
        const viewFiles = allFiles.filter(file => file.endsWith('.ejs'));
        for (const viewFile of viewFiles) {
          if (viewFile === normalizedPath) continue;
          
          const content = await readFile(viewFile, 'utf-8');
          if (
            content.includes(`include('${viewName}`) ||
            content.includes(`include("${viewName}`) ||
            content.includes(`include('./partials/${viewName}`) ||
            content.includes(`include("./partials/${viewName}`) ||
            content.includes(`include('./layouts/${viewName}`) ||
            content.includes(`include("./layouts/${viewName}`)
          ) {
            return true;
          }
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Chyba při kontrole views:', error);
    return false;
  }
}

/**
 * Kontroluje, zda je CSS nebo JavaScript soubor použit v HTML nebo EJS
 * @param filePath Cesta k souboru
 * @param allFiles Všechny soubory v projektu
 * @returns True, pokud je soubor použit
 */
async function isStaticAssetUsed(filePath: string, allFiles: string[]): Promise<boolean> {
  try {
    const normalizedPath = path.normalize(filePath);
    const ext = path.extname(normalizedPath);
    
    // Kontrola, zda je soubor CSS nebo JS v public/
    if ((ext === '.css' || ext === '.js') && normalizedPath.includes('/public/')) {
      const assetName = path.basename(normalizedPath);
      const relativePath = normalizedPath.split('/public/')[1]; // Cesta relativní k public/
      
      // Kontrola použití v HTML/EJS/layouts
      const targetFiles = allFiles.filter(file => 
        file.endsWith('.ejs') || 
        file.endsWith('.html')
      );
      
      for (const file of targetFiles) {
        const content = await readFile(file, 'utf-8');
        
        // Kontrola různých způsobů linkování
        if (
          content.includes(`href="/css/${assetName}"`) ||
          content.includes(`href="/js/${assetName}"`) ||
          content.includes(`src="/js/${assetName}"`) ||
          content.includes(`href="/${relativePath}"`) ||
          content.includes(`src="/${relativePath}"`)
        ) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Chyba při kontrole statických souborů:', error);
    return false;
  }
}

/**
 * Detekce nevyužitých souborů v projektu
 * @param directory Adresář k prozkoumání
 * @param config Konfigurace
 * @returns Seznam nevyužitých souborů
 */
export async function detectUnusedFiles(
  directory: string = process.cwd(),
  config: UnusedCodeConfig = DEFAULT_UNUSED_CONFIG
): Promise<UnusedFileResult[]> {
  const unusedFiles: UnusedFileResult[] = [];
  const allFiles: string[] = [];
  
  const ignoreRegex = createIgnoreRegex(config.ignorePatterns);
  
  // Rekurzivní procházení adresářů a sběr všech souborů
  async function collectFiles(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Přeskočení ignorovaných adresářů
      if (entry.isDirectory() && !config.ignoreDirs.includes(entry.name)) {
        await collectFiles(fullPath);
      } 
      // Zpracování souborů
      else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        
        // Přeskočení ignorovaných souborů
        if (
          config.ignoreFiles.includes(entry.name) ||
          !config.includedExtensions.includes(ext) ||
          ignoreRegex.test(entry.name)
        ) {
          continue;
        }
        
        allFiles.push(fullPath);
      }
    }
  }
  
  // Sběr všech souborů
  await collectFiles(directory);
  
  // Kontrola každého souboru
  for (const file of allFiles) {
    let isUsed = false;
    let reason = "";
    
    // Kontrola, zda je soubor vstupním bodem
    if (isEntryPointFile(file)) {
      isUsed = true;
      continue;
    }
    
    // Kontrola, zda je soubor v package.json
    if (await isInPackageJson(file)) {
      isUsed = true;
      continue;
    }
    
    // Kontrola, zda je soubor importován jinde
    if (await isFileImported(file, allFiles)) {
      isUsed = true;
      continue;
    }
    
    // Speciální kontroly podle typu souboru
    if (await isRouteController(file, allFiles)) {
      isUsed = true;
      continue;
    }
    
    if (await isModelUsed(file, allFiles)) {
      isUsed = true;
      continue;
    }
    
    if (await isViewUsed(file, allFiles)) {
      isUsed = true;
      continue;
    }
    
    if (await isStaticAssetUsed(file, allFiles)) {
      isUsed = true;
      continue;
    }
    
    // Pokud soubor není použit, přidat ho do seznamu
    if (!isUsed) {
      reason = "Soubor není importován ani použit nikde v projektu";
      
      // Zjištění velikosti souboru
      const stats = await stat(file);
      
      // Přidání do seznamu nevyužitých souborů
      unusedFiles.push({
        filePath: file,
        fileType: path.extname(file),
        sizeInBytes: stats.size,
        reason
      });
    }
  }
  
  return unusedFiles;
}

/**
 * Detekce nevyužitého kódu (nepoužívané funkce, proměnné, atd.)
 * @param directory Adresář k prozkoumání
 * @param config Konfigurace
 * @returns Seznam nevyužitého kódu
 */
export async function detectUnusedCode(
  directory: string = process.cwd(),
  config: UnusedCodeConfig = DEFAULT_UNUSED_CONFIG
): Promise<UnusedCodeResult[]> {
  try {
    const unusedCode: UnusedCodeResult[] = [];
    
    // Kontrola, zda jsou nainstalované potřebné závislosti
    try {
      await execPromise('which eslint');
    } catch {
      console.log('ESLint není nainstalován, instaluji...');
      await execPromise('npm install eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-unused-imports @eslint/eslintrc @eslint/js --save-dev');
    }
    
    try {
      // Použití existujícího eslint.config.js souboru v projektu
      const ignorePatterns = config.ignoreDirs.map(dir => `--ignore-pattern "${dir}/**"`).join(' ');
      const extensions = config.includedExtensions.filter(ext => ext === '.ts' || ext === '.js').join(',');
      
      // Volání ESLint s novým formátem konfigurace
      const { stdout } = await execPromise(
        `npx eslint --ext ${extensions} ${ignorePatterns} ${directory} -f json`
      );
      
      // Zpracování výstupu ESLint
      const results = JSON.parse(stdout);
      
      for (const result of results) {
        for (const message of result.messages) {
          if (
            message.ruleId === '@typescript-eslint/no-unused-vars' ||
            message.ruleId === 'unused-imports/no-unused-imports' ||
            message.ruleId === 'unused-imports/no-unused-vars'
          ) {
            // Načtení souboru pro získání úryvku kódu
            const fileContent = await readFile(result.filePath, 'utf-8');
            const lines = fileContent.split('\n');
            const lineStart = message.line;
            const lineEnd = message.endLine || message.line;
            const codeSnippet = lines.slice(lineStart - 1, lineEnd).join('\n');
            
            unusedCode.push({
              filePath: result.filePath,
              lineStart,
              lineEnd,
              codeSnippet,
              reason: message.message
            });
          }
        }
      }
    } catch (error) {
      console.error('Chyba při spuštění ESLint:', error);
    }
    
    return unusedCode;
  } catch (error) {
    console.error('Chyba při detekci nevyužitého kódu:', error);
    return [];
  }
}

/**
 * Spuštění kompletní kontroly nevyužitého kódu a souborů
 * @param directory Adresář k prozkoumání
 * @param config Konfigurace
 * @returns Report s výsledky kontrol
 */
export async function runUnusedCodeCheck(
  directory: string = process.cwd(),
  config: UnusedCodeConfig = DEFAULT_UNUSED_CONFIG
): Promise<UnusedCodeReport> {
  const unusedFiles = await detectUnusedFiles(directory, config);
  const unusedCode = await detectUnusedCode(directory, config);
  
  return {
    timestamp: new Date(),
    unusedFiles,
    unusedCode
  };
}

/**
 * Formátování výsledků kontroly nevyužitého kódu a souborů
 * @param report Report s výsledky kontrol
 * @returns Formátovaný textový výstup
 */
export function formatUnusedCodeReport(report: UnusedCodeReport): string {
  let output = `===== KONTROLA NEVYUŽITÉHO KÓDU A SOUBORŮ (${report.timestamp.toLocaleString()}) =====\n\n`;
  
  // Výpis nevyužitých souborů
  output += `NEVYUŽITÉ SOUBORY:\n`;
  output += `------------------\n`;
  
  if (report.unusedFiles.length > 0) {
    output += `Celkem nalezeno ${report.unusedFiles.length} nevyužitých souborů.\n\n`;
    
    // Seřazení souborů podle velikosti
    const sortedFiles = [...report.unusedFiles].sort((a, b) => b.sizeInBytes - a.sizeInBytes);
    
    sortedFiles.forEach((file, index) => {
      const relativePath = path.relative(process.cwd(), file.filePath);
      output += `${index + 1}. ${relativePath} [${file.fileType}]\n`;
      output += `   Velikost: ${formatFileSize(file.sizeInBytes)}\n`;
      output += `   Důvod: ${file.reason}\n`;
      output += `   Doporučení: Odstranit nebo začlenit do projektu.\n\n`;
    });
  } else {
    output += `Nebyly nalezeny žádné nevyužité soubory. 👍\n\n`;
  }
  
  // Výpis nevyužitého kódu
  output += `NEVYUŽITÝ KÓD:\n`;
  output += `--------------\n`;
  
  if (report.unusedCode.length > 0) {
    output += `Celkem nalezeno ${report.unusedCode.length} instancí nevyužitého kódu.\n\n`;
    
    // Seskupení podle souborů
    const fileGroups = report.unusedCode.reduce((groups, item) => {
      const filePath = item.filePath;
      if (!groups[filePath]) {
        groups[filePath] = [];
      }
      groups[filePath].push(item);
      return groups;
    }, {} as Record<string, UnusedCodeResult[]>);
    
    Object.entries(fileGroups).forEach(([filePath, items], fileIndex) => {
      const relativePath = path.relative(process.cwd(), filePath);
      output += `${fileIndex + 1}. Soubor: ${relativePath}\n`;
      
      items.forEach((item, itemIndex) => {
        output += `   ${fileIndex + 1}.${itemIndex + 1}. Řádky ${item.lineStart}-${item.lineEnd}: ${item.reason}\n`;
        output += `      \`\`\`\n      ${item.codeSnippet}\n      \`\`\`\n`;
      });
      
      output += `\n`;
    });
  } else {
    output += `Nebyl nalezen žádný nevyužitý kód. 👍\n\n`;
  }
  
  output += `Poznámka: Nevyužitý kód a soubory zvyšují složitost projektu a mohou vést k chybám při údržbě.\n`;
  output += `Doporučujeme pravidelně odstraňovat nevyužitý kód pro udržení čistoty projektu.\n`;
  
  return output;
}

