# Nastavení OAuth pro sociální sítě

Tento dokument popisuje kroky potřebné k nastavení OAuth autentizace pro různé sociální sítě.

## Facebook

1. Přejděte na https://developers.facebook.com/
2. Vytvořte novou aplikaci
3. Přidejte produkt "Facebook Login"
4. Nastavte OAuth Redirect URI: `http://localhost:3000/api/social-networks/callback/facebook`
5. V Basic Settings najdete App ID a App Secret
6. Přidejte permissions: `pages_manage_posts`, `pages_read_engagement`

## Twitter/X

1. Přejděte na https://developer.twitter.com/
2. Vytvořte nový projekt a aplikaci
3. Povolte OAuth 2.0
4. Nastavte Redirect URI: `http://localhost:3000/api/social-networks/callback/twitter`
5. Vytvořte Client ID a Client Secret
6. Nastavte scopes: `tweet.read`, `tweet.write`, `users.read`

## LinkedIn

1. Přejděte na https://www.linkedin.com/developers/
2. Vytvořte novou aplikaci
3. V Auth tab najdete Client ID a Client Secret
4. Přidejte Redirect URL: `http://localhost:3000/api/social-networks/callback/linkedin`
5. Požádejte o přístup k Marketing Developer Platform pro publikování

## Environment Variables

```env
# Facebook
FACEBOOK_APP_ID=váš_facebook_app_id
FACEBOOK_APP_SECRET=váš_facebook_app_secret

# Twitter
TWITTER_CLIENT_ID=váš_twitter_client_id
TWITTER_CLIENT_SECRET=váš_twitter_client_secret

# LinkedIn
LINKEDIN_CLIENT_ID=váš_linkedin_client_id
LINKEDIN_CLIENT_SECRET=váš_linkedin_client_secret
```

## Testování

1. Přidejte sociální síť v aplikaci
2. Klikněte na "Autentizovat"
3. Budete přesměrováni na přihlašovací stránku dané sociální sítě
4. Po úspěšném přihlášení budete vráceni zpět do aplikace
5. Nyní můžete použít tlačítko "Test příspěvku" pro publikování