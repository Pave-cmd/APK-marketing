// UI pro zobrazení průběhu analýzy webu
document.addEventListener('DOMContentLoaded', function() {
  console.log('[ANALYSIS] Inicializace analýzy webu');

  // Funkce pro spuštění analýzy
  window.startWebsiteAnalysis = function(websiteUrl) {
    console.log('[ANALYSIS] Spouštím analýzu pro:', websiteUrl);

    // Zobrazíme progress modal
    showAnalysisProgress(websiteUrl);

    fetch('/api/analysis/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ websiteUrl })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Začneme sledovat stav analýzy
        startMonitoringAnalysis(websiteUrl);
      } else {
        showAnalysisError(data.message || 'Chyba při spuštění analýzy');
      }
    })
    .catch(error => {
      showAnalysisError('Chyba připojení: ' + error.message);
    });
  };

  // Funkce pro sledování stavu analýzy
  function startMonitoringAnalysis(websiteUrl) {
    const intervalId = setInterval(() => {
      fetch(`/api/analysis/status/${encodeURIComponent(websiteUrl)}`, {
        credentials: 'include'
      })
      .then(response => response.json())
      .then(data => {
        if (data.success && data.analysis) {
          updateAnalysisProgress(data.analysis);

          // Pokud je analýza dokončena nebo selhala, zastavíme sledování
          if (data.analysis.status === 'completed' || data.analysis.status === 'failed') {
            clearInterval(intervalId);
            hideAnalysisProgress();
            
            if (data.analysis.status === 'completed') {
              showAnalysisSuccess();
            } else {
              showAnalysisError(data.analysis.error || 'Analýza selhala');
            }
          }
        }
      })
      .catch(error => {
        console.error('[ANALYSIS] Chyba při sledování:', error);
      });
    }, 2000); // Kontrolujeme každé 2 sekundy
  }

  // Funkce pro zobrazení progress modalu
  function showAnalysisProgress(websiteUrl) {
    const modalHtml = `
      <div class="modal fade" id="analysisProgressModal" tabindex="-1" data-bs-backdrop="static">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Analýza webu</h5>
            </div>
            <div class="modal-body">
              <p class="mb-3">Analyzuji web: <strong>${websiteUrl}</strong></p>
              
              <div class="analysis-steps">
                <div class="step" data-step="scanning">
                  <i class="fas fa-spider"></i>
                  <span>Skenování webu</span>
                  <i class="fas fa-spinner fa-spin status-icon d-none"></i>
                  <i class="fas fa-check text-success status-icon d-none"></i>
                </div>
                
                <div class="step" data-step="extracting">
                  <i class="fas fa-file-alt"></i>
                  <span>Extrakce obsahu</span>
                  <i class="fas fa-spinner fa-spin status-icon d-none"></i>
                  <i class="fas fa-check text-success status-icon d-none"></i>
                </div>
                
                <div class="step" data-step="generating">
                  <i class="fas fa-robot"></i>
                  <span>AI generování</span>
                  <i class="fas fa-spinner fa-spin status-icon d-none"></i>
                  <i class="fas fa-check text-success status-icon d-none"></i>
                </div>
                
                <div class="step" data-step="publishing">
                  <i class="fas fa-share-alt"></i>
                  <span>Publikace</span>
                  <i class="fas fa-spinner fa-spin status-icon d-none"></i>
                  <i class="fas fa-check text-success status-icon d-none"></i>
                </div>
              </div>
              
              <div class="progress mt-4">
                <div class="progress-bar progress-bar-striped progress-bar-animated" 
                     role="progressbar" 
                     style="width: 0%"
                     aria-valuenow="0" 
                     aria-valuemin="0" 
                     aria-valuemax="100">
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Přidáme modal do stránky
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Zobrazíme modal
    const modal = new bootstrap.Modal(document.getElementById('analysisProgressModal'));
    modal.show();
  }

  // Funkce pro aktualizaci progressu
  function updateAnalysisProgress(analysis) {
    const steps = {
      'scanning': 25,
      'extracting': 50,
      'generating': 75,
      'publishing': 90,
      'completed': 100
    };

    const currentProgress = steps[analysis.status] || 0;
    const progressBar = document.querySelector('#analysisProgressModal .progress-bar');
    if (progressBar) {
      progressBar.style.width = currentProgress + '%';
      progressBar.setAttribute('aria-valuenow', currentProgress);
    }

    // Aktualizace kroků
    document.querySelectorAll('.analysis-steps .step').forEach(step => {
      const stepName = step.dataset.step;
      const spinner = step.querySelector('.fa-spinner');
      const check = step.querySelector('.fa-check');

      if (stepName === analysis.status) {
        // Aktuální krok
        spinner.classList.remove('d-none');
        check.classList.add('d-none');
        step.classList.add('active');
      } else if (steps[stepName] < steps[analysis.status]) {
        // Dokončený krok
        spinner.classList.add('d-none');
        check.classList.remove('d-none');
        step.classList.add('completed');
      } else {
        // Budoucí krok
        spinner.classList.add('d-none');
        check.classList.add('d-none');
        step.classList.remove('active', 'completed');
      }
    });
  }

  // Funkce pro skrytí progress modalu
  function hideAnalysisProgress() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('analysisProgressModal'));
    if (modal) {
      modal.hide();
    }
    
    // Odebereme modal ze stránky
    setTimeout(() => {
      document.getElementById('analysisProgressModal')?.remove();
    }, 500);
  }

  // Funkce pro zobrazení úspěchu
  function showAnalysisSuccess() {
    showAlert('Analýza byla úspěšně dokončena!', 'success');
    // Reload stránky pro zobrazení aktualizovaných dat
    setTimeout(() => {
      location.reload();
    }, 2000);
  }

  // Funkce pro zobrazení chyby
  function showAnalysisError(message) {
    showAlert('Chyba: ' + message, 'danger');
  }

  // Pomocná funkce pro zobrazení alertu
  function showAlert(message, type) {
    const alertHtml = `
      <div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      </div>
    `;
    
    const alertContainer = document.getElementById('alertContainer') || 
                          document.querySelector('.dashboard-content');
    
    if (alertContainer) {
      alertContainer.insertAdjacentHTML('afterbegin', alertHtml);
    }
  }
});