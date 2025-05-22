# Social Network API Documentation

This document describes the API endpoints for managing social media connections and scheduled posts in the APK-Marketing application.

## Configuration Requirements

Before using the social media functionality, you need to set up the following:

1. Create OAuth applications on each platform (Facebook, Twitter, LinkedIn)
2. Add the necessary environment variables (see `.env.example`)
3. Configure redirect URIs in the platform developer dashboards

## Social Network Connection Endpoints

### List Connected Social Networks

Returns all social networks connected to the current user's account.

**Endpoint:** `GET /api/social-networks`

**Authentication:** Required (JWT)

**Response:**
```json
{
  "success": true,
  "socialNetworks": [
    {
      "_id": "60a6c3e9b9f6a82af823c4e2",
      "platform": "facebook",
      "username": "John's Facebook Page",
      "status": "active",
      "pageId": "123456789012345",
      "pageName": "Business Page Name",
      "connectedAt": "2023-05-20T15:22:23.000Z",
      "lastPostAt": "2023-05-25T10:11:12.000Z",
      "publishSettings": {
        "autoPublish": true,
        "frequency": "weekly",
        "contentType": "mix",
        "bestTimeToPost": true
      }
    }
  ]
}
```

### Connect to Social Network

Initiates the OAuth connection flow for the specified platform.

**Endpoint:** `GET /api/social-networks/connect/:platform`

**Authentication:** Required (JWT)

**URL Parameters:**
- `platform`: The social network platform to connect to (facebook, twitter, linkedin)

**Response:** Redirects to the OAuth consent screen of the specified platform.

### OAuth Callback Endpoint

Handles the OAuth callback from social platforms after user authorization.

**Endpoint:** `GET /api/social-networks/callback/:platform`

**Authentication:** Required (JWT)

**URL Parameters:**
- `platform`: The social network platform (facebook, twitter, linkedin)

**Query Parameters:** Varies by platform (typically includes authorization code or OAuth tokens)

**Response:** Redirects to the application dashboard with success or error status.

### Disconnect Social Network

Removes the connection to a specific social network.

**Endpoint:** `DELETE /api/social-networks/:networkId`

**Authentication:** Required (JWT)

**URL Parameters:**
- `networkId`: The ID of the social network connection to remove

**Response:**
```json
{
  "success": true,
  "message": "Social network disconnected successfully"
}
```

### Update Social Network Settings

Updates the publishing settings for a connected social network.

**Endpoint:** `PATCH /api/social-networks/:networkId/settings`

**Authentication:** Required (JWT)

**URL Parameters:**
- `networkId`: The ID of the social network to update

**Request Body:**
```json
{
  "publishSettings": {
    "autoPublish": true,
    "frequency": "daily",
    "contentType": "blog",
    "bestTimeToPost": true,
    "tone": "professional",
    "hashtags": "few",
    "emoji": "moderate",
    "includeImage": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Social network settings updated",
  "socialNetwork": {
    "_id": "60a6c3e9b9f6a82af823c4e2",
    "platform": "facebook",
    "status": "active",
    "publishSettings": {
      "autoPublish": true,
      "frequency": "daily",
      "contentType": "blog",
      "bestTimeToPost": true,
      "tone": "professional",
      "hashtags": "few",
      "emoji": "moderate",
      "includeImage": true
    }
  }
}
```

## Scheduled Posts Endpoints

### List Scheduled Posts

Returns a list of scheduled posts for the current user.

**Endpoint:** `GET /api/scheduled-posts`

**Authentication:** Required (JWT)

**Query Parameters:**
- `status`: Filter by status (pending, published, failed, cancelled)
- `platform`: Filter by platform (facebook, twitter, linkedin)
- `limit`: Maximum number of results (default: 50)
- `offset`: Pagination offset (default: 0)
- `fromDate`: Filter by date range (start)
- `toDate`: Filter by date range (end)

**Response:**
```json
{
  "success": true,
  "scheduledPosts": [
    {
      "_id": "60a7d5fab9f6a82af823c4e9",
      "platform": "facebook",
      "websiteUrl": "https://example.com",
      "title": "My Website",
      "content": "Check out our new product!",
      "imageUrl": "https://example.com/image.jpg",
      "scheduledFor": "2023-06-01T10:00:00.000Z",
      "status": "pending",
      "createdAt": "2023-05-21T14:30:12.000Z"
    }
  ],
  "stats": {
    "total": 10,
    "pending": 5,
    "published": 3,
    "failed": 1,
    "cancelled": 1,
    "upcoming24h": 2,
    "upcoming7d": 4
  }
}
```

### Create Scheduled Post

Creates a new scheduled post.

**Endpoint:** `POST /api/scheduled-posts`

**Authentication:** Required (JWT)

**Request Body:**
```json
{
  "socialNetworkId": "60a6c3e9b9f6a82af823c4e2",
  "websiteUrl": "https://example.com",
  "title": "My Website",
  "content": "Check out our new product!",
  "imageUrl": "https://example.com/image.jpg",
  "platform": "facebook",
  "scheduledFor": "2023-06-01T10:00:00.000Z",
  "recurrence": {
    "pattern": "weekly",
    "dayOfWeek": 1,
    "time": "10:00",
    "endDate": "2023-07-01T10:00:00.000Z"
  },
  "metadata": {
    "hashtags": ["product", "launch", "exciting"],
    "useAi": true,
    "aiPrompt": "Generate an engaging post about our new product launch"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Příspěvek byl úspěšně naplánován",
  "scheduledPost": {
    "_id": "60a7d5fab9f6a82af823c4e9",
    "platform": "facebook",
    "websiteUrl": "https://example.com",
    "title": "My Website",
    "content": "Check out our new product!",
    "scheduledFor": "2023-06-01T10:00:00.000Z",
    "status": "pending"
  }
}
```

### Update Scheduled Post

Updates an existing scheduled post.

**Endpoint:** `PUT /api/scheduled-posts/:postId`

**Authentication:** Required (JWT)

**URL Parameters:**
- `postId`: The ID of the scheduled post to update

**Request Body:**
```json
{
  "content": "Updated content for our product launch!",
  "scheduledFor": "2023-06-02T12:00:00.000Z",
  "metadata": {
    "useAi": true,
    "aiPrompt": "Generate an exciting post about our product launch"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Naplánovaný příspěvek byl úspěšně aktualizován",
  "scheduledPost": {
    "_id": "60a7d5fab9f6a82af823c4e9",
    "content": "Updated content for our product launch!",
    "scheduledFor": "2023-06-02T12:00:00.000Z",
    "status": "pending"
  }
}
```

### Delete Scheduled Post

Deletes a scheduled post.

**Endpoint:** `DELETE /api/scheduled-posts/:postId`

**Authentication:** Required (JWT)

**URL Parameters:**
- `postId`: The ID of the scheduled post to delete

**Response:**
```json
{
  "success": true,
  "message": "Naplánovaný příspěvek byl úspěšně smazán"
}
```

### Cancel Scheduled Post

Cancels a scheduled post without deleting it.

**Endpoint:** `PATCH /api/scheduled-posts/:postId/cancel`

**Authentication:** Required (JWT)

**URL Parameters:**
- `postId`: The ID of the scheduled post to cancel

**Response:**
```json
{
  "success": true,
  "message": "Naplánovaný příspěvek byl úspěšně zrušen",
  "scheduledPost": {
    "_id": "60a7d5fab9f6a82af823c4e9",
    "status": "cancelled"
  }
}
```

### Publish Post Immediately

Publishes a scheduled post immediately.

**Endpoint:** `POST /api/scheduled-posts/:postId/publish-now`

**Authentication:** Required (JWT)

**URL Parameters:**
- `postId`: The ID of the scheduled post to publish

**Response:**
```json
{
  "success": true,
  "message": "Příspěvek byl úspěšně publikován",
  "scheduledPost": {
    "_id": "60a7d5fab9f6a82af823c4e9",
    "status": "published",
    "publishedAt": "2023-05-25T14:30:12.000Z"
  }
}
```

### Calculate Best Time to Post

Returns the optimal time to post for a given platform.

**Endpoint:** `POST /api/scheduled-posts/best-time`

**Authentication:** Required (JWT)

**Request Body:**
```json
{
  "platform": "facebook",
  "timezone": "Europe/Prague"
}
```

**Response:**
```json
{
  "success": true,
  "bestTime": "2023-05-26T15:00:00.000Z"
}
```

## Error Handling

All API endpoints follow a consistent error format:

```json
{
  "success": false,
  "message": "Error message describing the issue",
  "error": "Optional technical error details"
}
```

Common error codes:
- `400`: Bad Request - Missing or invalid parameters
- `401`: Unauthorized - Authentication required
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource not found
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error - Server-side issue

## OAuth Flow

The OAuth flow for connecting social networks follows these steps:

1. User initiates connection via `/api/social-networks/connect/:platform`
2. User is redirected to platform's OAuth consent screen
3. After authorization, the platform redirects back to our callback URL
4. The callback handler exchanges the authorization code for access tokens
5. Tokens are securely stored and the connection is established
6. User is redirected back to the application dashboard

## Implementation Notes

- Token refreshing is handled automatically by a background process
- Posts are published by a scheduled job that runs every few minutes
- Failed posts are automatically retried up to 3 times
- AI content generation is optional and can be enabled per post