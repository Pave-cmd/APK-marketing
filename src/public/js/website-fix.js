/**
 * Jednoduchý opravný soubor pro debugging problému s přidáváním webových stránek
 */

console.log('🔥 WEBSITE-FIX.JS NAČTEN 🔥');

// Počkáme na načtení dokumentu
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM načten, inicializuji nové řešení pro správu webů');
  
  // Najdeme všechny potřebné elementy
  const addWebsiteForm = document.getElementById('addWebsiteForm');
  const websitesTableBody = document.getElementById('websitesTableBody');
  const emptyWebsitesMessage = document.getElementById('emptyWebsitesMessage');
  const websitesList = document.getElementById('websitesList');
  const alertContainer = document.getElementById('alertContainer');
  
  console.log('Formulář pro přidání webu:', addWebsiteForm ? 'NALEZEN' : 'NENALEZEN');
  console.log('Tabulka webů:', websitesTableBody ? 'NALEZENA' : 'NENALEZENA');
  
  // Přidáme logování cookies
  console.log('Cookies:', document.cookie);
  
  // Funkce pro zobrazení zprávy
  function displayAlert(message, type = 'info') {
    console.log(`ALERT ${type}: ${message}`);
    
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type} alert-dismissible fade show mb-4`;
    alertElement.role = 'alert';
    alertElement.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Zavřít"></button>
    `;
    
    if (alertContainer) {
      alertContainer.innerHTML = '';
      alertContainer.appendChild(alertElement);
    } else {
      console.error('Alert container nenalezen!');
    }
  }
  
  // Funkce pro načtení webových stránek
  function loadWebsites() {
    console.log('Načítám seznam webů...');
    
    fetch('/api/websites', {
      method: 'GET',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Cache-Control': 'no-cache'
      },
      credentials: 'include'
    })
    .then(response => {
      console.log('Odpověď ze serveru:', response.status);
      return response.json();
    })
    .then(data => {
      console.log('Data ze serveru:', data);
      
      if (data.success) {
        // Zobrazení webů
        const websites = Array.isArray(data.websites) ? data.websites : [];
        console.log('Nalezeno webů:', websites.length);
        
        if (websites.length === 0) {
          // Žádné weby
          if (websitesList) websitesList.style.display = 'none';
          if (emptyWebsitesMessage) emptyWebsitesMessage.style.display = 'block';
        } else {
          // Máme weby
          if (websitesList) websitesList.style.display = 'block';
          if (emptyWebsitesMessage) emptyWebsitesMessage.style.display = 'none';
          
          // Vykreslení
          if (websitesTableBody) {
            websitesTableBody.innerHTML = '';
            
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
                  <button type="button" class="btn btn-sm btn-outline-danger remove-website-btn" data-url="${url}">
                    <i class="fas fa-trash-alt"></i>
                  </button>
                </td>
              `;
              websitesTableBody.appendChild(row);
            });
          }
        }
      } else {
        console.error('Chyba při načítání webů:', data.message);
      }
    })
    .catch(error => {
      console.error('Chyba při komunikaci se serverem:', error);
    });
  }
  
  // Inicializace formuláře pro přidání webu
  if (addWebsiteForm) {
    console.log('Připojuji událost na formulář pro přidání webu');
    
    addWebsiteForm.addEventListener('submit', function(e) {
      e.preventDefault();
      console.log('Formulář pro přidání webu byl odeslán');
      
      // Získání URL z formuláře
      let url = document.getElementById('websiteUrl').value.trim();
      console.log('URL k přidání:', url);
      
      // Základní validace
      if (!url) {
        console.error('URL je prázdná!');
        displayAlert('Zadejte URL webové stránky', 'danger');
        return;
      }
      
      // Přidání protokolu, pokud chybí
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
        console.log('Upravená URL:', url);
      }
      
      // Odeslání požadavku na server
      fetch('/api/websites/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({ url }),
        credentials: 'include'
      })
      .then(response => {
        console.log('Odpověď na přidání webu:', response.status);
        if (!response.ok) {
          throw new Error('Server vrátil chybu: ' + response.status);
        }
        return response.json();
      })
      .then(data => {
        console.log('Odpověď na přidání webu (data):', data);
        
        if (data.success) {
          console.log('Web byl úspěšně přidán');
          displayAlert('Webová stránka byla úspěšně přidána!', 'success');
          addWebsiteForm.reset();
          
          // Obnovení seznamu webů
          loadWebsites();
          
          // Zavření modálu
          try {
            const modalElement = document.getElementById('addWebsiteModal');
            const closeButton = document.querySelector('#addWebsiteModal .btn-close');
            if (closeButton) closeButton.click();
          } catch (e) {
            console.error('Chyba při zavírání modálu:', e);
          }
        } else {
          console.error('Chyba při přidávání webu:', data.message);
          displayAlert(data.message || 'Nepodařilo se přidat webovou stránku', 'danger');
        }
      })
      .catch(error => {
        console.error('Chyba při komunikaci se serverem:', error);
        displayAlert('Chyba při komunikaci se serverem: ' + error.message, 'danger');
      });
    });
  }
  
  // Načtení webů při inicializaci
  loadWebsites();
  
  console.log('Inicializace dokončena');
});