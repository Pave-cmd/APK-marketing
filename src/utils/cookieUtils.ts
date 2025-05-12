/**
 * Utility functions for handling authentication cookies
 */
import { Response } from 'express';

/**
 * Sets authentication cookies for the user session
 * @param res Express response object
 * @param token JWT token to store
 */
export function setAuthCookies(res: Response, token: string): void {
  // Set HTTP-only cookie with the token for security
  res.cookie('authToken', token, {
    maxAge: 24 * 60 * 60 * 1000, // 1 den
    httpOnly: true,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  
  // Set visible cookie for JS-side authentication detection
  res.cookie('loggedIn', 'true', {
    maxAge: 24 * 60 * 60 * 1000, // 1 den
    httpOnly: false,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
}