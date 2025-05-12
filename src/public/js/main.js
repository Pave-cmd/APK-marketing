/**
 * Hlavní JavaScript soubor pro APK Marketing
 */

document.addEventListener('DOMContentLoaded', function() {
    // Přidání auth tokenu do každého fetch požadavku
    setupAuthInterceptor();

    // Inicializace nástrojů
    initializeAnimations();
    initializeTooltips();
    initializeScrollSpy();

    // Naslouchání událostem
    setupEventListeners();
});

/**
 * Nastavení interceptoru pro přidání auth tokenu a základní zpracování chyb
 */
function setupAuthInterceptor() {
    // Ukládáme původní funkci fetch
    const originalFetch = window.fetch;

    // Přepisujeme globální fetch funkci pro přidání auth tokenu
    window.fetch = async function(input, init) {
        try {
            // Použijeme původní inicializační objekt nebo vytvoříme nový
            init = init || {};
            init.headers = init.headers || {};

            // Přidáme credentials: 'include' pro zajištění, že cookies budou odeslány
            init.credentials = 'include';

            // Přidáme auth token z localStorage, pokud je dostupný
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            if (token) {
                // Přidáme token do hlavičky
                init.headers = {
                    ...init.headers,
                    'Authorization': `Bearer ${token}`
                };
            }

            // Zavoláme původní fetch s modifikovanými parametry
            const response = await originalFetch.call(this, input, init);

            // Základní zpracování běžných chybových stavů
            if (response.status === 401) {
                // Neautorizovaný přístup - pravděpodobně vypršel token
                handleUnauthorized();
            } else if (response.status === 403) {
                // Nedostatečná práva
                console.error('[AUTH] Nedostatečná oprávnění pro přístup k prostředku:', input);
            } else if (response.status >= 500) {
                // Serverová chyba
                console.error('[FETCH] Serverová chyba:', response.status, input);
            }

            return response;
        } catch (error) {
            // Zachycení síťových chyb
            console.error('[FETCH] Síťová chyba při volání API:', error.message);
            // Případ, kdy síť selže úplně - vytvoříme "mock" response pro konzistentní API
            return new Response(JSON.stringify({
                success: false,
                message: 'Síťová chyba při připojení k serveru. Zkontrolujte připojení k internetu.',
                networkError: true
            }), {
                status: 0,
                statusText: 'Network Error',
                headers: new Headers({'Content-Type': 'application/json'})
            });
        }
    };

    // Funkce pro zpracování neautorizovaného přístupu
    function handleUnauthorized() {
        const currentPath = window.location.pathname;
        // Přesměrování na přihlašovací stránku pouze pokud nejsme již tam
        if (currentPath !== '/prihlaseni') {
            console.warn('[AUTH] Neautorizovaný přístup, přesměrování na přihlášení');
            // Odstranění neplatného tokenu
            localStorage.removeItem('authToken');
            sessionStorage.removeItem('authToken');

            // Přesměrování s informací o původní stránce
            window.location.href = `/prihlaseni?from=${encodeURIComponent(currentPath)}`;
        }
    }

    console.log('[AUTH] Interceptor pro autentizaci byl nastaven');
}

/**
 * Inicializace animací na stránce
 */
function initializeAnimations() {
    // Přidání třídy pro animace při načtení stránky
    const fadeElements = document.querySelectorAll('.fade-in');
    fadeElements.forEach(element => {
        element.classList.add('animate');
    });

    // Animace na scroll
    window.addEventListener('scroll', function() {
        const scrollElements = document.querySelectorAll('.scroll-animation');
        scrollElements.forEach(element => {
            if (isElementInViewport(element)) {
                element.classList.add('animate');
            }
        });
    });
}

/**
 * Inicializace tooltipů z Bootstrap s ošetřením chyb
 */
function initializeTooltips() {
    try {
        // Kontrola, zda je Bootstrap dostupný
        if (typeof bootstrap === 'undefined' || !bootstrap.Tooltip) {
            console.warn('[UI] Bootstrap není dostupný, přeskakuji inicializaci tooltipů');
            return;
        }

        const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        if (tooltipTriggerList.length === 0) {
            return; // Žádné tooltip elementy, není potřeba inicializovat
        }

        tooltipTriggerList.forEach(function (tooltipTriggerEl) {
            try {
                new bootstrap.Tooltip(tooltipTriggerEl);
            } catch (err) {
                console.error('[UI] Chyba při inicializaci tooltip prvku:', err);
            }
        });
    } catch (error) {
        console.error('[UI] Chyba při inicializaci tooltipů:', error);
    }
}

/**
 * Inicializace ScrollSpy pro navigaci s ošetřením chyb
 */
function initializeScrollSpy() {
    try {
        // Kontrola, zda je Bootstrap dostupný
        if (typeof bootstrap === 'undefined' || !bootstrap.ScrollSpy) {
            console.warn('[UI] Bootstrap není dostupný, přeskakuji inicializaci ScrollSpy');
            return;
        }

        // Kontrola, zda cílový navigační element existuje
        const navbarMain = document.querySelector('#navbarMain');
        if (!navbarMain) {
            console.warn('[UI] Navigační lišta #navbarMain nenalezena, přeskakuji inicializaci ScrollSpy');
            return;
        }

        const scrollSpy = new bootstrap.ScrollSpy(document.body, {
            target: '#navbarMain'
        });
    } catch (error) {
        console.error('[UI] Chyba při inicializaci ScrollSpy:', error);
    }
}

/**
 * Nastavení naslouchání událostem pro interaktivní prvky
 */
function setupEventListeners() {
    // Smoothscroll pro odkazy
    const smoothScrollLinks = document.querySelectorAll('a.smooth-scroll');
    smoothScrollLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 70,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Formulářové validace
    const forms = document.querySelectorAll('.needs-validation');
    forms.forEach(form => {
        form.addEventListener('submit', function(event) {
            if (!this.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            this.classList.add('was-validated');
        }, false);
    });
}

/**
 * Kontrola, zda je element viditelný ve viewportu
 * @param {HTMLElement} el - Element k ověření
 * @returns {boolean} - True pokud je element viditelný
 */
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

/**
 * Funkce pro přepínání stavu mobilního menu
 */
function toggleMobileMenu() {
    const navbarCollapse = document.querySelector('.navbar-collapse');
    if (navbarCollapse.classList.contains('show')) {
        navbarCollapse.classList.remove('show');
    } else {
        navbarCollapse.classList.add('show');
    }
}

/**
 * Funkce pro přepínání aktivní záložky v navigaci
 * @param {HTMLElement} element - Element, který má být aktivován
 */
function setActiveTab(element) {
    // Odstranění aktivní třídy ze všech prvků
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
    });
    
    // Přidání aktivní třídy na vybraný prvek
    element.classList.add('active');
}