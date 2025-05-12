/**
 * Utility functions for URL handling and normalization
 */

/**
 * Normalize a URL to ensure consistent format for storage and comparison
 * - Adds https:// if no protocol is present
 * - Ensures consistent casing (lowercase)
 * - Handles trailing slashes consistently
 *
 * @param url The URL to normalize
 * @param options Configuration options
 * @returns Normalized URL
 */
export function normalizeUrl(url: string, options: {
  keepTrailingSlash?: boolean;
  forceHttps?: boolean;
  lowercaseDomain?: boolean;
} = {}): string {
  // Default options
  const {
    keepTrailingSlash = false,
    forceHttps = true,
    lowercaseDomain = true
  } = options;
  
  if (!url) return '';
  
  // Trim whitespace
  let normalized = url.trim();
  
  // Add protocol if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  
  // Force HTTPS if specified
  if (forceHttps && normalized.startsWith('http://')) {
    normalized = 'https://' + normalized.substring(7);
  }
  
  try {
    // Parse URL to handle components properly
    const parsedUrl = new URL(normalized);
    
    // Convert hostname to lowercase if specified
    if (lowercaseDomain) {
      parsedUrl.hostname = parsedUrl.hostname.toLowerCase();
    }
    
    // Handle trailing slash for root paths
    if (parsedUrl.pathname === '/' || parsedUrl.pathname === '') {
      if (!keepTrailingSlash) {
        parsedUrl.pathname = '';
      } else {
        parsedUrl.pathname = '/';
      }
    } else if (!keepTrailingSlash && parsedUrl.pathname.endsWith('/')) {
      // Remove trailing slash for non-root paths if not keeping them
      parsedUrl.pathname = parsedUrl.pathname.slice(0, -1);
    }
    
    return parsedUrl.toString();
  } catch (error) {
    // If URL parsing fails, return the original with basic normalization
    console.error('Error normalizing URL:', error);
    return normalized;
  }
}

/**
 * Validate a URL to ensure it's properly formatted
 * @param url The URL to validate
 * @returns Object with validation result and optional error message
 */
export function validateUrl(url: string): { isValid: boolean; message?: string } {
  if (!url || typeof url !== 'string') {
    return { isValid: false, message: 'URL je vyžadována' };
  }
  
  const trimmedUrl = url.trim();
  
  if (trimmedUrl.length < 3) {
    return { isValid: false, message: 'URL je příliš krátká' };
  }
  
  if (trimmedUrl.length > 2048) {
    return { isValid: false, message: 'URL je příliš dlouhá (max 2048 znaků)' };
  }
  
  // Add protocol for validation if missing
  let urlForValidation = trimmedUrl;
  if (!urlForValidation.startsWith('http://') && !urlForValidation.startsWith('https://')) {
    urlForValidation = 'https://' + urlForValidation;
  }
  
  try {
    const parsedUrl = new URL(urlForValidation);
    
    // Validate domain
    if (!parsedUrl.hostname || parsedUrl.hostname.length < 3 || !parsedUrl.hostname.includes('.')) {
      return { isValid: false, message: 'Neplatná doména v URL' };
    }
    
    // Check for invalid characters
    const invalidCharsRegex = /[\s<>\\^`{|}]/g;
    if (invalidCharsRegex.test(urlForValidation)) {
      return { isValid: false, message: 'URL obsahuje neplatné znaky' };
    }
    
    return { isValid: true };
  } catch (error) {
    return { isValid: false, message: 'Neplatný formát URL' };
  }
}

/**
 * Check if two URLs are equivalent (considering normalization)
 * @param url1 First URL
 * @param url2 Second URL
 * @returns Whether the URLs are equivalent
 */
export function areUrlsEquivalent(url1: string, url2: string): boolean {
  if (!url1 || !url2) return false;
  
  try {
    // Normalize both URLs for comparison
    const normalizedUrl1 = normalizeUrl(url1, { keepTrailingSlash: false, lowercaseDomain: true });
    const normalizedUrl2 = normalizeUrl(url2, { keepTrailingSlash: false, lowercaseDomain: true });
    
    return normalizedUrl1 === normalizedUrl2;
  } catch (error) {
    // If normalization fails, fall back to simple comparison
    return url1.trim().toLowerCase() === url2.trim().toLowerCase();
  }
}

/**
 * Check if a URL already exists in an array, considering normalization
 * @param urlToCheck The URL to check for
 * @param urlList Array of URLs to check against
 * @returns Whether the URL exists in the array
 */
export function isUrlInList(urlToCheck: string, urlList: string[]): boolean {
  if (!urlToCheck || !urlList || !Array.isArray(urlList)) return false;
  
  // Normalize the URL we're checking for
  const normalizedUrlToCheck = normalizeUrl(urlToCheck, { keepTrailingSlash: false });
  
  // Check if any URL in the list is equivalent to our URL
  return urlList.some(url => areUrlsEquivalent(url, urlToCheck));
}

/**
 * Find the exact URL in a list that matches a given URL (considering normalization)
 * @param urlToFind The URL to find
 * @param urlList Array of URLs to search in
 * @returns The exact URL from the list that matches, or null if not found
 */
export function findMatchingUrl(urlToFind: string, urlList: string[]): string | null {
  if (!urlToFind || !urlList || !Array.isArray(urlList)) return null;
  
  return urlList.find(url => areUrlsEquivalent(url, urlToFind)) || null;
}