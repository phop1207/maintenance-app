// ─────────────────────────────────────────────
// Text / Formatting Helpers
// ─────────────────────────────────────────────

function capitalizeTextBackend(text) {
    if (!text) return '-';
    return text.trim().split(' ').map(word => {
        if (!word) return '';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
}

function getBrandCategory(shopName) {
    if (!shopName) return 'Sme';
    const b = shopName.trim().toLowerCase();
    if (b.includes('mk')) return 'Mk';
    if (b.includes('fuji') || b.includes('ฟูจิ')) return 'Fuji';
    if (b.includes('lucky') || b.includes('ลัคกี้')) return 'Lucky';
    if (b.includes('bonus') || b.includes('โบนัส')) return 'Bonus';
    if (b.includes('bbq') || b.includes('บาร์บีคิว') || b.includes('plaza')) return 'Bbq';
    if (b.includes('seo')) return 'SEO';
    return 'Sme';
}

/** แปลงข้อความวันที่แบบยืดหยุ่น: "วันนี้"/"today", DD-MM (ใช้ปีปัจจุบัน), หรือ YYYY-MM-DD (ห้ามเป็นอนาคต) */
function parseFlexibleIncomeDate(text) {
    const nowTH = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const todayStr = nowTH.toISOString().split('T')[0];
    const currentYear = nowTH.getUTCFullYear();
    const t = (text || '').trim();
    const tLower = t.toLowerCase();
    if (t === 'วันนี้' || tLower === 'today') return { ok: true, date: todayStr };

    // รูปแบบเต็ม YYYY-MM-DD (รองรับไว้เผื่อกรณีพิเศษ)
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
        const parsed = new Date(t);
        if (isNaN(parsed.getTime()) || t > todayStr) return { ok: false, todayStr };
        return { ok: true, date: t };
    }

    // รูปแบบ DD-MM หรือ DD/MM (ใช้ปีปัจจุบันเป็นหลัก ไม่ต้องระบุปี)
    const m = t.match(/^(\d{1,2})[-\/](\d{1,2})$/);
    if (m) {
        const day = parseInt(m[1], 10);
        const month = parseInt(m[2], 10);
        if (month < 1 || month > 12 || day < 1 || day > 31) return { ok: false, todayStr };
        const dateStr = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const parsed = new Date(dateStr);
        if (isNaN(parsed.getTime()) || parsed.getUTCDate() !== day) return { ok: false, todayStr };
        if (dateStr > todayStr) return { ok: false, todayStr };
        return { ok: true, date: dateStr };
    }

    return { ok: false, todayStr };
}

module.exports = { capitalizeTextBackend, getBrandCategory, parseFlexibleIncomeDate };
