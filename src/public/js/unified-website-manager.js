/**
 * Unified Website Manager - Sjednocená implementace správce webových stránek
 * 
 * Kombinuje funkčnost původních souborů website-manager.js a fixed-website-manager.js
 * Odstraňuje duplicity a poskytuje konzistentní implementaci
 */
document.addEventListener('DOMContentLoaded', function() {
  console.log('[WEBSITES] Inicializace sjednoceného správce webových stránek');

  // DOM elementy
  const websitesTableBody = document.getElementById('websitesTableBody');
  const emptyWebsitesMessage = document.getElementById('emptyWebsitesMessage');
  const websitesList = document.getElementById('websitesList');
  const addWebsiteForm = document.getElementById('addWebsiteForm');
  const websiteLimit = document.getElementById('websiteLimit');
  const alertContainer = document.getElementById('alertContainer');
  const modalAlertContainer = document.getElementById('modalAlertContainer');
  
  // Dialog pro přidání webu
  const saveWebsiteBtn = document.getElementById('saveWebsiteBtn');
  const saveWebsiteSpinner = document.getElementById('saveWebsiteSpinner');
  
  // Pomocná funkce pro zobrazení zprávy v modálním okně
  function showModalAlert(message, type = 'info') {
    console.log(`[WEBSITES] Modal Alert (${type}):`, message);
    
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
    console.log(`[WEBSITES] Page Alert (${type}):`, message);
    
    if (alertContainer) {
      const alertElement = document.createElement('div');
      alertElement.className = `alert alert-${type} alert-dismissible fade show mb-4`;
      alertElement.role = 'alert';
      alertElement.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Zavřít"></button>
      `;
      
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
  }
  
  // Funkce pro načtení seznamu webů
  function loadWebsites() {
    console.log('[WEBSITES] Načítám seznam webů');
    
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
    
    // API požadavek
    fetch('/api/websites', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Cache-Control': 'no-cache'
      }
    })
    .then(response => {
      console.log('[WEBSITES] Odpověď na GET /api/websites:', response.status);
      
      // Kontrola chybových kódů
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
      console.log('[WEBSITES] Data webů:', data);
      
      // Skrytí loading indikátoru
      if (loadingIndicator) {
        loadingIndicator.classList.add('d-none');
      }
      
      // Kontrola odpovědi
      if (data.success === false) {
        throw new Error(data.message || 'Chyba při načítání webů');
      }
      
      // Nastavení limitu
      if (websiteLimit && data.maxWebsites) {
        websiteLimit.textContent = data.maxWebsites;
      }
      
      // Zpracování seznamu webů
      // Normalizace dat na pole
      let websitesArray = [];
      if (Array.isArray(data.websites)) {
        websitesArray = data.websites;
      } else if (data.websites) {
        websitesArray = [data.websites];
      }
      
      renderWebsites(websitesArray);
    })
    .catch(error => {
      console.error('[WEBSITES] Chyba při načítání webů:', error);
      
      // Skrytí loading indikátoru
      if (loadingIndicator) {
        loadingIndicator.classList.add('d-none');
      }
      
      // Zobrazení chyby
      displayAlert('Chyba: ' + error.message, 'danger');
      
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
      
      showError('Problém při načítání webů', error.message);
      
      // Zobrazení prázdného stavu
      renderWebsites([]);
    });
  }
  
  // Funkce pro vykreslení seznamu webů
  function renderWebsites(websites) {
    const websitesArray = Array.isArray(websites) ? websites : [];
    console.log('[WEBSITES] Vykreslování webů:', websitesArray);
    
    // Kontrola prázdného stavu
    if (websitesArray.length === 0) {
      // Žádné weby
      if (websitesList) websitesList.style.display = 'none';
      if (emptyWebsitesMessage) emptyWebsitesMessage.style.display = 'block';
      return;
    }
    
    // Existují weby k zobrazení
    if (websitesList) websitesList.style.display = 'block';
    if (emptyWebsitesMessage) emptyWebsitesMessage.style.display = 'none';
    
    // Vykreslení tabulky
    if (websitesTableBody) {
      websitesTableBody.innerHTML = '';
      
      websitesArray.forEach(url => {
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
  }
  
  // Funkce pro nastavení tlačítek odstranění webu
  function setupRemoveButtons() {
    document.querySelectorAll('.remove-website-btn').forEach(button => {
      button.addEventListener('click', function() {
        const url = this.getAttribute('data-url');
        openRemoveModal(url);
      });
    });
  }
  
  // Funkce pro otevření modálu odstranění webu
  function openRemoveModal(url) {
    const websiteToRemove = document.getElementById('websiteToRemove');
    const websiteToRemoveUrl = document.getElementById('websiteToRemoveUrl');
    
    if (websiteToRemove) websiteToRemove.textContent = url;
    if (websiteToRemoveUrl) websiteToRemoveUrl.value = url;
  }
  
  // Inicializace formuláře pro přidání webu
  if (addWebsiteForm) {
    addWebsiteForm.addEventListener('submit', function(e) {
      e.preventDefault();
      console.log('[WEBSITES] Zpracování formuláře pro přidání webu');
      
      // Získání URL z formuláře
      let url = document.getElementById('websiteUrl').value.trim();
      
      // Validace
      if (!url) {
        showModalAlert('Zadejte URL webové stránky', 'danger');
        return;
      }
      
      // Přidání protokolu, pokud chybí
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      try {
        new URL(url); // Kontrola formátu URL
      } catch (e) {
        showModalAlert('Zadejte platnou URL webové stránky', 'danger');
        return;
      }
      
      // Zobrazení loaderu
      if (saveWebsiteBtn) saveWebsiteBtn.disabled = true;
      if (saveWebsiteSpinner) saveWebsiteSpinner.classList.remove('d-none');
      
      // Odeslání požadavku na server - preferujeme direct-add, který funguje spolehlivě
      fetch('/api/direct-add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          url: url,
          userId: document.querySelector('meta[name="user-id"]')?.getAttribute('content') || ''
        }),
        credentials: 'include'
      })
      .then(response => {
        console.log('[WEBSITES] Odpověď na přidání webu:', response.status);
        
        return response.text().then(text => {
          console.log('[WEBSITES] Surová odpověď:', text);
          try {
            return JSON.parse(text);
          } catch (e) {
            throw new Error(`Neplatná odpověď ze serveru: ${text}`);
          }
        });
      })
      .then(data => {
        console.log('[WEBSITES] Zpracovaná odpověď:', data);
        
        if (data.success) {
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
          loadWebsites();
          
          // Zavření modálu
          try {
            const closeButton = document.querySelector('#addWebsiteModal .btn-close');
            if (closeButton) closeButton.click();
          } catch (e) {
            console.error('[WEBSITES] Chyba při zavírání modálu:', e);
          }
        } else {
          // Chyba
          showModalAlert(data.message || 'Nepodařilo se přidat webovou stránku', 'danger');
        }
      })
      .catch(error => {
        console.error('[WEBSITES] Chyba při přidání webu:', error);
        showModalAlert(`Chyba při komunikaci se serverem: ${error.message}`, 'danger');
      })
      .finally(() => {
        // Obnovení tlačítka
        if (saveWebsiteBtn) saveWebsiteBtn.disabled = false;
        if (saveWebsiteSpinner) saveWebsiteSpinner.classList.add('d-none');
      });
    });
  }
  
  // Inicializace formuláře pro odstranění webu
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
      
      if (confirmRemoveWebsiteBtn) confirmRemoveWebsiteBtn.disabled = true;
      if (removeWebsiteSpinner) removeWebsiteSpinner.classList.remove('d-none');
      
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
          const closeButton = document.querySelector('#removeWebsiteModal .btn-close');
          if (closeButton) closeButton.click();
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
        console.error('[WEBSITES] Chyba při odstraňování webu:', error);
        
        try {
          const closeButton = document.querySelector('#removeWebsiteModal .btn-close');
          if (closeButton) closeButton.click();
        } catch (e) {
          console.error('[WEBSITES] Chyba při zavírání modálu:', e);
        }
        
        displayAlert('Chyba při komunikaci se serverem', 'danger');
      })
      .finally(() => {
        // Obnovení tlačítka
        if (confirmRemoveWebsiteBtn) confirmRemoveWebsiteBtn.disabled = false;
        if (removeWebsiteSpinner) removeWebsiteSpinner.classList.add('d-none');
      });
    });
  }
  
  // Nástroje pro testování
  function initTestButton() {
    const testButton = document.getElementById('testDirectRequestBtn');
    if (testButton) {
      testButton.addEventListener('click', function(e) {
        e.preventDefault();
        runDirectTest();
      });
    }
  }
  
  function runDirectTest() {
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
  }
  
  function addTestMessage(message, isError = false) {
    console.log(`[TEST] ${message}`);
    
    const testContainer = document.getElementById('testOutputContainer');
    if (testContainer) {
      const msgElement = document.createElement('div');
      msgElement.className = isError ? 'test-error' : 'test-info';
      msgElement.textContent = message;
      testContainer.appendChild(msgElement);
      testContainer.scrollTop = testContainer.scrollHeight;
    }
  }
  
  // Načtení webů při inicializaci
  loadWebsites();
  
  // Inicializace testovacího tlačítka
  initTestButton();
  
  console.log('[WEBSITES] Inicializace dokončena');
});