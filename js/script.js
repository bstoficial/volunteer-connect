// ============================================================
// VolunteerConnect — Frontend Application Logic
// All data is fetched from /backend/api/api.php
// ============================================================

const API = './backend/api/api.php';
const NEPAL_DISTRICTS = [
    'Achham', 'Arghakhanchi', 'Baglung', 'Baitadi', 'Bajhang', 'Bajura', 'Banke', 'Bara',
    'Bardiya', 'Bhaktapur', 'Bhojpur', 'Chitwan', 'Dadeldhura', 'Dailekh', 'Dang', 'Darchula',
    'Dhading', 'Dhankuta', 'Dhanusha', 'Dolakha', 'Dolpa', 'Doti', 'Gorkha', 'Gulmi', 'Humla',
    'Ilam', 'Jajarkot', 'Jhapa', 'Jumla', 'Kailali', 'Kalikot', 'Kanchanpur', 'Kapilvastu', 'Kaski',
    'Kathmandu', 'Kavrepalanchok', 'Khotang', 'Lalitpur', 'Lamjung', 'Mahottari', 'Makwanpur',
    'Manang', 'Morang', 'Mugu', 'Mustang', 'Myagdi', 'Nawalpur', 'Nuwakot', 'Okhaldhunga',
    'Palpa', 'Panchthar', 'Parasi', 'Parbat', 'Parsa', 'Pokhara', 'Pyuthan', 'Ramechhap', 'Rasuwa',
    'Rautahat', 'Rolpa', 'Rukum East', 'Rukum West', 'Rupandehi', 'Salyan', 'Sankhuwasabha',
    'Saptari', 'Sarlahi', 'Sindhuli', 'Sindhupalchok', 'Siraha', 'Solukhumbu', 'Sunsari',
    'Surkhet', 'Syangja', 'Tanahun', 'Taplejung', 'Tehrathum', 'Udayapur'
];
const OPPORTUNITY_TIMES = ['Morning', 'Afternoon', 'Evening', 'Night'];

function populateOpportunityOptions() {
    const locationOptions = '<option value="">Select...</option>' + NEPAL_DISTRICTS
        .concat('Remote').map(location => `<option value="${location}">${location}</option>`).join('');
    const filterLocationOptions = '<option value="">All Locations</option>' + NEPAL_DISTRICTS
        .concat('Remote').map(location => `<option value="${location}">${location}</option>`).join('');
    const timeOptions = '<option value="">Select...</option>' + OPPORTUNITY_TIMES
        .map(time => `<option value="${time}">${time}</option>`).join('');
    const filterTimeOptions = '<option value="">Any Time</option>' + OPPORTUNITY_TIMES
        .map(time => `<option value="${time}">${time}</option>`).join('');
    const locationFilter = document.getElementById('oppLocationFilter');
    const locationInput = document.getElementById('oppLocation');
    const timeFilter = document.getElementById('oppTimeFilter');
    const timeInput = document.getElementById('oppTime');
    if (locationFilter) locationFilter.innerHTML = filterLocationOptions;
    if (locationInput) locationInput.innerHTML = locationOptions;
    if (timeFilter) timeFilter.innerHTML = filterTimeOptions;
    if (timeInput) timeInput.innerHTML = timeOptions;
}

// Application State
let currentUser = null;
let currentPage = 'home';
let allOpportunities = []; // cached from server
let adminRefreshTimer = null;
let opportunityRefreshTimer = null;
let opportunityFilterTimer = null;

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    populateOpportunityOptions();
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
        headers: body instanceof FormData ? { 'Accept': 'application/json' } : { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'same-origin'
    };
    if (body) opts.body = body instanceof FormData ? body : JSON.stringify(body);

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

    if (opportunityRefreshTimer) {
        clearInterval(opportunityRefreshTimer);
        opportunityRefreshTimer = null;
    }
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
    document.getElementById('org-tab-all-opps').classList.add('hidden');
    document.getElementById('org-tab-' + tabName)?.classList.remove('hidden');
    if (tabName === 'all-opps') loadOrgAllOpportunities();
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
            ${opp.review_count ? `<div class="text-sm text-accent mb-4"><i class="fas fa-star mr-1"></i>${opp.average_rating}/5 (${opp.review_count} review${opp.review_count === 1 ? '' : 's'})</div>` : ''}
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
            const topRated = data.opportunities
                .filter(opportunity => Number(opportunity.review_count) > 0)
                .sort((first, second) => Number(second.average_rating || 0) - Number(first.average_rating || 0)
                    || Number(second.review_count || 0) - Number(first.review_count || 0))
                .slice(0, 3);
            container.innerHTML = topRated.length
                ? topRated.map(renderOppCard).join('')
                : '<div class="col-span-3 text-center text-muted py-8">Top rated opportunities will appear here after volunteers submit reviews.</div>';
        }
    } catch {
        container.innerHTML = '<div class="text-muted text-center">Could not load opportunities.</div>';
    }
}

async function renderOpportunities() {
    filterOpportunities();
}

function filterOpportunities() {
    clearTimeout(opportunityFilterTimer);
    opportunityFilterTimer = setTimeout(loadFilteredOpportunities, 250);
}

async function loadFilteredOpportunities() {
    const search = document.getElementById('oppSearchInput')?.value.trim() || '';
    const cat    = document.getElementById('oppCategoryFilter')?.value || '';
    const loc    = document.getElementById('oppLocationFilter')?.value || '';
    const time   = document.getElementById('oppTimeFilter')?.value || '';

    const container = document.getElementById('opportunitiesGrid');
    const count     = document.getElementById('oppResultCount');

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

function updateOpportunityMapPreview() {
    const input = document.getElementById('oppMapUrl');
    const previewBox = document.getElementById('oppMapPreviewBox');
    const preview = document.getElementById('oppMapPreview');
    if (!input || !previewBox || !preview) return;

    try {
        const url = new URL(input.value.trim());
        const allowedHosts = ['google.com', 'www.google.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl'];
        if (url.protocol !== 'https:' || !allowedHosts.includes(url.hostname.toLowerCase())) throw new Error('Invalid map URL');
        preview.src = `https://www.google.com/maps?q=${encodeURIComponent(input.value.trim())}&output=embed`;
        previewBox.classList.remove('hidden');
    } catch {
        preview.removeAttribute('src');
        previewBox.classList.add('hidden');
    }
}

function showOppDetail(id) {
    const opp = allOpportunities.find(o => String(o.id) === String(id));
    if (!opp) { toast('Opportunity not found', 'error'); return; }

    const content = document.getElementById('oppDetailContent');
    const viewer = typeof getCurrentUserData === 'function' ? getCurrentUserData() : currentUser;
    const spots = parseInt(opp.spots || opp.spots_needed || 0);
    const filled = parseInt(opp.filled || opp.spots_filled || 0);
    content.innerHTML = `
    <div class="modal-header">
      <h2 class="font-display text-2xl font-black">${escHtml(opp.title)}</h2>
      <button class="close-btn" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="mb-4">
      <span class="badge badge-success mb-2">${escHtml(opp.category)}</span>
    <p class="text-sm text-muted">Hosted by <button type="button" class="inline-link font-semibold" onclick="showOrganizationProfile(${opp.organization_id})">${escHtml(opp.org || opp.org_name || '')}</button></p>
            ${opp.review_count ? `<p class="text-sm text-accent mt-2"><i class="fas fa-star mr-1"></i>${opp.average_rating}/5 from ${opp.review_count} review${opp.review_count === 1 ? '' : 's'}</p>` : '<p class="text-sm text-muted mt-2">No reviews yet</p>'}
    </div>
    <p class="text-muted leading-relaxed mb-6">${escHtml(opp.desc || opp.description || '')}</p>
    ${opp.opportunity_image ? `<a class="btn btn-outline btn-sm mb-4" href="${escHtml(new URL(opp.opportunity_image, window.location.href).href)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-image mr-1"></i>View attached image</a>` : ''}
    <div class="grid grid-2 gap-4 mb-6 bg-forest-light p-4 rounded-xl">
      <div><span class="text-xs text-muted block">Location</span><strong>${escHtml(opp.location)}</strong></div>
      <div><span class="text-xs text-muted block">Commitment</span><strong>${escHtml(opp.time || opp.time_commitment || '')}</strong></div>
      <div><span class="text-xs text-muted block">Start Date</span><strong>${escHtml(opp.date || opp.start_date || '')}</strong></div>
      <div><span class="text-xs text-muted block">Spots Available</span><strong>${spots - filled} left of ${spots}</strong></div>
    </div>
        ${opp.map_url ? `<a class="btn btn-outline btn-sm mb-4" href="${escHtml(opp.map_url)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-map-marker-alt mr-1"></i>View exact location in Google Maps</a>` : ''}
        ${(opp.contact_phone || opp.contact_email) ? `<div class="bg-forest-light p-4 rounded-xl mb-6"><span class="text-xs text-muted block mb-2">Contact for this opportunity</span>${opp.contact_phone ? `<a class="text-primary block mb-1" href="tel:${escHtml(opp.contact_phone)}"><i class="fas fa-phone mr-2"></i>${escHtml(opp.contact_phone)}</a>` : ''}${opp.contact_email ? `<a class="text-primary block" href="mailto:${escHtml(opp.contact_email)}"><i class="fas fa-envelope mr-2"></i>${escHtml(opp.contact_email)}</a>` : ''}</div>` : ''}
        <div id="opportunityReviewArea" class="mb-6"></div>
    ${viewer?.role === 'organization'
        ? '<p class="text-sm text-muted text-center">Organizations can view opportunities but cannot apply.</p>'
        : viewer?.role === 'volunteer'
            ? '<div id="opportunityActionArea"><p class="application-status text-center">Checking application status...</p></div>'
            : `<div id="opportunityActionArea"><button class="btn btn-primary w-full" onclick="applyToOpp(${opp.id})">Apply Now</button></div>`}`;
    showModal('opportunityDetail');
        loadReviewInfo(opp.id);
}

    async function loadReviewInfo(opportunityId) {
        const area = document.getElementById('opportunityReviewArea');
        const actionArea = document.getElementById('opportunityActionArea');
        const user = typeof getCurrentUserData === 'function' ? getCurrentUserData() : currentUser;
        if (!area || !user || user.role !== 'volunteer') return;
        try {
            const data = await apiFetch('review_info', { opportunity_id: opportunityId });
            if (!data.success) return;
            if (data.application_status) {
                const statusText = data.application_status.charAt(0).toUpperCase() + data.application_status.slice(1);
                if (actionArea) actionArea.innerHTML = `<p class="application-status text-center"><i class="fas fa-check-circle mr-2"></i>Application ${escHtml(statusText)}</p>`;
            } else if (actionArea) {
                actionArea.innerHTML = `<button class="btn btn-primary w-full" onclick="applyToOpp(${opportunityId})">Apply Now</button>`;
            }
            if (!data.eligible) return;
            const existing = data.review || {};
            area.innerHTML = `<div class="review-box"><h3 class="font-bold mb-2">${existing.rating ? 'Update your review' : 'Rate this opportunity'}</h3><p class="text-sm text-muted mb-2">Choose a rating</p><div class="star-rating mb-4" role="radiogroup" aria-label="Opportunity rating">${[1,2,3,4,5].map(value => `<button type="button" class="star-btn" data-rating="${value}" aria-label="${value} star${value === 1 ? '' : 's'}" onclick="selectReviewRating(${value})"><i class="fas fa-star"></i></button>`).join('')}</div><input type="hidden" id="reviewRating" value="${existing.rating || ''}"><label class="form-label">Review <span class="text-muted">(optional)</span><textarea class="input-field" id="reviewText" rows="3" maxlength="2000" placeholder="Share your experience..."></textarea></label><button type="button" class="btn btn-outline btn-sm mt-3" onclick="submitOpportunityReview(${opportunityId})">Save Review</button></div>`;
            if (existing.rating) selectReviewRating(existing.rating);
            if (existing.review) document.getElementById('reviewText').value = existing.review;
        } catch { /* Reviews are optional and should not block opportunity details. */ }
    }

    function selectReviewRating(rating) {
        const input = document.getElementById('reviewRating');
        if (input) input.value = rating;
        document.querySelectorAll('.star-btn').forEach(button => {
            button.classList.toggle('selected', Number(button.dataset.rating) <= Number(rating));
        });
    }

    async function submitOpportunityReview(opportunityId) {
        const rating = document.getElementById('reviewRating')?.value || '';
        const review = document.getElementById('reviewText')?.value.trim() || '';
        if (!rating) { toast('Please choose a rating.', 'error'); return; }
        try {
            const data = await apiFetch('submit_review', {}, 'POST', { opportunity_id: opportunityId, rating, review });
            if (!data.success) { toast(data.message || 'Could not save review.', 'error'); return; }
            toast(data.message, 'success');
            await filterOpportunities();
            const updated = allOpportunities.find(o => String(o.id) === String(opportunityId));
            if (updated) showOppDetail(opportunityId);
        } catch { toast('Network error. Please try again.', 'error'); }
    }

async function showOrganizationProfile(id) {
        if (!id) { toast('Organization profile is unavailable.', 'error'); return; }
        const content = document.getElementById('organizationProfileContent');
        if (!content) return;
        content.innerHTML = '<div class="text-center text-muted py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Loading organization profile...</div>';
        showModal('organizationProfile');

        try {
                const data = await apiFetch('organization_profile', { id });
                if (!data.success || !data.organization) throw new Error(data.message || 'Could not load organization profile.');
                const org = data.organization;
                const location = [org.address, org.city, org.state, org.country].filter(Boolean).join(', ');
                const reviews = Array.isArray(org.reviews) ? org.reviews : [];
                const image = org.profile_image ? `<img class="public-org-avatar" src="${escHtml(org.profile_image)}" alt="${escHtml(org.name)}">` : '<div class="public-org-avatar public-org-avatar-placeholder"><i class="fas fa-building"></i></div>';
                content.innerHTML = `
                    <div class="modal-header">
                        <h2 class="font-display text-2xl font-black">Organization Profile</h2>
                        <button class="close-btn" onclick="closeModal()"><i class="fas fa-times"></i></button>
                    </div>
                      <div class="public-org-header">${image}<div><h3 class="font-display text-xl font-black">${escHtml(org.name)}</h3><p class="text-muted text-sm">${escHtml(org.category || 'Community organization')}</p><p class="text-sm text-accent mt-1"><i class="fas fa-star mr-1"></i>${org.review_count ? `${org.average_rating}/5 from ${org.review_count} volunteer review${org.review_count === 1 ? '' : 's'}` : 'No volunteer ratings yet'}</p></div></div>
                    <p class="text-muted leading-relaxed mb-6">${escHtml(org.description || 'This organization has not added a description yet.')}</p>
                    ${reviews.length ? `<div class="public-reviews mb-6"><h3 class="font-bold mb-3">Volunteer Reviews</h3>${reviews.map(review => `<article class="public-review"><div class="flex-row items-center justify-between mb-1"><strong>${escHtml(review.volunteer_name)}</strong><span class="text-accent">${'<i class="fas fa-star"></i>'.repeat(Number(review.rating))}</span></div><p class="text-sm text-muted">${escHtml(review.review)}</p><time class="text-xs text-muted">${escHtml(fmtDate(review.created_at))}</time></article>`).join('')}</div>` : ''}
                    <div class="grid grid-2 gap-4 mb-6 bg-forest-light p-4 rounded-xl">
                        <div><span class="text-xs text-muted block">Active Opportunities</span><strong>${org.active_opportunities}</strong></div>
                        ${location ? `<div><span class="text-xs text-muted block">Address</span><strong>${escHtml(location)}</strong></div>` : ''}
                        ${org.phone ? `<div><span class="text-xs text-muted block">Phone</span><a class="text-primary" href="tel:${escHtml(org.phone)}">${escHtml(org.phone)}</a></div>` : ''}
                        ${org.email ? `<div><span class="text-xs text-muted block">Email</span><a class="text-primary" href="mailto:${escHtml(org.email)}">${escHtml(org.email)}</a></div>` : ''}
                    </div>
                    ${org.website ? `<a class="btn btn-outline btn-sm" href="${escHtml(org.website)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-globe mr-1"></i>Visit organization website</a>` : ''}`;
        } catch (error) {
                content.innerHTML = `<div class="modal-header"><h2 class="font-display text-2xl font-black">Organization Profile</h2><button class="close-btn" onclick="closeModal()"><i class="fas fa-times"></i></button></div><p class="text-center text-danger py-8">${escHtml(error.message)}</p>`;
        }
}

async function applyToOpp(id) {
    const user = typeof getCurrentUserData === 'function' ? getCurrentUserData() : currentUser;
    if (!user) { closeModal(); showModal('login'); return; }

    try {
        const data = await apiFetch('apply', {}, 'POST', { opportunity_id: id });
        if (data.success) {
            toast(data.message || 'Application submitted!', 'success');
            closeModal();
            await filterOpportunities();
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
    loadProfileData();

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
    if (!apps.length) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No applications found.</td></tr>'; return; }

    tbody.innerHTML = apps.map(a => {
        const badge = a.status === 'approved' ? 'badge-success' : a.status === 'pending' ? 'badge-warning' : a.status === 'rejected' ? 'badge-danger' : 'badge-info';
        return `<tr data-title="${escHtml(a.title||'')}" data-org="${escHtml(a.org||'')}">
          <td><strong>${escHtml(a.title || 'N/A')}</strong></td>
          <td>${escHtml(a.org || 'N/A')}</td>
          <td>${fmtDate(a.applied)}</td>
          <td><span class="badge ${badge}">${a.status}</span></td>
          <td><span class="text-xs text-muted">${a.location||'—'}</span></td>
                      <td>${a.status === 'approved' ? `<button type="button" class="btn btn-outline btn-sm" onclick="openApplicationReview(${a.opp_id}, decodeURIComponent('${encodeURIComponent(a.title || 'Opportunity')}'))"><i class="fas fa-star mr-1"></i>Review</button>` : '<span class="text-xs text-muted">Available after approval</span>'}</td>
        </tr>`;
    }).join('');
}

async function openApplicationReview(opportunityId, opportunityTitle) {
    const content = document.getElementById('applicationReviewContent');
    if (!content) return;
    content.innerHTML = '<div class="text-center text-muted py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Loading review...</div>';
    showModal('applicationReview');
    try {
        const data = await apiFetch('review_info', { opportunity_id: opportunityId });
        if (!data.success || !data.eligible) throw new Error('Reviews are available after your application is approved.');
        const existing = data.review || {};
        content.innerHTML = `<div class="modal-header"><h2 class="font-display text-2xl font-black">Review Opportunity</h2><button class="close-btn" onclick="closeModal()"><i class="fas fa-times"></i></button></div><p class="text-muted mb-4">${escHtml(opportunityTitle)}</p><div class="review-box"><h3 class="font-bold mb-2">Your rating</h3><div class="star-rating mb-4" role="radiogroup" aria-label="Opportunity rating">${[1,2,3,4,5].map(value => `<button type="button" class="star-btn app-star-btn" data-rating="${value}" aria-label="${value} star${value === 1 ? '' : 's'}" onclick="selectApplicationReviewRating(${value})"><i class="fas fa-star"></i></button>`).join('')}</div><input type="hidden" id="applicationReviewRating" value="${existing.rating || ''}"><label class="form-label">Review <span class="text-muted">(optional)</span><textarea class="input-field" id="applicationReviewText" rows="4" maxlength="2000" placeholder="Share your experience..."></textarea></label><button type="button" class="btn btn-primary btn-sm mt-3" onclick="submitApplicationReview(${opportunityId})">Save Review</button></div>`;
        if (existing.rating) selectApplicationReviewRating(existing.rating);
        if (existing.review) document.getElementById('applicationReviewText').value = existing.review;
    } catch (error) {
        content.innerHTML = `<div class="modal-header"><h2 class="font-display text-2xl font-black">Review Opportunity</h2><button class="close-btn" onclick="closeModal()"><i class="fas fa-times"></i></button></div><p class="text-center text-danger py-8">${escHtml(error.message)}</p>`;
    }
}

function selectApplicationReviewRating(rating) {
    const input = document.getElementById('applicationReviewRating');
    if (input) input.value = rating;
    document.querySelectorAll('.app-star-btn').forEach(button => {
        button.classList.toggle('selected', Number(button.dataset.rating) <= Number(rating));
    });
}

async function submitApplicationReview(opportunityId) {
    const rating = document.getElementById('applicationReviewRating')?.value || '';
    const review = document.getElementById('applicationReviewText')?.value.trim() || '';
    if (!rating) { toast('Please choose a rating.', 'error'); return; }
    try {
        const data = await apiFetch('submit_review', {}, 'POST', { opportunity_id: opportunityId, rating, review });
        if (!data.success) { toast(data.message || 'Could not save review.', 'error'); return; }
        toast(data.message, 'success');
        closeModal();
    } catch { toast('Network error. Please try again.', 'error'); }
}

// ── Organization Dashboard ────────────────────────────────────
async function initOrgDashboard() {
    const user = typeof getCurrentUserData === 'function' ? getCurrentUserData() : currentUser;
    if (!user || user.role !== 'organization') return;
    loadProfileData();

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

async function loadOrgAllOpportunities() {
    const grid = document.getElementById('orgAllOpportunitiesGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="text-center text-muted">Loading...</div>';
    try {
        const data = await apiFetch('opportunities');
        const opportunities = data.opportunities || [];
        allOpportunities = opportunities;
        grid.innerHTML = opportunities.length
            ? opportunities.map(renderOppCard).join('')
            : '<div class="text-center text-muted">No opportunities found.</div>';
    } catch {
        grid.innerHTML = '<div class="text-center text-muted">Could not load opportunities.</div>';
    }
}

function renderOrgAppsTable(apps) {
    const tbody = document.getElementById('orgAppsTableBody');
    if (!tbody) return;
    if (!apps.length) { tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No applications yet.</td></tr>'; return; }

    tbody.innerHTML = apps.map(a => {
        const badge = a.status==='approved'?'badge-success':a.status==='pending'?'badge-warning':a.status==='rejected'?'badge-danger':'badge-info';
                const actions = a.status === 'approved'
                        ? '<span class="badge badge-success"><i class="fas fa-check mr-1"></i>Approved</span>'
                        : a.status === 'rejected'
                                ? '<span class="badge badge-danger"><i class="fas fa-times mr-1"></i>Rejected</span>'
                                : `<button class="btn btn-primary btn-sm" onclick="updateOrgApp(${a.id},'approved')">Approve</button><button class="btn btn-outline btn-sm" style="margin-left:4px;" onclick="updateOrgApp(${a.id},'rejected')">Reject</button>`;
        return `<tr>
          <td><strong>${escHtml(a.volunteer_name||'N/A')}</strong><div class="text-xs text-muted">${escHtml(a.volunteer_email||'')}</div></td>
          <td>${escHtml(a.title||'')}</td>
          <td>${fmtDate(a.applied_at)}</td>
          <td><span class="badge ${badge}">${a.status}</span></td>
                    <td>${actions}</td>
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
            const o = await apiFetch('org_opportunities');
            if (o.success) renderOrgOppsTable(o.opportunities || []);
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
    document.getElementById('oppMapUrl').value   = opp.map_url || '';
    document.getElementById('oppContactPhone').value = opp.contact_phone || '';
    document.getElementById('oppContactEmail').value = opp.contact_email || '';
    updateOpportunityMapPreview();
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
    const image = document.getElementById('oppImage')?.files?.[0];
    if (image && image.size > 500 * 1024) {
        toast('Opportunity image must be 500 KB or smaller.', 'error');
        return;
    }

    const payload = new FormData();
    payload.append('title', document.getElementById('oppTitle').value);
    payload.append('category', document.getElementById('oppCategory').value);
    payload.append('location', document.getElementById('oppLocation').value);
    payload.append('time', document.getElementById('oppTime').value);
    payload.append('spots', document.getElementById('oppSpots').value);
    payload.append('date', document.getElementById('oppDate').value);
    payload.append('description', document.getElementById('oppDesc').value);
    payload.append('map_url', document.getElementById('oppMapUrl').value.trim());
    payload.append('contact_phone', document.getElementById('oppContactPhone').value.trim());
    payload.append('contact_email', document.getElementById('oppContactEmail').value.trim());
    if (image) payload.append('opportunity_image', image);

    const action = editId ? 'update_opportunity' : 'create_opportunity';
    if (editId) payload.append('id', editId);

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
    loadProfileData();

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
    // Load contact messages
    await loadAdminMessages();

    // Keep the admin view current when a registration is submitted elsewhere.
    if (!adminRefreshTimer) {
        adminRefreshTimer = setInterval(() => {
            if (currentPage === 'admin-dashboard') {
                loadAdminStats();
                loadAdminPendingOrgs();
                loadAdminOrgs();
                loadAdminOpportunities();
                loadAdminMessages();
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

async function loadAdminMessages(markAsRead = false) {
    try {
        const data = await apiFetch('admin_messages', markAsRead ? { mark_read: '1' } : {});
        if (data.success) renderAdminMessagesTable(data.messages || [], data.unread || 0);
    } catch { renderAdminMessagesTable([], 0); }
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
    if (tabName === 'messages') loadAdminMessages(true);
}

function renderAdminMessagesTable(messages, unread) {
    const tbody = document.getElementById('adminMessagesTableBody');
    if (!tbody) return;
    const badge = document.getElementById('adminMessagesBadge');
    if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'inline-flex' : 'none'; }
    if (!messages.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No contact messages yet.</td></tr>';
        return;
    }
        tbody.innerHTML = messages.map(m => `<tr class="${m.status === 'unread' ? 'font-semibold' : ''}">
      <td><strong>${escHtml(m.name)}</strong><div class="text-xs text-muted">${escHtml(m.email)}</div></td>
      <td>${escHtml(m.subject)}</td>
      <td class="text-sm" style="max-width:420px;white-space:normal;">${escHtml(m.message)}</td>
      <td>${fmtDate(m.created_at)}</td>
            <td>
                <span class="badge ${m.status === 'unread' ? 'badge-warning' : 'badge-success'}">${m.status}</span>
                <button type="button" class="btn btn-sm btn-outline" style="margin-left:6px;padding:3px 8px;font-size:11px;" onclick="updateAdminMessageStatus(${m.id},'${m.status === 'unread' ? 'read' : 'unread'}')">
                    Mark ${m.status === 'unread' ? 'read' : 'unread'}
                </button>
            </td>
    </tr>`).join('');
}

async function updateAdminMessageStatus(id, status) {
        try {
                const data = await apiFetch('admin_message_status', {}, 'POST', { id, status });
                if (!data.success) throw new Error(data.message || 'Could not update message.');
                await loadAdminMessages();
        } catch (error) {
                toast(error.message || 'Could not update message.', 'error');
        }
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
    if (!opps.length) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No opportunities found.</td></tr>'; return; }

    tbody.innerHTML = opps.map(o => {
        const sBadge = o.status === 'active' ? 'badge-success' : o.status === 'pending' ? 'badge-warning' : 'badge-danger';
        return `<tr>
          <td><strong>${escHtml(o.title)}</strong></td>
          <td>${escHtml(o.org_name||'')}</td>
          <td><span class="badge badge-info">${escHtml(o.category)}</span></td>
          <td><span class="badge ${sBadge}">${o.status}</span></td>
          <td class="text-sm">${o.applicant_count||0} applicants</td>
          <td><button type="button" class="btn btn-outline btn-sm" onclick="openAdminOpportunityReview(${o.id})"><i class="fas fa-eye mr-1"></i>Inspect</button>${o.status !== 'closed' && o.status !== 'rejected' ? `<button type="button" class="btn btn-sm admin-remove-btn" onclick="removeAdminOpportunity(${o.id})"><i class="fas fa-trash-alt mr-1"></i>Remove</button>` : ''}</td>
        </tr>`;
    }).join('');
}

async function openAdminOpportunityReview(id) {
    const content = document.getElementById('adminOpportunityReviewContent');
    if (!content) return;
    content.innerHTML = '<div class="text-center text-muted py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Loading opportunity details...</div>';
    showModal('adminOpportunityReview');
    try {
        const data = await apiFetch('admin_opportunity_detail', { id });
        if (!data.success || !data.opportunity) throw new Error(data.message || 'Could not load opportunity details.');
        const opportunity = data.opportunity;
        const status = opportunity.status;
        const moderationActions = status === 'pending'
            ? `<div class="flex-row gap-3 mt-6"><button type="button" class="btn btn-primary" onclick="moderateOpportunity(${opportunity.id}, 'active')"><i class="fas fa-check mr-2"></i>Approve and Publish</button><button type="button" class="btn btn-outline" onclick="moderateOpportunity(${opportunity.id}, 'rejected')"><i class="fas fa-times mr-2"></i>Reject as Fake</button></div>`
            : `<p class="application-status mt-6">This opportunity is already ${escHtml(status)}.</p>`;
        content.innerHTML = `<div class="modal-header"><h2 class="font-display text-2xl font-black">Inspect Opportunity</h2><button class="close-btn" onclick="closeModal()"><i class="fas fa-times"></i></button></div><div class="mb-4"><span class="badge badge-info">${escHtml(opportunity.category)}</span><span class="badge ${status === 'pending' ? 'badge-warning' : status === 'active' ? 'badge-success' : 'badge-danger'} ml-2">${escHtml(status)}</span><h3 class="font-display text-xl font-black mt-3">${escHtml(opportunity.title)}</h3><p class="text-sm text-muted">Posted by <strong>${escHtml(opportunity.org_name)}</strong></p></div><p class="text-muted leading-relaxed mb-6">${escHtml(opportunity.description)}</p><div class="grid grid-2 gap-4 mb-6 bg-forest-light p-4 rounded-xl"><div><span class="text-xs text-muted block">Location</span><strong>${escHtml(opportunity.location)}</strong></div><div><span class="text-xs text-muted block">Time</span><strong>${escHtml(opportunity.time_commitment)}</strong></div><div><span class="text-xs text-muted block">Start Date</span><strong>${escHtml(opportunity.start_date)}</strong></div><div><span class="text-xs text-muted block">Volunteers Needed</span><strong>${escHtml(opportunity.spots_needed)}</strong></div><div><span class="text-xs text-muted block">Contact Phone</span><strong>${escHtml(opportunity.contact_phone || '—')}</strong></div><div><span class="text-xs text-muted block">Contact Email</span><strong>${escHtml(opportunity.contact_email || '—')}</strong></div></div><div class="bg-forest-light p-4 rounded-xl"><h4 class="font-bold mb-2">Organization Details</h4><p class="text-sm"><strong>${escHtml(opportunity.org_name)}</strong> · ${escHtml(opportunity.org_email || 'No email')}</p><p class="text-sm text-muted mt-1">${escHtml(opportunity.org_phone || '')} ${opportunity.org_address ? `· ${escHtml(opportunity.org_address)}` : ''}</p><p class="text-sm text-muted mt-2">${escHtml(opportunity.org_description || 'No organization description provided.')}</p></div>${opportunity.map_url ? `<a class="btn btn-outline btn-sm mt-4" href="${escHtml(opportunity.map_url)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-map-marker-alt mr-1"></i>Open Google Maps</a>` : ''}${moderationActions}`;
    } catch (error) {
        content.innerHTML = `<div class="modal-header"><h2 class="font-display text-2xl font-black">Inspect Opportunity</h2><button class="close-btn" onclick="closeModal()"><i class="fas fa-times"></i></button></div><p class="text-center text-danger py-8">${escHtml(error.message)}</p>`;
    }
}

async function moderateOpportunity(id, status) {
    const data = await apiFetch('admin_opportunity_status', {}, 'POST', { id, status });
    if (!data.success) { toast(data.message || 'Could not update opportunity.', 'error'); return; }
    toast(data.message, 'success');
    closeModal();
    loadAdminOpportunities();
}

async function removeAdminOpportunity(id) {
    if (!confirm('Remove this opportunity from public listings? Its applications and reviews will be preserved.')) return;
    try {
        const data = await apiFetch('admin_remove_opportunity', {}, 'POST', { id });
        if (!data.success) { toast(data.message || 'Could not remove opportunity.', 'error'); return; }
        toast(data.message, 'success');
        loadAdminOpportunities();
    } catch { toast('Network error. Please try again.', 'error'); }
}

// ── Profile ───────────────────────────────────────────────────
function renderProfileData(p, user) {
    const name = p.name || '';
    const bio = p.bio || p.description || 'Add a short bio from your profile.';
    const imageUrl = p.profile_image ? new URL(p.profile_image, window.location.href).href : '';
    ['profileAvatar', 'dashboardProfileAvatar', 'avatarInitial'].forEach(id => setProfileAvatar(id, name, imageUrl));
    setEl('profileDisplayName', name);
    setEl('profileDisplayRole', { volunteer:'Volunteer', organization:'Organization', admin:'Administrator' }[user.role] || '');
    setEl('profileDisplayBio', bio);
    setEl('profileDisplayLocation', p.location || p.address || '—');
    setEl('profileDisplayEmail', p.email || '—');
    setEl('profileDisplayPhone', p.phone || '—');
    const ratingText = p.review_count ? `${p.average_rating}/5 from ${p.review_count} volunteer review${p.review_count === 1 ? '' : 's'}` : 'No ratings yet';
    setEl('profileDisplayRating', ratingText);
    document.getElementById('profileDisplayRatingItem')?.classList.toggle('hidden', user.role !== 'organization');
    const skills = (p.skills || '').split(',').map(skill => skill.trim()).filter(Boolean);
    setEl('profileDisplaySkills', skills.length ? skills.join(', ') : '—');
    document.getElementById('profileDisplaySkillsItem')?.classList.toggle('hidden', user.role !== 'volunteer');
    document.getElementById('profileSkillsField')?.classList.toggle('hidden', user.role !== 'volunteer');
    const parts = name.split(' ');
    setVal('profileFirstName', parts[0] || '');
    setVal('profileLastName', parts.slice(1).join(' ') || '');
    setVal('profileEmail', p.email || '');
    setVal('profilePhone', p.phone || '');
    setVal('profileLocation', p.location || p.address || '');
    setVal('profileBio', p.bio || p.description || '');
    setVal('profileSkills', skills.join(', '));
}

function setProfileAvatar(id, name, imageUrl) {
    const avatar = document.getElementById(id);
    if (!avatar) return;
    const initial = (name || 'U')[0].toUpperCase();
    avatar.textContent = initial;
    avatar.style.backgroundImage = '';
    avatar.classList.remove('profile-avatar-image');
    if (!imageUrl) return;

    const image = new Image();
    image.onload = () => {
        avatar.textContent = '';
        avatar.style.backgroundImage = `url("${imageUrl}")`;
        avatar.classList.add('profile-avatar-image');
    };
    image.onerror = () => {
        avatar.textContent = initial;
        avatar.style.backgroundImage = '';
    };
    image.src = imageUrl;
}

async function loadProfileData() {
    const user = typeof getCurrentUserData === 'function' ? getCurrentUserData() : currentUser;
    if (!user) return;
    try {
        const data = await apiFetch('profile');
        if (data.success && data.profile) renderProfileData(data.profile, user);
    } catch { /* ignore */ }
}

async function initProfile() {
    await loadProfileData();
}

async function handleProfileSave(e) {
    e.preventDefault();
    const user = typeof getCurrentUserData === 'function' ? getCurrentUserData() : currentUser;
    if (!user) return;

    const first = document.getElementById('profileFirstName')?.value || '';
    const last  = document.getElementById('profileLastName')?.value  || '';
    const image = document.getElementById('profileImage')?.files?.[0];
    if (image && image.size > 500 * 1024) {
        toast('Profile picture must be 500 KB or smaller.', 'error');
        return;
    }
    const payload = new FormData();
    payload.append('name', `${first} ${last}`.trim());
    payload.append('email', document.getElementById('profileEmail')?.value || '');
    payload.append('phone', document.getElementById('profilePhone')?.value || '');
    payload.append('location', document.getElementById('profileLocation')?.value || '');
    payload.append('bio', document.getElementById('profileBio')?.value || '');
    payload.append('skills', document.getElementById('profileSkills')?.value || '');
    if (image) payload.append('profile_image', image);

    try {
        const data = await apiFetch('profile_update', {}, 'POST', payload);
        if (data.success) {
            const imageInput = document.getElementById('profileImage');
            if (imageInput) imageInput.value = '';
            if (data.user) {
                localStorage.setItem('vc_user', JSON.stringify(data.user));
                if (typeof currentUser !== 'undefined') currentUser = data.user;
            }
            if (typeof updateAuthUI === 'function') updateAuthUI();
            toast('Profile updated successfully!', 'success');
            await loadProfileData();
        } else {
            toast(data.message || 'Update failed.', 'error');
        }
    } catch { toast('Network error.', 'error'); }
}

// ── Contact Form ──────────────────────────────────────────────
async function handleContactForm(e) {
    e.preventDefault();
    const form=e.target; const button=form.querySelector('button[type="submit"]');
    const original=button?.innerHTML;
    if(button){ button.disabled=true; button.innerHTML='Sending...'; }
    try {
        const data=await apiFetch('contact_submit',{},'POST',{
            name:document.getElementById('contactName')?.value.trim()||'',
            email:document.getElementById('contactEmail')?.value.trim()||'',
            subject:document.getElementById('contactSubject')?.value.trim()||'',
            message:document.getElementById('contactMessage')?.value.trim()||''
        });
        if(data.success){ toast(data.message,'success'); form.reset(); }
        else toast(data.message||'Could not send your message.','error');
    } catch { toast('Network error. Please try again.','error'); }
    finally { if(button){ button.disabled=false; button.innerHTML=original; } }
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