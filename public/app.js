// ─────────────────────────────────────────────
// UI Feedback: Toast + Confirm Modal
// (แทนที่ alert()/confirm()/prompt() ของเบราว์เซอร์ ให้หน้าตาตรงกับธีมแอป)
// ─────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3200) {
    const container = document.getElementById('toast-container');
    if (!container) { console.log(message); return; }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    el.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(el);
    setTimeout(() => {
        el.classList.add('toast-hide');
        setTimeout(() => el.remove(), 200);
    }, duration);
}
window.showToast = showToast;

function confirmModal(message, title = '⚠️ ยืนยันการทำรายการ') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modal-confirm');
        document.getElementById('modal-confirm-title').textContent = title;
        document.getElementById('modal-confirm-message').textContent = message;
        overlay.style.display = 'flex';

        const okBtn = document.getElementById('modal-confirm-ok');
        const cancelBtn = document.getElementById('modal-confirm-cancel');

        function cleanup(result) {
            overlay.style.display = 'none';
            okBtn.removeEventListener('click', onOk);
            cancelBtn.removeEventListener('click', onCancel);
            overlay.removeEventListener('click', onOverlay);
            resolve(result);
        }
        function onOk() { cleanup(true); }
        function onCancel() { cleanup(false); }
        function onOverlay(e) { if (e.target === overlay) cleanup(false); }

        okBtn.addEventListener('click', onOk);
        cancelBtn.addEventListener('click', onCancel);
        overlay.addEventListener('click', onOverlay);
    });
}
window.confirmModal = confirmModal;

// ─────────────────────────────────────────────
// Session Management
// ─────────────────────────────────────────────
let currentUser = null; // { id, username, display_name, role }

function roleLabel(role) {
    if (role === 'admin') return '👑 Admin';
    if (role === 'staff') return '⭐ Staff';
    return '👤 User';
}
function roleBadgeClass(role) {
    if (role === 'admin') return 'role-admin';
    if (role === 'staff') return 'role-staff';
    return 'role-user';
}

function getSession() {
    try {
        const s = sessionStorage.getItem('joblogger_user');
        if (s) return JSON.parse(s);
        const l = localStorage.getItem('joblogger_remember');
        return l ? JSON.parse(l) : null;
    } catch { return null; }
}

function setSession(user, remember = false) {
    sessionStorage.setItem('joblogger_user', JSON.stringify(user));
    if (remember) {
        localStorage.setItem('joblogger_remember', JSON.stringify(user));
    }
    currentUser = user;
}

function clearSession() {
    sessionStorage.removeItem('joblogger_user');
    localStorage.removeItem('joblogger_remember');
    currentUser = null;
}

function logout() {
    clearSession();
    location.reload();
}

// ─────────────────────────────────────────────
// Login Handler
// ─────────────────────────────────────────────
document.getElementById('btn-login').addEventListener('click', async () => {
    const username = document.getElementById('login-username').value.trim();
    const pin = document.getElementById('login-pin').value.trim();
    const errorEl = document.getElementById('login-error');

    if (!username || !pin) {
        errorEl.textContent = '⚠️ กรุณากรอก Username และ PIN ครับ';
        errorEl.style.display = 'block';
        return;
    }

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, pin })
        });
        const data = await res.json();
        if (!res.ok) {
            errorEl.textContent = '❌ ' + (data.error || 'เข้าสู่ระบบไม่สำเร็จ');
            errorEl.style.display = 'block';
            return;
        }
        const remember = document.getElementById('login-remember').checked;
        setSession(data, remember);
        initAfterLogin();
    } catch (e) {
        errorEl.textContent = '❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
        errorEl.style.display = 'block';
    }
});

// Enter key on PIN field
document.getElementById('login-pin').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-login').click();
});

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
function initAfterLogin() {
    const overlay = document.getElementById('login-overlay');
    overlay.style.opacity = '0';
    setTimeout(() => overlay.style.display = 'none', 300);

    // แสดง user badge
    const badge = document.getElementById('user-badge');
    const badgeName = document.getElementById('user-badge-name');
    const badgeRole = document.getElementById('user-badge-role');
    badgeName.textContent = currentUser.display_name || currentUser.username;
    badgeRole.textContent = roleLabel(currentUser.role);
    badge.style.display = 'flex';
    document.getElementById('btn-logout').style.display = 'inline-flex';
    document.getElementById('btn-profile').style.display = 'flex';

    // Admin → แสดงคอลัมน์ช่าง + dropdown filter user + หน้า Admin
    if (currentUser.role === 'admin') {
        document.getElementById('col-technician').style.display = '';
        document.getElementById('filter-user').style.display = '';
        document.getElementById('nav-admin').style.display = '';
        document.getElementById('btn-danger-month').style.display = '';
        document.getElementById('btn-danger-all').style.display = '';
        loadUserFilterOptions();
    }

    // Admin หรือ Staff → เห็นเมนู "รายได้" (staff เห็นแค่ของตัวเอง, admin เลือกดูของใครก็ได้)
    if (currentUser.role === 'admin' || currentUser.role === 'staff') {
        document.getElementById('nav-income').style.display = '';
    }

    fetchJobs();
}

async function loadUserFilterOptions() {
    // ดึง users ทั้งหมดมาใส่ใน dropdown (admin เท่านั้น)
    const res = await fetch('/api/auth/users');
    if (!res.ok) return;
    const users = await res.json();
    const sel = document.getElementById('filter-user');
    users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = u.display_name || u.username;
        sel.appendChild(opt);
    });
}

// Check session on page load
window.addEventListener('DOMContentLoaded', () => {
    const session = getSession();
    if (session) {
        currentUser = session;
        initAfterLogin();
    }
    // else: overlay stays visible, waiting for login
});

// ─────────────────────────────────────────────
// API & Data
// ─────────────────────────────────────────────
const API_URL = '/api/jobs';
let allJobs = [];
let currentFilteredJobs = [];

function resolveImageUrl(imagePath) {
    if (!imagePath) return '';
    return imagePath.startsWith('http') ? imagePath : '/' + imagePath;
} 

let selectedBrandFilter = 'all';
let selectedTypeFilter = 'all';

const jobForm = document.getElementById('job-form');
const jobIdInput = document.getElementById('job-id');
const imagePathInput = document.getElementById('image_path');
const dateInput = document.getElementById('date');
const timeInput = document.getElementById('time');
const shopBrandInput = document.getElementById('shop_brand'); 
const shopNameInput = document.getElementById('shop_name');
const branchCodeInput = document.getElementById('branch_code');
const branchNameInput = document.getElementById('branch_name');
const jobTypeInput = document.getElementById('job_type');
const repairDetailContainer = document.getElementById('repair-detail-container');
const repairDetailInput = document.getElementById('repair_detail');
const jobImageInput = document.getElementById('job_image'); 
const jobTableBody = document.getElementById('job-table-body');

const searchInput = document.getElementById('search-input');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const btnClearFilter = document.getElementById('btn-clear-filter');

// 🌗 ระบบ Dark / Light Theme
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

const currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);
themeIcon.innerText = currentTheme === 'dark' ? '☀️' : '🌙';

themeToggleBtn.addEventListener('click', () => {
    let theme = 'light';
    if (document.documentElement.getAttribute('data-theme') === 'light') {
        theme = 'dark';
        themeIcon.innerText = '☀️';
    } else {
        themeIcon.innerText = '🌙';
    }
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
});

// 🔄 ดักจับการเปลี่ยนค่าประเภทงานเพื่อซ่อน/แสดงช่อง "ซ่อมอะไร"
jobTypeInput.addEventListener('change', function() {
    if (this.value === 'Repair') {
        repairDetailContainer.style.display = 'block';
        repairDetailInput.setAttribute('required', 'true');
    } else {
        repairDetailContainer.style.display = 'none';
        repairDetailInput.removeAttribute('required');
        repairDetailInput.value = '';
    }
});

function capitalizeText(text) {
    if (!text) return '-';
    return text.trim().split(' ').map(word => {
        if (!word) return '';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
}

window.switchPage = function(pageTarget) {
    document.querySelectorAll('.app-page').forEach(page => page.classList.remove('active'));
    document.getElementById(`page-${pageTarget}`).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    // บางหน้า (เช่น "โปรไฟล์") ย้ายไปเข้าถึงผ่านไอคอนบน header แทน bottom nav แล้ว จึงอาจไม่มีปุ่ม nav-* คู่กัน
    const navBtn = document.getElementById(`nav-${pageTarget}`);
    if (navBtn) navBtn.classList.add('active');

    document.querySelectorAll('.btn-theme').forEach(b => b.classList.remove('active-page-icon'));
    if (pageTarget === 'profile') {
        const profileBtn = document.getElementById('btn-profile');
        if (profileBtn) profileBtn.classList.add('active-page-icon');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', () => {}); // handled by initAfterLogin

async function fetchJobs() {
    if (!currentUser) return;
    try {
        const params = new URLSearchParams({
            user_id: currentUser.id,
            role: currentUser.role
        });
        const response = await fetch(`${API_URL}?${params}`);
        allJobs = await response.json();
        currentFilteredJobs = [...allJobs];
        filterJobs();
        // ใช้ grouped jobs เพื่อนับสถิติ dashboard ให้ตรงกับจำนวนงานจริง (ไม่นับตามจำนวนใบงาน/รูป)
        updateDashboardStats(groupJobsBySession(allJobs));
    } catch (error) {
        console.error('Error fetching jobs:', error);
    }
}

function updateDashboardStats(jobs) {
    let mkCount = 0; let fujiCount = 0; let luckyCount = 0; let smeCount = 0; let bbqCount = 0; let bonusCount = 0;
    let repairCount = 0; let maCount = 0; let installCount = 0;
    let latestJob = null;

    jobs.forEach(job => {
        const brand = capitalizeText(job.shop_brand || job.shop_name);
        const type = job.job_type ? job.job_type.toLowerCase().trim() : '';

        if (brand === 'Mk') mkCount++;
        else if (brand === 'Fuji') fujiCount++;
        else if (brand === 'Lucky') luckyCount++;
        else if (brand === 'Bonus') bonusCount++;
        else if (brand === 'Bbq') bbqCount++;
        else smeCount++;

        if (type.includes('repair') || type.includes('ซ่อม')) repairCount++;
        else if (type.includes('ma') || type.includes('maintenance') || type.includes('บำรุง') || type.includes('ล้าง')) maCount++;
        else if (type.includes('ติดตั้ง') || type.includes('install')) installCount++;

        if (!latestJob) { latestJob = job; } 
        else {
            const currentJobTime = `${job.date}T${job.time}`;
            const latestJobTime = `${latestJob.date}T${latestJob.time}`;
            if (currentJobTime > latestJobTime) { latestJob = job; }
        }
    });

    document.getElementById('stat-shop-mk').innerText = mkCount;
    document.getElementById('stat-shop-fuji').innerText = fujiCount;
    document.getElementById('stat-shop-lucky').innerText = luckyCount;
    if (document.getElementById('stat-shop-bonus')) document.getElementById('stat-shop-bonus').innerText = bonusCount;
    if (document.getElementById('stat-shop-sme')) document.getElementById('stat-shop-sme').innerText = smeCount;
    if (document.getElementById('stat-shop-bbq')) document.getElementById('stat-shop-bbq').innerText = bbqCount;

    document.getElementById('stat-type-repair').innerText = repairCount;
    document.getElementById('stat-type-ma').innerText = maCount;
    document.getElementById('stat-type-install').innerText = installCount;

    if (latestJob) {
        document.getElementById('stat-last-date').innerText = `${latestJob.date} (${latestJob.time} น.)`;
        const shopUpper = capitalizeText(latestJob.shop_name);
        const branchFormatted = capitalizeText(latestJob.branch_name);
        
        if (latestJob.branch_code && latestJob.branch_code !== '-') {
            document.getElementById('stat-location').innerText = `${shopUpper} (${latestJob.branch_code}) - ${branchFormatted}`;
        } else {
            document.getElementById('stat-location').innerText = `${shopUpper} - ${branchFormatted}`;
        }
    } else {
        document.getElementById('stat-last-date').innerText = '-';
        document.getElementById('stat-location').innerText = '-';
    }
}

function groupJobsBySession(jobs) {
    // รวม jobs ที่มีข้อมูลเหมือนกัน (date+time+shop+branch+job_type+repair_detail+user_id)
    // ไว้ใน row เดียว แสดงรูปทุกใบในช่องเดียวกัน
    const groups = [];
    const keyMap = {};

    jobs.forEach(job => {
        const key = [
            job.date, job.time,
            (job.shop_brand || '').toLowerCase(),
            (job.shop_name || '').toLowerCase(),
            (job.branch_code || '').toLowerCase(),
            (job.branch_name || '').toLowerCase(),
            (job.job_type || '').toLowerCase(),
            (job.repair_detail || '').toLowerCase(),
            job.user_id || ''
        ].join('|');

        if (keyMap[key] !== undefined) {
            // เพิ่มรูปและ id เข้า group เดิม
            groups[keyMap[key]].images.push(job.image_path);
            groups[keyMap[key]].ids.push(job.id);
        } else {
            keyMap[key] = groups.length;
            groups.push({ ...job, images: [job.image_path], ids: [job.id] });
        }
    });

    return groups;
}

function renderTable(jobs) {
    jobTableBody.innerHTML = '';

    const grouped = groupJobsBySession(jobs);
    document.getElementById('filtered-count').innerText = grouped.length;

    grouped.forEach(job => {
        // สร้าง HTML รูปหลายรูป
        const validImages = job.images.filter(p => p);
        let imageHtml;
        if (validImages.length === 0) {
            imageHtml = '<span style="color:#94a3b8; font-style:italic; font-size:0.85rem;">ไม่มีรูปภาพ</span>';
        } else {
            imageHtml = `<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">`;
            validImages.forEach((imgPath, idx) => {
                const imgUrl = resolveImageUrl(imgPath);
                imageHtml += `<div class="img-container" style="position:relative;">
                    <img src="${imgUrl}" alt="ใบงาน ${idx+1}" class="img-thumb" style="cursor:pointer;"
                        onclick="openLightbox('${imgUrl}', '${capitalizeText(job.shop_name)} - ${capitalizeText(job.branch_name)} (ใบที่ ${idx+1})')"
                        title="ใบงานที่ ${idx+1} — คลิกขยาย">
                    ${validImages.length > 1 ? `<span style="position:absolute;bottom:2px;right:4px;background:rgba(0,0,0,0.55);color:#fff;font-size:0.65rem;border-radius:4px;padding:1px 4px;">${idx+1}/${validImages.length}</span>` : ''}
                </div>`;
            });
            imageHtml += `</div>`;
        }

        const brandFormatted = capitalizeText(job.shop_brand);
        let brandClass = 'badge-sme';
        if (brandFormatted === 'Mk') brandClass = 'badge-mk';
        else if (brandFormatted === 'Fuji') brandClass = 'badge-fuji';
        else if (brandFormatted === 'Lucky') brandClass = 'badge-lucky';
        else if (brandFormatted === 'Bonus') brandClass = 'badge-bonus';
        else if (brandFormatted === 'Bbq') brandClass = 'badge-bbq';

        let displayJobType = job.job_type;
        if (job.job_type === 'Repair' && job.repair_detail) {
            displayJobType = `Repair<br><small style="color: var(--danger-color); font-weight:500;">(${job.repair_detail})</small>`;
        } else if (job.job_type === 'Maintenance') {
            displayJobType = 'MA';
        } else if (job.job_type === 'Installation') {
            displayJobType = 'Installation';
        }

        const techName = job.users ? (job.users.display_name || job.users.username) : '-';
        const isAdmin = currentUser && currentUser.role === 'admin';

        // ปุ่มจัดการ: แก้ไขและลบ id แรกเป็น primary, ถ้ามีหลาย id ให้ลบทุกใบพร้อมกัน
        const primaryId = job.ids[0];
        const deleteLabel = job.ids.length > 1 ? `ลบ (${job.ids.length} ใบ)` : 'ลบ';
        const deleteHandler = job.ids.length > 1
            ? `deleteJobGroup([${job.ids.join(',')}])`
            : `deleteJob(${primaryId})`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="job-card-primary" data-label="วันที่"><b>${job.date}</b></td>
            <td data-label="เวลา"><span style="color: var(--text-muted);">${job.time} น.</span></td>
            ${isAdmin ? `<td data-label="ช่าง"><span style="font-size:0.9rem; color:var(--text-muted);">${techName}</span></td>` : ''}
            <td data-label="ร้าน/แบรนด์"><span class="custom-badge ${brandClass}">${capitalizeText(job.shop_name)}</span></td>
            <td data-label="รหัสสาขา"><code>${job.branch_code ? job.branch_code.toUpperCase() : '-'}</code></td>
            <td data-label="ชื่อสาขา">${capitalizeText(job.branch_name)}</td>
            <td data-label="ประเภทงาน"><span style="background: var(--panel-bg); color: var(--accent-color); padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; font-weight: 500; display: inline-block; line-height: 1.2;">${displayJobType}</span></td>
            <td data-label="รูปใบงาน">${imageHtml}</td>
            <td data-label="จัดการ">
                <div class="action-cell">
                    <button class="btn btn-edit" onclick="editJob(${primaryId})">แก้ไข</button>
                    <button class="btn btn-delete" onclick="${deleteHandler}">${deleteLabel}</button>
                </div>
            </td>
        `;
        jobTableBody.appendChild(tr);
    });
}

window.setQuickFilter = function(filterCategory, filterValue) {
    if (filterCategory === 'brand') {
        selectedBrandFilter = filterValue;
        document.querySelectorAll('[id^="tag-brand-"]').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`tag-brand-${filterValue.toLowerCase()}`).classList.add('active');
    } else if (filterCategory === 'type') {
        selectedTypeFilter = filterValue;
        document.querySelectorAll('[id^="tag-type-"]').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`tag-type-${filterValue.toLowerCase()}`).classList.add('active');
    }
    filterJobs(); 
}

function filterJobs() {
    const query = searchInput.value.toLowerCase().trim();
    const startDate = startDateInput.value; const endDate = endDateInput.value;
    const userFilterEl = document.getElementById('filter-user');
    const selectedUser = userFilterEl ? userFilterEl.value : 'all';

    currentFilteredJobs = allJobs.filter(job => {
        if (selectedBrandFilter !== 'all') {
            const currentBrand = capitalizeText(job.shop_brand).toLowerCase();
            if (currentBrand !== selectedBrandFilter.toLowerCase()) return false;
        }

        if (selectedTypeFilter !== 'all') {
            const currentJobType = job.job_type ? job.job_type.toLowerCase() : '';
            if (selectedTypeFilter === 'repair' && !currentJobType.includes('repair')) return false;
            if (selectedTypeFilter === 'ma' && !currentJobType.includes('ma') && !currentJobType.includes('maintenance')) return false;
            if (selectedTypeFilter === 'install' && !currentJobType.includes('install')) return false;
        }

        // Admin user filter
        if (selectedUser !== 'all' && String(job.user_id) !== String(selectedUser)) return false;

        const matchesQuery = 
            (job.shop_brand && job.shop_brand.toLowerCase().includes(query)) ||
            (job.shop_name && job.shop_name.toLowerCase().includes(query)) || 
            (job.branch_name && job.branch_name.toLowerCase().includes(query)) ||
            (job.branch_code && job.branch_code.toLowerCase().includes(query)) ||
            (job.repair_detail && job.repair_detail.toLowerCase().includes(query)) ||
            (job.job_type && job.job_type.toLowerCase().includes(query));

        if (!matchesQuery) return false;
        if (startDate && job.date < startDate) return false;
        if (endDate && job.date > endDate) return false;

        return true;
    });
    // อัปเดต dashboard stats โดยนับจาก grouped (1 งาน = 1 นับ ไม่ว่าจะมีกี่ใบงาน)
    updateDashboardStats(groupJobsBySession(currentFilteredJobs));
    renderTable(currentFilteredJobs);
}

// ตัวกรองเพิ่มเติม (ประเภทงาน/ค้นหา/ช่วงวันที่): ซ่อน/แสดงได้ เพื่อลดความรกบนจอมือถือ — จำสถานะไว้ใน localStorage
window.toggleSearchPanel = function() {
    const body = document.getElementById('search-panel-body');
    const btn = document.getElementById('btn-toggle-search-panel');
    const collapsed = body.style.display === 'none';
    body.style.display = collapsed ? '' : 'none';
    btn.textContent = collapsed ? 'ซ่อน ▲' : 'แสดง ▼';
    localStorage.setItem('searchPanelCollapsed', collapsed ? '0' : '1');
};
(function initSearchPanelState() {
    if (localStorage.getItem('searchPanelCollapsed') === '1') {
        document.getElementById('search-panel-body').style.display = 'none';
        document.getElementById('btn-toggle-search-panel').textContent = 'แสดง ▼';
    }
})();

searchInput.addEventListener('input', filterJobs);
startDateInput.addEventListener('change', filterJobs);
endDateInput.addEventListener('change', filterJobs);

btnClearFilter.addEventListener('click', () => {
    searchInput.value = ''; startDateInput.value = ''; endDateInput.value = ''; 
    selectedBrandFilter = 'all'; selectedTypeFilter = 'all';
    
    document.querySelectorAll('[id^="tag-brand-"]').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('[id^="tag-type-"]').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tag-brand-all').classList.add('active');
    document.getElementById('tag-type-all').classList.add('active');
    
    currentFilteredJobs = [...allJobs];
    updateDashboardStats(groupJobsBySession(allJobs));
    renderTable(allJobs);
});

window.exportToExcel = function() {
    if (typeof XLSX === 'undefined') { showToast('ตรวจไม่พบโมดูล XLSX ครับ', 'error'); return; }
    if (!currentFilteredJobs || currentFilteredJobs.length === 0) { showToast('ไม่มีข้อมูลจะส่งออกครับ', 'error'); return; }

    try {
        const grouped = groupJobsBySession(currentFilteredJobs);
        const dataForExcel = grouped.map((job, idx) => {
            const imageUrls = job.images
                .filter(p => p)
                .map(p => p.startsWith('http') ? p : window.location.origin + '/' + p)
                .join(' | ');
            return {
                'ลำดับ': idx + 1,
                'วันที่เข้าทำงาน': job.date || '-',
                'เวลา': job.time || '-',
                'กลุ่มสถิติแบรนด์': capitalizeText(job.shop_brand),
                'ชื่อร้านค้า': capitalizeText(job.shop_name) || '-',
                'รหัสสาขา': job.branch_code ? job.branch_code.toUpperCase() : '-',
                'ชื่อสาขา/สถานที่': capitalizeText(job.branch_name) || '-',
                'ประเภทงานหลัก': job.job_type || '-',
                'รายละเอียดความเสียหาย (กรณีงานซ่อม)': job.repair_detail || '-',
                'จำนวนรูปใบงาน': job.images.filter(p => p).length,
                'ที่อยู่ไฟล์รูปภาพ': imageUrls || 'ไม่มีรูปภาพ'
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "บันทึกงานช่าง");
        XLSX.writeFile(workbook, `สรุปรายงานประวัติงานซ่อม_${new Date().toISOString().split('T')[0]}.xlsx`);
        showToast('ส่งออก Excel สำเร็จ', 'success');
    } catch (e) { showToast('เกิดข้อผิดพลาดในการส่งออก Excel: ' + e.message, 'error'); }
};

window.openLightbox = function(src, caption) {
    const modal = document.getElementById('lightbox-modal'); const img = document.getElementById('lightbox-img');
    const captionText = document.getElementById('lightbox-caption');
    modal.style.display = "block"; img.src = src; captionText.innerHTML = caption;
}
window.closeLightbox = function() { document.getElementById('lightbox-modal').style.display = "none"; }

window.dangerDelete = async function(type) {
    if (!currentUser || currentUser.role !== 'admin') { showToast('เฉพาะ Admin เท่านั้นที่ทำรายการนี้ได้', 'error'); return; }

    let confirmMsg = ""; let deleteUrl = "";
    const requesterParams = `requester_id=${currentUser.id}&role=${currentUser.role}`;

    if (type === 'all') {
        confirmMsg = "คุณกำลังจะลบข้อมูลงานซ่อมทั้งหมดในระบบ การกระทำนี้ไม่สามารถย้อนกลับได้ ยืนยันทำรายการต่อใช่ไหม?";
        deleteUrl = `${API_URL}/danger/all?${requesterParams}`;
    } else if (type === 'month') {
        const startDate = startDateInput.value; const endDate = endDateInput.value;
        if (!startDate || !endDate) { showToast('กรุณากำหนดช่วงวันที่ตัวกรองก่อนครับ', 'error'); return; }
        confirmMsg = `ยืนยันลบข้อมูลงานในช่วงวันที่ ${startDate} ถึง ${endDate} หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`;
        deleteUrl = `${API_URL}/danger/range?start=${startDate}&end=${endDate}&${requesterParams}`;
    }

    const confirmed = await confirmModal(confirmMsg, '🚨 ลบข้อมูลถาวร');
    if (!confirmed) return;

    try {
        const response = await fetch(deleteUrl, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) { showToast(result.message, 'success'); await fetchJobs(); }
        else { showToast('เกิดข้อผิดพลาด: ' + result.error, 'error'); }
    } catch (error) { showToast('ล้มเหลวในการเชื่อมต่อเซิร์ฟเวอร์', 'error'); }
};

jobForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = jobIdInput.value;

    const formData = new FormData();
    formData.append('date', dateInput.value);
    formData.append('time', timeInput.value);
    formData.append('shop_brand', capitalizeText(shopBrandInput.value)); 
    formData.append('shop_name', capitalizeText(shopNameInput.value));
    formData.append('branch_code', branchCodeInput.value ? branchCodeInput.value.toUpperCase() : '-');
    formData.append('branch_name', capitalizeText(branchNameInput.value));
    formData.append('job_type', jobTypeInput.value);
    formData.append('repair_detail', jobTypeInput.value === 'Repair' ? repairDetailInput.value : '');
    formData.append('image_path', imagePathInput.value || '');
    if (currentUser) formData.append('user_id', currentUser.id);

    if (jobImageInput.files.length > 0) { formData.append('image', jobImageInput.files[0]); }

    try {
        let response = id ? 
            await fetch(`${API_URL}/${id}`, { method: 'PUT', body: formData }) : 
            await fetch(API_URL, { method: 'POST', body: formData });

        if (response.ok) {
            jobForm.reset(); jobIdInput.value = ''; imagePathInput.value = '';
            repairDetailContainer.style.display = 'none';
            document.getElementById('form-title').innerText = '📝 ลงข้อมูลงานใหม่';
            document.getElementById('btn-save').innerHTML = '🚀 ยืนยันบันทึกข้อมูลงาน';
            document.getElementById('btn-cancel').style.display = 'none';
            await fetchJobs(); switchPage('table');
            showToast(id ? 'อัปเดตข้อมูลงานสำเร็จ' : 'บันทึกข้อมูลงานสำเร็จ', 'success');
        } else { showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูลงาน', 'error'); }
    } catch (error) { console.error(error); showToast('ล้มเหลวในการเชื่อมต่อเซิร์ฟเวอร์', 'error'); }
});

window.deleteJob = async function(id) {
    const confirmed = await confirmModal('คุณแน่ใจหรือไม่ที่จะลบรายการนี้?');
    if (!confirmed) return;
    const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    if (response.ok) { fetchJobs(); showToast('ลบรายการสำเร็จ', 'success'); }
    else showToast('ลบรายการไม่สำเร็จ', 'error');
};

window.deleteJobGroup = async function(ids) {
    const confirmed = await confirmModal(`คุณแน่ใจหรือไม่ที่จะลบงานนี้ทั้งหมด ${ids.length} ใบ?`);
    if (!confirmed) return;
    await Promise.all(ids.map(id => fetch(`${API_URL}/${id}`, { method: 'DELETE' })));
    fetchJobs();
    showToast('ลบรายการสำเร็จ', 'success');
};

window.editJob = function(id) {
    const job = allJobs.find(j => j.id === id); if (!job) return;
    jobIdInput.value = job.id; imagePathInput.value = job.image_path || '';
    dateInput.value = job.date; timeInput.value = job.time;
    shopBrandInput.value = capitalizeText(job.shop_brand); shopNameInput.value = capitalizeText(job.shop_name);
    branchCodeInput.value = job.branch_code ? job.branch_code.toUpperCase() : '-';
    branchNameInput.value = capitalizeText(job.branch_name);
    
    jobTypeInput.value = job.job_type;
    if (job.job_type === 'Repair') {
        repairDetailContainer.style.display = 'block';
        repairDetailInput.setAttribute('required', 'true');
        repairDetailInput.value = job.repair_detail || '';
    } else {
        repairDetailContainer.style.display = 'none';
        repairDetailInput.removeAttribute('required');
        repairDetailInput.value = '';
    }
    jobImageInput.value = ''; 
    
    document.getElementById('form-title').innerText = '⚙️ แก้ไขรายการงานซ่อม';
    document.getElementById('btn-save').innerHTML = '💾 อัปเดตข้อมูล';
    document.getElementById('btn-cancel').style.display = 'inline-block';
    switchPage('form'); 
};

document.getElementById('btn-cancel').addEventListener('click', () => {
    jobForm.reset(); jobIdInput.value = ''; imagePathInput.value = '';
    repairDetailContainer.style.display = 'none';
    document.getElementById('form-title').innerText = '📝 ลงข้อมูลงานใหม่';
    document.getElementById('btn-save').innerHTML = '🚀 ยืนยันบันทึกข้อมูลงาน';
    document.getElementById('btn-cancel').style.display = 'none';
    switchPage('table');
});
// ─────────────────────────────────────────────
// Profile Page
// ─────────────────────────────────────────────
function renderProfilePage() {
    if (!currentUser) return;
    document.getElementById('profile-display-name').textContent = currentUser.display_name || currentUser.username;
    document.getElementById('profile-username').textContent = '@' + currentUser.username;
    const roleEl = document.getElementById('profile-role-badge');
    roleEl.textContent = roleLabel(currentUser.role);
    roleEl.className = 'profile-role ' + roleBadgeClass(currentUser.role);
}

// เปลี่ยน PIN
document.getElementById('btn-change-pin').addEventListener('click', async () => {
    const oldPin = document.getElementById('old-pin').value.trim();
    const newPin = document.getElementById('new-pin').value.trim();
    const confirmPin = document.getElementById('confirm-pin').value.trim();
    const successEl = document.getElementById('pin-success');
    const errorEl = document.getElementById('pin-error');

    successEl.style.display = 'none';
    errorEl.style.display = 'none';

    if (!oldPin || !newPin || !confirmPin) {
        errorEl.textContent = '⚠️ กรุณากรอกข้อมูลให้ครบทุกช่อง';
        errorEl.style.display = 'block'; return;
    }
    if (newPin !== confirmPin) {
        errorEl.textContent = '❌ PIN ใหม่ทั้งสองช่องไม่ตรงกัน';
        errorEl.style.display = 'block'; return;
    }
    if (!/^\d{4,6}$/.test(newPin)) {
        errorEl.textContent = '❌ PIN ต้องเป็นตัวเลข 4-6 หลักเท่านั้น';
        errorEl.style.display = 'block'; return;
    }

    try {
        const res = await fetch('/api/auth/change-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id, old_pin: oldPin, new_pin: newPin })
        });
        const data = await res.json();
        if (!res.ok) {
            errorEl.textContent = '❌ ' + (data.error || 'เปลี่ยน PIN ไม่สำเร็จ');
            errorEl.style.display = 'block';
        } else {
            successEl.textContent = '✅ ' + data.message;
            successEl.style.display = 'block';
            document.getElementById('old-pin').value = '';
            document.getElementById('new-pin').value = '';
            document.getElementById('confirm-pin').value = '';
        }
    } catch (e) {
        errorEl.textContent = '❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
        errorEl.style.display = 'block';
    }
});

// Override switchPage เพื่อ render profile เมื่อเปิดหน้านั้น
const _origSwitchPage = window.switchPage;
window.switchPage = function(pageTarget) {
    _origSwitchPage(pageTarget);
    if (pageTarget === 'profile') renderProfilePage();
};

// ─────────────────────────────────────────────
// Admin Panel
// ─────────────────────────────────────────────
let adminUsers = [];
let resetTargetUserId = null;

async function loadAdminPanel() {
    const res = await fetch('/api/admin/users');
    if (!res.ok) return;
    adminUsers = await res.json();

    // Stats
    document.getElementById('admin-stat-total').textContent = adminUsers.length;
    document.getElementById('admin-stat-admin').textContent = adminUsers.filter(u => u.role === 'admin').length;
    document.getElementById('admin-stat-staff').textContent = adminUsers.filter(u => u.role === 'staff').length;
    document.getElementById('admin-stat-user').textContent = adminUsers.filter(u => u.role === 'user' || !u.role).length;
    document.getElementById('admin-stat-line').textContent = adminUsers.filter(u => u.has_line).length;

    // Render cards
    const container = document.getElementById('admin-user-list');
    if (!adminUsers.length) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:30px;">ไม่พบผู้ใช้งาน</div>';
        return;
    }

    container.innerHTML = adminUsers.map(u => `
        <div class="admin-user-card ${u.role === 'admin' ? 'card-admin' : ''}">
            <div class="auc-top">
                <div class="auc-avatar">${u.role === 'admin' ? '👑' : u.role === 'staff' ? '⭐' : '👤'}</div>
                <div class="auc-info">
                    <div class="auc-name">${u.display_name || u.username}</div>
                    <div class="auc-meta">@${u.username} &nbsp;·&nbsp; ${u.job_count} งาน &nbsp;·&nbsp; ${u.has_line ? '🟢 มี LINE' : '⚪ ไม่มี LINE'}</div>
                </div>
                <span class="auc-role-badge ${roleBadgeClass(u.role)}">
                    ${roleLabel(u.role).replace(/^[^ ]+ /, '')}
                </span>
            </div>
            <div class="auc-actions">
                <label style="font-size:0.78rem;color:var(--text-muted);">Role:</label>
                <select class="role-select" onchange="changeRole(${u.id}, this.value)" style="padding:5px 8px;border-radius:8px;border:1px solid var(--border-color);background:var(--panel-bg);color:var(--text-main);font-size:0.8rem;">
                    <option value="user" ${u.role === 'user' || !u.role ? 'selected' : ''}>User (ช่างทั่วไป)</option>
                    <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Staff (ดูรายได้ตัวเอง)</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
                <button class="btn btn-secondary" onclick="openResetModal(${u.id}, '${u.display_name || u.username}')">
                    🔑 รีเซ็ต PIN
                </button>
                ${u.id !== currentUser.id ? `<button class="btn btn-delete" onclick="deleteUser(${u.id}, '${u.display_name || u.username}')">🗑️ ลบ</button>` : '<span style="font-size:0.75rem;color:var(--text-muted);">(ตัวเอง)</span>'}
            </div>
        </div>
    `).join('');
}

window.changeRole = async function(userId, newRole) {
    const confirmed = await confirmModal(`ยืนยันเปลี่ยน role เป็น "${newRole}" ใช่ไหมครับ?`);
    if (!confirmed) { loadAdminPanel(); return; }
    const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
    });
    const data = await res.json();
    if (res.ok) { loadAdminPanel(); showToast('เปลี่ยน role สำเร็จ', 'success'); }
    else showToast(data.error, 'error');
};

window.openResetModal = function(userId, name) {
    resetTargetUserId = userId;
    document.getElementById('modal-reset-user-name').textContent = `ผู้ใช้: ${name}`;
    document.getElementById('modal-new-pin').value = '';
    document.getElementById('modal-reset-error').style.display = 'none';
    document.getElementById('modal-reset-pin').style.display = 'flex';
};

window.closeResetModal = function(e) {
    if (e && e.target !== document.getElementById('modal-reset-pin')) return;
    document.getElementById('modal-reset-pin').style.display = 'none';
    resetTargetUserId = null;
};

window.confirmResetPin = async function() {
    const newPin = document.getElementById('modal-new-pin').value.trim();
    const errEl = document.getElementById('modal-reset-error');
    if (!/^\d{4,6}$/.test(newPin)) {
        errEl.textContent = 'PIN ต้องเป็นตัวเลข 4-6 หลัก';
        errEl.style.display = 'block'; return;
    }
    const res = await fetch(`/api/admin/users/${resetTargetUserId}/reset-pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_pin: newPin })
    });
    const data = await res.json();
    if (res.ok) {
        document.getElementById('modal-reset-pin').style.display = 'none';
        showToast(data.message, 'success');
    } else {
        errEl.textContent = '❌ ' + data.error;
        errEl.style.display = 'block';
    }
};

window.deleteUser = async function(userId, name) {
    const confirmed = await confirmModal(`ยืนยันลบผู้ใช้ "${name}" ออกจากระบบ? ข้อมูลงานของผู้ใช้นี้จะยังคงอยู่ แต่จะไม่ถูกผูกกับใคร`, '⚠️ ลบผู้ใช้งาน');
    if (!confirmed) return;
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) { loadAdminPanel(); fetchJobs(); showToast('ลบผู้ใช้สำเร็จ', 'success'); }
    else showToast(data.error, 'error');
};

// Override switchPage to trigger admin load
const _origSwitchPage2 = window.switchPage;
window.switchPage = function(pageTarget) {
    _origSwitchPage2(pageTarget);
    if (pageTarget === 'admin' && currentUser && currentUser.role === 'admin') loadAdminPanel();
};

// ─────────────────────────────────────────────
// Income Page (รายได้)
// ─────────────────────────────────────────────
let incomeUsersLoaded = false;

async function loadIncomeUserOptions() {
    const wrap = document.getElementById('income-user-select');
    const sel = document.getElementById('income-user-filter');
    wrap.style.display = '';
    if (incomeUsersLoaded) return;
    const res = await fetch('/api/auth/users');
    if (!res.ok) return;
    const users = await res.json();
    sel.innerHTML = '';
    users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = (u.display_name || u.username) + (u.id === currentUser.id ? ' (ตัวเอง)' : '');
        if (u.id === currentUser.id) opt.selected = true;
        sel.appendChild(opt);
    });
    sel.addEventListener('change', () => loadIncomePage(sel.value));
    incomeUsersLoaded = true;
}

async function loadIncomePage(targetUserId) {
    if (!currentUser) return;
    const cycleLabelEl = document.getElementById('income-cycle-label');
    const breakdownEl = document.getElementById('income-breakdown');
    const totalEl = document.getElementById('income-total');

    if (currentUser.role === 'admin') {
        await loadIncomeUserOptions();
    }

    cycleLabelEl.textContent = 'กำลังโหลด...';
    breakdownEl.innerHTML = '';
    totalEl.style.display = 'none';

    const params = new URLSearchParams({ requester_id: currentUser.id, role: currentUser.role });
    if (currentUser.role === 'admin' && targetUserId) params.set('user_id', targetUserId);

    try {
        const res = await fetch(`/api/income/summary?${params}`);
        const summary = await res.json();
        if (!res.ok) {
            cycleLabelEl.textContent = '❌ ' + (summary.error || 'โหลดข้อมูลไม่สำเร็จ');
            return;
        }

        cycleLabelEl.textContent = `รอบบิล ${summary.cycleStart} ถึง ${summary.cycleEnd}`;

        const rows = [
            { label: '🔧 งานซ่อม/MA', detail: `${summary.jobCount} ใบ x 100 บ.`, amount: summary.jobAmount },
            { label: '⏱ OT', detail: '', amount: summary.otAmount },
            { label: '🚗 เดินทาง', detail: '', amount: summary.travelAmount },
            { label: '🛣 ผ่านทางพิเศษ', detail: '', amount: summary.tollAmount },
            { label: '🅿️ จอดรถ', detail: '', amount: summary.parkingAmount }
        ];
        breakdownEl.innerHTML = rows.map(r => `
            <div class="income-row">
                <div>
                    <div class="ir-label">${r.label}</div>
                    ${r.detail ? `<div class="ir-detail">${r.detail}</div>` : ''}
                </div>
                <div class="ir-amount">${(r.amount || 0).toLocaleString()} บ.</div>
            </div>
        `).join('');

        document.getElementById('income-total-amount').textContent = `${(summary.grandTotal || 0).toLocaleString()} บาท`;
        totalEl.style.display = '';

        await loadIncomeRecords(targetUserId);
    } catch (e) {
        cycleLabelEl.textContent = '❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
    }
}

const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function formatThaiDateShort(dateStr) {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return `${String(d).padStart(2, '0')} ${THAI_MONTHS_SHORT[m - 1]} ${y + 543}`;
}

async function loadIncomeRecords(targetUserId) {
    const bodyEl = document.getElementById('income-records-body');
    const emptyEl = document.getElementById('income-records-empty');
    const countEl = document.getElementById('income-records-count');
    bodyEl.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">กำลังโหลด...</td></tr>';
    emptyEl.style.display = 'none';

    const params = new URLSearchParams({ requester_id: currentUser.id, role: currentUser.role });
    if (currentUser.role === 'admin' && targetUserId) params.set('user_id', targetUserId);

    try {
        const res = await fetch(`/api/income/records?${params}`);
        const records = await res.json();
        if (!res.ok) {
            bodyEl.innerHTML = '';
            emptyEl.textContent = `❌ ${records.error || 'โหลดรายการไม่สำเร็จ'}`;
            emptyEl.style.display = 'block';
            countEl.textContent = '0';
            return;
        }

        incomeRecordsCache = records;
        countEl.textContent = records.length;

        if (!records.length) {
            bodyEl.innerHTML = '';
            emptyEl.textContent = 'ยังไม่มีรายการที่บันทึกไว้ในรอบบิลนี้';
            emptyEl.style.display = 'block';
            return;
        }

        // เรียงจากวันที่ล่าสุดไปเก่าสุด (เผื่อ API ไม่ได้เรียงมา), ถ้าวันที่ตรงกันเรียงตาม id ล่าสุดก่อน
        const sorted = [...records].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.id - a.id));

        bodyEl.innerHTML = sorted.map(r => {
            const amtCell = (v) => v ? `<span style="font-weight:600;">${v.toLocaleString()}</span>` : '<span style="color:var(--text-muted);">-</span>';
            return `
                <tr>
                    <td><b>${formatThaiDateShort(r.date)}</b></td>
                    <td>${amtCell(r.ot_amount)}</td>
                    <td>${amtCell(r.travel_amount)}</td>
                    <td>${amtCell(r.toll_amount)}</td>
                    <td>${amtCell(r.parking_amount)}</td>
                    <td><span style="background: var(--panel-bg); color: var(--accent-color); padding: 4px 10px; border-radius: 20px; font-weight: 700; display:inline-block;">${(r.total_amount || 0).toLocaleString()} บ.</span></td>
                    <td>
                        <div class="action-cell">
                            <button class="btn btn-edit" onclick="openIncomeDetailModal(${r.id})">✏️ แก้ไข</button>
                            <button class="btn btn-delete" onclick="deleteIncomeRecord(${r.id})">🗑️ ลบ</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        bodyEl.innerHTML = '';
        emptyEl.textContent = '❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';
        emptyEl.style.display = 'block';
    }
}

window.deleteIncomeRecord = async function(id) {
    const confirmed = await confirmModal('ยืนยันลบรายการนี้ใช่ไหมครับ? การลบนี้จะมีผลทั้งในเว็บและ LINE ทันที');
    if (!confirmed) return;
    const params = new URLSearchParams({ requester_id: currentUser.id, role: currentUser.role });
    const res = await fetch(`/api/income/records/${id}?${params}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { showToast(data.error, 'error'); return; }

    showToast('ลบรายการสำเร็จ', 'success');
    const sel = document.getElementById('income-user-filter');
    loadIncomePage(currentUser.role === 'admin' && sel ? sel.value : undefined);
};

// ─────────────────────────────────────────────
// Income Detail Editor Modal (ดู/แก้ไขรายละเอียดเต็ม: OT / เดินทาง / ผ่านทาง / จอดรถ)
// ─────────────────────────────────────────────
let incomeRecordsCache = [];
let incomeDetailDraft = null; // { id, date, ot:[], travel:[{date, legs:[]}], toll:[], parking:[] }
const OT_RATE_DISPLAY = 125;
const KM_RATE_DISPLAY = 5;

window.openIncomeDetailModal = function(id) {
    const record = incomeRecordsCache.find(r => r.id === id);
    if (!record) return;

    incomeDetailDraft = {
        id: record.id,
        date: record.date,
        ot: JSON.parse(JSON.stringify(record.ot_details || [])),
        travel: JSON.parse(JSON.stringify(record.travel_details || [])),
        toll: JSON.parse(JSON.stringify(record.toll_details || [])),
        parking: JSON.parse(JSON.stringify(record.parking_details || []))
    };
    // เผื่อรายการเก่าที่ยังไม่มี toll_details/parking_details (บันทึกก่อนอัปเดตระบบ) ให้ยกยอดรวมเดิมมาเป็นรายการเดียว
    if (!incomeDetailDraft.toll.length && record.toll_amount) {
        incomeDetailDraft.toll = [{ amount: record.toll_amount, detail: '(ยอดเดิมก่อนแยกรายละเอียด)' }];
    }
    if (!incomeDetailDraft.parking.length && record.parking_amount) {
        incomeDetailDraft.parking = [{ amount: record.parking_amount, detail: '(ยอดเดิมก่อนแยกรายละเอียด)' }];
    }

    document.getElementById('income-detail-date').value = incomeDetailDraft.date;
    document.getElementById('income-detail-error').style.display = 'none';
    renderIncomeDetailModal();
    document.getElementById('modal-income-detail').style.display = 'flex';
};

window.closeIncomeDetailModal = function(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('modal-income-detail').style.display = 'none';
    incomeDetailDraft = null;
};

function renderIncomeDetailModal() {
    renderOtSection();
    renderTravelSection();
    renderTollSection();
    renderParkingSection();
    updateIncomeDetailTotal();
}

function updateIncomeDetailTotal() {
    const d = incomeDetailDraft;
    const otAmount = d.ot.reduce((s, e) => s + (Number(e.hours) || 0) * OT_RATE_DISPLAY, 0);
    const travelAmount = d.travel.reduce((s, r) => s + (r.legs || []).reduce((s2, l) => s2 + (Number(l.km) || 0) * KM_RATE_DISPLAY, 0), 0);
    const legToll = d.travel.reduce((s, r) => s + (r.legs || []).reduce((s2, l) => s2 + (Number(l.toll_amount) || 0), 0), 0);
    const legParking = d.travel.reduce((s, r) => s + (r.legs || []).reduce((s2, l) => s2 + (Number(l.parking_amount) || 0), 0), 0);
    const tollAmount = d.toll.reduce((s, t) => s + (Number(t.amount) || 0), 0) + legToll;
    const parkingAmount = d.parking.reduce((s, t) => s + (Number(t.amount) || 0), 0) + legParking;
    const total = otAmount + travelAmount + tollAmount + parkingAmount;
    document.getElementById('income-detail-total').textContent = `${total.toLocaleString()} บาท`;
}

// ── OT ──
function renderOtSection() {
    const el = document.getElementById('income-detail-ot-list');
    if (!incomeDetailDraft.ot.length) { el.innerHTML = '<div class="income-detail-empty">ไม่มีรายการ OT</div>'; return; }
    el.innerHTML = incomeDetailDraft.ot.map((e, i) => `
        <div class="income-detail-row">
            <input type="number" class="income-input-narrow" placeholder="ชม." value="${e.hours ?? ''}" oninput="updateOtField(${i},'hours',this.value)">
            <input type="text" placeholder="เหตุผล" value="${(e.reason || '').replace(/"/g, '&quot;')}" oninput="updateOtField(${i},'reason',this.value)">
            <input type="text" class="income-input-narrow" placeholder="วันที่" value="${e.date || ''}" oninput="updateOtField(${i},'date',this.value)">
            <button class="btn-remove-row" onclick="removeOtRow(${i})">✕</button>
        </div>
    `).join('');
}
window.addOtRow = function() {
    incomeDetailDraft.ot.push({ hours: 1, reason: '', date: incomeDetailDraft.date });
    renderOtSection(); updateIncomeDetailTotal();
};
window.removeOtRow = function(i) {
    incomeDetailDraft.ot.splice(i, 1);
    renderOtSection(); updateIncomeDetailTotal();
};
window.updateOtField = function(i, field, value) {
    incomeDetailDraft.ot[i][field] = field === 'hours' ? value : value;
    updateIncomeDetailTotal();
};

// ── เดินทาง (routes → legs) ──
function renderTravelSection() {
    const el = document.getElementById('income-detail-travel-list');
    if (!incomeDetailDraft.travel.length) { el.innerHTML = '<div class="income-detail-empty">ไม่มีเส้นทาง</div>'; return; }
    el.innerHTML = incomeDetailDraft.travel.map((route, ri) => `
        <div class="income-route-card">
            <div class="income-route-card-header">
                <input type="text" placeholder="วันที่เส้นทาง" value="${route.date || ''}" oninput="updateRouteField(${ri},'date',this.value)">
                <button class="btn-remove-row" onclick="removeRouteRow(${ri})">🗑 ลบเส้นทางนี้</button>
            </div>
            <div class="income-leg-list">
                ${(route.legs || []).map((l, li) => `
                    <div class="income-detail-row">
                        <input type="text" placeholder="จาก" value="${(l.from || '').replace(/"/g, '&quot;')}" oninput="updateLegField(${ri},${li},'from',this.value)">
                        <input type="text" placeholder="ถึง" value="${(l.to || '').replace(/"/g, '&quot;')}" oninput="updateLegField(${ri},${li},'to',this.value)">
                        <input type="text" placeholder="งาน" value="${(l.job || '').replace(/"/g, '&quot;')}" oninput="updateLegField(${ri},${li},'job',this.value)">
                        <input type="number" class="income-input-narrow" placeholder="กม." value="${l.km ?? ''}" oninput="updateLegField(${ri},${li},'km',this.value)">
                        <input type="number" class="income-input-narrow" placeholder="ผ่านทาง" value="${l.toll_amount ?? ''}" oninput="updateLegField(${ri},${li},'toll_amount',this.value)">
                        <input type="number" class="income-input-narrow" placeholder="จอดรถ" value="${l.parking_amount ?? ''}" oninput="updateLegField(${ri},${li},'parking_amount',this.value)">
                        <button class="btn-remove-row" onclick="removeLegRow(${ri},${li})">✕</button>
                    </div>
                `).join('')}
            </div>
            <button class="btn btn-secondary btn-sm" onclick="addLegRow(${ri})">+ เพิ่มช่วงทาง</button>
        </div>
    `).join('');
}
window.addRouteRow = function() {
    incomeDetailDraft.travel.push({ date: incomeDetailDraft.date, legs: [{ from: '', to: '', job: '', km: 0, toll_amount: 0, parking_amount: 0 }] });
    renderTravelSection(); updateIncomeDetailTotal();
};
window.removeRouteRow = function(ri) {
    incomeDetailDraft.travel.splice(ri, 1);
    renderTravelSection(); updateIncomeDetailTotal();
};
window.addLegRow = function(ri) {
    incomeDetailDraft.travel[ri].legs.push({ from: '', to: '', job: '', km: 0, toll_amount: 0, parking_amount: 0 });
    renderTravelSection(); updateIncomeDetailTotal();
};
window.removeLegRow = function(ri, li) {
    incomeDetailDraft.travel[ri].legs.splice(li, 1);
    renderTravelSection(); updateIncomeDetailTotal();
};
window.updateRouteField = function(ri, field, value) {
    incomeDetailDraft.travel[ri][field] = value;
};
window.updateLegField = function(ri, li, field, value) {
    incomeDetailDraft.travel[ri].legs[li][field] = value;
    updateIncomeDetailTotal();
};

// ── ผ่านทางพิเศษ / จอดรถ (โครงสร้างเดียวกัน: amount + detail) ──
function renderSimpleSection(key, elId) {
    const el = document.getElementById(elId);
    const list = incomeDetailDraft[key];
    if (!list.length) { el.innerHTML = '<div class="income-detail-empty">ไม่มีรายการ</div>'; return; }
    el.innerHTML = list.map((t, i) => `
        <div class="income-detail-row">
            <input type="number" class="income-input-narrow" placeholder="บาท" value="${t.amount ?? ''}" oninput="updateSimpleField('${key}',${i},'amount',this.value)">
            <input type="text" placeholder="รายละเอียด/เหตุผล" value="${(t.detail || '').replace(/"/g, '&quot;')}" oninput="updateSimpleField('${key}',${i},'detail',this.value)">
            <button class="btn-remove-row" onclick="removeSimpleRow('${key}',${i})">✕</button>
        </div>
    `).join('');
}
function renderTollSection() { renderSimpleSection('toll', 'income-detail-toll-list'); }
function renderParkingSection() { renderSimpleSection('parking', 'income-detail-parking-list'); }
window.addTollRow = function() { incomeDetailDraft.toll.push({ amount: 0, detail: '' }); renderTollSection(); updateIncomeDetailTotal(); };
window.addParkingRow = function() { incomeDetailDraft.parking.push({ amount: 0, detail: '' }); renderParkingSection(); updateIncomeDetailTotal(); };
window.removeSimpleRow = function(key, i) {
    incomeDetailDraft[key].splice(i, 1);
    if (key === 'toll') renderTollSection(); else renderParkingSection();
    updateIncomeDetailTotal();
};
window.updateSimpleField = function(key, i, field, value) {
    incomeDetailDraft[key][i][field] = value;
    updateIncomeDetailTotal();
};

window.saveIncomeDetailModal = async function() {
    const errEl = document.getElementById('income-detail-error');
    errEl.style.display = 'none';

    const date = document.getElementById('income-detail-date').value;
    if (!date) { errEl.textContent = '⚠️ กรุณาระบุวันที่'; errEl.style.display = 'block'; return; }

    const res = await fetch(`/api/income/records/${incomeDetailDraft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            requester_id: currentUser.id, role: currentUser.role,
            date,
            ot_details: incomeDetailDraft.ot,
            travel_details: incomeDetailDraft.travel,
            toll_details: incomeDetailDraft.toll,
            parking_details: incomeDetailDraft.parking
        })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = '❌ ' + data.error; errEl.style.display = 'block'; return; }

    closeIncomeDetailModal();
    const sel = document.getElementById('income-user-filter');
    loadIncomePage(currentUser.role === 'admin' && sel ? sel.value : undefined);
};

// Override switchPage to trigger income load
const _origSwitchPage3 = window.switchPage;
window.switchPage = function(pageTarget) {
    _origSwitchPage3(pageTarget);
    if (pageTarget === 'income' && currentUser && (currentUser.role === 'admin' || currentUser.role === 'staff')) {
        loadIncomePage(currentUser.role === 'admin' ? currentUser.id : undefined);
    }
};