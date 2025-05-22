import { Request, Response } from 'express';
import { logger } from './logger';

/**
 * Error handling utility to standardize API error responses
 * @param res Express response object
 * @param statusCode HTTP status code
 * @param message Error message for the user
 * @param error Original error object (optional)
 * @param logPrefix Optional prefix for logging
 */
export function handleApiError(
  res: Response,
  statusCode: number = 500,
  message: string = 'An unexpected error occurred',
  error?: any,
  logPrefix: string = '[API]'
): Response {
  // Log the error
  logger.error(`${logPrefix} ${message}`, { 
    error: error instanceof Error ? { 
      message: error.message, 
      stack: error.stack 
    } : error 
  });

  // Send standardized response
  return res.status(statusCode).json({
    success: false,
    message,
    error: error instanceof Error ? error.message : 'Unknown error'
  });
}

/**
 * Async error handler wrapper for Express route handlers
 * @param fn Async route handler function
 */
export function asyncHandler(fn: (req: Request, res: Response, next?: any) => Promise<any>) {
  return (req: Request, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      handleApiError(res, 500, 'Server error encountered', error);
    });
  };
}

/**
 * Standard success response
 * @param res Express response object
 * @param message Success message
 * @param data Additional data to include in the response
 * @param statusCode HTTP status code (default: 200)
 */
export function sendSuccess(
  res: Response,
  message: string = 'Operation successful',
  data?: any,
  statusCode: number = 200
): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    ...data
  });
}