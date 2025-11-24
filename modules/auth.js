import { setCookie, getCookie, deleteCookie } from './utils.js';

// Dependencies to be injected from other modules
let isAdmin;
let loadInitialData;
let showSections;
let GEMINI_PROXY_URL;


export function initAuth(dependencies) {
    isAdmin = dependencies.isAdmin;
    loadInitialData = dependencies.loadInitialData;
    showSections = dependencies.showSections;
    GEMINI_PROXY_URL = dependencies.GEMINI_PROXY_URL;
}

export function showLoginModal() {
    document.getElementById('securityModal').style.display = 'flex';
    const lastUserRole = getCookie('userRole');
    if (lastUserRole) {
        const radio = document.querySelector(`input[name="userType"][value="${lastUserRole}"]`);
        if (radio) {
            radio.checked = true;
        }
    }
}

export function closeLoginModal() {
    document.getElementById('securityModal').style.display = 'none';
}

export function logoff() {
    deleteCookie('isAdmin');
    deleteCookie('userRole'); // Delete userRole cookie
    isAdmin = false; // Update local state
    disableAdminFeatures(); // Immediately disable features
    showLoginModal(); // Show login modal after logoff
    // No need to reload, loadInitialData will be called after successful login
}

export async function enterAdminMode() {
    isAdmin = true;
    enableAdminFeatures();
    await loadInitialData();
}

export async function enterReadOnlyMode() {
    isAdmin = false;
    disableAdminFeatures();
    await loadInitialData();
}

export async function validatePassword() {
    const password = document.getElementById('passwordInput').value;
    const selectedUserType = document.querySelector('input[name="userType"]:checked').value; // Get selected user type

    try {
        const response = await fetch(GEMINI_PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'login', // New action for login
                userType: selectedUserType, // Send user type
                password: password
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error del proxy: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (data.success) { // Assuming backend returns { success: true, role: 'Lector'/'Bibliotecario' }
            closeLoginModal();
            setCookie('userRole', data.role, 7); // Set userRole cookie for 7 days
            if (data.role === 'Bibliotecario') {
                setCookie('isAdmin', 'true', 7); // Set cookie for 7 days
                isAdmin = true;
                enableAdminFeatures();
            } else { // Lector
                deleteCookie('isAdmin'); // Ensure no admin cookie is set
                isAdmin = false;
                disableAdminFeatures();
            }
            
            // Load initial data and render UI based on the new role
            await loadInitialData(); // This will call showSections() internally

        } else {
            alert('Contraseña incorrecta o tipo de usuario inválido.');
        }
    } catch (error) {
        console.error('Error validating password:', error);
        alert('Error al validar la contraseña. Por favor, inténtalo de nuevo.');
    }
}

export function disableAdminFeatures() {
    // Hide all admin-only buttons and controls
    document.querySelectorAll('.admin-control').forEach(button => {
        button.style.display = 'none';
    });

    // Configure the auth button for "Login"
    const authButton = document.getElementById('authButton');
    if (authButton) {
        authButton.innerHTML = '🔒 Login';
        authButton.onclick = showLoginModal;
        authButton.style.display = 'inline-flex';
    }
}

export function enableAdminFeatures() {
    // Show all admin-only buttons and controls
    document.querySelectorAll('.admin-control').forEach(button => {
        button.style.display = 'inline-flex';
    });

    // Configure the auth button for "Logoff"
    const authButton = document.getElementById('authButton');
    if (authButton) {
        authButton.innerHTML = '🔒 Logoff';
        authButton.onclick = logoff;
        authButton.style.display = 'inline-flex';
    }
}
