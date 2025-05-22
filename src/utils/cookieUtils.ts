/**
 * Utility functions for handling authentication cookies
 */
import { Response } from 'express';

/**
 * Sets authentication cookies for the user session
 * @param res Express response object
 * @param token JWT token to store
 * @param expiresIn Expiration time in milliseconds (default: 7 days)
 */
export function setAuthCookies(res: Response, token: string, expiresIn: number = 7 * 24 * 60 * 60 * 1000): void {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Set HTTP-only cookie with the token for security
  res.cookie('authToken', token, {
    maxAge: expiresIn,
    httpOnly: true, // Skrýt před JavaScript
    path: '/',
    secure: !isDevelopment, // Vždy použít secure kromě development prostředí
    sameSite: 'strict', // Přísnější ochrana proti CSRF
    domain: undefined // Automatické nastavení podle aktuální domény
  });
  
  // Set visible cookie for JS-side authentication detection (contains no sensitive data)
  res.cookie('loggedIn', 'true', {
    maxAge: expiresIn,
    httpOnly: false,
    path: '/',
    secure: !isDevelopment, // Vždy použít secure kromě development prostředí
    sameSite: 'strict',
    domain: undefined
  });
}