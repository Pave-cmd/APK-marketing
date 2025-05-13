/**
 * Kompletně přepracovaný správce webových stránek - fungující verze
 */
document.addEventListener('DOMContentLoaded', function() {
  console.log('[FIXED-WEBSITES] Inicializace správce webových stránek');

  // DOM elementy
  const websitesTableBody = document.getElementById('websitesTableBody');
  const emptyWebsitesMessage = document.getElementById('emptyWebsitesMessage');
  const websitesList = document.getElementById('websitesList');
  const addWebsiteForm = document.getElementById('addWebsiteForm');
  const alertContainer = document.getElementById('alertContainer');
  const modalAlertContainer = document.getElementById('modalAlertContainer');
  
  // Dialog pro přidání webu
  const saveWebsiteBtn = document.getElementById('saveWebsiteBtn');
  const saveWebsiteSpinner = document.getElementById('saveWebsiteSpinner');
  
  // Funkce pro zobrazení zprávy v modálním okně
  function showModalAlert(message, type = 'info') {
    console.log(`[FIXED-WEBSITES] Modal Alert (${type}):`, message);
    
    if (modalAlertContainer) {
      modalAlertContainer.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
          ${message}
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Zavřít"></button>
        </div>
      `;
    }
  }
  
  // Funkce pro zobrazení zprávy na stránce
  function displayAlert(message, type = 'info') {
    console.log(`[FIXED-WEBSITES] Page Alert (${type}):`, message);
    
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
    console.log('[FIXED-WEBSITES] Načítám seznam webů');
    
    // Zobrazení loading stavu
    const loadingIndicator = document.getElementById('websitesLoadingIndicator');
    if (loadingIndicator) {
      loadingIndicator.classList.remove('d-none');
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
      console.log('[FIXED-WEBSITES] Odpověď na GET /api/websites:', response.status);
      
      if (!response.ok) {
        throw new Error(`Server vrátil chybu: ${response.status}`);
      }
      
      return response.json().catch(err => {
        throw new Error('Neplatná odpověď ze serveru');
      });
    })
    .then(data => {
      console.log('[FIXED-WEBSITES] Data webů:', data);
      
      // Skrytí loading indikátoru
      if (loadingIndicator) {
        loadingIndicator.classList.add('d-none');
      }
      
      // Kontrola odpovědi
      if (data.success === false) {
        throw new Error(data.message || 'Chyba při načítání webů');
      }
      
      // Nastavení limitu
      const websiteLimit = document.getElementById('websiteLimit');
      if (websiteLimit && data.maxWebsites) {
        websiteLimit.textContent = data.maxWebsites;
      }
      
      // Zpracování seznamu webů
      renderWebsites(data.websites || []);
    })
    .catch(error => {
      console.error('[FIXED-WEBSITES] Chyba při načítání webů:', error);
      
      // Skrytí loading indikátoru
      if (loadingIndicator) {
        loadingIndicator.classList.add('d-none');
      }
      
      // Zobrazení chyby
      displayAlert(`Chyba při načítání webů: ${error.message}`, 'danger');
      
      // Zobrazení prázdného stavu
      renderWebsites([]);
    });
  }
  
  // Funkce pro vykreslení seznamu webů
  function renderWebsites(websites) {
    // Zajistit, že máme opravdu pole
    const websitesArray = Array.isArray(websites) ? websites : [];
    console.log('[FIXED-WEBSITES] Vykreslování webů:', websitesArray);
    
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
    console.log('[FIXED-WEBSITES] Inicializace formuláře pro přidání webu');
    
    addWebsiteForm.addEventListener('submit', function(e) {
      e.preventDefault();
      console.log('[FIXED-WEBSITES] Zpracování formuláře pro přidání webu');
      
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
      
      // Odeslání požadavku na server
      console.log('[FIXED-WEBSITES] Odesílám požadavek na přidání webu:', url);
      
      // Použití direct-add endpointu, který funguje spolehlivě
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
        console.log('[FIXED-WEBSITES] Odpověď na přidání webu:', response.status);
        
        return response.text().then(text => {
          console.log('[FIXED-WEBSITES] Surová odpověď:', text);
          try {
            return JSON.parse(text);
          } catch (e) {
            throw new Error(`Neplatná odpověď ze serveru: ${text}`);
          }
        });
      })
      .then(data => {
        console.log('[FIXED-WEBSITES] Zpracovaná odpověď:', data);
        
        if (data.success) {
          // Úspěšné přidání
          displayAlert('Webová stránka byla úspěšně přidána!', 'success');
          
          // Resetování formuláře
          addWebsiteForm.reset();
          
          // Obnovení seznamu webů
          loadWebsites();
          
          // Zavření modálu
          try {
            const closeButton = document.querySelector('#addWebsiteModal .btn-close');
            if (closeButton) closeButton.click();
          } catch (e) {
            console.error('[FIXED-WEBSITES] Chyba při zavírání modálu:', e);
          }
        } else {
          // Chyba
          showModalAlert(data.message || 'Nepodařilo se přidat webovou stránku', 'danger');
        }
      })
      .catch(error => {
        console.error('[FIXED-WEBSITES] Chyba při přidání webu:', error);
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
    console.log('[FIXED-WEBSITES] Inicializace formuláře pro odstranění webu');
    
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
          console.error('[FIXED-WEBSITES] Chyba při zavírání modálu:', e);
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
        console.error('[FIXED-WEBSITES] Chyba při odstraňování webu:', error);
        
        try {
          const closeButton = document.querySelector('#removeWebsiteModal .btn-close');
          if (closeButton) closeButton.click();
        } catch (e) {
          console.error('[FIXED-WEBSITES] Chyba při zavírání modálu:', e);
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
  
  // Načtení webů při inicializaci
  loadWebsites();
  
  console.log('[FIXED-WEBSITES] Inicializace dokončena');
});