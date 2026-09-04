// ============================================================
// VolunteerConnect — Frontend Application Logic
// All data is fetched from /backend/api/api.php
// ============================================================

const API = './backend/api/api.php';

// Application State
let currentUser = null;
let currentPage = 'home';
let oppViewMode = 'grid';
let allOpportunities = []; // cached from server
let adminRefreshTimer = null;

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    animateCounterNumbers();
    loadFeaturedOpportunities();
});

// ── Generic fetch helper (used by dashboards) ─────────────────
async function apiFetch(action, params = {}, method = 'GET', body = null) {
    const url = new URL(API, window.location.href);
    url.searchParams.set('action', action);
    if (method === 'GET') Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const opts = {
        method,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'same-origin'
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url.toString(), opts);
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { success: false, message: 'Server error' }; }
}

// ── Navigation Router ─────────────────────────────────────────
function navigateTo(page) {
    const protectedPages = ['volunteer-dashboard', 'org-dashboard', 'admin-dashboard', 'profile'];
    const user = (typeof getCurrentUserData === 'function') ? getCurrentUserData() : currentUser;

    if (protectedPages.includes(page) && !user) { showModal('login'); return; }
    if (page === 'volunteer-dashboard' && user?.role !== 'volunteer') { page = dashboardRoute(); }
    if (page === 'org-dashboard'       && user?.role !== 'organization') { page = dashboardRoute(); }
    if (page === 'admin-dashboard'     && user?.role !== 'admin') { page = dashboardRoute(); }

    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) { target.classList.add('active'); currentPage = page; }

    document.querySelectorAll('.nav-link[data-nav]').forEach(l => l.classList.remove('active'));
    const navMap = { home:'home', opportunities:'opportunities', about:'about', contact:'contact' };
    if (navMap[page]) document.querySelector(`.nav-link[data-nav="${navMap[page]}"]`)?.classList.add('active');

    const footer = document.getElementById('mainFooter');
    if (footer) footer.style.display = ['volunteer-dashboard','org-dashboard','admin-dashboard'].includes(page) ? 'none' : 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (page === 'opportunities') renderOpportunities();
    if (page === 'volunteer-dashboard') initVolunteerDashboard();
    if (page === 'org-dashboard') initOrgDashboard();
    if (page === 'admin-dashboard') initAdminDashboard();
    if (page === 'profile') initProfile();
}

function dashboardRoute() {
    const user = (typeof getCurrentUserData === 'function') ? getCurrentUserData() : currentUser;
    if (!user) return 'home';
    if (user.role === 'admin') return 'admin-dashboard';
    if (user.role === 'organization') return 'org-dashboard';
    return 'volunteer-dashboard';
}

// ── Mobile Menu ───────────────────────────────────────────────
let mobileMenuOpen = false;
function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
    document.getElementById('mobileMenu').classList.toggle('hidden', !mobileMenuOpen);
    document.getElementById('mobileMenuIcon').className = mobileMenuOpen ? 'fas fa-times' : 'fas fa-bars';
}

// ── Org Tab Switcher ──────────────────────────────────────────
function switchOrgTab(tabName, btn) {
    document.querySelectorAll('#page-org-dashboard .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('org-tab-opps').classList.add('hidden');
    document.getElementById('org-tab-apps').classList.add('hidden');
    document.getElementById('org-tab-' + tabName)?.classList.remove('hidden');
}


// ── User Dropdown ─────────────────────────────────────────────
function toggleUserDropdown() {
    document.getElementById('userDropdown').classList.toggle('hidden');
}
document.addEventListener('click', (e) => {
    if (!e.target.closest('#userAvatarBtn') && !e.target.closest('#userDropdown')) {
        document.getElementById('userDropdown')?.classList.add('hidden');
    }
});

// ── Modals ────────────────────────────────────────────────────
function showModal(type) { closeModal(); document.getElementById('modal-' + type)?.classList.remove('hidden'); }
function closeModal() { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden')); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// ── Toasts ────────────────────────────────────────────────────
function toast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const icons = { success:'fa-check-circle', error:'fa-exclamation-circle', info:'fa-info-circle' };
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(100px)'; t.style.transition='all 0.3s'; setTimeout(() => t.remove(), 300); }, 3500);
}

// ── Opportunity Rendering ─────────────────────────────────────
function renderOppCard(opp) {
    const pct = opp.spots > 0 ? Math.min(100, Math.round((opp.filled / opp.spots) * 100)) : 0;
    const catIcons  = { Environment:'fa-leaf', Education:'fa-graduation-cap', Healthcare:'fa-heartbeat', Community:'fa-hands-helping', Technology:'fa-laptop-code', Animals:'fa-paw' };
    const catColors = { Environment:'success', Education:'warning', Healthcare:'danger', Community:'success', Technology:'info', Animals:'warning' };
    const color = catColors[opp.category] || 'success';
    const icon  = catIcons[opp.category]  || 'fa-circle';
    return `
    <div class="card-hover bg-white card-box" style="padding:1.5rem;">
      <div class="flex-row items-center justify-between mb-4">
        <span class="badge badge-${color}"><i class="fas ${icon} mr-1"></i>${opp.category}</span>
        ${opp.urgent ? '<span class="badge badge-danger">Urgent</span>' : ''}
      </div>
      <h3 class="font-bold text-lg mb-1">${escHtml(opp.title)}</h3>
      <p class="text-sm text-muted mb-3">${escHtml(opp.org || opp.org_name || '')}</p>
      <p class="text-sm text-muted mb-4" style="line-height:1.5;height:3rem;overflow:hidden;">${escHtml(opp.desc || opp.description || '')}</p>
      <div class="progress-bar mb-2"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
      <div class="flex-row items-center justify-between text-xs text-muted mb-4">
        <span>${opp.filled} of ${opp.spots} spots filled</span>
        <span class="font-semibold text-primary">${opp.time || opp.time_commitment || ''}</span>
      </div>
      <button class="btn btn-primary btn-sm w-full" onclick="showOppDetail(${opp.id})">View Details</button>
    </div>`;
}

async function loadFeaturedOpportunities() {
    const container = document.getElementById('featuredOpsGrid');
    if (!container) return;
    try {
        const data = await apiFetch('opportunities');
        if (data.success && data.opportunities) {
            allOpportunities = data.opportunities;
            const urgent = data.opportunities.filter(o => o.urgent).slice(0, 3);
            const display = urgent.length ? urgent : data.opportunities.slice(0, 3);
            container.innerHTML = display.map(renderOppCard).join('');
        }
    } catch {
        container.innerHTML = '<div class="text-muted text-center">Could not load opportunities.</div>';
    }
}

async function renderOpportunities() {
    filterOpportunities();
}

async function filterOpportunities() {
    const search = document.getElementById('oppSearchInput')?.value.trim() || '';
    const cat    = document.getElementById('oppCategoryFilter')?.value || '';
    const loc    = document.getElementById('oppLocationFilter')?.value || '';
    const time   = document.getElementById('oppTimeFilter')?.value || '';

    const container = document.getElementById('opportunitiesGrid');
    const count     = document.getElementById('oppResultCount');
    if (container) container.innerHTML = '<div class="text-center text-muted py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Loading…</div>';

    try {
        const params = {};
        if (search) params.search   = search;
        if (cat)    params.category = cat;
        if (loc)    params.location = loc;
        if (time)   params.time     = time;

        const data = await apiFetch('opportunities', params);
        allOpportunities = data.opportunities || [];

        if (count) count.textContent = `Showing ${allOpportunities.length} opportunities`;
        if (container) {
            container.innerHTML = allOpportunities.length
                ? allOpportunities.map(renderOppCard).join('')
                : '<div class="col-span-3 text-center py-12 text-muted">No opportunities found matching your filters.</div>';
        }
    } catch {
        if (container) container.innerHTML = '<div class="text-center text-muted py-8">Could not load opportunities. Please ensure XAMPP is running.</div>';
    }
}

function setOppView(mode) {
    oppViewMode = mode;
    document.getElementById('gridViewBtn').classList.toggle('active', mode === 'grid');
    document.getElementById('listViewBtn').classList.toggle('active', mode === 'list');
}

function showOppDetail(id) {
    const opp = allOpportunities.find(o => String(o.id) === String(id));
    if (!opp) { toast('Opportunity not found', 'error'); return; }

    const content = document.getElementById('oppDetailContent');
    const spots = parseInt(opp.spots || opp.spots_needed || 0);
    const filled = parseInt(opp.filled || opp.spots_filled || 0);
    content.innerHTML = `
    <div class="modal-header">
      <h2 class="font-display text-2xl font-black">${escHtml(opp.title)}</h2>
      <button class="close-btn" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="mb-4">
      <span class="badge badge-success mb-2">${escHtml(opp.category)}</span>
      <p class="text-sm text-muted">Hosted by <strong>${escHtml(opp.org || opp.org_name || '')}</strong></p>
    </div>
    <p class="text-muted leading-relaxed mb-6">${escHtml(opp.desc || opp.description || '')}</p>
    <div class="grid grid-2 gap-4 mb-6 bg-forest-light p-4 rounded-xl">
      <div><span class="text-xs text-muted block">Location</span><strong>${escHtml(opp.location)}</strong></div>
      <div><span class="text-xs text-muted block">Commitment</span><strong>${escHtml(opp.time || opp.time_commitment || '')}</strong></div>
      <div><span class="text-xs text-muted block">Start Date</span><strong>${escHtml(opp.date || opp.start_date || '')}</strong></div>
      <div><span class="text-xs text-muted block">Spots Available</span><strong>${spots - filled} left of ${spots}</strong></div>
    </div>
    <button class="btn btn-primary w-full" onclick="applyToOpp(${opp.id})">Apply Now</button>`;
    showModal('opportunityDetail');
}

async function applyToOpp(id) {
    const user = typeof getCurrentUserData === 'function' ? getCurrentUserData() : currentUser;
    if (!user) { closeModal(); showModal('login'); return; }

    try {
        const data = await apiFetch('apply', {}, 'POST', { opportunity_id: id });
        if (data.success) {
            toast(data.message || 'Application submitted!', 'success');
            closeModal();
        } else {
            toast(data.message || 'Could not apply.', 'error');
        }
    } catch (err) {
        toast('Network error. Please try again.', 'error');
    }
}

// ── Volunteer Dashboard ───────────────────────────────────────
async function initVolunteerDashboard() {
    const user = typeof getCurrentUserData === 'function' ? getCurrentUserData() : currentUser;
    if (!user) return;

    const nameEl = document.getElementById('volDashName');
    if (nameEl) nameEl.textContent = user.name;

    // Load stats
    try {
        const s = await apiFetch('stats');
        if (s.success && s.stats) {
            const st = s.stats;
            setEl('volStatApps',   st.total_apps || 0);
            setEl('volStatActive', st.approved   || 0);
            setEl('volStatHours',  0);
            setEl('volStatImpact', '—');
        }
    } catch { /* ignore */ }

    // Load applications
    try {
        const a = await apiFetch('my_applications');
        if (a.success) renderVolAppsTable(a.applications || []);
    } catch {
        renderVolAppsTable([]);
    }
}

function filterVolApps() {
    // Re-fetch from the table rows (simple client-side filter)
    const search = document.getElementById('volAppSearch')?.value.toLowerCase() || '';
    const rows = document.querySelectorAll('#volAppsTableBody tr[data-title]');
    rows.forEach(row => {
        const match = row.dataset.title?.toLowerCase().includes(search) || row.dataset.org?.toLowerCase().includes(search);
        row.style.display = match ? '' : 'none';
    });
}

function renderVolAppsTable(apps) {
    const tbody = document.getElementById('volAppsTableBody');
    if (!tbody) return;
    if (!apps.length) { tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No applications found.</td></tr>'; return; }

    tbody.innerHTML = apps.map(a => {
        const badge = a.status === 'approved' ? 'badge-success' : a.status === 'pending' ? 'badge-warning' : a.status === 'rejected' ? 'badge-danger' : 'badge-info';
        return `<tr data-title="${escHtml(a.title||'')}" data-org="${escHtml(a.org||'')}">
          <td><strong>${escHtml(a.title || 'N/A')}</strong></td>
          <td>${escHtml(a.org || 'N/A')}</td>
          <td>${fmtDate(a.applied)}</td>
          <td><span class="badge ${badge}">${a.status}</span></td>
          <td><span class="text-xs text-muted">${a.location||'—'}</span></td>
        </tr>`;
    }).join('');
}

// ── Organization Dashboard ────────────────────────────────────
async function initOrgDashboard() {
    const user = typeof getCurrentUserData === 'function' ? getCurrentUserData() : currentUser;
    if (!user || user.role !== 'organization') return;

    // Stats
    try {
        const s = await apiFetch('stats');
        if (s.success && s.stats) {
            setEl('orgStatListings',   s.stats.active_listings  || 0);
            setEl('orgStatApplicants', s.stats.applicants       || 0);
            setEl('orgStatVolunteers', s.stats.active_volunteers || 0);
        }
    } catch { /* ignore */ }

    // Opportunities table
    try {
        const o = await apiFetch('org_opportunities');
        if (o.success) renderOrgOppsTable(o.opportunities || []);
    } catch {
        renderOrgOppsTable([]);
    }

    // Applications tab
    try {
        const a = await apiFetch('org_applications');
        if (a.success) renderOrgAppsTable(a.applications || []);
    } catch { /* ignore */ }
}

function filterOrgOpps() {
    const search = document.getElementById('orgOppSearch')?.value.toLowerCase() || '';
    document.querySelectorAll('#orgOppsTableBody tr[data-title]').forEach(row => {
        row.style.display = row.dataset.title?.toLowerCase().includes(search) ? '' : 'none';
    });
}

let _orgOpps = [];
function renderOrgOppsTable(opps) {
    _orgOpps = opps;
    const tbody = document.getElementById('orgOppsTableBody');
    if (!tbody) return;
    if (!opps.length) { tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No listings found. Create your first opportunity!</td></tr>'; return; }

    tbody.innerHTML = opps.map(o => {
        const spots  = parseInt(o.spots_needed || o.spots || 0);
        const filled = parseInt(o.spots_filled || o.filled || 0);
        const sBadge = o.status === 'active' ? 'badge-success' : 'badge-danger';
        return `<tr data-title="${escHtml(o.title)}">
          <td><strong>${escHtml(o.title)}</strong></td>
          <td><span class="badge badge-success">${escHtml(o.category)}</span></td>
          <td>${filled} / ${spots}</td>
          <td><span class="badge ${sBadge}">${o.status}</span></td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="openEditOppModal(${o.id})">Edit</button>
            <button class="btn btn-sm" style="background:#fee2e2;color:#b91c1c;margin-left:4px;" onclick="closeOpp(${o.id})">Close</button>
          </td>
        </tr>`;
    }).join('');
}

function renderOrgAppsTable(apps) {
    const tbody = document.getElementById('orgAppsTableBody');
    if (!tbody) return;
    if (!apps.length) { tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No applications yet.</td></tr>'; return; }

    tbody.innerHTML = apps.map(a => {
        const badge = a.status==='approved'?'badge-success':a.status==='pending'?'badge-warning':a.status==='rejected'?'badge-danger':'badge-info';
        return `<tr>
          <td><strong>${escHtml(a.volunteer_name||'N/A')}</strong><div class="text-xs text-muted">${escHtml(a.volunteer_email||'')}</div></td>
          <td>${escHtml(a.title||'')}</td>
          <td>${fmtDate(a.applied_at)}</td>
          <td><span class="badge ${badge}">${a.status}</span></td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="updateOrgApp(${a.id},'approved')">Approve</button>
            <button class="btn btn-outline btn-sm" style="margin-left:4px;" onclick="updateOrgApp(${a.id},'rejected')">Reject</button>
          </td>
        </tr>`;
    }).join('');
}

async function updateOrgApp(appId, status) {
    try {
        const data = await apiFetch('update_application', {}, 'POST', { application_id: appId, status });
        if (data.success) {
            toast(data.message, 'success');
            const a = await apiFetch('org_applications');
            if (a.success) renderOrgAppsTable(a.applications || []);
        } else {
            toast(data.message || 'Failed to update.', 'error');
        }
    } catch { toast('Network error.', 'error'); }
}

async function closeOpp(id) {
    if (!confirm('Are you sure you want to close this opportunity?')) return;
    const data = await apiFetch('delete_opportunity', {}, 'POST', { id });
    if (data.success) {
        toast(data.message, 'success');
        const o = await apiFetch('org_opportunities');
        if (o.success) renderOrgOppsTable(o.opportunities || []);
    } else {
        toast(data.message || 'Failed.', 'error');
    }
}

function openEditOppModal(id) {
    const opp = _orgOpps.find(o => String(o.id) === String(id));
    if (!opp) return;
    // Populate modal and set edit mode
    document.getElementById('oppTitle').value    = opp.title;
    document.getElementById('oppCategory').value = opp.category;
    document.getElementById('oppLocation').value = opp.location;
    document.getElementById('oppTime').value     = opp.time_commitment;
    document.getElementById('oppSpots').value    = opp.spots_needed || opp.spots;
    document.getElementById('oppDate').value     = opp.start_date || opp.date || '';
    document.getElementById('oppDesc').value     = opp.description || opp.desc || '';
    const form = document.querySelector('#modal-createOpportunity form');
    if (form) form.dataset.editId = id;
    document.querySelector('#modal-createOpportunity h2').textContent = 'Edit Opportunity';
    showModal('createOpportunity');
}

// ── Create / Edit Opportunity ─────────────────────────────────
async function handleCreateOpportunity(e) {
    e.preventDefault();
    const form    = e.target;
    const editId  = form.dataset.editId;

    const payload = {
        title:       document.getElementById('oppTitle').value,
        category:    document.getElementById('oppCategory').value,
        location:    document.getElementById('oppLocation').value,
        time:        document.getElementById('oppTime').value,
        spots:       parseInt(document.getElementById('oppSpots').value),
        date:        document.getElementById('oppDate').value,
        description: document.getElementById('oppDesc').value,
    };

    const action = editId ? 'update_opportunity' : 'create_opportunity';
    if (editId) payload.id = editId;

    try {
        const data = await apiFetch(action, {}, 'POST', payload);
        if (data.success) {
            toast(data.message, 'success');
            form.reset();
            delete form.dataset.editId;
            document.querySelector('#modal-createOpportunity h2').textContent = 'Create Opportunity';
            closeModal();
            initOrgDashboard();
        } else {
            toast(data.message || 'Failed.', 'error');
        }
    } catch { toast('Network error.', 'error'); }
}

// ── Admin Dashboard ───────────────────────────────────────────
async function initAdminDashboard() {
    const user = typeof getCurrentUserData === 'function' ? getCurrentUserData() : currentUser;
    if (!user || user.role !== 'admin') return;

    // Load stats
    await loadAdminStats();

    // Load users table
    await loadAdminUsers();
    // Load orgs tab
    await loadAdminOrgs();
    // Load pending requests
    await loadAdminPendingOrgs();
    // Load opportunities
    await loadAdminOpportunities();

    // Keep the admin view current when a registration is submitted elsewhere.
    if (!adminRefreshTimer) {
        adminRefreshTimer = setInterval(() => {
            if (currentPage === 'admin-dashboard') {
                loadAdminStats();
                loadAdminPendingOrgs();
                loadAdminOrgs();
                loadAdminOpportunities();
            }
        }, 10000);
    }
}

async function loadAdminStats() {
    try {
        const s = await apiFetch('admin_stats');
        if (!s.success) throw new Error(s.message || 'Could not load admin statistics.');
        setEl('adminStatUsers', s.stats.total_volunteers ?? '—');
        setEl('adminStatOrgs', s.stats.total_orgs ?? '—');
        setEl('adminStatOpps', s.stats.active_opportunities ?? '—');
        setEl('adminStatPending', s.stats.pending_orgs ?? '—');
        const pendingCount = parseInt(s.stats.pending_orgs || 0);
        const badge = document.getElementById('adminPendingBadge');
        if (badge) {
            badge.textContent = pendingCount;
            badge.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
        }
    } catch (error) {
        toast(error.message, 'error');
    }
}

async function loadAdminUsers() {
    try {
        const data = await apiFetch('admin_users');
        if (data.success) renderAdminUsersTable(data.users || []);
    } catch { renderAdminUsersTable([]); }
}

async function loadAdminOrgs() {
    try {
        const data = await apiFetch('admin_orgs');
        if (data.success) renderAdminOrgsTable(data.organizations || []);
    } catch { renderAdminOrgsTable([]); }
}

async function loadAdminPendingOrgs() {
    try {
        const data = await apiFetch('admin_pending_orgs');
        if (!data.success) throw new Error(data.message || 'Could not load organization requests.');
        renderAdminPendingOrgsTable(data.organizations || []);
    } catch (error) {
        renderAdminPendingOrgsError(error.message);
    }
}

function renderAdminPendingOrgsError(message) {
    const tbody = document.getElementById('adminPendingOrgsTableBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-8">${escHtml(message || 'Could not load organization requests.')}</td></tr>`;
}

async function loadAdminOpportunities() {
    try {
        const data = await apiFetch('admin_opportunities');
        if (data.success) renderAdminOppsTable(data.opportunities || []);
    } catch { /* ignore */ }
}

function switchAdminTab(tabName, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById('admin-tab-' + tabName)?.classList.remove('hidden');

    // Reload data when switching tabs
    if (tabName === 'pending') loadAdminPendingOrgs();
    if (tabName === 'orgs') loadAdminOrgs();
    if (tabName === 'users') loadAdminUsers();
    if (tabName === 'opps') loadAdminOpportunities();
}

function filterAdminUsers() {
    const search = document.getElementById('adminUserSearch')?.value.toLowerCase() || '';
    const role   = document.getElementById('adminRoleFilter')?.value || '';
    document.querySelectorAll('#adminUsersTableBody tr[data-name]').forEach(row => {
        const matchSearch = row.dataset.name?.includes(search) || row.dataset.email?.includes(search);
        const matchRole   = !role || row.dataset.role === role;
        row.style.display = matchSearch && matchRole ? '' : 'none';
    });
}

function renderAdminUsersTable(users) {
    const tbody = document.getElementById('adminUsersTableBody');
    if (!tbody) return;
    if (!users.length) { tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No users found.</td></tr>'; return; }

    tbody.innerHTML = users.map(u => {
        const sBadge = u.status === 'active' ? 'badge-success' : u.status === 'suspended' ? 'badge-danger' : 'badge-warning';
        const isActive = u.status === 'active';
        return `<tr data-name="${escHtml((u.name||'').toLowerCase())}" data-email="${escHtml((u.email||'').toLowerCase())}" data-role="${u.role}">
          <td><strong>${escHtml(u.name||'')}</strong></td>
          <td class="text-sm">${escHtml(u.email||'')}</td>
          <td><span class="badge badge-info">${u.role}</span></td>
          <td>${fmtDate(u.created_at)}</td>
          <td><span class="badge ${sBadge}">${u.status}</span></td>
          <td>
            <button class="btn btn-sm ${isActive ? '' : 'btn-primary'}" style="${isActive?'background:#fef3c7;color:#92400e;':''}; padding:4px 10px; font-size:12px;"
              onclick="toggleUserStatus('${u.role}',${u.id},'${isActive?'suspended':'active'}')">
              ${isActive ? 'Suspend' : 'Activate'}
            </button>
          </td>
        </tr>`;
    }).join('');
}

async function toggleUserStatus(role, id, newStatus) {
    if (!confirm(`Set user status to "${newStatus}"?`)) return;
    const data = await apiFetch('admin_toggle_user', {}, 'POST', { role, id, status: newStatus });
    if (data.success) { toast(data.message, 'success'); loadAdminUsers(); }
    else toast(data.message || 'Failed.', 'error');
}

function renderAdminOrgsTable(orgs) {
    const tbody = document.getElementById('adminOrgsTableBody');
    if (!tbody) return;
    if (!orgs.length) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No organizations found.</td></tr>'; return; }

    tbody.innerHTML = orgs.map(o => {
        const sBadge = o.status === 'active' ? 'badge-success' : o.status === 'pending' ? 'badge-warning' : 'badge-danger';
        return `<tr>
          <td><strong>${escHtml(o.name)}</strong><div class="text-xs text-muted">${escHtml(o.category||'')}</div></td>
          <td class="text-sm">${escHtml(o.email)}</td>
          <td>${o.opportunities || 0}</td>
          <td>${o.volunteers || 0}</td>
          <td><span class="badge ${sBadge}">${o.status}</span></td>
          <td>
            ${o.status === 'active'
                ? `<button class="btn btn-sm" style="background:#fef3c7;color:#92400e;padding:4px 10px;font-size:12px;" onclick="verifyOrg(${o.id},'rejected')">Suspend</button>`
                : `<button class="btn btn-primary btn-sm" style="padding:4px 10px;font-size:12px;" onclick="verifyOrg(${o.id},'active')">Activate</button>`
            }
          </td>
        </tr>`;
    }).join('');
}

function renderAdminPendingOrgsTable(orgs) {
    const tbody = document.getElementById('adminPendingOrgsTableBody');
    if (!tbody) return;

    // Update tab badge
    const badge = document.getElementById('adminPendingBadge');
    if (badge) { badge.textContent = orgs.length; badge.style.display = orgs.length > 0 ? 'inline-flex' : 'none'; }

    if (!orgs.length) {
        tbody.innerHTML = `<tr><td colspan="6">
          <div class="text-center py-12 text-muted">
            <i class="fas fa-check-circle text-4xl text-primary mb-3 block"></i>
            <p>No pending organization requests</p>
          </div>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = orgs.map(o => `<tr>
      <td>
        <strong>${escHtml(o.name)}</strong>
        <div class="text-xs text-muted">${escHtml(o.category||'General')}</div>
      </td>
      <td class="text-sm">${escHtml(o.email)}</td>
      <td class="text-sm">${escHtml(o.phone||'—')}</td>
      <td class="text-sm" style="max-width:200px;white-space:normal;">${escHtml((o.description||'—').substring(0, 80))}${(o.description||'').length > 80 ? '…' : ''}</td>
      <td>${fmtDate(o.created_at)}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="verifyOrg(${o.id},'active')" style="margin-right:6px;">
          <i class="fas fa-check mr-1"></i>Approve
        </button>
        <button class="btn btn-sm" style="background:#fee2e2;color:#b91c1c;" onclick="verifyOrg(${o.id},'rejected')">
          <i class="fas fa-times mr-1"></i>Reject
        </button>
      </td>
    </tr>`).join('');
}

async function verifyOrg(id, status) {
    const action = status === 'active' ? 'approve' : 'reject';
    if (!confirm(`Are you sure you want to ${action} this organization?`)) return;
    const data = await apiFetch('admin_verify_org', {}, 'POST', { id, status });
    if (data.success) {
        toast(data.message, 'success');
        // Reload both tabs
        await loadAdminPendingOrgs();
        await loadAdminOrgs();
        // Refresh stats
        try {
            const s = await apiFetch('admin_stats');
            if (s.success) {
                const pending = parseInt(s.stats.pending_orgs || 0);
                const badge = document.getElementById('adminPendingBadge');
                if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? 'inline-flex' : 'none'; }
                setEl('adminStatPending', pending);
                setEl('adminStatOrgs', s.stats.total_orgs ?? '—');
            }
        } catch { /* ignore */ }
    } else {
        toast(data.message || 'Failed.', 'error');
    }
}

function renderAdminOppsTable(opps) {
    const tbody = document.getElementById('adminOppsTableBody');
    if (!tbody) return;
    if (!opps.length) { tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No opportunities found.</td></tr>'; return; }

    tbody.innerHTML = opps.map(o => {
        const sBadge = o.status === 'active' ? 'badge-success' : 'badge-danger';
        return `<tr>
          <td><strong>${escHtml(o.title)}</strong></td>
          <td>${escHtml(o.org_name||'')}</td>
          <td><span class="badge badge-info">${escHtml(o.category)}</span></td>
          <td><span class="badge ${sBadge}">${o.status}</span></td>
          <td class="text-sm">${o.applicant_count||0} applicants</td>
        </tr>`;
    }).join('');
}

// ── Profile ───────────────────────────────────────────────────
async function initProfile() {
    const user = typeof getCurrentUserData === 'function' ? getCurrentUserData() : currentUser;
    if (!user) return;

    try {
        const data = await apiFetch('profile');
        if (data.success && data.profile) {
            const p = data.profile;
            setEl('profileDisplayName', p.name || '');
            setEl('profileDisplayRole', { volunteer:'Volunteer', organization:'Organization', admin:'Administrator' }[user.role] || '');
            setEl('profileAvatar', (p.name||'U')[0].toUpperCase());
            setEl('profileDisplayLocation', p.location || p.address || '—');

            const parts = (p.name||'').split(' ');
            setVal('profileFirstName', parts[0] || '');
            setVal('profileLastName',  parts.slice(1).join(' ') || '');
            setVal('profileEmail',     p.email || '');
            setVal('profilePhone',     p.phone || '');
            setVal('profileLocation',  p.location || p.address || '');
            setVal('profileBio',       p.bio || p.description || '');
            setVal('profileSkills',    p.skills || '');
        }
    } catch { /* ignore */ }
}

async function handleProfileSave(e) {
    e.preventDefault();
    const user = typeof getCurrentUserData === 'function' ? getCurrentUserData() : currentUser;
    if (!user) return;

    const first = document.getElementById('profileFirstName')?.value || '';
    const last  = document.getElementById('profileLastName')?.value  || '';
    const payload = {
        name:     `${first} ${last}`.trim(),
        email:    document.getElementById('profileEmail')?.value    || '',
        phone:    document.getElementById('profilePhone')?.value    || '',
        location: document.getElementById('profileLocation')?.value || '',
        bio:      document.getElementById('profileBio')?.value      || '',
        skills:   document.getElementById('profileSkills')?.value   || '',
    };

    try {
        const data = await apiFetch('profile_update', {}, 'POST', payload);
        if (data.success) {
            if (data.user) {
                localStorage.setItem('vc_user', JSON.stringify(data.user));
                if (typeof currentUser !== 'undefined') currentUser = data.user;
            }
            if (typeof updateAuthUI === 'function') updateAuthUI();
            toast('Profile updated successfully!', 'success');
            initProfile();
        } else {
            toast(data.message || 'Update failed.', 'error');
        }
    } catch { toast('Network error.', 'error'); }
}

// ── Contact Form ──────────────────────────────────────────────
function handleContactForm(e) {
    e.preventDefault();
    toast('Thank you for reaching out! We will reply shortly.', 'success');
    e.target.reset();
}

// ── Animated Counters ─────────────────────────────────────────
function animateCounterNumbers() {
    document.querySelectorAll('[data-count]').forEach(el => {
        const target = parseInt(el.getAttribute('data-count'));
        let current = 0;
        const step = Math.ceil(target / 50);
        const timer = setInterval(() => {
            current += step;
            if (current >= target) { el.textContent = target.toLocaleString(); clearInterval(timer); }
            else el.textContent = current.toLocaleString();
        }, 30);
    });
}

// ── Utility Helpers ───────────────────────────────────────────
function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(str) {
    if (!str) return '—';
    try { return new Date(str).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }); }
    catch { return str; }
}

function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}