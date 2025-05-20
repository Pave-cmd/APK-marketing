#!/bin/bash

echo "Starting Heroku deployment..."

# Build for production
echo "Building for production..."
npm run build

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "Heroku CLI is not installed. Please install it first:"
    echo "https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

# Check if logged in to Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo "You are not logged in to Heroku. Please log in:"
    heroku login
fi

# Deploy to Heroku
echo "Deploying to Heroku..."
git push heroku main

# Scale dynos
echo "Ensuring dyno is running..."
heroku ps:scale web=1

# Open the app
echo "Deployment completed! Opening app..."
heroku open

echo "Done!"