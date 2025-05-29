// GDPR funkce pro správu souhlasů a dat

// Získání CSRF tokenu z meta tagu
function getCsrfToken() {
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  return metaTag ? metaTag.getAttribute('content') : '';
}

// Získání GDPR statusu
async function loadGdprStatus() {
  try {
    const response = await fetch('/api/gdpr/status', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'X-CSRF-Token': getCsrfToken(),
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('GDPR status načten:', data);
    } else if (response.status === 401) {
      console.log('Uživatel není přihlášen pro GDPR status');
    } else {
      console.error('Chyba při načítání GDPR statusu:', response.status);
    }
  } catch (error) {
    console.error('Chyba při načítání GDPR statusu:', error);
  }
}

// Export dat
async function exportData() {
  try {
    const response = await fetch('/api/gdpr/export', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `apk-marketing-data-export-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showAlert('success', 'Data byla úspěšně exportována');
    } else {
      const error = await response.json();
      showAlert('danger', error.error || 'Chyba při exportu dat');
    }
  } catch (error) {
    console.error('Chyba při exportu dat:', error);
    showAlert('danger', 'Nastala chyba při exportu dat');
  }
}

// Zobrazení dialogu pro smazání účtu
function showDeleteDialog() {
  const modal = new bootstrap.Modal(document.getElementById('deleteAccountModal'));
  modal.show();
}

// Smazání účtu
async function deleteAccount() {
  const password = document.getElementById('deletePassword').value;
  const confirmDeletion = document.getElementById('confirmDeletion').checked;
  
  if (!password || !confirmDeletion) {
    showAlert('danger', 'Vyplňte všechna pole');
    return;
  }
  
  try {
    const response = await fetch('/api/gdpr/delete-request', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      body: JSON.stringify({ password, confirmDeletion })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('warning', data.message);
      bootstrap.Modal.getInstance(document.getElementById('deleteAccountModal')).hide();
      setTimeout(() => location.reload(), 3000);
    } else {
      showAlert('danger', data.error || 'Chyba při žádosti o smazání');
    }
  } catch (error) {
    console.error('Chyba při žádosti o smazání:', error);
    showAlert('danger', 'Nastala chyba při zpracování žádosti');
  }
}

// Helper funkce pro zobrazení alertů
function showAlert(type, message) {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
  alertDiv.style.zIndex = '9999';
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  document.body.appendChild(alertDiv);
  
  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}

// Zobrazení dialogu pro udělení souhlasu
function showConsentDialog() {
  window.location.href = '/dashboard/consent?platform=general&returnUrl=' + encodeURIComponent(window.location.pathname);
}

// Odvolání souhlasu
async function revokeConsent() {
  if (!confirm('Opravdu chcete odvolat souhlas se zpracováním dat? Některé funkce aplikace nebudou dostupné.')) {
    return;
  }
  
  try {
    const response = await fetch('/api/gdpr/consent', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      },
      body: JSON.stringify({ consentGiven: false })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('warning', 'Souhlas byl odvolán');
      setTimeout(() => location.reload(), 2000);
    } else {
      showAlert('danger', data.error || 'Chyba při odvolání souhlasu');
    }
  } catch (error) {
    console.error('Chyba při odvolání souhlasu:', error);
    showAlert('danger', 'Nastala chyba při odvolání souhlasu');
  }
}

// Načtení dat při načtení stránky
document.addEventListener('DOMContentLoaded', loadGdprStatus);

// Expose functions globally for HTML onclick handlers
window.exportData = exportData;
window.showDeleteDialog = showDeleteDialog;
window.deleteAccount = deleteAccount;
window.showConsentDialog = showConsentDialog;
window.revokeConsent = revokeConsent;