# Nastavení autentizace Facebook aplikace

Tento dokument popisuje, jak správně nastavit Facebook Developer aplikaci pro integraci s APK-marketing systémem.

## Nastavení v Facebook Developer Console

1. Přihlaste se do Facebook Developer Console: https://developers.facebook.com/

2. Vyberte vaši aplikaci nebo vytvořte novou.

3. V sekci **Základní nastavení**:
   - Přidejte `www.bekpashop.cz` do pole **App Domains**
   - Vyplňte všechny požadované informace o aplikaci (Ochrana osobních údajů, Podmínky služby)

4. V sekci **Facebook Login > Settings**:
   - Povolte "Login with the JavaScript SDK"
   - Zajistěte, že "Enforce HTTPS" je zapnuté
   - Do **Valid OAuth Redirect URIs** přidejte tuto URI:
     ```
     https://www.bekpashop.cz/api/social-networks/callback/facebook
     ```
   - Doporučujeme zapnout "Use Strict Mode for Redirect URIs"

5. V sekci **Povolené domény pro JavaScript SDK**:
   - Přidejte `www.bekpashop.cz`

## Nastavení oprávnění (Scopes)

Aplikace vyžaduje tato oprávnění:
- `pages_read_engagement` - Pro čtení informací o stránkách
- `public_profile` - Základní informace o uživateli

Pokud je potřeba publikovat příspěvky na stránkách:
1. Přidejte oprávnění `pages_manage_posts` do vašeho kódu
2. Odešlete žádost o přezkoumání aplikace ve Facebook Developer Console
3. Počkejte na schválení od Facebook týmu

## Nastavení v aplikaci APK-marketing

1. V administraci nastavte Facebook API klíče:
   - App ID
   - App Secret
   
2. Nastavte proměnnou prostředí na vašem serveru:
   ```
   APP_URL=https://www.bekpashop.cz
   ```

3. Proměnné prostředí v Heroku:
   - Otevřete Heroku Dashboard
   - Vyberte vaši aplikaci
   - Jděte do Settings > Config Vars
   - Přidejte nebo upravte proměnnou `APP_URL` s hodnotou `https://www.bekpashop.cz`

## Testování

1. Přejděte na stránku Správa sociálních sítí v administraci
2. Přidejte nový Facebook profil
3. Klikněte na "Autentizovat"
4. Následujte kroky autentizace ve Facebook dialogu
5. Po úspěšné autentizaci budete přesměrováni zpět do administrace

## Řešení problémů

### "Invalid Scopes: pages_manage_posts"
- Tento scope vyžaduje schválení Facebookem. Dokud nebude schválen, použijte pouze `pages_read_engagement,public_profile`

### "Domain of this URL isn't included in the app's domains"
- Ujistěte se, že doména `www.bekpashop.cz` je přidána v App Domains
- Ověřte, že doména je také přidána v Povolených doménách pro JavaScript SDK

### Chyba v přesměrování po autentizaci
- Zkontrolujte, že `APP_URL` je správně nastavena
- Ověřte, že URI v kódu a v Facebook Developer Console jsou identické (včetně protokolu https)