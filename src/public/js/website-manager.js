// Hlavní JS pro správu webových stránek
// Tento soubor nahrazuje dosavadní řešení a spojuje původní kód s opravami

document.addEventListener('DOMContentLoaded', function() {
    console.log('[WEBSITES] Inicializace správce webových stránek');

    // DOM elementy
    const websitesTableBody = document.getElementById('websitesTableBody');
    const emptyWebsitesMessage = document.getElementById('emptyWebsitesMessage');
    const websitesList = document.getElementById('websitesList');
    const addWebsiteForm = document.getElementById('addWebsiteForm');
    const websiteLimit = document.getElementById('websiteLimit');
    const alertContainer = document.getElementById('alertContainer');

    // Pomocné funkce pro testování - používáme sdílenou utilitu nebo jednoduchý fallback
    const addTestMessage = window.WebsiteTestUtils ?
        WebsiteTestUtils.addTestMessage.bind(WebsiteTestUtils) :
        function(message, isError = false) {
            console.log(`[TEST] ${message}`);
        };

    // Přímá testovací funkce - buď ze sdílené utility nebo lokální implementace
    const runDirectTest = window.WebsiteTestUtils ?
        function() {
            WebsiteTestUtils.runDirectTest({
                onSuccess: function(data) {
                    // Při úspěchu obnovíme seznam webů
                    setTimeout(loadWebsites, 1000);
                }
            });
        } :
        function() {
            console.log('[TEST] Spouštím přímý test');
            addTestMessage("Test začal...");

            const url = document.getElementById('websiteUrl').value.trim() || 'https://example.com';
            addTestMessage("Testovaná URL: " + url);

            fetch('/api/test-auth', {
                method: 'GET',
                credentials: 'include'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error("Auth test selhal se statusem: " + response.status);
                }
                addTestMessage("Auth test úspěšný (status: " + response.status + ")");
                return response.json();
            })
            .then(authData => {
                addTestMessage("Přihlášen jako: " + (authData.user?.email || "neznámý"));

                return fetch('/api/websites/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url }),
                    credentials: 'include'
                });
            })
            .then(response => {
                addTestMessage("Add Website status: " + response.status);
                return response.text();
            })
            .then(text => {
                try {
                    const data = JSON.parse(text);
                    addTestMessage(data.success ? "Úspěch: " + data.message : "Chyba: " + data.message);

                    if (data.success) {
                        setTimeout(loadWebsites, 1000);
                    }
                } catch (e) {
                    addTestMessage("Nelze parsovat odpověď jako JSON: " + text, true);
                }
            })
            .catch(error => {
                addTestMessage("Chyba: " + error.message, true);
            });
        };

    // Inicializace testovacího tlačítka
    function initTestButton() {
        // Preferujeme použití sdílené utility, pokud je dostupná
        if (window.WebsiteTestUtils) {
            WebsiteTestUtils.initTestButton('testDirectRequestBtn');
        } else {
            const testButton = document.getElementById('testDirectRequestBtn');
            if (testButton) {
                testButton.addEventListener('click', function(e) {
                    e.preventDefault();
                    runDirectTest();
                    return false;
                });
            }
        }
        console.log('[WEBSITES] Testovací tlačítko inicializováno');
    }
    
    // Inicializace formuláře pro přidání webu
    function initAddWebsiteForm() {
        if (addWebsiteForm) {
            addWebsiteForm.addEventListener('submit', function(e) {
                e.preventDefault();
                
                // Získání URL z formuláře
                let url = document.getElementById('websiteUrl').value.trim();
                
                // Základní validace
                if (!url) {
                    showModalAlert('Zadejte URL webové stránky', 'danger');
                    return;
                }
                
                // Přidání protokolu, pokud chybí
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                    document.getElementById('websiteUrl').value = url;
                }
                
                try {
                    new URL(url);
                } catch (e) {
                    showModalAlert('Zadejte platnou URL webové stránky včetně https://', 'danger');
                    return;
                }
                
                // Zobrazení loaderu
                const saveWebsiteBtn = document.getElementById('saveWebsiteBtn');
                const saveWebsiteSpinner = document.getElementById('saveWebsiteSpinner');
                
                saveWebsiteBtn.disabled = true;
                saveWebsiteSpinner.classList.remove('d-none');
                
                // Odeslání požadavku na server
                console.log('[WEBSITES] Odesílám požadavek na přidání webu:', url);
                console.log('[WEBSITES] Cookie v prohlížeči:', document.cookie);

                // Najdi token v cookie
                const authToken = document.cookie.split(';').find(c => c.trim().startsWith('authToken='));
                console.log('[WEBSITES] Auth token v cookie:', authToken || 'NENALEZEN!');

                fetch('/api/websites/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Authorization': authToken ? 'Bearer ' + authToken.split('=')[1] : ''
                    },
                    body: JSON.stringify({ url }),
                    credentials: 'include'
                })
                .then(response => {
                    console.log('[WEBSITES] Odpověď na přidání webu:', response.status);
                    console.log('[WEBSITES] Odpověď hlavičky:', response.headers);

                    if (!response.ok) {
                        if (response.status === 401) {
                            console.error('[WEBSITES] Chyba autentizace (401)');
                            throw new Error('Nejste přihlášeni. Prosím, přihlaste se znovu.');
                        } else if (response.status === 400) {
                            console.error('[WEBSITES] Chyba validace (400)');
                            return response.json().then(data => {
                                console.error('[WEBSITES] Detaily chyby 400:', data);
                                throw new Error(data.message || 'Chyba při přidávání webu');
                            });
                        } else {
                            console.error('[WEBSITES] Obecná chyba:', response.status);
                            throw new Error('Server vrátil chybu: ' + response.status);
                        }
                    }

                    console.log('[WEBSITES] Odpověď je OK, pokusím se parsovat JSON');
                    return response.json().catch(err => {
                        console.error('[WEBSITES] Chyba při parsování JSON odpovědi:', err);
                        throw new Error('Neplatná odpověď ze serveru');
                    });
                })
                .then(data => {
                    console.log('[WEBSITES] Odpověď na přidání webu (data):', data);

                    if (!data) {
                        console.error('[WEBSITES] Data jsou prázdná nebo undefined!');
                        throw new Error('Server vrátil prázdnou odpověď');
                    }

                    if (data.success) {
                        console.log('[WEBSITES] Přidání webu bylo úspěšné, přidaný web:', data.websites);
                        
                        // Formátujeme seznam webů do čitelnější podoby
                        let websiteList = '';
                        if (Array.isArray(data.websites) && data.websites.length > 0) {
                            websiteList = '<ul class="mb-0 ps-3">';
                            data.websites.forEach(website => {
                                websiteList += `<li><a href="${website}" target="_blank">${website}</a></li>`;
                            });
                            websiteList += '</ul>';
                        }
                        
                        // Úspěšné přidání s formátovaným seznamem webů
                        displayAlert(`
                            <div class="d-flex align-items-center">
                                <div class="me-3">
                                    <i class="fas fa-check-circle text-success fa-2x"></i>
                                </div>
                                <div>
                                    <strong>Webová stránka byla úspěšně přidána!</strong>
                                    <div class="mt-1">Vaše aktivní webové stránky:</div>
                                    ${websiteList}
                                </div>
                            </div>
                        `, 'success');

                        // Resetování formuláře
                        addWebsiteForm.reset();

                        // Obnovení seznamu webů
                        console.log('[WEBSITES] Obnovovuji seznam webů po úspěšném přidání');
                        loadWebsites();

                        // Zavření modálu
                        try {
                            const modalElement = document.getElementById('addWebsiteModal');
                            const modalInstance = bootstrap.Modal.getInstance(modalElement);
                            if (modalInstance) {
                                console.log('[WEBSITES] Zavírání modálu přes instanci Bootstrap');
                                modalInstance.hide();
                            } else {
                                console.log('[WEBSITES] Zavírání modálu přes tlačítko');
                                document.querySelector('#addWebsiteModal .btn-close').click();
                            }
                        } catch (e) {
                            console.error('[WEBSITES] Chyba při zavírání modálu:', e);
                        }
                    } else {
                        // Chyba
                        console.error('[WEBSITES] Server hlásí neúspěch:', data.message);
                        showModalAlert(data.message || 'Nepodařilo se přidat webovou stránku', 'danger');
                    }
                })
                .catch(error => {
                    console.error('[WEBSITES] Chyba při zpracování odpovědi:', error);
                    showModalAlert('Chyba při komunikaci se serverem: ' + error.message, 'danger');
                })
                .finally(() => {
                    // Obnovení tlačítka
                    saveWebsiteBtn.disabled = false;
                    saveWebsiteSpinner.classList.add('d-none');
                });
            });
        }
    }
    
    // Inicializace formuláře pro odstranění webu
    function initRemoveWebsiteForm() {
        const removeWebsiteForm = document.getElementById('removeWebsiteForm');
        if (removeWebsiteForm) {
            removeWebsiteForm.addEventListener('submit', function(e) {
                e.preventDefault();
                
                // Získání URL z formuláře
                const url = document.getElementById('websiteToRemoveUrl').value;
                
                if (!url) {
                    return;
                }
                
                // Zobrazení loaderu
                const confirmRemoveWebsiteBtn = document.getElementById('confirmRemoveWebsiteBtn');
                const removeWebsiteSpinner = document.getElementById('removeWebsiteSpinner');
                
                confirmRemoveWebsiteBtn.disabled = true;
                removeWebsiteSpinner.classList.remove('d-none');
                
                // Odeslání požadavku na server
                fetch('/api/websites/remove', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ url }),
                    credentials: 'include'
                })
                .then(response => response.json())
                .then(data => {
                    try {
                        document.querySelector('#removeWebsiteModal .btn-close').click();
                    } catch (e) {
                        console.error('[WEBSITES] Chyba při zavírání modálu:', e);
                    }
                    
                    if (data.success) {
                        // Úspěšné odstranění
                        displayAlert('Webová stránka byla úspěšně odstraněna', 'success');
                        
                        // Obnovení seznamu webů
                        setTimeout(loadWebsites, 500);
                    } else {
                        // Chyba
                        displayAlert(data.message || 'Nepodařilo se odstranit webovou stránku', 'danger');
                    }
                })
                .catch(error => {
                    try {
                        document.querySelector('#removeWebsiteModal .btn-close').click();
                    } catch (e) {
                        console.error('[WEBSITES] Chyba při zavírání modálu:', e);
                    }
                    
                    displayAlert('Chyba při komunikaci se serverem', 'danger');
                })
                .finally(() => {
                    // Obnovení tlačítka
                    confirmRemoveWebsiteBtn.disabled = false;
                    removeWebsiteSpinner.classList.add('d-none');
                });
            });
        }
    }
    
    // Funkce pro načtení webových stránek pomocí AJAX
    function loadWebsites() {
        console.log('[WEBSITES] Načítání seznamu webů');
        console.log('[WEBSITES] Session cookie pro načtení:', document.cookie);

        // Zobrazení loading stavu
        const loadingIndicator = document.getElementById('websitesLoadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.classList.remove('d-none');
        }

        // Skrytí případné předchozí chyby
        const errorContainer = document.getElementById('websitesErrorContainer');
        if (errorContainer) {
            errorContainer.classList.add('d-none');
        }

        // Najdi token v cookie pro diagnostiku
        const authToken = document.cookie.split(';').find(c => c.trim().startsWith('authToken='));
        console.log('[WEBSITES] Auth token v cookie pro načtení seznamu:', authToken || 'NENALEZEN!');

        fetch('/api/websites', {
            method: 'GET',
            credentials: 'include'
        })
        .then(response => {
            console.log('[WEBSITES] Odpověď na GET /api/websites:', response.status);

            // Kontrola chybových kódů s konkrétními zprávami
            if (response.status === 401) {
                throw new Error('Pro zobrazení webů se musíte přihlásit');
            } else if (response.status === 403) {
                throw new Error('Nemáte oprávnění pro zobrazení webů');
            } else if (response.status >= 500) {
                throw new Error('Server není momentálně dostupný (HTTP ' + response.status + ')');
            } else if (!response.ok) {
                throw new Error('Nepodařilo se načíst seznam webů (HTTP ' + response.status + ')');
            }

            return response.json().catch(err => {
                throw new Error('Server vrátil neplatná data. Zkuste to znovu později.');
            });
        })
        .then(data => {
            console.log('[WEBSITES] Odpověď na GET /api/websites (data):', data);

            // Skrytí loading indikátoru po načtení
            if (loadingIndicator) {
                loadingIndicator.classList.add('d-none');
            }

            if (data.success !== false) {
                try {
                    console.log('[WEBSITES] Data jsou úspěšná, weby:', data.websites);

                    // Normalizace dat na pole
                    let websitesArray = [];

                    if (Array.isArray(data.websites)) {
                        websitesArray = data.websites;
                        console.log('[WEBSITES] Weby jsou již pole, počet:', websitesArray.length);
                    } else if (data.websites) {
                        websitesArray = [data.websites];
                        console.log('[WEBSITES] Weby nejsou pole, konvertuji na pole s jedním prvkem:', websitesArray);
                    } else {
                        console.log('[WEBSITES] Žádná data webů nebyla vrácena, używám prázdné pole');
                    }

                    // Vykreslení webů
                    console.log('[WEBSITES] Předávám k vykreslení pole:', websitesArray);
                    renderWebsites(websitesArray);

                    // Zobrazení limitu webů podle plánu
                    if (data.maxWebsites && websiteLimit) {
                        console.log('[WEBSITES] Nastavuji limit webů:', data.maxWebsites);
                        websiteLimit.textContent = data.maxWebsites;
                    }
                } catch (e) {
                    console.error('[WEBSITES] Chyba při zpracování dat:', e);
                    displayAlert('Chyba při zpracování seznamu webů: ' + e.message, 'danger');
                    showError('Chyba při zpracování dat webu', e.message);
                }
            } else {
                console.error('[WEBSITES] Server vrátil chybu:', data.message);
                displayAlert(data.message || 'Nepodařilo se načíst seznam webů', 'danger');
                showError('Nepodařilo se načíst weby', data.message || 'Server vrátil chybu');
            }
        })
        .catch(error => {
            console.error('[WEBSITES] Chyba při načítání webů:', error);

            // Skrytí loading indikátoru v případě chyby
            if (loadingIndicator) {
                loadingIndicator.classList.add('d-none');
            }

            // Zobrazení chyby
            displayAlert('Chyba: ' + error.message, 'danger');
            showError('Problém při načítání webů', error.message);

            // Zobrazení prázdného stavu
            renderWebsites([]);
        });
    }

    // Pomocná funkce pro zobrazení chyby
    function showError(title, message) {
        const errorContainer = document.getElementById('websitesErrorContainer');
        if (errorContainer) {
            errorContainer.classList.remove('d-none');
            errorContainer.innerHTML = `
                <div class="alert alert-danger">
                    <h5>${title}</h5>
                    <p>${message}</p>
                    <button class="btn btn-sm btn-outline-danger mt-2" onclick="loadWebsites()">
                        <i class="fas fa-sync-alt"></i> Zkusit znovu
                    </button>
                </div>
            `;
        }
    }
    
    // Funkce pro vykreslení seznamu webových stránek
    function renderWebsites(websites) {
        console.log('[WEBSITES] Vykresluji seznam webů:', websites);
        console.log('[WEBSITES] Typ dat webů:', typeof websites, 'Je pole?', Array.isArray(websites));

        // Kontrola, zda máme nějaké weby
        if (!websites || websites.length === 0) {
            // Žádné weby - zobrazíme prázdnou zprávu
            console.log('[WEBSITES] Žádné weby k zobrazení - zobrazuji prázdný stav');
            websitesList.style.display = 'none';
            emptyWebsitesMessage.style.display = 'block';
            return;
        }

        // Máme weby - zobrazíme tabulku
        console.log('[WEBSITES] Nalezeno', websites.length, 'webů - zobrazuji tabulku');
        websitesList.style.display = 'block';
        emptyWebsitesMessage.style.display = 'none';

        // Vyprázdnění tabulky
        websitesTableBody.innerHTML = '';
        
        // Vykreslení webů do tabulky
        websites.forEach(url => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>
                    <a href="${url}" target="_blank" class="text-decoration-none">
                        ${url}
                        <i class="fas fa-external-link-alt ms-2 small"></i>
                    </a>
                </td>
                <td>Dnes</td>
                <td><span class="badge bg-success">Aktivní</span></td>
                <td>
                    <button type="button" class="btn btn-sm btn-outline-danger remove-website-btn" data-url="${url}" data-bs-toggle="modal" data-bs-target="#removeWebsiteModal">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            
            websitesTableBody.appendChild(row);
        });
        
        // Přidání událostí pro tlačítka odstranění
        setupRemoveButtons();
    }
    
    // Přidání událostí pro tlačítka odstranění webů
    function setupRemoveButtons() {
        document.querySelectorAll('.remove-website-btn').forEach(button => {
            button.addEventListener('click', function() {
                const url = this.getAttribute('data-url');
                openRemoveModal(url);
            });
        });
    }
    
    // Funkce pro otevření modálního okna pro odstranění webu
    function openRemoveModal(url) {
        document.getElementById('websiteToRemove').textContent = url;
        document.getElementById('websiteToRemoveUrl').value = url;
    }
    
    // Pomocná funkce pro zobrazení zprávy v modálním okně
    function showModalAlert(message, type = 'info') {
        const modalAlertContainer = document.getElementById('modalAlertContainer');
        if (modalAlertContainer) {
            modalAlertContainer.innerHTML = `
                <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                    ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Zavřít"></button>
                </div>
            `;
        }
    }
    
    // Pomocná funkce pro zobrazení zprávy na stránce
    function displayAlert(message, type = 'info') {
        const alertElement = document.createElement('div');
        alertElement.className = `alert alert-${type} alert-dismissible fade show mb-4`;
        alertElement.role = 'alert';
        alertElement.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Zavřít"></button>
        `;
        
        // Vložení do připraveného kontejneru
        alertContainer.innerHTML = '';
        alertContainer.appendChild(alertElement);
        
        // Automatické skrytí po 5 sekundách
        setTimeout(() => {
            alertElement.classList.remove('show');
            setTimeout(() => {
                alertElement.remove();
            }, 150);
        }, 5000);
    }

    // Inicializace všech komponent
    // Načtení seznamu webových stránek
    loadWebsites();

    // Inicializace tlačítek a formulářů
    initTestButton();
    initAddWebsiteForm();
    initRemoveWebsiteForm();

    // Registrace do globálního prostoru pro inline volání z HTML (fallback)
    if (!window.WebsiteTestUtils) {
        window.runDirectTest = runDirectTest;
    }

    // Informace o inicializaci
    addTestMessage("Inicializace dokončena. Systém je připraven.");
});