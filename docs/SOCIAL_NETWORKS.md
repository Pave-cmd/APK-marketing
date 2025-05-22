# Social Networks Integration

This document describes the implementation of social network integrations in the APK-Marketing platform.

## Overview

The APK-Marketing platform now supports integration with multiple social networks for automated content publishing:

- Facebook
- Twitter
- LinkedIn

These integrations allow the application to:

1. Connect user accounts to social media platforms
2. Schedule posts to be published automatically
3. Generate AI-driven content for social media posts
4. Publish content with images and links
5. Retrieve analytics data from social networks

## Technical Implementation

### Architecture

The implementation follows a modular architecture:

1. **Token Management** - Secure storage and refresh of API tokens
2. **Social API Service** - Platform-specific API calls with error handling and retries
3. **Content Generation** - AI-based generation of platform-specific content
4. **Post Scheduling** - Time-based scheduling with recurring posts
5. **Cron Jobs** - Background processing for scheduled tasks

### Key Components

#### Token Management (TokenManagerService)

This service is responsible for:
- Storing and refreshing authentication tokens
- Encrypting sensitive token data
- Providing platform-specific token handling
- Automatic token refresh when nearing expiration

#### Social API Service (SocialApiService)

This service provides a unified interface for:
- Publishing content to different platforms
- Uploading media (images)
- Error handling with automatic retries
- Platform-specific API call optimizations

#### Content Generation (ContentGeneratorService)

This service:
- Generates platform-specific content using OpenAI API
- Applies different tones and styles based on the platform
- Creates content tailored to different types (general, product, blog)
- Optimizes content length for each platform

#### Post Scheduling (ScheduledPostService)

This service:
- Schedules posts for future publishing
- Supports recurring post schedules (daily, weekly, monthly)
- Provides optimal posting time recommendations
- Manages the post lifecycle (pending, published, failed, cancelled)

### Database Models

#### ApiConfig Model

Stores the API configuration and tokens for each social platform:
- Platform-specific API keys and secrets
- User access tokens (encrypted)
- Token expiration dates
- Configuration details for each platform

#### User Model - Social Networks

The User model has been extended with:
- List of connected social networks
- Platform-specific user information
- Publishing preferences
- Connection status and history

#### ScheduledPost Model

Manages the scheduled social media posts:
- Content and scheduling information
- Social network targeting
- Recurrence patterns
- Publishing status and history

## Authentication Flows

### Facebook Authentication

Uses OAuth 2.0 for:
- User authentication
- Page access token acquisition
- Publishing to Facebook Pages

### Twitter Authentication

Uses OAuth 1.0a for:
- User authentication
- Obtaining user access tokens
- Tweet publishing permissions

### LinkedIn Authentication

Uses OAuth 2.0 for:
- User profile access
- Obtaining user access tokens
- Sharing permissions (w_member_social scope)

## Migration

A migration script has been created to update existing data to the new schema:
- `scripts/migrate-social-networks.ts`

This script:
1. Moves token data from the User model to the ApiConfig model
2. Updates the User.socialNetworks schema with the new fields
3. Maintains backward compatibility with existing data

## Security Considerations

- All tokens are encrypted before storage in the database
- API keys and secrets are stored as environment variables
- Token refresh is handled automatically to prevent expiration
- Error handling includes protection against API rate limits

## Configuration

See the `.env.example` file for required environment variables:
- Facebook App credentials
- Twitter API credentials
- LinkedIn App credentials
- OpenAI API key for content generation

## API Documentation

Detailed API documentation is available in `docs/SOCIAL_API.md`, covering:
- Social network connection endpoints
- Scheduled post management
- Content publishing
- Error handling

## Future Enhancements

Planned future enhancements include:
1. Support for additional platforms (Instagram, Pinterest)
2. Enhanced analytics dashboard for social media performance
3. A/B testing for different content styles
4. Smart scheduling based on audience engagement data
5. Content calendar visualization