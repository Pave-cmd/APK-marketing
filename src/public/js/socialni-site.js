document.addEventListener('DOMContentLoaded', function() {
    // Inicializace stránky
    console.log('Inicializace správy sociálních sítí');
    
    // Reference na formulář a tlačítko pro přidání sociální sítě
    const addNetworkForm = document.getElementById('addNetworkForm');
    const addNetworkBtn = document.getElementById('addNetworkBtn');
    
    // Reference na přepínače a nastavení
    const autoPublishSwitch = document.getElementById('autoPublish');
    const publishFrequency = document.getElementById('publishFrequency');
    const contentType = document.getElementById('contentType');
    
    // Event listener pro tlačítko přidání sociální sítě
    if (addNetworkBtn) {
        addNetworkBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Ověření formuláře
            if (!addNetworkForm.checkValidity()) {
                addNetworkForm.reportValidity();
                return;
            }
            
            // Získání hodnot z formuláře
            const platform = document.getElementById('networkType').value;
            const profileName = document.getElementById('profileName').value;
            const profileUrl = document.getElementById('profileUrl').value;
            
            // Simulace přidání sociální sítě (v reálné aplikaci by se volalo API)
            console.log('Přidávání sociální sítě:', { platform, profileName, profileUrl });
            
            // Ukázka zpracování (v reálné aplikaci by se zpracovávala odpověď z API)
            simulateNetworkConnection(platform, profileName, profileUrl);
        });
    }
    
    // Event listener pro tlačítka odstranění sociální sítě
    const removeButtons = document.querySelectorAll('.network-remove');
    removeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const networkId = this.getAttribute('data-network-id');
            
            if (confirm('Opravdu chcete odstranit tuto sociální síť?')) {
                console.log('Odstraňování sociální sítě s ID:', networkId);
                // V reálné aplikaci by se volalo API pro odstranění
                // Ukázka: this.closest('tr').remove();
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
    
    // Pomocná funkce pro simulaci připojení sociální sítě
    function simulateNetworkConnection(type, name, url) {
        showNotification('Probíhá připojování k ' + getNetworkName(type) + '...', 'info');
        
        // Simulace zpracování (ve skutečné aplikaci by to byl API požadavek)
        setTimeout(() => {
            // Zavření modálního okna
            const modal = bootstrap.Modal.getInstance(document.getElementById('addNetworkModal'));
            if (modal) modal.hide();
            
            // Zobrazení zprávy o úspěchu
            showNotification('Sociální síť ' + getNetworkName(type) + ' byla úspěšně připojena!', 'success');
            
            // Resetování formuláře
            if (addNetworkForm) addNetworkForm.reset();
            
            // V reálné aplikaci by se aktualizoval seznam sítí bez nutnosti načítat stránku znovu
            // Ukázka: location.reload();
        }, 1500);
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
});