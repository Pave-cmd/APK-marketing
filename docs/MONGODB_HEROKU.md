# MongoDB Configuration for Heroku

This guide explains how to properly configure MongoDB with your Heroku deployment.

## Issue

The application is failing to connect to MongoDB on Heroku with the error:
```
MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017
```

This occurs because the application is trying to connect to a local MongoDB instance (127.0.0.1) on Heroku, which doesn't exist.

## Solution

### 1. Add MongoDB Add-on to Heroku

First, make sure you have a MongoDB add-on properly attached to your Heroku app:

```bash
heroku addons:create mongolab:sandbox -a your-app-name
```

This will create a MongoDB Atlas instance and set the `MONGODB_URI` environment variable automatically.

### 2. Verify Environment Variables

Check that the `MONGODB_URI` environment variable is set:

```bash
heroku config -a your-app-name | grep MONGODB
```

You should see something like:
```
MONGODB_URI: mongodb+srv://user:password@host.mongodb.net/dbname
```

If not, you can manually set it:
```bash
heroku config:set MONGODB_URI=your-mongodb-uri -a your-app-name
```

### 3. Update Configuration

The application has been updated to:
1. Check for multiple environment variable names (MONGODB_URI, MONGODB_URI_HEROKU, MONGODB_URL)
2. Add connection timeout parameters
3. Not exit the process immediately on connection failure in production

### 4. Troubleshooting

If you continue to have problems:

1. Check Heroku logs for MongoDB connection errors:
```bash
heroku logs --tail -a your-app-name
```

2. Verify that your MongoDB Atlas instance is working:
```bash
heroku addons:open mongolab -a your-app-name
```

3. Try manually setting a different environment variable name:
```bash
# Get the current MongoDB URI
MONGO_URI=$(heroku config:get MONGODB_URI -a your-app-name)

# Set it with alternate names
heroku config:set MONGODB_URL="$MONGO_URI" -a your-app-name
```

## Fallback Server

If the MongoDB connection fails, the application will now gracefully fall back to a simple Express server that shows a maintenance page, instead of crashing completely.

## Testing Connection

To test the connection:

1. Launch the app: `heroku open -a your-app-name`
2. Check the logs: `heroku logs --tail -a your-app-name`
3. Look for the log message "MongoDB připojeno úspěšně" which indicates a successful connection