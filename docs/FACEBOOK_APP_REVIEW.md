# Plán pro Facebook App Review

Tento dokument popisuje kroky, které je potřeba provést k získání schválení Facebook aplikace pro použití rozšířených oprávnění, zejména `pages_manage_posts`.

## Požadovaná oprávnění

Pro plnou funkčnost budeme potřebovat tato oprávnění:

1. **pages_read_engagement** - Pro čtení informací o stránkách a metrikách příspěvků
2. **pages_manage_posts** - Pro vytváření, upravování a mazání příspěvků na stránkách
3. **instagram_basic** - Pro čtení základních informací o Instagram účtech
4. **instagram_content_publish** - Pro publikování obsahu na Instagram

## 1. Příprava Facebook Business aplikace

### 1.1 Vytvoření Business aplikace

1. Přejděte na [Facebook Developers](https://developers.facebook.com/)
2. Vytvořte novou aplikaci s typem "Business"
3. Vyplňte základní informace:
   - Název aplikace: "APK-marketing"
   - Kontaktní email: [váš firemní email]
   - Business účet: [vyberte nebo vytvořte business účet]

### 1.2 Základní nastavení

1. V sekci "Nastavení > Základní":
   - Přidejte ikonu aplikace (logo APK-marketing)
   - Přidejte zásady ochrany osobních údajů URL
   - Přidejte podmínky služby URL
   - Nastavte kategorii aplikace na "Marketing"

2. V sekci "Use cases" přidejte:
   - Facebook Login
   - Pages API
   - Instagram API

3. V sekci "Products" nastavte:
   - Facebook Login
   - Pages API
   - Instagram Graph API

### 1.3 Konfigurace Facebook Login

1. V sekci "Facebook Login > Settings":
   - Valid OAuth Redirect URIs: https://www.bekpashop.cz/api/social-networks/callback/facebook
   - Zapněte "Login with the JavaScript SDK"
   - Povolte "Web OAuth Login"
   - Zapněte "Enforce HTTPS"
   - Zapněte "Use Strict Mode for Redirect URIs"

2. V "Allowed Domains for the JavaScript SDK":
   - Přidejte www.bekpashop.cz

## 2. Vytvoření testovacích účtů a stránek

### 2.1 Testovací účty

1. Vytvořte testovací účty v sekci "Roles > Test Users"
2. Vytvořte alespoň 2 testovací uživatele
3. Přihlaste se jako testovací uživatel

### 2.2 Testovací stránky

1. Vytvořte testovací stránky jako testovací uživatel
2. Vytvořte alespoň 2 testovací Facebook stránky
3. Propojte tyto stránky s APK-marketing aplikací

## 3. Příprava dokumentace pro App Review

### 3.1 Základní dokumenty

1. Vytvořte demo video (2-3 minuty) ukazující:
   - Jak se uživatel přihlásí do APK-marketing
   - Jak propojí svou Facebook stránku
   - Jak aplikace používá požadovaná oprávnění

2. Připravte snímky obrazovky:
   - Přihlašovací obrazovka
   - Dashboard
   - Stránka sociálních sítí
   - Stránka publikování příspěvků
   - Stránka s analytickými údaji

### 3.2 Podrobné popisy případů použití

Pro každé oprávnění připravte podrobný popis:

#### pages_manage_posts

1. **Popis**: Aplikace umožňuje uživatelům automaticky publikovat obsah na jejich stránkách pomocí AI.
2. **Jak se používá**: 
   - Uživatel propojí svou Facebook stránku s aplikací
   - Aplikace analyzuje web uživatele a generuje relevantní příspěvky
   - Uživatel může nastavit automatické publikování nebo schvalovat příspěvky
   - Aplikace publikuje schválené příspěvky na stránce
3. **Proč je nutné**: Bez tohoto oprávnění by uživatelé nemohli využívat automatické publikování obsahu, což je klíčová funkce aplikace.

#### pages_read_engagement

1. **Popis**: Aplikace analyzuje výkon příspěvků pro optimalizaci budoucího obsahu.
2. **Jak se používá**:
   - Aplikace sbírá metriky z publikovaných příspěvků
   - Analýza úspěšnosti různých typů příspěvků
   - Automatická optimalizace budoucího obsahu na základě zpětné vazby
3. **Proč je nutné**: Pro zlepšování a optimalizaci strategie obsahu potřebujeme přístup k metrikám příspěvků.

## 4. Odeslání žádosti o App Review

### 4.1 Kontrolní seznam před odesláním

1. Ověřte, že aplikace je plně funkční
2. Testovací účet má správně nastavená oprávnění
3. Všechny materiály jsou připraveny:
   - Demo video
   - Snímky obrazovky
   - Popisy případů použití
   - Zásady ochrany osobních údajů
   - Podmínky služby

### 4.2 Odeslání žádosti

1. Přejděte do sekce "App Review"
2. Klikněte na "Request Permissions"
3. Vyberte požadovaná oprávnění:
   - pages_manage_posts
   - pages_read_engagement
   - instagram_basic
   - instagram_content_publish
4. Pro každé oprávnění nahrajte:
   - Podrobný popis případu použití
   - Demo video
   - Snímky obrazovky
5. Odešlete žádost

## 5. Sledování a reakce na zpětnou vazbu

1. Pravidelně kontrolujte stav žádosti o kontrolu
2. Připravte se na dodatečné dotazy od týmu Facebook
3. Buďte připraveni upravit aplikaci nebo dokumentaci na základě zpětné vazby

## 6. Po schválení

1. Proveďte rychlý test s reálnými účty (ne testovacími)
2. Sledujte logy a chyby pro rychlou identifikaci problémů
3. Postupně nasaďte funkcionalitu pro všechny uživatele

## 7. Timeframe

- **Příprava aplikace**: 1-2 týdny
- **Vytvoření dokumentace**: 1 týden
- **Proces schválení Facebookem**: 2-4 týdny
- **Celková očekávaná doba**: 4-7 týdnů

## 8. Potenciální problémy a řešení

1. **Zamítnutí žádosti**:
   - Pečlivě si přečtěte zpětnou vazbu
   - Upravte aplikaci podle požadavků
   - Připravte lepší dokumentaci
   - Znovu odešlete žádost

2. **Změny v API**:
   - Sledujte Developer News na Facebook for Developers
   - Účastněte se Facebook Developer Groups
   - Mějte připravené alternativní plány pro kritické funkce

3. **Vypršení schválení**:
   - Sledujte platnost schválení
   - Připravte se na opětovné odeslání žádosti, pokud je to nutné

## 9. Důležité odkazy

- [Facebook for Developers](https://developers.facebook.com/)
- [App Review Guide](https://developers.facebook.com/docs/app-review/)
- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login/)
- [Pages API Documentation](https://developers.facebook.com/docs/pages-api/)