/**
 * Sdílený modul pro testování webových stránek
 */
(function(window) {
    'use strict';
    
    // Modul pro sdílené utility pro testování webových stránek
    const WebsiteTestUtils = {
        /**
         * Přidá zprávu do testovacího logu
         * @param {string} message Zpráva
         * @param {boolean} isError Zda se jedná o chybu
         * @param {string} prefix Prefix pro logování
         */
        addTestMessage: function(message, isError = false, prefix = '[TEST]') {
            console.log(`${prefix} ${message}`);
            const container = document.getElementById('testResultsContainer');
            if (container) {
                const p = document.createElement('p');
                p.className = 'mb-1 small ' + (isError ? 'text-danger' : 'text-success');
                p.textContent = message;
                container.appendChild(p);
                // Vždy scrollovat na konec
                container.scrollTop = container.scrollHeight;
            } else {
                console.error(`${prefix} Kontejner pro testovací zprávy nenalezen!`);
            }
        },
        
        /**
         * Spustí přímý test API pro přidání webu
         * @param {Object} options Nastavení testu
         */
        runDirectTest: function(options = {}) {
            const self = this;
            const prefix = options.prefix || '[TEST]';
            console.log(`${prefix} Spouštím přímý test`);
            
            try {
                self.addTestMessage("Test začal...", false, prefix);
                
                const urlInput = document.getElementById('websiteUrl');
                const url = (urlInput ? urlInput.value.trim() : '') || 'https://example.com';
                
                self.addTestMessage("Testovaná URL: " + url, false, prefix);
                
                // Testuj autentizaci
                fetch('/api/test-auth', {
                    method: 'GET',
                    credentials: 'include'
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error("Auth test selhal se statusem: " + response.status);
                    }
                    self.addTestMessage("Auth test úspěšný (status: " + response.status + ")", false, prefix);
                    return response.json();
                })
                .then(authData => {
                    self.addTestMessage("Přihlášen jako: " + (authData.user?.email || "neznámý"), false, prefix);
                    
                    // Pokud auth OK, testuj přidání webu
                    console.log(`${prefix} Auth test OK, pokračuji na přidání webu`);
                    return fetch('/api/websites/add', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url }),
                        credentials: 'include'
                    });
                })
                .then(response => {
                    self.addTestMessage("Add Website status: " + response.status, false, prefix);
                    return response.text();
                })
                .then(text => {
                    try {
                        const data = JSON.parse(text);
                        self.addTestMessage(data.success ? 
                            "Úspěch: " + data.message : 
                            "Chyba: " + data.message, 
                            !data.success, prefix);
                            
                        // Callback pro úspěšné přidání
                        if (data.success && typeof options.onSuccess === 'function') {
                            options.onSuccess(data);
                        }
                    } catch (e) {
                        self.addTestMessage("Nelze parsovat odpověď jako JSON: " + text, true, prefix);
                    }
                })
                .catch(error => {
                    self.addTestMessage("Chyba: " + error.message, true, prefix);
                    console.error(`${prefix} Chyba při testování:`, error);
                });
            } catch (error) {
                console.error(`${prefix} Neočekávaná chyba při testování:`, error);
                self.addTestMessage("Neočekávaná chyba: " + error.message, true, prefix);
            }
        },
        
        /**
         * Inicializuje testovací tlačítko
         * @param {string} buttonId ID tlačítka
         * @returns {boolean} Úspěch inicializace
         */
        initTestButton: function(buttonId = 'testDirectRequestBtn') {
            const testButton = document.getElementById(buttonId);
            if (testButton) {
                // Pomocník pro "this" v event handleru
                const self = this;
                
                testButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.runDirectTest();
                    return false;
                });
                
                return true;
            }
            return false;
        }
    };
    
    // Exportování modulu do globálního objektu
    window.WebsiteTestUtils = WebsiteTestUtils;
    
})(window);