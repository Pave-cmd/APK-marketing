// Content.js - Marketing functionality

// Základní funkce pro správu obsahu marketingových kampaní
document.addEventListener('DOMContentLoaded', function() {
    console.log('Content.js loaded successfully');
    
    // Zde můžete přidat váš kód pro marketing funkcionality
    initMarketingFeatures();
});

// Inicializace marketingových funkcí
function initMarketingFeatures() {
    console.log('Marketing features initialized');
    
    // Příklad funkce pro sledování konverzí
    trackConversions();
}

// Funkce pro sledování konverzí
function trackConversions() {
    const ctaButtons = document.querySelectorAll('.cta-button');
    
    if (ctaButtons.length > 0) {
        ctaButtons.forEach(button => {
            button.addEventListener('click', function() {
                console.log('Conversion tracked:', this.dataset.campaign || 'unknown campaign');
            });
        });
    }
}

// Nastavení oznámení o úspěšném načtení
console.log('Content.js loaded and initialized successfully');