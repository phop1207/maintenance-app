const API_URL = '/api/jobs';
let allJobs = [];
let currentFilteredJobs = [];

// คืน URL ของรูปภาพ: ถ้าเป็น public URL ของ Supabase Storage (เริ่มด้วย http) ใช้ตรงๆ
// ถ้าเป็น path เก่าแบบ local (เช่น "uploads/xxx.jpg") ให้เติม "/" นำหน้า
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

document.addEventListener('DOMContentLoaded', fetchJobs);

async function fetchJobs() {
    try {
        const response = await fetch(API_URL);
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

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${job.date}</b></td>
            <td><span style="color: var(--text-muted);">${job.time}</span></td>
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