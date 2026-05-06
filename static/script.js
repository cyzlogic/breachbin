// Role styles (no emojis, just effects)
const ROLE_STYLES = {
    'owner': { color: '#FF0000', glow: '0 0 10px #FF0000, 0 0 20px #FF0000, 0 0 40px #FF0000' },
    'admin': { color: '#FF4500', glow: '0 0 8px #FF4500, 0 0 15px #FF4500' },
    'boss': { color: '#FFD700', glow: '0 0 8px #FFD700, 0 0 15px #FFD700' },
    'ceo': { color: '#8B00FF', glow: '0 0 8px #8B00FF, 0 0 15px #8B00FF' },
    'premium': { color: '#00BFFF', glow: '0 0 8px #00BFFF' },
    'VIP': { color: '#00FF00', glow: '0 0 8px #00FF00' },
    'skid': { color: '#FF69B4', glow: '0 0 5px #FF69B4' },
    'member': { color: '#888888', glow: 'none' },
};

let currentUser = null;
let currentPage = 1;
let searchTimer = null;

// ======================== INIT ========================
document.addEventListener('DOMContentLoaded', () => {
    setupTabNavigation();
    setupGlobalSearch();
    setupAdminKeybind();
    startRainbowAnimation();
    startRetroCursor();
    checkAuth();
    loadStats();
    spawnParticles();
    
    if (typeof pasteId !== 'undefined') loadPaste(pasteId);
    if (typeof profileUsername !== 'undefined') loadUserProfile(profileUsername);
});

// ======================== RETRO CURSOR ========================
function startRetroCursor() {
    const style = document.createElement('style');
    style.textContent = `
        * {
            caret-color: #00ff41 !important;
        }
        body {
            cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='24' viewBox='0 0 20 24'%3E%3Crect x='1' y='1' width='4' height='4' fill='%2300ff41' opacity='0.8'/%3E%3C/svg%3E") 2 2, auto !important;
        }
        a, button, .card, .user-card, .nav-link, .user-badge, .page-btn, .btn {
            cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='24' viewBox='0 0 20 24'%3E%3Crect x='0' y='0' width='6' height='6' fill='%2300ff41'/%3E%3C/svg%3E") 2 2, pointer !important;
        }
        input, textarea, select {
            cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='18' viewBox='0 0 12 18'%3E%3Crect x='2' y='2' width='2' height='14' fill='%2300ff41'/%3E%3C/svg%3E") 3 2, text !important;
        }
    `;
    document.head.appendChild(style);
}

// ======================== PARTICLES ========================
function spawnParticles() {
    setInterval(() => {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: fixed; pointer-events: none; z-index: 9999;
            width: 2px; height: 2px;
            background: #00ff41;
            box-shadow: 0 0 2px #00ff41;
            left: ${Math.random() * 100}vw;
            top: -10px;
            animation: particleFall ${3 + Math.random() * 4}s linear;
            opacity: ${0.3 + Math.random() * 0.5};
        `;
        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 7000);
    }, 1000);
}

// Add particle animation
const particleStyle = document.createElement('style');
particleStyle.textContent = `
    @keyframes particleFall {
        0% { transform: translateY(0) rotate(0deg); opacity: 0; }
        10% { opacity: 0.8; }
        100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
    }
    @keyframes rainbowCycle {
        0% { color: #FF0000; text-shadow: 0 0 10px #FF0000, 0 0 20px #FF0000; }
        16% { color: #FF7700; text-shadow: 0 0 10px #FF7700, 0 0 20px #FF7700; }
        33% { color: #FFFF00; text-shadow: 0 0 10px #FFFF00, 0 0 20px #FFFF00; }
        50% { color: #00FF00; text-shadow: 0 0 10px #00FF00, 0 0 20px #00FF00; }
        66% { color: #0077FF; text-shadow: 0 0 10px #0077FF, 0 0 20px #0077FF; }
        83% { color: #8B00FF; text-shadow: 0 0 10px #8B00FF, 0 0 20px #8B00FF; }
        100% { color: #FF0000; text-shadow: 0 0 10px #FF0000, 0 0 20px #FF0000; }
    }
    @keyframes dotOrbit {
        0% { transform: rotate(0deg) translateX(12px) rotate(0deg); }
        100% { transform: rotate(360deg) translateX(12px) rotate(-360deg); }
    }
    @keyframes adminPulse {
        0%, 100% { text-shadow: 0 0 8px #FF4500, 0 0 15px #FF4500; }
        50% { text-shadow: 0 0 15px #FF4500, 0 0 25px #FF4500, 0 0 35px #FF4500; }
    }
    @keyframes bossSparkle {
        0%, 100% { filter: brightness(1); }
        50% { filter: brightness(1.5); }
    }
`;
document.head.appendChild(particleStyle);

// ======================== KEYBINDS ========================
function setupAdminKeybind() {
    let keyState = { shift: false, x: false, c: false };
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Shift') keyState.shift = true;
        if (e.key === 'x' || e.key === 'X') keyState.x = true;
        if (e.key === 'c' || e.key === 'C') keyState.c = true;
        
        if (keyState.shift && keyState.x && keyState.c) {
            checkAdminAccess();
            keyState = { shift: false, x: false, c: false };
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') keyState.shift = false;
        if (e.key === 'x' || e.key === 'X') keyState.x = false;
        if (e.key === 'c' || e.key === 'C') keyState.c = false;
    });
}

async function checkAdminAccess() {
    try {
        const res = await fetch('/api/admin/check');
        const data = await res.json();
        
        if (data.authenticated) {
            showAdmin();
        } else {
            const password = prompt('[-] ADMIN ACCESS REQUIRED\n\nenter password:');
            if (password) {
                const loginRes = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                const loginData = await loginRes.json();
                if (loginRes.ok) {
                    showAdmin();
                } else {
                    showToast('access denied', 'error');
                }
            }
        }
    } catch (e) {
        showToast('connection error', 'error');
    }
}

// ======================== RAINBOW ASCII ========================
function startRainbowAnimation() {
    const ascii = document.getElementById('asciiArt');
    if (!ascii) return;
    
    const colors = ['#ff0000', '#ff7700', '#ffff00', '#00ff00', '#0077ff', '#8b00ff'];
    let index = 0;
    
    setInterval(() => {
        ascii.style.color = colors[index];
        ascii.style.textShadow = `0 0 10px ${colors[index]}, 0 0 20px ${colors[index]}, 0 0 40px ${colors[index]}`;
        index = (index + 1) % colors.length;
    }, 400);
}

// ======================== TAB NAVIGATION ========================
function setupTabNavigation() {
    document.querySelectorAll('.nav-link[data-tab]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(link.dataset.tab);
        });
    });
}

function switchTab(tab) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`.nav-link[data-tab="${tab}"]`)?.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tab}`)?.classList.add('active');
    
    switch(tab) {
        case 'pastes': loadPastes(); break;
        case 'users': loadUsers(); break;
        case 'management': loadManagement(); break;
        case 'announcements': loadAnnouncements(); break;
        case 'tos': loadTOS(); break;
        case 'home': loadStats(); break;
    }
}

// ======================== GLOBAL SEARCH ========================
function setupGlobalSearch() {
    const searchInput = document.getElementById('globalSearch');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            const query = searchInput.value.trim();
            if (query.length >= 2) {
                switchTab('pastes');
                document.getElementById('pasteSearch').value = query;
                loadPastes(query);
            } else if (query.length === 0) {
                switchTab('home');
            }
        }, 500);
    });
    
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && searchInput.value.trim().length > 0) {
            switchTab('pastes');
            document.getElementById('pasteSearch').value = searchInput.value.trim();
            loadPastes(searchInput.value.trim());
        }
    });
}

// ======================== AUTH ========================
function showAuth(mode) {
    document.getElementById('authModal').classList.remove('hidden');
    switchAuth(mode);
}

function hideAuth() {
    document.getElementById('authModal').classList.add('hidden');
}

function switchAuth(mode) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('signupForm').classList.add('hidden');
    document.getElementById('loginError').textContent = '';
    document.getElementById('signupError').textContent = '';
    
    if (mode === 'login') {
        document.querySelector('.auth-tab:first-child').classList.add('active');
        document.getElementById('loginForm').classList.remove('hidden');
    } else {
        document.querySelector('.auth-tab:last-child').classList.add('active');
        document.getElementById('signupForm').classList.remove('hidden');
    }
}

async function login(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            hideAuth();
            currentUser = data.user;
            updateUIForAuth();
            showToast('authenticated', 'success');
            loadStats();
        } else {
            document.getElementById('loginError').textContent = data.error;
        }
    } catch (e) {
        document.getElementById('loginError').textContent = 'connection error';
    }
}

async function signup(e) {
    e.preventDefault();
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    const email = document.getElementById('signupEmail').value.trim();
    
    try {
        const res = await fetch('/api/auth/signup', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, email })
        });
        const data = await res.json();
        
        if (res.ok) {
            hideAuth();
            currentUser = data.user;
            updateUIForAuth();
            showToast('account created', 'success');
            loadStats();
        } else {
            document.getElementById('signupError').textContent = data.error;
        }
    } catch (e) {
        document.getElementById('signupError').textContent = 'connection error';
    }
}

async function logout() {
    try {
        await fetch('/api/auth/logout');
        currentUser = null;
        document.getElementById('authButtons').classList.remove('hidden');
        document.getElementById('userMenu').classList.add('hidden');
        document.getElementById('userDropdown').classList.add('hidden');
        showToast('disconnected', 'info');
        loadStats();
    } catch (e) {
        showToast('error disconnecting', 'error');
    }
}

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated) {
            currentUser = data.user;
            updateUIForAuth();
        }
    } catch (e) {}
}

function updateUIForAuth() {
    document.getElementById('authButtons').classList.add('hidden');
    document.getElementById('userMenu').classList.remove('hidden');
    
    const display = document.getElementById('userDisplay');
    const role = currentUser.role;
    const style = ROLE_STYLES[role] || ROLE_STYLES.member;
    
    display.textContent = currentUser.username;
    display.style.color = style.color;
    display.style.textShadow = style.glow !== 'none' ? style.glow : 'none';
    
    // Apply role-specific effects
    if (role === 'owner') {
        display.style.animation = 'rainbowCycle 2s linear infinite';
    } else {
        display.style.animation = 'none';
    }
    
    // Admin pulse effect
    if (role === 'admin') {
        display.style.animation = 'adminPulse 1.5s ease-in-out infinite';
    }
}

function toggleDropdown() {
    document.getElementById('userDropdown').classList.toggle('hidden');
}

document.addEventListener('click', (e) => {
    const menu = document.getElementById('userMenu');
    const dropdown = document.getElementById('userDropdown');
    if (menu && !menu.contains(e.target) && dropdown) dropdown.classList.add('hidden');
});

function viewMyProfile() {
    if (currentUser) window.location.href = `/user/${currentUser.username}`;
}

// ======================== PASTES ========================
async function loadPastes(search = '') {
    const container = document.getElementById('pastesContainer');
    container.innerHTML = '<div class="paste-loading">loading pastes...</div>';
    
    try {
        const params = new URLSearchParams({ page: currentPage });
        if (search) params.set('search', search);
        
        const res = await fetch(`/api/pastes?${params}`);
        const data = await res.json();
        
        if (data.pastes.length === 0) {
            container.innerHTML = '<div class="paste-loading">no pastes found.</div>';
        } else {
            container.innerHTML = data.pastes.map(p => createPasteCard(p)).join('');
        }
        renderPagination(data.page, data.pages);
    } catch (e) {
        container.innerHTML = '<div class="paste-loading">error loading pastes.</div>';
    }
}

function searchPastes() {
    currentPage = 1;
    loadPastes(document.getElementById('pasteSearch').value.trim());
}

function createPasteCard(paste) {
    const date = new Date(paste.created_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
    
    let title = paste.title || 'Untitled';
    if (title.length > 40) title = title.substring(0, 40) + '...';
    
    const displayViews = (paste.views || 0) + (paste.fake_views || 0);
    const pinIcon = paste.pinned ? '<span style="color:#00ff41">&#9733;</span> ' : '';
    
    return `
        <div class="card" onclick="window.location='/paste/${paste.paste_id}'">
            <div class="card-main">
                <div class="card-title">${pinIcon}${escapeHtml(title)}</div>
                <div class="card-meta">
                    <span><i class="fas fa-user"></i> ${escapeHtml(paste.username)}</span>
                    <span><i class="fas fa-code"></i> ${paste.syntax}</span>
                    <span><i class="fas fa-calendar"></i> ${date}</span>
                </div>
            </div>
            <div class="card-right">
                <span class="card-views"><i class="fas fa-eye"></i> ${displayViews}</span>
            </div>
        </div>
    `;
}

function renderPagination(page, totalPages) {
    const container = document.getElementById('pastesPagination');
    if (totalPages <= 1) { container.innerHTML = ''; return; }
    
    container.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `page-btn ${i === page ? 'active' : ''}`;
        btn.textContent = i;
        btn.onclick = () => { currentPage = i; loadPastes(document.getElementById('pasteSearch').value.trim()); };
        container.appendChild(btn);
    }
}

async function loadPaste(pasteId) {
    const container = document.getElementById('pasteView');
    
    try {
        const res = await fetch(`/api/pastes/${pasteId}`);
        if (!res.ok) { container.innerHTML = '<div class="paste-loading">paste not found.</div>'; return; }
        
        const paste = await res.json();
        const date = new Date(paste.created_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        
        document.title = `Breach Bin - ${paste.title || 'Untitled'}`;
        
        let actions = '';
        if (currentUser && (currentUser.username === paste.username || ['owner', 'admin', 'boss'].includes(currentUser.role))) {
            actions = `<button class="btn btn-danger btn-small" onclick="deletePaste('${paste.paste_id}')"><i class="fas fa-trash"></i></button>`;
        }
        
        // Like button
        const likeIcon = paste.user_liked ? 'fas fa-heart' : 'far fa-heart';
        const likeColor = paste.user_liked ? '#ff0033' : 'var(--text-muted)';
        const likeBtn = currentUser ? `<button class="btn btn-small" style="border-color: ${likeColor}; color: ${likeColor}" onclick="toggleLike('${paste.paste_id}')"><i class="${likeIcon}"></i> <span id="likeCount">${paste.like_count}</span></button>` : '';
        
        // Comments section
        let commentsHtml = '';
        if (paste.comments && paste.comments.length > 0) {
            commentsHtml = paste.comments.map(c => {
                const cDate = new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                return `<div class="comment-item"><span class="comment-author">${escapeHtml(c.username)}</span> <span class="comment-time">${cDate}</span><p class="comment-text">${escapeHtml(c.content)}</p></div>`;
            }).join('');
        }
        
        const commentForm = currentUser ? `
            <div class="comment-form">
                <input type="text" id="commentInput" class="form-input" placeholder="add comment..." maxlength="1000">
                <button class="btn btn-primary btn-small" onclick="addComment('${paste.paste_id}')">post</button>
            </div>
        ` : '<p style="color: var(--text-muted); font-size: 12px; padding: 10px;">login to comment</p>';
        
        container.innerHTML = `
            <div class="paste-header">
                <div class="paste-header-left">
                    <h1>${paste.pinned ? '&#9733; ' : ''}${escapeHtml(paste.title)}</h1>
                    <div class="paste-header-meta">
                        <span>by <a href="/user/${paste.username}">${escapeHtml(paste.username)}</a></span>
                        <span>${date}</span>
                        <span>${paste.syntax}</span>
                        <span><i class="fas fa-eye"></i> ${paste.display_views || paste.views} views</span>
                    </div>
                </div>
                <div class="paste-header-right">
                    <button class="btn btn-outline btn-small" onclick="copyPaste()"><i class="fas fa-copy"></i></button>
                    ${likeBtn}
                    ${actions}
                </div>
            </div>
            <div class="paste-content">
                <pre>${escapeHtml(paste.content)}</pre>
            </div>
            <div class="paste-comments">
                <h3>comments (${paste.comments ? paste.comments.length : 0})</h3>
                ${commentForm}
                <div class="comments-list">${commentsHtml}</div>
            </div>
        `;
        
        window.currentPasteContent = paste.content;
        window.currentPasteId = pasteId;
    } catch (e) {
        container.innerHTML = '<div class="paste-loading">error loading paste.</div>';
    }
}

function copyPaste() {
    if (window.currentPasteContent) {
        navigator.clipboard.writeText(window.currentPasteContent);
        showToast('copied to clipboard', 'success');
    }
}

async function deletePaste(pasteId) {
    if (!confirm('delete this paste?')) return;
    try {
        const res = await fetch(`/api/pastes/${pasteId}`, { method: 'DELETE' });
        if (res.ok) { showToast('paste deleted', 'success'); window.location.href = '/'; }
        else { const d = await res.json(); showToast(d.error, 'error'); }
    } catch (e) { showToast('error deleting paste', 'error'); }
}

// ======================== LIKES ========================
async function toggleLike(pasteId) {
    try {
        const res = await fetch(`/api/pastes/${pasteId}/like`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            const countSpan = document.getElementById('likeCount');
            if (countSpan) countSpan.textContent = data.like_count;
            // Reload to update the heart icon
            loadPaste(pasteId);
        }
    } catch (e) { showToast('error', 'error'); }
}

// ======================== COMMENTS ========================
async function addComment(pasteId) {
    const input = document.getElementById('commentInput');
    const content = input.value.trim();
    if (!content) { showToast('enter a comment', 'error'); return; }
    
    try {
        const res = await fetch(`/api/pastes/${pasteId}/comments`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        if (res.ok) {
            input.value = '';
            loadPaste(pasteId);
            showToast('comment posted', 'success');
        } else {
            const d = await res.json();
            showToast(d.error, 'error');
        }
    } catch (e) { showToast('error', 'error'); }
}

function showCreatePaste() {
    document.getElementById('createPasteModal').classList.remove('hidden');
}

function hideCreatePaste() {
    document.getElementById('createPasteModal').classList.add('hidden');
}

async function createPaste(e) {
    e.preventDefault();
    
    const title = document.getElementById('pasteTitle').value.trim() || 'Untitled';
    const content = document.getElementById('pasteContent').value.trim();
    const syntax = document.getElementById('pasteSyntax').value;
    const exposure = document.getElementById('pasteExposure').value;
    const anonymous = document.getElementById('pasteAnonymous').checked;
    
    if (!content) { showToast('content is required', 'error'); return; }
    
    try {
        const res = await fetch('/api/pastes', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, syntax, exposure, anonymous })
        });
        const data = await res.json();
        
        if (res.ok) {
            hideCreatePaste();
            showToast('paste created', 'success');
            window.location.href = `/paste/${data.paste_id}`;
        } else {
            showToast(data.error || 'error creating paste', 'error');
        }
    } catch (e) { showToast('error creating paste', 'error'); }
}

// ======================== USERS ========================
async function loadUsers(search = '') {
    const container = document.getElementById('usersContainer');
    container.innerHTML = '<div class="paste-loading">loading users...</div>';
    
    try {
        const params = search ? `?search=${encodeURIComponent(search)}` : '';
        const res = await fetch(`/api/users${params}`);
        const data = await res.json();
        
        container.innerHTML = data.users.length === 0
            ? '<div class="paste-loading">no users found.</div>'
            : data.users.map(u => createUserCard(u)).join('');
    } catch (e) {
        container.innerHTML = '<div class="paste-loading">error loading users.</div>';
    }
}

let userSearchTimer = null;
function searchUsers() {
    clearTimeout(userSearchTimer);
    userSearchTimer = setTimeout(() => loadUsers(document.getElementById('userSearch').value.trim()), 300);
}

function createUserCard(user) {
    const style = ROLE_STYLES[user.role] || ROLE_STYLES.member;
    const initial = user.username.charAt(0).toUpperCase();
    
    let roleBadgeExtra = '';
    if (user.role === 'owner') roleBadgeExtra = 'animation: rainbowCycle 2s linear infinite;';
    if (user.role === 'admin') roleBadgeExtra = 'animation: adminPulse 1.5s ease-in-out infinite;';
    
    return `
        <div class="user-card" onclick="window.location='/user/${user.username}'">
            <div class="user-card-left">
                <div class="user-avatar" style="border-color: ${style.color}">${initial}</div>
                <div class="user-info">
                    <h4>${escapeHtml(user.username)}</h4>
                    <p><span class="role-badge" style="background: ${style.color}22; color: ${style.color}; border: 1px solid ${style.color}44; box-shadow: ${style.glow !== 'none' ? style.glow : 'none'}; ${roleBadgeExtra}">
                        ${user.role}
                    </span></p>
                </div>
            </div>
            <div class="user-paste-count">
                <i class="fas fa-file-alt"></i> ${user.paste_count} pastes
            </div>
        </div>
    `;
}

async function loadUserProfile(username) {
    const container = document.getElementById('userProfileView');
    
    try {
        const res = await fetch(`/api/users/${encodeURIComponent(username)}`);
        if (!res.ok) { container.innerHTML = '<div class="paste-loading">user not found.</div>'; return; }
        
        const data = await res.json();
        const user = data.user;
        const style = ROLE_STYLES[user.role] || ROLE_STYLES.member;
        const initial = user.username.charAt(0).toUpperCase();
        const date = new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        
        document.title = `Breach Bin - ${user.username}`;
        
        let roleExtra = '';
        if (user.role === 'owner') roleExtra = 'animation: rainbowCycle 2s linear infinite;';
        if (user.role === 'admin') roleExtra = 'animation: adminPulse 1.5s ease-in-out infinite;';
        
        let pastesHtml = data.pastes.length === 0
            ? '<p style="color: var(--text-muted);">no public pastes.</p>'
            : data.pastes.map(p => createPasteCard(p)).join('');
        
        container.innerHTML = `
            <div class="profile-header">
                <div class="profile-avatar" style="border-color: ${style.color}; box-shadow: 0 0 20px ${style.color}44">${initial}</div>
                <h2 style="color: ${style.color}; text-shadow: ${style.glow !== 'none' ? style.glow : 'none'}; ${roleExtra}">${escapeHtml(user.username)}</h2>
                <span class="role-badge" style="background: ${style.color}22; color: ${style.color}; border: 1px solid ${style.color}44; font-size: 13px; padding: 4px 16px; ${roleExtra}">${user.role}</span>
                <div class="profile-stats">
                    <div class="profile-stat"><span class="stat-num">${user.paste_count}</span><span class="stat-lbl">Pastes</span></div>
                    <div class="profile-stat"><span class="stat-num">${date}</span><span class="stat-lbl">Joined</span></div>
                </div>
            </div>
            <div class="profile-pastes">
                <h3>public pastes</h3>
                <div class="content-grid">${pastesHtml}</div>
            </div>
        `;
    } catch (e) {
        container.innerHTML = '<div class="paste-loading">error loading profile.</div>';
    }
}

// ======================== ANNOUNCEMENTS ========================
async function loadAnnouncements() {
    const container = document.getElementById('announcementsContainer');
    try {
        const res = await fetch('/api/announcements');
        const data = await res.json();
        
        container.innerHTML = data.announcements.length === 0
            ? '<div class="paste-loading">no announcements.</div>'
            : data.announcements.map(a => {
                const date = new Date(a.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                return `<div class="announcement-card"><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.content)}</p><div class="announcement-meta"><span>posted by ${escapeHtml(a.author)}</span><span>${date}</span></div></div>`;
            }).join('');
    } catch (e) {
        container.innerHTML = '<div class="paste-loading">error loading announcements.</div>';
    }
}

// ======================== TOS ========================
async function loadTOS() {
    const container = document.getElementById('tosContainer');
    try {
        const res = await fetch('/api/tos');
        const data = await res.json();
        container.innerHTML = `<p>${escapeHtml(data.tos.content)}</p>`;
    } catch (e) {
        container.innerHTML = '<p>error loading tos.</p>';
    }
}

// ======================== MANAGEMENT ========================
async function loadManagement() {
    const container = document.getElementById('managementContainer');
    container.innerHTML = '<div class="paste-loading">loading management...</div>';
    try {
        const res = await fetch('/api/users/management');
        const data = await res.json();
        container.innerHTML = data.users.length === 0
            ? '<div class="paste-loading">no management found.</div>'
            : data.users.map(u => createUserCard(u)).join('');
    } catch (e) {
        container.innerHTML = '<div class="paste-loading">error loading management.</div>';
    }
}

// ======================== STATS ========================
async function loadStats() {
    try {
        const res = await fetch('/api/pastes?page=1');
        const data = await res.json();
        document.getElementById('totalPastes').textContent = data.total || 0;
        
        const usersRes = await fetch('/api/users');
        const usersData = await usersRes.json();
        document.getElementById('totalUsers').textContent = usersData.users.length || 0;
        document.getElementById('recentPastes').textContent = data.pastes ? data.pastes.length : 0;
    } catch (e) {}
}

// ======================== ADMIN PANEL ========================
function showAdmin() {
    document.getElementById('adminPanel').classList.remove('hidden');
    adminLoadUsers();
    adminLoadPastes();
    adminLoadAnnouncements();
    loadTOSForAdmin();
}

function hideAdmin() {
    document.getElementById('adminPanel').classList.add('hidden');
}

function switchAdminTab(tab, btn) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`admin${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');
}

async function adminLoadUsers() {
    const container = document.getElementById('adminUsersList');
    try {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        
        container.innerHTML = data.users.map(u => {
            const style = ROLE_STYLES[u.role] || ROLE_STYLES.member;
            return `
                <div class="admin-user-item">
                    <div class="admin-user-info">
                        <span class="admin-username" style="color: ${style.color}; text-shadow: ${style.glow !== 'none' ? style.glow : 'none'}">${escapeHtml(u.username)}</span>
                        <span class="admin-user-meta">${u.role} &middot; ${u.paste_count} pastes</span>
                    </div>
                    <div class="admin-actions">
                        <select class="role-select" onchange="adminSetRole(${u.id}, this.value)">
                            ${Object.keys(ROLE_STYLES).map(r => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}
                        </select>
                        <button class="btn btn-danger btn-small" onclick="adminDeleteUser(${u.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = '<p>error loading users.</p>';
    }
}

function adminSearchUsers() {
    const query = document.getElementById('adminUserSearch').value.toLowerCase();
    document.querySelectorAll('.admin-user-item').forEach(item => {
        item.style.display = item.querySelector('.admin-username').textContent.toLowerCase().includes(query) ? '' : 'none';
    });
}

async function adminDeleteUser(userId) {
    if (!confirm('delete this user and all their data?')) return;
    try {
        const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
        if (res.ok) { showToast('user deleted', 'success'); adminLoadUsers(); }
        else { const d = await res.json(); showToast(d.error, 'error'); }
    } catch (e) { showToast('error deleting user', 'error'); }
}

async function adminSetRole(userId, role) {
    try {
        const res = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role })
        });
        if (res.ok) { showToast('role updated', 'success'); adminLoadUsers(); }
        else { const d = await res.json(); showToast(d.error, 'error'); }
    } catch (e) { showToast('error setting role', 'error'); }
}

async function adminLoadPastes() {
    const container = document.getElementById('adminPastesList');
    try {
        const res = await fetch('/api/admin/pastes');
        const data = await res.json();
        
        container.innerHTML = data.pastes.map(p => {
            const date = new Date(p.created_at).toLocaleDateString();
            const displayViews = (p.views || 0) + (p.fake_views || 0);
            return `
                <div class="admin-paste-item">
                    <div class="admin-paste-info">
                        <span class="admin-paste-title">${p.pinned ? '&#9733; ' : ''}${escapeHtml(p.title)}</span>
                        <span class="admin-paste-meta">by ${escapeHtml(p.username)} &middot; ${date} &middot; ${displayViews} views</span>
                    </div>
                    <div class="admin-actions">
                        <button class="btn btn-small" style="border-color: ${p.pinned ? '#00ff41' : 'var(--border-bright)'}; color: ${p.pinned ? '#00ff41' : 'var(--text-muted)'}" onclick="adminTogglePin('${p.paste_id}')"><i class="fas fa-thumbtack"></i></button>
                        <button class="btn btn-small" onclick="adminSpoofViews('${p.paste_id}')" style="border-color: #ffaa00; color: #ffaa00"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-small" onclick="adminSpoofLikes('${p.paste_id}')" style="border-color: #ff3355; color: #ff3355"><i class="fas fa-heart"></i></button>
                        <button class="btn btn-danger btn-small" onclick="adminDeletePaste('${p.paste_id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        container.innerHTML = '<p>error loading pastes.</p>';
    }
}

function adminSearchPastes() {
    const query = document.getElementById('adminPasteSearch').value.toLowerCase();
    document.querySelectorAll('.admin-paste-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(query) ? '' : 'none';
    });
}

async function adminTogglePin(pasteId) {
    try {
        const res = await fetch(`/api/admin/pastes/${pasteId}/pin`, { method: 'POST' });
        if (res.ok) { showToast('pin toggled', 'success'); adminLoadPastes(); }
    } catch (e) { showToast('error', 'error'); }
}

async function adminSpoofLikes(pasteId) {
    const fakeLikes = prompt('enter fake like count:');
    if (fakeLikes === null) return;
    const count = parseInt(fakeLikes);
    if (isNaN(count) || count < 0) { showToast('invalid number', 'error'); return; }
    try {
        const res = await fetch(`/api/admin/pastes/${pasteId}/spoof-likes`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fake_likes: count })
        });
        if (res.ok) { showToast(`likes spoofed to ${count}`, 'success'); adminLoadPastes(); }
    } catch (e) { showToast('error', 'error'); }
}

async function adminSpoofViews(pasteId) {
    const fakeViews = prompt('enter fake view count:');
    if (fakeViews === null) return;
    const count = parseInt(fakeViews);
    if (isNaN(count) || count < 0) { showToast('invalid number', 'error'); return; }
    
    try {
        const res = await fetch(`/api/admin/pastes/${pasteId}/spoof`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fake_views: count })
        });
        if (res.ok) { showToast(`views spoofed to ${count}`, 'success'); adminLoadPastes(); }
    } catch (e) { showToast('error', 'error'); }
}

async function adminDeletePaste(pasteId) {
    if (!confirm('delete this paste?')) return;
    try {
        const res = await fetch(`/api/admin/pastes/${pasteId}/delete`, { method: 'DELETE' });
        if (res.ok) { showToast('paste deleted', 'success'); adminLoadPastes(); }
        else { const d = await res.json(); showToast(d.error, 'error'); }
    } catch (e) { showToast('error deleting paste', 'error'); }
}

async function adminLoadAnnouncements() {
    const container = document.getElementById('adminAnnouncementsList');
    try {
        const res = await fetch('/api/announcements');
        const data = await res.json();
        container.innerHTML = data.announcements.map(a => `
            <div class="admin-paste-item">
                <div class="admin-paste-info">
                    <span class="admin-paste-title">${escapeHtml(a.title)}</span>
                    <span class="admin-paste-meta">by ${escapeHtml(a.author)}</span>
                </div>
                <div class="admin-actions">
                    <button class="btn btn-danger btn-small" onclick="adminDeleteAnnouncement(${a.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    } catch (e) { container.innerHTML = ''; }
}

async function postAnnouncement() {
    const title = document.getElementById('announceTitle').value.trim();
    const content = document.getElementById('announceContent').value.trim();
    if (!title || !content) { showToast('title and content required', 'error'); return; }
    
    try {
        const res = await fetch('/api/announcements', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });
        if (res.ok) {
            showToast('announcement posted', 'success');
            document.getElementById('announceTitle').value = '';
            document.getElementById('announceContent').value = '';
            adminLoadAnnouncements();
        } else { const d = await res.json(); showToast(d.error, 'error'); }
    } catch (e) { showToast('error posting announcement', 'error'); }
}

async function adminDeleteAnnouncement(id) {
    if (!confirm('delete this announcement?')) return;
    try {
        const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
        if (res.ok) { showToast('announcement deleted', 'success'); adminLoadAnnouncements(); }
    } catch (e) { showToast('error', 'error'); }
}

async function loadTOSForAdmin() {
    try {
        const res = await fetch('/api/tos');
        const data = await res.json();
        document.getElementById('tosEditor').value = data.tos.content;
    } catch (e) { document.getElementById('tosEditor').value = 'error loading tos.'; }
}

async function saveTOS() {
    const content = document.getElementById('tosEditor').value.trim();
    if (!content) { showToast('content required', 'error'); return; }
    try {
        const res = await fetch('/api/tos', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        if (res.ok) showToast('tos updated', 'success');
        else { const d = await res.json(); showToast(d.error, 'error'); }
    } catch (e) { showToast('error saving tos', 'error'); }
}

// ======================== TOAST ========================
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = `> ${message}`;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    
    clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ======================== UTILITIES ========================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}