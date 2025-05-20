# Deployment Instructions for BekpaShop

This guide will walk you through deploying the BekpaShop application to Heroku.

## Prerequisites

1. [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed
2. Heroku account
3. Git repository with the application code

## Deployment Steps

### 1. Login to Heroku

```bash
heroku login
```

### 2. Create a new Heroku application

```bash
heroku create bekpashop
```

Or if you want to use an existing app:

```bash
heroku git:remote -a bekpashop
```

### 3. Add MongoDB Add-on

```bash
heroku addons:create mongolab:sandbox
```

### 4. Configure Environment Variables

Set the required environment variables:

```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -base64 32)
```

Set any additional environment variables needed for social media integrations:

```bash
heroku config:set FACEBOOK_APP_ID=your-facebook-app-id
heroku config:set FACEBOOK_APP_SECRET=your-facebook-app-secret
# Add other social media configurations as needed
```

### 5. Deploy the Application

Push your code to Heroku:

```bash
git push heroku main
```

### 6. Ensure at least one instance is running

```bash
heroku ps:scale web=1
```

### 7. Open the application

```bash
heroku open
```

## Domain Configuration

To use the custom domain bekpashop.cz:

```bash
heroku domains:add bekpashop.cz
heroku domains:add www.bekpashop.cz
```

You'll receive DNS target information. Update your DNS settings with your domain registrar to point to the Heroku DNS targets.

## Monitoring

To monitor your application:

```bash
heroku logs --tail
```

## Switching to Production Version

When you're ready to remove the temporary landing page:

1. Update the server.ts file to remove the coming-soon page conditional:

```typescript
app.get('/', (req: Request, res: Response): void => {
  res.render('index', {
    title: 'BekpaShop - Online Shopping',
    description: 'Nakupujte online na BekpaShop'
  });
});
```

2. Commit your changes:

```bash
git add src/server.ts
git commit -m "Remove temporary landing page"
```

3. Deploy the changes:

```bash
git push heroku main
```

## Troubleshooting

If you encounter issues:

- Check the application logs: `heroku logs --tail`
- Ensure all required environment variables are set: `heroku config`
- Verify the MongoDB connection: `heroku addons:open mongolab`
- Restart the application: `heroku restart`