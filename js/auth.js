/**
 * Authentication Frontend Module
 * All calls route to /backend/api/api.php?action=...
 */

const AUTH_API = window.location.protocol === 'file:'
    ? 'http://localhost/volunteerconnect/root/backend/api/api.php'
    : './backend/api/api.php';

/* ── Helpers ─────────────────────────────────────────────── */
async function apiCall(action, body = null, method = 'POST') {
    const url = `${AUTH_API}?action=${action}`;
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'same-origin'
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        console.error('Non-JSON response from', action, ':', text);
        throw new Error('Server returned an unexpected response. Please ensure Apache and MySQL are running in XAMPP.');
    }
}

/* ── Login ───────────────────────────────────────────────── */
async function handleLogin(event) {
    if (event && event.preventDefault) event.preventDefault();

    const email    = document.getElementById('loginEmail')?.value.trim() || '';
    const password = document.getElementById('loginPassword')?.value || '';

    if (!email || !password) { toast('Please fill in all fields', 'error'); return; }

    const btn = (event?.target?.querySelector)
        ? event.target.querySelector('button[type="submit"]')
        : document.querySelector('#modal-login button[type="submit"]');

    const orig = btn ? btn.textContent : 'Sign In';
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }

    try {
        const data = await apiCall('login', { email, password });

        if (data.success) {
            // Store session user data
            localStorage.setItem('vc_user', JSON.stringify(data.user));

            // Sync global state
            if (typeof currentUser !== 'undefined') currentUser = data.user;

            updateAuthUI();
            toast(`Welcome back, ${data.user.name.split(' ')[0]}!`, 'success');

            setTimeout(() => {
                if (typeof closeModal === 'function') closeModal();
                if (typeof navigateTo === 'function') navigateTo(dashboardRoute());
            }, 600);
        } else {
            toast(data.message || 'Invalid email or password', 'error');
        }
    } catch (err) {
        toast(err.message || 'Network error. Please ensure XAMPP is running.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
}

/* ── Register ────────────────────────────────────────────── */
async function handleRegister(event) {
    if (event && event.preventDefault) event.preventDefault();

    const role    = document.querySelector('input[name="regRole"]:checked')?.value || 'volunteer';
    const name    = document.getElementById('regName')?.value.trim() || '';
    const email   = document.getElementById('regEmail')?.value.trim() || '';
    const phone   = document.getElementById('regPhone')?.value.trim() || '';
    const address = document.getElementById('regAddress')?.value.trim() || '';
    const description = document.getElementById('regDescription')?.value.trim() || '';
    const category = document.getElementById('regCategory')?.value || 'General';
    const password        = document.getElementById('regPassword')?.value || '';
    const confirmPassword = document.getElementById('regConfirm')?.value || '';

    if (!name || !email || !password || !confirmPassword) {
        toast('Please fill in all fields', 'error'); return;
    }
    if (password.length < 8) { toast('Password must be at least 8 characters', 'error'); return; }
    if (password !== confirmPassword) { toast('Passwords do not match', 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Please enter a valid email', 'error'); return; }

    const btn = (event?.target?.querySelector)
        ? event.target.querySelector('button[type="submit"]')
        : document.querySelector('#modal-register button[type="submit"]');

    const orig = btn ? btn.textContent : 'Create Account';
    if (btn) { btn.disabled = true; btn.textContent = 'Creating account…'; }

    try {
        const data = await apiCall('register', {
            role, name, email, password, confirm_password: confirmPassword,
            phone, address, description, category
        });

        if (data.success) {
            toast(data.message || 'Account created! Please sign in.', 'success');
            if (event?.target?.reset) event.target.reset();

            setTimeout(() => {
                if (typeof closeModal === 'function') closeModal();
                if (typeof showModal === 'function') {
                    showModal('login');
                    const lEmail = document.getElementById('loginEmail');
                    if (lEmail) lEmail.value = email;
                }
            }, 1200);
        } else {
            toast(data.message || 'Registration failed', 'error');
        }
    } catch (err) {
        toast(err.message || 'Network error. Please try again.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = orig; }
    }
}

function contactAdmin() {
    closeModal();
    navigateTo('contact');
    const subject = document.getElementById('contactSubject');
    const message = document.getElementById('contactMessage');
    if (subject) subject.value = 'Password reset request';
    if (message) message.value = 'I need help changing my VolunteerConnect password. Please verify my identity and contact me with the next steps.';
}

/* ── Logout ──────────────────────────────────────────────── */
async function logout() {
    try { await apiCall('logout'); } catch { /* ignore */ }

    localStorage.removeItem('vc_user');
    if (typeof currentUser !== 'undefined') currentUser = null;

    updateAuthUI();
    if (typeof navigateTo === 'function') navigateTo('home');
    toast('Signed out successfully', 'info');
}

/* ── Helpers ─────────────────────────────────────────────── */
function getCurrentUserData() {
    try { return JSON.parse(localStorage.getItem('vc_user') || 'null'); } catch { return null; }
}

function isAuthenticated() {
    return !!getCurrentUserData();
}

function dashboardRoute() {
    const user = getCurrentUserData() || (typeof currentUser !== 'undefined' ? currentUser : null);
    if (!user) return 'home';
    const map = { volunteer: 'volunteer-dashboard', organization: 'org-dashboard', admin: 'admin-dashboard' };
    return map[user.role] || 'home';
}

/* ── Update Nav UI ───────────────────────────────────────── */
function updateAuthUI() {
    const authBtns   = document.getElementById('authButtons');
    const userMenu   = document.getElementById('userMenu');
    const mobileAuth = document.getElementById('mobileAuthBtns');
    const mobileUser = document.getElementById('mobileUserBtns');
    const publicNavLinks = document.querySelectorAll('.public-nav-link');

    const user = getCurrentUserData() || (typeof currentUser !== 'undefined' ? currentUser : null);

    const navAvatar = document.getElementById('avatarInitial');
    if (navAvatar) {
        navAvatar.style.backgroundImage = '';
        navAvatar.classList.remove('profile-avatar-image');
    }

    // Sync global state
    if (typeof currentUser !== 'undefined') currentUser = user;

    if (user) {
        publicNavLinks.forEach(link => link.classList.add('hidden'));
        authBtns?.classList.add('hidden');
        userMenu?.classList.remove('hidden');
        userMenu?.classList.add('flex-row');
        mobileAuth?.classList.add('hidden');
        mobileUser?.classList.remove('hidden');

        const nameEl   = document.getElementById('userName');
        const initEl   = document.getElementById('avatarInitial');
        const firstName = user.name ? user.name.split(' ')[0] : 'User';
        if (nameEl)  nameEl.textContent  = firstName;
        if (initEl)  initEl.textContent  = user.name ? user.name.charAt(0).toUpperCase() : 'U';

        const dashLink = document.getElementById('dashboardLink');
        if (dashLink) dashLink.onclick = () => { if (typeof navigateTo === 'function') navigateTo(dashboardRoute()); };

        // Profile page elements
        const dName = document.getElementById('profileDisplayName');
        if (dName) {
            dName.textContent = user.name;
            const roleMap = { volunteer: 'Volunteer', organization: 'Organization', admin: 'Administrator' };
            const dRole = document.getElementById('profileDisplayRole');
            if (dRole) dRole.textContent = roleMap[user.role] || 'Member';
        }
    } else {
        publicNavLinks.forEach(link => link.classList.remove('hidden'));
        authBtns?.classList.remove('hidden');
        userMenu?.classList.add('hidden');
        userMenu?.classList.remove('flex-row');
        mobileAuth?.classList.remove('hidden');
        mobileUser?.classList.add('hidden');
    }
}

/* ── Verify session on load ──────────────────────────────── */
async function initSession() {
    const saved = getCurrentUserData();
    if (saved) {
        if (typeof currentUser !== 'undefined') currentUser = saved;
        updateAuthUI();

        // Verify with server that session is still valid
        try {
            const res = await apiCall('session', null, 'GET');
            if (!res.logged_in) {
                // Session expired server-side
                localStorage.removeItem('vc_user');
                if (typeof currentUser !== 'undefined') currentUser = null;
                updateAuthUI();
            } else if (typeof navigateTo === 'function') {
                navigateTo(dashboardRoute());
            }
        } catch { /* server unreachable — keep local state */ }
    } else {
        updateAuthUI();
    }
}

/* ── Demo Login ──────────────────────────────────────────── */
function demoLogin(role) {
    const creds = {
        volunteer:    { email: 'volunteer@demo.com', password: 'demo123456' },
        organization: { email: 'org@demo.com',       password: 'demo123456' },
        admin:        { email: 'admin@volunteerconnect.org', password: 'admin123' }
    };
    const c = creds[role];
    if (!c) return;

    const eF = document.getElementById('loginEmail');
    const pF = document.getElementById('loginPassword');
    if (eF) eF.value = c.email;
    if (pF) pF.value = c.password;
    toast(`Filling ${role} demo credentials…`, 'info');
    setTimeout(() => handleLogin({ preventDefault: () => {}, target: document.querySelector('#modal-login form') }), 300);
}

/* ── Init ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    initSession();

    const loginForm = document.querySelector('#modal-login form');
    if (loginForm) loginForm.onsubmit = handleLogin;

    const regForm = document.querySelector('#modal-register form');
    if (regForm) regForm.onsubmit = handleRegister;

    document.querySelectorAll('input[name="regRole"]').forEach((radio) => {
        radio.addEventListener('change', updateRegistrationFields);
    });
    updateRegistrationFields();
});

function updateRegistrationFields() {
    const isOrganization = document.querySelector('input[name="regRole"]:checked')?.value === 'organization';
    document.getElementById('organizationDetails')?.classList.toggle('hidden', !isOrganization);

    const nameLabel = document.getElementById('regNameLabel');
    const nameInput = document.getElementById('regName');
    const nameHint = document.getElementById('regNameHint');
    if (nameLabel) nameLabel.textContent = isOrganization ? 'Organization Name' : 'Full Name';
    if (nameInput) nameInput.placeholder = isOrganization ? 'Your organization name' : 'Your name';
    if (nameHint) nameHint.textContent = isOrganization
        ? 'Use the official name volunteers will see on your organization profile.'
        : 'Use your legal name as it should appear on your profile.';
}

/* ── Exports ─────────────────────────────────────────────── */
window.handleLogin       = handleLogin;
window.handleRegister    = handleRegister;
window.logout            = logout;
window.isAuthenticated   = isAuthenticated;
window.getCurrentUserData= getCurrentUserData;
window.dashboardRoute    = dashboardRoute;
window.demoLogin         = demoLogin;
window.updateAuthUI      = updateAuthUI;
window.apiCall           = apiCall;
