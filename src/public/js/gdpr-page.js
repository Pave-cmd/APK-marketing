// GDPR funkce pro správu souhlasů a dat
console.log('GDPR script se spouští - START');
console.error('GDPR SCRIPT TEST - pokud vidíte tuto zprávu, script běží');

// Získání CSRF tokenu
function getCsrfToken() {
  const tokenElement = document.querySelector('meta[name="csrf-token"]');
  return tokenElement ? tokenElement.content : '';
}

// Funkce showAlert musí být definována před použitím
function showAlert(type, message) {
  // Odstraníme existující alerty
  document.querySelectorAll('.alert.position-fixed').forEach(alert => alert.remove());
  
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

// Export dat - definováno globálně
async function exportData() {
  console.log('Export dat funkce spuštěna');
  try {
    showAlert('info', 'Připravuji export dat...');
    
    console.log('Odesílám požadavek na /api/gdpr/export');
    const response = await fetch('/api/gdpr/export', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'X-CSRF-Token': getCsrfToken()
      }
    });
    console.log('Response status:', response.status);
    
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
      const modal = bootstrap.Modal.getInstance(document.getElementById('deleteAccountModal'));
      modal.hide();
      setTimeout(() => location.reload(), 2000);
    } else {
      showAlert('danger', data.error || 'Chyba při žádosti o smazání');
    }
  } catch (error) {
    console.error('Chyba při žádosti o smazání:', error);
    showAlert('danger', 'Nastala chyba při zpracování žádosti');
  }
}

// Zobrazení dialogu pro udělení souhlasu
function showConsentDialog() {
  window.location.href = '/dashboard/consent?platform=general&returnUrl=' + encodeURIComponent(window.location.pathname);
}

// Odvolání souhlasu
async function revokeConsent() {
  if (!confirm('Opravdu chcete odvolat souhlas se zpracováním dat?')) {
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
      body: JSON.stringify({ consent: false })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('warning', 'Souhlas byl odvolán');
      setTimeout(() => location.reload(), 1500);
    } else {
      showAlert('danger', data.error || 'Chyba při odvolání souhlasu');
    }
  } catch (error) {
    console.error('Chyba při odvolání souhlasu:', error);
    showAlert('danger', 'Nastala chyba při odvolání souhlasu');
  }
}

// Zrušení žádosti o smazání
async function cancelDeletion() {
  if (!confirm('Opravdu chcete zrušit žádost o smazání účtu?')) {
    return;
  }
  
  try {
    const response = await fetch('/api/gdpr/cancel-deletion', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken()
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('success', 'Žádost o smazání byla zrušena');
      setTimeout(() => location.reload(), 2000);
    } else {
      showAlert('danger', data.error || 'Chyba při rušení žádosti');
    }
  } catch (error) {
    console.error('Chyba při rušení žádosti:', error);
    showAlert('danger', 'Nastala chyba při rušení žádosti');
  }
}

// Načtení dat při načtení stránky
document.addEventListener('DOMContentLoaded', function() {
  console.log('GDPR skripty načteny - DOMContentLoaded');
  console.log('Kontroluji dostupnost funkcí:');
  console.log('exportData:', typeof exportData);
  console.log('showDeleteDialog:', typeof showDeleteDialog);
  console.log('showConsentDialog:', typeof showConsentDialog);
  
  loadGdprStatus();
  
  // Přidání event listenerů
  const exportDataBtn = document.getElementById('exportDataBtn');
  console.log('exportDataBtn nalezeno:', !!exportDataBtn);
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', function(e) {
      console.log('Export button clicked!');
      e.preventDefault();
      exportData();
    });
    console.log('Event listener pro exportDataBtn přidán');
  }
  
  const deleteAccountBtn = document.getElementById('deleteAccountBtn');
  console.log('deleteAccountBtn nalezeno:', !!deleteAccountBtn);
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', showDeleteDialog);
    console.log('Event listener pro deleteAccountBtn přidán');
  }
  
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  console.log('confirmDeleteBtn nalezeno:', !!confirmDeleteBtn);
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', deleteAccount);
    console.log('Event listener pro confirmDeleteBtn přidán');
  }
  
  const cancelDeletionBtn = document.getElementById('cancelDeletionBtn');
  console.log('cancelDeletionBtn nalezeno:', !!cancelDeletionBtn);
  if (cancelDeletionBtn) {
    cancelDeletionBtn.addEventListener('click', cancelDeletion);
    console.log('Event listener pro cancelDeletionBtn přidán');
  }
  
  // Testovací funkce dostupná globálně
  window.testGdprFunctions = function() {
    console.log('=== Test GDPR funkcí ===');
    console.log('exportData:', typeof window.exportData);
    console.log('showDeleteDialog:', typeof window.showDeleteDialog);
    console.log('showConsentDialog:', typeof window.showConsentDialog);
    console.log('deleteAccount:', typeof window.deleteAccount);
    console.log('cancelDeletion:', typeof window.cancelDeletion);
  };
  
  console.log('GDPR inicializace dokončena. Pro test spusťte: testGdprFunctions()');
});

// Ujistíme se, že funkce jsou dostupné globálně
window.exportData = exportData;
window.showDeleteDialog = showDeleteDialog;
window.showConsentDialog = showConsentDialog;
window.revokeConsent = revokeConsent;
window.deleteAccount = deleteAccount;
window.cancelDeletion = cancelDeletion;
window.showAlert = showAlert;

console.log('GDPR script načten - funkce exportovány do window objektu');