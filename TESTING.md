# Testování aplikace APK-marketing

## Testování přihlášení a přidávání webových stránek

### 1. Přihlášení

1. **Spusťte server v development módu:**
   ```
   npm run dev
   ```

2. **Otevřete aplikaci** v prohlížeči podle URL zobrazené v konzoli
   - Obvykle: `http://localhost:3000`

3. **Přejděte na přihlašovací stránku:**
   - Klikněte na odkaz "Přihlášení" v navigaci nebo přejděte na `/prihlaseni`

4. **Zadejte přihlašovací údaje:**
   - Zadejte platný e-mail a heslo existujícího uživatele
   - Pokud nemáte existujícího uživatele, nejprve se zaregistrujte na `/registrace`

5. **Sledujte konzoli serveru:**
   - Měl by se zobrazit log o úspěšném přihlášení a nastavení cookies

6. **Zkontrolujte přesměrování:**
   - Po úspěšném přihlášení byste měli být přesměrováni na dashboard (`/dashboard`)

### 2. Přidávání webových stránek

1. **Otevřete sekci webových stránek:**
   - Na dashboardu klikněte na odkaz "Weby" nebo přejděte na `/dashboard/weby`

2. **Přidejte novou webovou stránku:**
   - Klikněte na tlačítko "Přidat web"
   - V dialogovém okně zadejte URL webové stránky (např. "example.com")

3. **Pro otestování funkčnosti:**
   - Můžete použít tlačítko "Test přímého požadavku", které zobrazí podrobnou diagnostiku

4. **Sledujte konzoli serveru:**
   - V konzoli by měly být vidět logy o zpracování požadavku a uložení webové stránky

5. **Zkontrolujte výsledek:**
   - Po úspěšném přidání by se webová stránka měla zobrazit v seznamu webů
   - Webová stránka by měla být uložena v databázi MongoDB

## Řešení problémů

### Nejčastější problémy

1. **Chyba 404 při přístupu na dashboard nebo jinou stránku**
   - Zkontrolujte, zda je server spuštěn
   - Zkontrolujte, zda jsou views a statické soubory správně nastaveny (cesty)

2. **Problémy s autentizací**
   - Zkontrolujte v konzoli, zda se správně nastavují cookies
   - Zkontrolujte, zda se token posílá v HTTP hlavičce Authorization

3. **Problémy s databází**
   - Zkontrolujte připojení k MongoDB (status v konzoli)
   - Zkontrolujte, zda jsou data správně ukládána (např. pomocí MongoDB Compass)

4. **Chyby 502 Bad Gateway pro statické soubory**
   - Zkontrolujte, zda jsou statické soubory správně servírovány
   - Zkontrolujte MIME typy v odpovědích serveru

### Diagnostické nástroje

1. **Browser Developer Tools:**
   - Network tab: Sledujte HTTP požadavky a odpovědi
   - Console tab: Sledujte chyby a logy z JavaScript kódu
   - Application tab: Zkontrolujte cookies a localStorage

2. **Server logy:**
   - Sledujte výpisy v konzoli NodeJS serveru

3. **Testovací tlačítko:**
   - Použijte tlačítko "Test přímého požadavku" pro diagnostiku API volání

## Debugování serverové části

### Explicitní API volání pro testování

Pro manuální testování API endpointů můžete použít následující curl příkazy:

1. **Test přihlášení:**
   ```bash
   curl -X POST -H "Content-Type: application/json" -d '{"email":"vas@email.cz","password":"heslo123"}' http://localhost:3000/api/auth/login
   ```

2. **Test získání seznamu webů:**
   ```bash
   curl -X GET -H "Authorization: Bearer VAS_TOKEN" http://localhost:3000/api/websites
   ```

3. **Test přidání webu:**
   ```bash
   curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer VAS_TOKEN" -d '{"url":"example.com"}' http://localhost:3000/api/websites/add
   ```