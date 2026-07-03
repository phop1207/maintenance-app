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

/** แปลงข้อความวันที่แบบยืดหยุ่น: "วันนี้"/"today" หรือ YYYY-MM-DD (ห้ามเป็นอนาคต) */
function parseFlexibleIncomeDate(text) {
    const nowTH = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const todayStr = nowTH.toISOString().split('T')[0];
    const t = (text || '').trim();
    const tLower = t.toLowerCase();
    if (t === 'วันนี้' || tLower === 'today') return { ok: true, date: todayStr };
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
        const parsed = new Date(t);
        if (isNaN(parsed.getTime()) || t > todayStr) return { ok: false, todayStr };
        return { ok: true, date: t };
    }
    return { ok: false, todayStr };
}

module.exports = { capitalizeTextBackend, getBrandCategory, parseFlexibleIncomeDate };
