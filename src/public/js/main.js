/**
 * Hlavní JavaScript soubor pro APK Marketing
 */

document.addEventListener('DOMContentLoaded', function() {
    // Inicializace nástrojů
    initializeAnimations();
    initializeTooltips();
    initializeScrollSpy();
    
    // Naslouchání událostem
    setupEventListeners();
});

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
 * Inicializace tooltipů z Bootstrap
 */
function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

/**
 * Inicializace ScrollSpy pro navigaci
 */
function initializeScrollSpy() {
    const scrollSpy = new bootstrap.ScrollSpy(document.body, {
        target: '#navbarMain'
    });
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