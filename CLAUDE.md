# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

APK-marketing is a web application for AI-driven marketing automation for websites. It's built with:
- Node.js/Express backend
- TypeScript
- MongoDB database 
- EJS templating engine for views
- User authentication system

## Common Commands

### Development
- Start development server: `npm run dev`
- Build for production: `npm run build`
- Start production server: `npm start`
- Check for code duplicates: `npm run check-duplicates`

### Code Quality
- Lint the codebase: `npx eslint "src/**/*.{js,ts}" --fix`
- Type check: `npx tsc --noEmit`

## Architecture

### Backend Structure
- `src/server.ts` - Main server entry point
- `src/config/` - Configuration files
- `src/controllers/` - API controllers (authController, websiteController)
- `src/middleware/` - Express middleware including authentication
- `src/models/` - Mongoose database models
- `src/routes/` - Express route definitions
- `src/utils/` - Utility functions including logging and duplicate detection
- `src/views/` - EJS templates for server-rendered pages

### Frontend Assets
- `src/public/css/` - Stylesheets
- `src/public/js/` - Client-side JavaScript
- `src/public/images/` - Image assets

### Key Files
- `src/controllers/authController.ts` - Authentication logic
- `src/controllers/websiteController.ts` - Website management
- `src/models/User.ts` - User data model
- `src/middleware/authMiddleware.ts` - JWT authentication

## Data Flow

1. Authentication
   - Users register or login via `/api/auth` endpoints
   - JWT tokens are stored in cookies
   - Protected routes use `auth` middleware to verify tokens

2. Website Management
   - Authenticated users can add/remove websites via `/api/websites` endpoints
   - Website list is limited based on user subscription plan

3. UI Components
   - Dashboard interface for authenticated users
   - Public marketing pages for non-authenticated users

## Logging System

The application uses winston for logging:
- General logs stored in `logs/YYYY-MM-DD-app.log`
- Error logs stored in `logs/exceptions.log`
- Promise rejection logs stored in `logs/rejections.log`
- Special `webLog()` function for website operations

## Code Quality Checks

- ESLint for code style enforcement
- TypeScript for strict type checking
- Code duplication checks using custom utilities
- Unused code detection

## Error Handling

Errors are handled and logged consistently:
- API errors return consistent JSON format with success/error flags
- Unhandled exceptions and promise rejections are logged to separate files