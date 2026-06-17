// ─────────────────────────────────────────────
// Session Management
// ─────────────────────────────────────────────
let currentUser = null; // { id, username, display_name, role }

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
    badgeRole.textContent = currentUser.role === 'admin' ? '👑 Admin' : '👤 User';
    badge.style.display = 'flex';
    document.getElementById('btn-logout').style.display = 'inline-flex';

    // Admin → แสดงคอลัมน์ช่าง + dropdown filter user
    if (currentUser.role === 'admin') {
        document.getElementById('col-technician').style.display = '';
        document.getElementById('filter-user').style.display = '';
        document.getElementById('nav-admin').style.display = '';
        loadUserFilterOptions();
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
    document.getElementById(`nav-${pageTarget}`).classList.add('active');
    
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
        updateDashboardStats(allJobs); 
    } catch (error) {
        console.error('Error fetching jobs:', error);
    }
}

function updateDashboardStats(jobs) {
    let mkCount = 0; let fujiCount = 0; let luckyCount = 0; let smeCount = 0; let bbqCount = 0;          
    let repairCount = 0; let maCount = 0; let installCount = 0;
    let latestJob = null;

    jobs.forEach(job => {
        const brand = capitalizeText(job.shop_brand || job.shop_name);
        const type = job.job_type ? job.job_type.toLowerCase().trim() : '';

        if (brand === 'Mk') mkCount++;
        else if (brand === 'Fuji') fujiCount++;
        else if (brand === 'Lucky') luckyCount++;
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

function renderTable(jobs) {
    jobTableBody.innerHTML = '';
    document.getElementById('filtered-count').innerText = jobs.length;

    jobs.forEach(job => {
        let imageHtml = '<span style="color:#94a3b8; font-style:italic; font-size:0.85rem;">ไม่มีรูปภาพ</span>';
        if (job.image_path) {
            const imgUrl = resolveImageUrl(job.image_path);
            imageHtml = `<div class="img-container">
                            <img src="${imgUrl}" alt="ใบงาน" class="img-thumb" style="cursor: pointer;" onclick="openLightbox('${imgUrl}', '${capitalizeText(job.shop_name)} - ${capitalizeText(job.branch_name)}')" title="คลิกส่องใบงาน">
                         </div>`;
        }

        const brandFormatted = capitalizeText(job.shop_brand);
        let brandClass = 'badge-sme';
        if (brandFormatted === 'Mk') brandClass = 'badge-mk';
        else if (brandFormatted === 'Fuji') brandClass = 'badge-fuji';
        else if (brandFormatted === 'Lucky') brandClass = 'badge-lucky';
        else if (brandFormatted === 'Bbq') brandClass = 'badge-bbq';

        // แสดงผลประเภทงานคู่กับรายละเอียดเพิ่มเติม (ถ้ามี)
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

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${job.date}</b></td>
            <td><span style="color: var(--text-muted);">${job.time}</span></td>
            ${isAdmin ? `<td style="font-size:0.82rem; color:var(--text-muted);">${techName}</td>` : ''}
            <td><span class="custom-badge ${brandClass}">${capitalizeText(job.shop_name)}</span></td>
            <td><code>${job.branch_code ? job.branch_code.toUpperCase() : '-'}</code></td>
            <td>${capitalizeText(job.branch_name)}</td>
            <td><span style="background: var(--panel-bg); color: var(--accent-color); padding: 4px 8px; border-radius: 6px; font-size: 0.85rem; font-weight: 500; display: inline-block; line-height: 1.2;">${displayJobType}</span></td>
            <td>${imageHtml}</td>
            <td>
                <div class="action-cell">
                    <button class="btn btn-edit" onclick="editJob(${job.id})">แก้ไข</button>
                    <button class="btn btn-delete" onclick="deleteJob(${job.id})">ลบ</button>
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
    renderTable(currentFilteredJobs);
}

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
    renderTable(allJobs);
});

window.exportToExcel = function() {
    if (typeof XLSX === 'undefined') { alert('❌ ตรวจไม่พบโมดูล XLSX ครับ'); return; }
    if (!currentFilteredJobs || currentFilteredJobs.length === 0) { alert('❌ ไม่มีข้อมูลจะส่งออกครับ'); return; }
    
    try {
        const dataForExcel = currentFilteredJobs.map((job, idx) => ({
            'ลำดับ': idx + 1,
            'วันที่เข้าทำงาน': job.date || '-',
            'เวลา': job.time || '-',
            'กลุ่มสถิติแบรนด์': capitalizeText(job.shop_brand),
            'ชื่อร้านค้า': capitalizeText(job.shop_name) || '-',
            'รหัสสาขา': job.branch_code ? job.branch_code.toUpperCase() : '-',
            'ชื่อสาขา/สถานที่': capitalizeText(job.branch_name) || '-',
            'ประเภทงานหลัก': job.job_type || '-',
            'รายละเอียดความเสียหาย (กรณีงานซ่อม)': job.repair_detail || '-',
            'ที่อยู่ไฟล์รูปภาพ': job.image_path ? (job.image_path.startsWith('http') ? job.image_path : window.location.origin + '/' + job.image_path) : 'ไม่มีรูปภาพ'
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "บันทึกงานช่าง");
        XLSX.writeFile(workbook, `สรุปรายงานประวัติงานซ่อม_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) { alert('เกิดข้อผิดพลาดในการส่งออก Excel: ' + e.message); }
};

window.openLightbox = function(src, caption) {
    const modal = document.getElementById('lightbox-modal'); const img = document.getElementById('lightbox-img');
    const captionText = document.getElementById('lightbox-caption');
    modal.style.display = "block"; img.src = src; captionText.innerHTML = caption;
}
window.closeLightbox = function() { document.getElementById('lightbox-modal').style.display = "none"; }

window.dangerDelete = async function(type) {
    const MASTER_PASSWORD = "phop23"; let confirmMsg = ""; let deleteUrl = "";
    if (type === 'all') {
        confirmMsg = "🚨 คุณกำลังสั่งลบข้อมูลงานซ่อมทั้งหมดเกลี้ยงตับ! \n\nยืนยันทำรายการต่อใช่ไหม?";
        deleteUrl = `${API_URL}/danger/all`;
    } else if (type === 'month') {
        const startDate = startDateInput.value; const endDate = endDateInput.value;
        if (!startDate || !endDate) { alert("⚠️ กรุณากำหนดช่วงวันที่ตัวกรองก่อนครับ"); return; }
        confirmMsg = `📅 ยืนยันลบข้อมูลงานในช่วงวันที่ ${startDate} ถึง ${endDate} หรือไม่?`;
        deleteUrl = `${API_URL}/danger/range?start=${startDate}&end=${endDate}`;
    }
    if (!confirm(confirmMsg)) return;
    const password = prompt("🔒 กรุณากรอกรหัสผ่านเพื่ออนุมัติสิทธิ์:");
    if (password === null || password !== MASTER_PASSWORD) { alert("❌ รหัสผ่านไม่ถูกต้อง!"); return; }

    try {
        const response = await fetch(deleteUrl, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) { alert(`✅ ${result.message}`); await fetchJobs(); } 
        else { alert(`❌ เกิดข้อผิดพลาด: ${result.error}`); }
    } catch (error) { alert('❌ ล้มเหลวในการเชื่อมต่อเซิร์ฟเวอร์'); }
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
        } else { alert('เกิดข้อผิดพลาดในการบันทึกข้อมูลงาน'); }
    } catch (error) { console.error(error); }
});

window.deleteJob = async function(id) {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบรายการนี้?')) {
        const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        if (response.ok) fetchJobs();
    }
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
    roleEl.textContent = currentUser.role === 'admin' ? '👑 Admin' : '👤 User';
    roleEl.className = 'profile-role ' + (currentUser.role === 'admin' ? 'role-admin' : 'role-user');
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
    document.getElementById('admin-stat-user').textContent = adminUsers.filter(u => u.role === 'user').length;
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
                <div class="auc-avatar">${u.role === 'admin' ? '👑' : '👤'}</div>
                <div class="auc-info">
                    <div class="auc-name">${u.display_name || u.username}</div>
                    <div class="auc-meta">@${u.username} &nbsp;·&nbsp; ${u.job_count} งาน &nbsp;·&nbsp; ${u.has_line ? '🟢 มี LINE' : '⚪ ไม่มี LINE'}</div>
                </div>
                <span class="auc-role-badge ${u.role === 'admin' ? 'role-admin' : 'role-user'}">
                    ${u.role === 'admin' ? 'Admin' : 'User'}
                </span>
            </div>
            <div class="auc-actions">
                <button class="btn btn-edit" onclick="toggleRole(${u.id}, '${u.role}')">
                    ${u.role === 'admin' ? '⬇️ ลด Role' : '⬆️ เพิ่มเป็น Admin'}
                </button>
                <button class="btn btn-secondary" onclick="openResetModal(${u.id}, '${u.display_name || u.username}')">
                    🔑 รีเซ็ต PIN
                </button>
                ${u.id !== currentUser.id ? `<button class="btn btn-delete" onclick="deleteUser(${u.id}, '${u.display_name || u.username}')">🗑️ ลบ</button>` : '<span style="font-size:0.75rem;color:var(--text-muted);">(ตัวเอง)</span>'}
            </div>
        </div>
    `).join('');
}

window.toggleRole = async function(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`ยืนยันเปลี่ยน role เป็น "${newRole}" ใช่ไหมครับ?`)) return;
    const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
    });
    const data = await res.json();
    if (res.ok) loadAdminPanel();
    else alert('❌ ' + data.error);
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
        alert(`✅ ${data.message}`);
    } else {
        errEl.textContent = '❌ ' + data.error;
        errEl.style.display = 'block';
    }
};

window.deleteUser = async function(userId, name) {
    if (!confirm(`⚠️ ยืนยันลบผู้ใช้ "${name}" ออกจากระบบ?\n\nข้อมูลงานของผู้ใช้นี้จะยังคงอยู่ แต่จะไม่ถูกผูกกับใคร`)) return;
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) { loadAdminPanel(); fetchJobs(); }
    else alert('❌ ' + data.error);
};

// Override switchPage to trigger admin load
const _origSwitchPage2 = window.switchPage;
window.switchPage = function(pageTarget) {
    _origSwitchPage2(pageTarget);
    if (pageTarget === 'admin' && currentUser && currentUser.role === 'admin') loadAdminPanel();
};