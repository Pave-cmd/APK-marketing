console.log('socialni-site.js načítá se...'); // Add loading message

document.addEventListener('DOMContentLoaded', function() {
    // Inicializace stránky
    console.log('Inicializace správy sociálních sítí');
    
    // Reference na formulář a tlačítko pro přidání sociální sítě
    const addNetworkForm = document.getElementById('addNetworkForm');
    const addNetworkBtn = document.getElementById('addNetworkBtn');
    
    console.log('Form element:', addNetworkForm);
    console.log('Button element:', addNetworkBtn);
    
    // Reference na přepínače a nastavení
    const autoPublishSwitch = document.getElementById('autoPublish');
    const publishFrequency = document.getElementById('publishFrequency');
    const contentType = document.getElementById('contentType');
    
    // Event listener pro tlačítko přidání sociální sítě
    if (addNetworkBtn) {
        addNetworkBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Button clicked - start'); // Debug log
            
            // Ověření formuláře
            if (!addNetworkForm.checkValidity()) {
                console.log('Form invalid'); // Debug log
                addNetworkForm.reportValidity();
                return;
            }
            
            // Získání hodnot z formuláře
            const platform = document.getElementById('networkType').value;
            const profileName = document.getElementById('profileName').value;
            const profileUrl = document.getElementById('profileUrl').value;
            
            console.log('Form values:', { platform, profileName, profileUrl }); // Debug log
            
            // Check if values are empty
            if (!platform || !profileName || !profileUrl) {
                console.error('Missing form values');
                showNotification('Prosím vyplňte všechna pole', 'danger');
                return;
            }
            
            // Volání API pro přidání sociální sítě
            console.log('Přidávání sociální sítě:', { platform, profileName, profileUrl });
            
            // API požadavek
            addSocialNetworkAPI(platform, profileName, profileUrl);
        });
    } else {
        console.error('Add network button not found'); // Debug log
    }
    
    // Event listener pro tlačítka odstranění sociální sítě
    const removeButtons = document.querySelectorAll('.network-remove');
    removeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const networkId = this.getAttribute('data-network-id');
            
            if (confirm('Opravdu chcete odstranit tuto sociální síť?')) {
                console.log('Odstraňování sociální sítě s ID:', networkId);
                // Volání API pro odstranění
                removeSocialNetworkAPI(networkId, this.closest('tr'));
            }
        });
    });
    
    // Event listener pro uložení nastavení
    const saveSettingsBtn = document.querySelector('.card-body .btn-primary');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', function() {
            const settings = {
                autoPublish: autoPublishSwitch ? autoPublishSwitch.checked : false,
                frequency: publishFrequency ? publishFrequency.value : 'weekly',
                contentType: contentType ? contentType.value : 'mix'
            };
            
            console.log('Ukládání nastavení:', settings);
            // V reálné aplikaci by se volalo API pro uložení nastavení
            
            // Ukázka zpracování odpovědi
            showNotification('Nastavení bylo úspěšně uloženo!', 'success');
        });
    }
    
    // Funkce pro volání API pro přidání sociální sítě
    async function addSocialNetworkAPI(platform, profileName, profileUrl) {
        console.log('addSocialNetworkAPI called with:', { platform, profileName, profileUrl }); // Debug log
        showNotification('Probíhá připojování k ' + getNetworkName(platform) + '...', 'info');
        
        try {
            console.log('Sending POST request to /api/social-networks/add'); // Debug log
            const response = await fetch('/api/social-networks/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin', // This includes cookies in the request
                body: JSON.stringify({
                    platform: platform,
                    accountId: profileName,
                    profileUrl: profileUrl
                })
            });
            
            console.log('Response status:', response.status); // Debug log
            const data = await response.json();
            console.log('Response data:', data); // Debug log
            
            if (data.success) {
                // Zavření modálního okna
                const modal = bootstrap.Modal.getInstance(document.getElementById('addNetworkModal'));
                if (modal) modal.hide();
                
                // Zobrazení zprávy o úspěchu
                showNotification('Sociální síť ' + getNetworkName(platform) + ' byla úspěšně připojena!', 'success');
                
                // Resetování formuláře
                if (addNetworkForm) addNetworkForm.reset();
                
                // Načtení stránky znovu pro zobrazení aktualizovaného seznamu
                setTimeout(() => location.reload(), 1500);
            } else {
                console.error('API error:', data.message); // Debug log
                showNotification(data.message || 'Chyba při připojování sociální sítě', 'danger');
            }
        } catch (error) {
            console.error('Chyba při připojování sociální sítě:', error);
            showNotification('Chyba při připojování sociální sítě: ' + error.message, 'danger');
        }
    }
    
    // Funkce pro volání API pro odstranění sociální sítě
    async function removeSocialNetworkAPI(networkId, tableRow) {
        try {
            const response = await fetch(`/api/social-networks/remove/${networkId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin' // This includes cookies in the request
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('Sociální síť byla úspěšně odstraněna', 'success');
                // Odstranění řádku z tabulky
                if (tableRow) tableRow.remove();
            } else {
                showNotification(data.message || 'Chyba při odstraňování sociální sítě', 'danger');
            }
        } catch (error) {
            console.error('Chyba při odstraňování sociální sítě:', error);
            showNotification('Chyba při odstraňování sociální sítě', 'danger');
        }
    }
    
    // Pomocná funkce pro získání názvu sociální sítě
    function getNetworkName(type) {
        const names = {
            'facebook': 'Facebook',
            'instagram': 'Instagram',
            'twitter': 'Twitter',
            'linkedin': 'LinkedIn'
        };
        return names[type] || type;
    }
    
    // Pomocná funkce pro zobrazení notifikace
    function showNotification(message, type = 'info') {
        // Vytvoření elementu pro notifikaci
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} notification-toast`;
        notification.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'} me-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Přidání do DOM
        document.body.appendChild(notification);
        
        // Zobrazení a po čase skrytí
        setTimeout(() => {
            notification.classList.add('show');
            
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }, 100);
    }
    
    // Test function for debugging
    const testSocialAPI = async () => {
        console.log('Testing social network API...');
        try {
            const response = await fetch('/api/social-networks/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    platform: 'facebook',
                    accountId: 'test',
                    profileUrl: 'https://facebook.com/test'
                })
            });
            const data = await response.json();
            console.log('API test response:', data);
            showNotification('API test result: ' + JSON.stringify(data), data.success ? 'success' : 'danger');
        } catch (error) {
            console.error('API test error:', error);
            showNotification('API test error: ' + error.message, 'danger');
        }
    };
    
    // Make the test function available globally
    window.testSocialAPI = testSocialAPI;
    
    console.log('socialni-site.js načteno úspěšně');
});