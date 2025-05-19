console.log('[API-CONFIG] External script loaded');

// Set redirect URIs based on current URL
function setRedirectUris() {
    const currentUrl = window.location.origin;
    console.log('[API-CONFIG] Setting redirect URIs for:', currentUrl);
    
    // Facebook
    const fbRedirectUri = document.getElementById('fb-redirect-uri');
    if (fbRedirectUri) {
        fbRedirectUri.value = `${currentUrl}/api/social-networks/callback/facebook`;
    }
    
    // Twitter
    const twRedirectUri = document.getElementById('tw-redirect-uri');
    if (twRedirectUri) {
        twRedirectUri.value = `${currentUrl}/api/social-networks/callback/twitter`;
    }
    
    // LinkedIn
    const liRedirectUri = document.getElementById('li-redirect-uri');
    if (liRedirectUri) {
        liRedirectUri.value = `${currentUrl}/api/social-networks/callback/linkedin`;
    }
    
    console.log('[API-CONFIG] Redirect URIs set');
}

// Call it immediately
setRedirectUris();

// Function to load configuration
function loadApiConfig() {
    console.log('[API-CONFIG] Loading config...');
    const debugDiv = document.getElementById('debug-messages');
    if (debugDiv) {
        debugDiv.innerHTML += '<div>Loading configuration...</div>';
    }
    
    fetch('/api/config')
        .then(response => {
            console.log('[API-CONFIG] Response status:', response.status);
            if (debugDiv) {
                debugDiv.innerHTML += `<div>Response status: ${response.status}</div>`;
            }
            return response.json();
        })
        .then(data => {
            console.log('[API-CONFIG] Data received:', data);
            if (debugDiv) {
                debugDiv.innerHTML += `<div>Data received: ${JSON.stringify(data)}</div>`;
            }
            
            if (data.success && data.configs) {
                data.configs.forEach(config => {
                    console.log('[API-CONFIG] Processing config:', config);
                    switch(config.platform) {
                        case 'facebook':
                            document.getElementById('fb-app-id').value = config.appId || '';
                            if (config.hasAppSecret) {
                                document.getElementById('fb-app-secret').placeholder = 'Šifrováno v databázi';
                            }
                            break;
                        case 'twitter':
                            document.getElementById('tw-client-id').value = config.clientId || '';
                            if (config.hasClientSecret) {
                                document.getElementById('tw-client-secret').placeholder = 'Šifrováno v databázi';
                            }
                            break;
                        case 'linkedin':
                            document.getElementById('li-client-id').value = config.clientId || '';
                            if (config.hasClientSecret) {
                                document.getElementById('li-client-secret').placeholder = 'Šifrováno v databázi';
                            }
                            break;
                    }
                });
            } else {
                console.log('[API-CONFIG] No configs or error:', data.message);
            }
        })
        .catch(error => {
            console.error('[API-CONFIG] Error loading config:', error);
            if (debugDiv) {
                debugDiv.innerHTML += `<div>Error: ${error.message}</div>`;
            }
        });
}

// Check if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM is still loading
    console.log('[API-CONFIG] DOM is loading, setting up event listener');
    document.addEventListener('DOMContentLoaded', function() {
        console.log('[API-CONFIG] DOMContentLoaded event fired');
        setRedirectUris();
        loadApiConfig();
    });
} else {
    // DOM is already loaded
    console.log('[API-CONFIG] DOM already loaded, calling functions immediately');
    setRedirectUris();
    loadApiConfig();
}

// Also try on window load as backup
window.addEventListener('load', function() {
    console.log('[API-CONFIG] Window loaded event fired');
    // Try loading again if not already loaded
    const debugDiv = document.getElementById('debug-messages');
    if (debugDiv && debugDiv.innerHTML === '') {
        console.log('[API-CONFIG] Debug div is empty, loading config again');
        loadApiConfig();
    }
});

// Initialize forms
function initializeForms() {
    console.log('[API-CONFIG] Initializing forms');
    
    // Facebook form submit
    const fbForm = document.getElementById('facebook-config-form');
    if (fbForm) {
        fbForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const data = {
                appId: document.getElementById('fb-app-id').value,
                appSecret: document.getElementById('fb-app-secret').value,
                redirectUri: document.getElementById('fb-redirect-uri').value
            };
            
            console.log('[API-CONFIG] Saving Facebook config:', data);
            
            fetch('/api/config/facebook', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(result => {
                console.log('[API-CONFIG] Save result:', result);
                if (result.success) {
                    alert('Konfigurace byla úspěšně uložena!');
                    // Clear password field
                    document.getElementById('fb-app-secret').value = '';
                    loadApiConfig(); // Reload configuration
                } else {
                    alert('Chyba: ' + result.message);
                }
            })
            .catch(error => {
                console.error('[API-CONFIG] Save error:', error);
                alert('Chyba při ukládání: ' + error.message);
            });
        });
    }

    // Twitter form submit
    const twForm = document.getElementById('twitter-config-form');
    if (twForm) {
        twForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const data = {
                clientId: document.getElementById('tw-client-id').value,
                clientSecret: document.getElementById('tw-client-secret').value,
                redirectUri: document.getElementById('tw-redirect-uri').value
            };
            
            console.log('[API-CONFIG] Saving Twitter config:', data);
            
            fetch('/api/config/twitter', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(result => {
                console.log('[API-CONFIG] Save result:', result);
                if (result.success) {
                    alert('Konfigurace byla úspěšně uložena!');
                    // Clear password field
                    document.getElementById('tw-client-secret').value = '';
                    loadApiConfig(); // Reload configuration
                } else {
                    alert('Chyba: ' + result.message);
                }
            })
            .catch(error => {
                console.error('[API-CONFIG] Save error:', error);
                alert('Chyba při ukládání: ' + error.message);
            });
        });
    }

    // LinkedIn form submit
    const liForm = document.getElementById('linkedin-config-form');
    if (liForm) {
        liForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const data = {
                clientId: document.getElementById('li-client-id').value,
                clientSecret: document.getElementById('li-client-secret').value,
                redirectUri: document.getElementById('li-redirect-uri').value
            };
            
            console.log('[API-CONFIG] Saving LinkedIn config:', data);
            
            fetch('/api/config/linkedin', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(result => {
                console.log('[API-CONFIG] Save result:', result);
                if (result.success) {
                    alert('Konfigurace byla úspěšně uložena!');
                    // Clear password field
                    document.getElementById('li-client-secret').value = '';
                    loadApiConfig(); // Reload configuration
                } else {
                    alert('Chyba: ' + result.message);
                }
            })
            .catch(error => {
                console.error('[API-CONFIG] Save error:', error);
                alert('Chyba při ukládání: ' + error.message);
            });
        });
    }

    // Test configuration buttons
    document.querySelectorAll('.test-config-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const platform = this.getAttribute('data-platform');
            
            fetch(`/api/config/${platform}/test`, {
                method: 'POST',
                credentials: 'same-origin'
            })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    alert('✓ ' + result.message);
                } else {
                    alert('✗ ' + result.message);
                }
            })
            .catch(error => {
                alert('Chyba při testování: ' + error.message);
            });
        });
    });
}

// Initialize forms when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeForms);
} else {
    initializeForms();
}