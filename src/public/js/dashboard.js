/**
 * APK Marketing Dashboard - hlavní JavaScript soubor
 * Obsahuje funkce pro práci s dashboardem a jeho komponentami
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard.js načten - inicializace dashboardu');
    
    // Inicializace komponent dashboardu
    initDashboard();
    
    // Zvýraznění aktivní položky v menu
    highlightActiveMenuItem();
});

/**
 * Inicializace funkcí a komponent dashboardu
 */
function initDashboard() {
    // Mobilní menu toggle
    const sidebarToggle = document.querySelector('.navbar-toggler');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            document.querySelector('.sidebar').classList.toggle('show-sidebar');
        });
    }
    
    // Inicializace tooltipů
    initTooltips();
    
    // Nastavení kontroly stavu uživatele
    checkUserSession();
    
    console.log('Dashboard inicializován');
}

/**
 * Inicializace Bootstrap tooltipů
 */
function initTooltips() {
    // Pokud existuje Bootstrap Tooltip
    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
        const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltips.forEach(tooltip => {
            new bootstrap.Tooltip(tooltip);
        });
    }
}

/**
 * Zvýraznění aktivní položky v menu podle aktuální URL
 */
function highlightActiveMenuItem() {
    const currentPath = window.location.pathname;
    
    // Odstranění aktivní třídy ze všech odkazů
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Nalezení odpovídajícího odkazu a přidání aktivní třídy
    document.querySelectorAll('.sidebar-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || (href !== '/dashboard' && currentPath.startsWith(href))) {
            link.classList.add('active');
        } else if (href === '/dashboard' && currentPath === '/dashboard') {
            link.classList.add('active');
        }
    });
}

/**
 * Kontrola stavu uživatelské session
 */
function checkUserSession() {
    // Kontrola existence tokenu v localStorage
    const token = localStorage.getItem('authToken');
    
    if (!token) {
        console.warn('Autentizační token nenalezen v localStorage');
    }
    
    // Každých 5 minut zkontrolovat, zda je uživatel stále přihlášen
    setInterval(validateSession, 5 * 60 * 1000);
}

/**
 * Ověření platnosti uživatelské session
 */
function validateSession() {
    fetch('/api/auth/validate', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            console.warn('Session již není platná, přesměrování na přihlášení');
            window.location.href = '/prihlaseni';
        }
    })
    .catch(error => {
        console.error('Chyba při ověřování session:', error);
    });
}