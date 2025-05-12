/**
 * Sdílené pomocné formátovací funkce
 */

/**
 * Formátuje velikost souboru v bajtech na čitelnou podobu (KB, MB, GB)
 * @param bytes Velikost v bajtech
 * @param decimals Počet desetinných míst
 * @returns Formátovaná velikost (např. "1.23 MB")
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}