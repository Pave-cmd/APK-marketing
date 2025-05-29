/**
 * Cookie Consent Management
 * Správa souhlasu s cookies podle GDPR
 */

class CookieConsent {
    constructor() {
        this.cookieName = 'cookieConsent';
        this.consentData = this.getConsentData();
        this.init();
    }

    init() {
        // Pokud už je souhlas udělen, nezobrazujeme banner
        if (this.consentData && this.consentData.timestamp) {
            this.applyCookieSettings();
            return;
        }

        // Zobrazíme banner po načtení stránky
        this.showConsentBanner();
    }

    getConsentData() {
        const consent = localStorage.getItem(this.cookieName);
        return consent ? JSON.parse(consent) : null;
    }

    saveConsentData(data) {
        const consentData = {
            ...data,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
        localStorage.setItem(this.cookieName, JSON.stringify(consentData));
        
        // Odeslat na server pro uložení do profilu uživatele
        this.sendConsentToServer(consentData);
    }

    async sendConsentToServer(consentData) {
        try {
            await fetch('/api/auth/consent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(consentData),
                credentials: 'same-origin'
            });
        } catch (error) {
            console.warn('Nepodařilo se uložit souhlas na server:', error);
        }
    }

    showConsentBanner() {
        const banner = document.createElement('div');
        banner.id = 'cookieConsentBanner';
        banner.className = 'cookie-consent-banner';
        banner.innerHTML = `
            <div class="cookie-consent-content">
                <div class="container">
                    <div class="row align-items-center">
                        <div class="col-lg-8">
                            <h5 class="mb-2">🍪 Používáme cookies</h5>
                            <p class="mb-0">
                                Náš web používá cookies pro zajištění základní funkčnosti a vylepšení vašeho zážitku. 
                                Můžete si vybrat, které cookies přijmout.
                                <a href="/legal/cookies" target="_blank" class="text-white text-decoration-underline">Více informací</a>
                            </p>
                        </div>
                        <div class="col-lg-4 text-lg-end mt-3 mt-lg-0">
                            <button class="btn btn-outline-light btn-sm me-2" onclick="cookieConsent.showDetailedSettings()">
                                Nastavit
                            </button>
                            <button class="btn btn-success btn-sm me-2" onclick="cookieConsent.acceptAll()">
                                Přijmout vše
                            </button>
                            <button class="btn btn-light btn-sm" onclick="cookieConsent.acceptNecessary()">
                                Pouze nezbytné
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(banner);
        
        // Animace zobrazení
        setTimeout(() => {
            banner.classList.add('show');
        }, 100);
    }

    showDetailedSettings() {
        const modal = document.createElement('div');
        modal.id = 'cookieConsentModal';
        modal.className = 'cookie-consent-modal';
        modal.innerHTML = `
            <div class="cookie-consent-modal-content">
                <div class="cookie-consent-modal-header">
                    <h4>Nastavení cookies</h4>
                    <button type="button" class="btn-close" onclick="cookieConsent.closeModal()"></button>
                </div>
                <div class="cookie-consent-modal-body">
                    <p class="mb-4">Upravte si, které cookies chcete povolit. Nezbytné cookies nelze vypnout.</p>
                    
                    <div class="cookie-category mb-4">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-1">Nezbytné cookies</h6>
                                <small class="text-muted">Nutné pro základní funkčnost webu</small>
                            </div>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="necessary" checked disabled>
                                <label class="form-check-label" for="necessary">Vždy aktivní</label>
                            </div>
                        </div>
                    </div>

                    <div class="cookie-category mb-4">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-1">Funkční cookies</h6>
                                <small class="text-muted">Vylepšují funkcionalitu a personalizaci</small>
                            </div>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="functional">
                                <label class="form-check-label" for="functional"></label>
                            </div>
                        </div>
                    </div>

                    <div class="cookie-category mb-4">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-1">Analytické cookies</h6>
                                <small class="text-muted">Pomáhají nám zlepšovat náš web</small>
                            </div>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="analytics">
                                <label class="form-check-label" for="analytics"></label>
                            </div>
                        </div>
                    </div>

                    <div class="cookie-category mb-4">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-1">Marketingové cookies</h6>
                                <small class="text-muted">Umožňují personalizovanou reklamu</small>
                            </div>
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" id="marketing">
                                <label class="form-check-label" for="marketing"></label>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="cookie-consent-modal-footer">
                    <button class="btn btn-outline-secondary me-2" onclick="cookieConsent.closeModal()">
                        Zrušit
                    </button>
                    <button class="btn btn-primary" onclick="cookieConsent.saveDetailedSettings()">
                        Uložit nastavení
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Animace zobrazení
        setTimeout(() => {
            modal.classList.add('show');
        }, 100);
    }

    closeModal() {
        const modal = document.getElementById('cookieConsentModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 300);
        }
    }

    acceptAll() {
        const consentData = {
            necessary: true,
            functional: true,
            analytics: true,
            marketing: true
        };
        
        this.saveConsentData(consentData);
        this.hideBanner();
        this.applyCookieSettings();
    }

    acceptNecessary() {
        const consentData = {
            necessary: true,
            functional: false,
            analytics: false,
            marketing: false
        };
        
        this.saveConsentData(consentData);
        this.hideBanner();
        this.applyCookieSettings();
    }

    saveDetailedSettings() {
        const consentData = {
            necessary: true,
            functional: document.getElementById('functional').checked,
            analytics: document.getElementById('analytics').checked,
            marketing: document.getElementById('marketing').checked
        };
        
        this.saveConsentData(consentData);
        this.closeModal();
        this.hideBanner();
        this.applyCookieSettings();
    }

    hideBanner() {
        const banner = document.getElementById('cookieConsentBanner');
        if (banner) {
            banner.classList.remove('show');
            setTimeout(() => {
                if (banner.parentNode) {
                    document.body.removeChild(banner);
                }
            }, 300);
        }
    }

    applyCookieSettings() {
        const consent = this.getConsentData();
        if (!consent) return;

        // Nezbytné cookies jsou vždy aktivní
        
        // Funkční cookies
        if (!consent.functional) {
            this.removeCookiesByPattern(/^(userPreferences|languagePreference|dashboardLayout)$/);
        }

        // Analytické cookies
        if (consent.analytics) {
            this.loadGoogleAnalytics();
        } else {
            this.removeCookiesByPattern(/^(_ga|_ga_|analyticsConsent)$/);
            this.disableGoogleAnalytics();
        }

        // Marketingové cookies
        if (!consent.marketing) {
            this.removeCookiesByPattern(/^(marketing|advertising)/);
        }
    }

    removeCookiesByPattern(pattern) {
        document.cookie.split(';').forEach(cookie => {
            const [name] = cookie.split('=');
            if (pattern.test(name.trim())) {
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
            }
        });
    }

    loadGoogleAnalytics() {
        if (window.gtag) return; // Už je načteno

        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID';
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        function gtag() { 
            /* eslint-disable-next-line no-undef */
            dataLayer.push(arguments); 
        }
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', 'GA_MEASUREMENT_ID');
    }

    disableGoogleAnalytics() {
        window['ga-disable-GA_MEASUREMENT_ID'] = true;
    }

    // Metoda pro změnu nastavení z nastavení uživatele
    updateConsent(newConsent) {
        this.saveConsentData(newConsent);
        this.applyCookieSettings();
    }

    // Metoda pro získání aktuálního stavu souhlasu
    getCurrentConsent() {
        return this.getConsentData();
    }
}

// Inicializace cookie consent managementu
let cookieConsent;

document.addEventListener('DOMContentLoaded', function() {
    cookieConsent = new CookieConsent();
    // Expose globally for onclick handlers in HTML
    window.cookieConsent = cookieConsent;
});

// Globální funkce pro přístup z jiných skriptů
window.CookieConsent = CookieConsent;