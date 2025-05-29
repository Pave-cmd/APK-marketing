import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import util from 'util';

/**
 * Rozhraní pro duplicitní soubor
 */
export interface DuplicateFile {
  hash: string;
  size: number;
  paths: string[];
}

/**
 * Získání hashe souboru pro kontrolu duplicit
 * @param filePath Cesta k souboru
 * @returns Hash souboru
 */
async function getFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    
    stream.on('error', (err) => reject(err));
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Získání velikosti souboru
 * @param filePath Cesta k souboru
 * @returns Velikost souboru v bajtech
 */
async function getFileSize(filePath: string): Promise<number> {
  const stats = await util.promisify(fs.stat)(filePath);
  return stats.size;
}

/**
 * Rekurzivní procházení adresáře a hledání všech souborů
 * @param directory Cesta k adresáři
 * @param fileList Pole pro uložení nalezených souborů
 * @param ignoredFolders Pole složek, které mají být ignorovány
 */
async function getAllFiles(directory: string, fileList: string[] = [], ignoredFolders: string[] = ['node_modules', 'dist', '.git']): Promise<string[]> {
  const files = await util.promisify(fs.readdir)(directory);
  
  for (const file of files) {
    const filePath = path.join(directory, file);
    const stats = await util.promisify(fs.stat)(filePath);
    
    if (stats.isDirectory()) {
      if (!ignoredFolders.includes(file)) {
        fileList = await getAllFiles(filePath, fileList, ignoredFolders);
      }
    } else {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

/**
 * Detekce duplicitních souborů v projektu
 * @param directory Cesta k adresáři, který se má prohledat (výchozí: aktuální adresář)
 * @param ignoredFolders Složky, které mají být ignorovány
 * @returns Objekt s výsledky detekce duplicitních souborů
 */
export async function detectDuplicateFiles(directory: string = process.cwd(), ignoredFolders: string[] = ['node_modules', 'dist', '.git']): Promise<DuplicateFile[]> {
  try {
    // Získání všech souborů v adresáři
    const files = await getAllFiles(directory, [], ignoredFolders);
    
    // Mapa pro seskupení souborů podle velikosti
    const sizeGroups: Map<number, string[]> = new Map();
    
    // Seskupení souborů podle velikosti (první filter pro potenciální duplicity)
    for (const file of files) {
      const size = await getFileSize(file);
      
      if (!sizeGroups.has(size)) {
        sizeGroups.set(size, []);
      }
      
      sizeGroups.get(size)?.push(file);
    }
    
    // Filtrování skupin s více než jedním souborem stejné velikosti
    const potentialDuplicates = Array.from(sizeGroups.entries())
      .filter(([, group]) => group.length > 1)
      .map(([size, group]) => ({ size, files: group }));
    
    // Výsledný seznam duplicitních souborů
    const duplicates: DuplicateFile[] = [];
    
    // Kontrola hashů souborů pro potvrzení duplicit
    for (const group of potentialDuplicates) {
      const hashGroups: Map<string, string[]> = new Map();
      
      for (const file of group.files) {
        const hash = await getFileHash(file);
        
        if (!hashGroups.has(hash)) {
          hashGroups.set(hash, []);
        }
        
        hashGroups.get(hash)?.push(file);
      }
      
      // Přidání skutečných duplicit do výsledku
      for (const [hash, files] of hashGroups.entries()) {
        if (files.length > 1) {
          duplicates.push({
            hash,
            size: group.size,
            paths: files
          });
        }
      }
    }
    
    return duplicates;
  } catch (error) {
    console.error('Chyba při detekci duplicitních souborů:', error);
    return [];
  }
}

/**
 * Kontrola, zda existují duplicitní soubory v projektu
 * @param directory Cesta k adresáři, který se má prohledat
 * @returns True pokud nebyly nalezeny žádné duplicitní soubory
 */
export async function hasNoDuplicateFiles(directory: string = process.cwd()): Promise<boolean> {
  const duplicates = await detectDuplicateFiles(directory);
  return duplicates.length === 0;
}

/**
 * Odstranění duplicitních souborů, ponechá pouze jeden soubor z každé skupiny duplicit
 * @param directory Cesta k adresáři, který se má prohledat
 * @returns Počet odstraněných souborů
 */
export async function removeDuplicateFiles(directory: string = process.cwd()): Promise<number> {
  const duplicates = await detectDuplicateFiles(directory);
  let removedCount = 0;
  
  for (const duplicate of duplicates) {
    // Ponechání prvního souboru, odstranění zbytku
    const [, ...remove] = duplicate.paths;
    
    for (const filePath of remove) {
      await util.promisify(fs.unlink)(filePath);
      removedCount++;
    }
  }
  
  return removedCount;
}