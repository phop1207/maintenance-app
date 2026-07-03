// ─────────────────────────────────────────────
// Income Service — คำนวณรายได้รวม (ใบงาน + OT/เดินทาง/ผ่านทาง/จอดรถ)
// รอบบิล: วันที่ 26 ถึง 25 ของเดือนถัดไป
// ─────────────────────────────────────────────
const supabase = require('../config/supabaseClient');
const { JOB_INCOME_RATE, JOB_INCOME_TYPES, BILLING_CYCLE_START_DAY, OT_RATE_PER_HOUR, KM_RATE_PER_KM } = require('../config/constants');

/** คืนวันที่ปัจจุบัน (เวลาไทย) แบบ YYYY-MM-DD */
function getTodayTH() {
    const nowTH = new Date(Date.now() + 7 * 60 * 60 * 1000);
    return nowTH.toISOString().split('T')[0];
}

/** คำนวณช่วงรอบบิลปัจจุบัน (26 ถึง 25 ของเดือนถัดไป) จากวันที่อ้างอิง (YYYY-MM-DD, ค่าเริ่มต้น = วันนี้) */
function getBillingCycle(refDateStr) {
    const ref = refDateStr || getTodayTH();
    const [y, m, d] = ref.split('-').map(Number);
    let startY = y, startM = m; // เดือนที่รอบบิลเริ่ม (1-indexed)
    if (d < BILLING_CYCLE_START_DAY) {
        // ก่อนวันที่ 26 → รอบบิลเริ่มตั้งแต่วันที่ 26 ของเดือนก่อนหน้า
        startM -= 1;
        if (startM === 0) { startM = 12; startY -= 1; }
    }
    let endY = startY, endM = startM + 1;
    if (endM === 13) { endM = 1; endY += 1; }

    const cycleStart = `${startY}-${String(startM).padStart(2, '0')}-${String(BILLING_CYCLE_START_DAY).padStart(2, '0')}`;
    const cycleEnd = `${endY}-${String(endM).padStart(2, '0')}-25`;
    return { cycleStart, cycleEnd };
}

/**
 * รวมรายได้ทั้งหมดของ user ในรอบบิลที่กำหนด
 * - jobIncome: จำนวนใบงาน Repair/Maintenance x 100 บาท
 * - otAmount / travelAmount / tollAmount / parkingAmount: รวมจาก extra_income ที่บันทึกไว้ (ค่าตอบแทนเพิ่มเติม, ไม่ใช่รายได้หลัก)
 */
async function computeIncomeSummary({ userId, lineUserId, cycleStart, cycleEnd }) {
    const { cycleStart: start, cycleEnd: end } = (cycleStart && cycleEnd) ? { cycleStart, cycleEnd } : getBillingCycle();

    let jobCount = 0;
    if (userId) {
        const { data: jobs } = await supabase
            .from('jobs')
            .select('date, time, shop_brand, shop_name, branch_code, branch_name, job_type, repair_detail, user_id')
            .eq('user_id', userId)
            .in('job_type', JOB_INCOME_TYPES)
            .gte('date', start)
            .lte('date', end);

        // งานที่มีหลายรูป จะถูกบันทึกเป็นหลายแถวใน jobs (แถวละ 1 รูป, ข้อมูลอื่นเหมือนกันหมด)
        // ต้อง group ด้วย key เดียวกับหน้าเว็บ (groupJobsBySession) ก่อนนับ ไม่งั้นจะนับซ้ำตามจำนวนรูป
        const sessionKeys = new Set();
        (jobs || []).forEach(j => {
            const key = [
                j.date, j.time,
                (j.shop_brand || '').toLowerCase(),
                (j.shop_name || '').toLowerCase(),
                (j.branch_code || '').toLowerCase(),
                (j.branch_name || '').toLowerCase(),
                (j.job_type || '').toLowerCase(),
                (j.repair_detail || '').toLowerCase(),
                j.user_id || ''
            ].join('|');
            sessionKeys.add(key);
        });
        jobCount = sessionKeys.size;
    }
    const jobAmount = jobCount * JOB_INCOME_RATE;

    let extraQuery = supabase
        .from('extra_income')
        .select('*')
        .gte('date', start)
        .lte('date', end);
    if (lineUserId) extraQuery = extraQuery.eq('line_user_id', lineUserId);
    else if (userId) extraQuery = extraQuery.eq('user_id', userId);

    const { data: extraRecords } = await extraQuery;
    const records = extraRecords || [];

    const otAmount = records.reduce((s, r) => s + (r.ot_amount || 0), 0);
    const travelAmount = records.reduce((s, r) => s + (r.travel_amount || 0), 0);
    const tollAmount = records.reduce((s, r) => s + (r.toll_amount || 0), 0);
    const parkingAmount = records.reduce((s, r) => s + (r.parking_amount || 0), 0);
    const extraTotal = otAmount + travelAmount + tollAmount + parkingAmount;
    const grandTotal = jobAmount + extraTotal;

    return {
        cycleStart: start, cycleEnd: end,
        jobCount, jobAmount,
        otAmount, travelAmount, tollAmount, parkingAmount, extraTotal,
        grandTotal,
        extraRecords: records
    };
}

/**
 * คำนวณยอดเงินทั้งหมดใหม่จาก "รายละเอียดดิบ" (ot_details / travel_details / toll_details / parking_details)
 * ใช้ทั้งตอนบันทึกจาก LINE และตอนแก้ไขรายละเอียดจากหน้าเว็บ เพื่อให้สูตรคำนวณตรงกันเสมอ
 * - ot_details: [{ hours, reason, date }]  → amount คำนวณใหม่จาก hours x OT_RATE_PER_HOUR
 * - travel_details: [{ date, legs: [{ from, to, job, km, toll_amount, parking_amount }] }] → amount คำนวณใหม่จาก km x KM_RATE_PER_KM
 * - toll_details / parking_details: [{ amount, detail }] → ใช้ amount ตามที่กรอก (ไม่มีสูตรคำนวณ)
 */
function computeTotals({ otDetails = [], travelDetails = [], tollDetails = [], parkingDetails = [] }) {
    const otEntries = otDetails.map(e => ({
        ...e,
        hours: Number(e.hours) || 0,
        amount: Math.round((Number(e.hours) || 0) * OT_RATE_PER_HOUR * 100) / 100
    }));
    const otHours = otEntries.reduce((s, e) => s + e.hours, 0);
    const otAmount = otEntries.reduce((s, e) => s + e.amount, 0);

    const routes = travelDetails.map(route => {
        const legs = (route.legs || []).map(l => ({
            ...l,
            km: Number(l.km) || 0,
            amount: Math.round((Number(l.km) || 0) * KM_RATE_PER_KM * 100) / 100,
            toll_amount: Number(l.toll_amount) || 0,
            parking_amount: Number(l.parking_amount) || 0
        }));
        const total_km = Math.round(legs.reduce((s, l) => s + l.km, 0) * 100) / 100;
        const amount = Math.round(legs.reduce((s, l) => s + l.amount, 0) * 100) / 100;
        const toll_amount = Math.round(legs.reduce((s, l) => s + l.toll_amount, 0) * 100) / 100;
        const parking_amount = Math.round(legs.reduce((s, l) => s + l.parking_amount, 0) * 100) / 100;
        return { ...route, legs, total_km, amount, toll_amount, parking_amount };
    });
    const travelKm = routes.reduce((s, r) => s + r.total_km, 0);
    const travelAmount = routes.reduce((s, r) => s + r.amount, 0);
    const routeTollAmount = routes.reduce((s, r) => s + (r.toll_amount || 0), 0);
    const routeParkingAmount = routes.reduce((s, r) => s + (r.parking_amount || 0), 0);

    const tolls = tollDetails.map(t => ({ ...t, amount: Number(t.amount) || 0 }));
    const parkings = parkingDetails.map(t => ({ ...t, amount: Number(t.amount) || 0 }));
    const tollAmount = Math.round((tolls.reduce((s, t) => s + t.amount, 0) + routeTollAmount) * 100) / 100;
    const parkingAmount = Math.round((parkings.reduce((s, t) => s + t.amount, 0) + routeParkingAmount) * 100) / 100;

    const totalAmount = Math.round((otAmount + travelAmount + tollAmount + parkingAmount) * 100) / 100;

    return {
        otEntries, otHours, otAmount,
        routes, travelKm, travelAmount,
        tolls, parkings, tollAmount, parkingAmount,
        totalAmount
    };
}

/**
 * หาวันที่ "ของรายการจริง" จากรายละเอียดที่กรอกไว้ (วันที่ทำ OT หรือวันที่เดินทาง)
 * แทนที่จะใช้วันที่อัปโหลด/บันทึกเข้าระบบเสมอ — ถ้าไม่มีวันที่ระบุไว้เลย (เช่น จดค่าผ่านทาง/จอดรถเดี่ยวๆ) ถึงจะ fallback เป็นวันนี้
 */
function deriveEntryDate(totals, fallbackDate) {
    if (totals.otEntries.length && totals.otEntries[0].date) return totals.otEntries[0].date;
    if (totals.routes.length && totals.routes[0].date) return totals.routes[0].date;
    return fallbackDate;
}

/**
 * บันทึกรายการค่าตอบแทนเพิ่มเติมที่สะสมไว้ใน session (OT/เดินทาง/ทางด่วน/จอดรถ) ลง Supabase เป็น 1 แถว
 * คืนค่า { ok, totalAmount, error }
 */
async function saveIncomeSession(incState, lineUserId) {
    const totals = computeTotals({
        otDetails: incState.ot_entries || [],
        travelDetails: incState.routes || [],
        tollDetails: incState.tolls || [],
        parkingDetails: incState.parkings || []
    });

    if (totals.totalAmount <= 0) return { ok: false, totalAmount: 0, error: 'ยังไม่มีรายการให้บันทึกครับ กรุณาเพิ่มรายการก่อน', empty: true };

    const { data: userRow } = await supabase.from('users').select('id').eq('line_user_id', lineUserId).single();
    const dbUserId = userRow ? userRow.id : null;
    const dateStr = deriveEntryDate(totals, getTodayTH());

    const { error: saveErr } = await supabase.from('extra_income').insert([{
        user_id: dbUserId,
        line_user_id: lineUserId,
        date: dateStr,
        ot_hours: totals.otHours,
        ot_amount: totals.otAmount,
        ot_details: totals.otEntries,
        travel_km: totals.travelKm,
        travel_amount: totals.travelAmount,
        travel_details: totals.routes,
        toll_amount: totals.tollAmount,
        toll_details: totals.tolls,
        parking_amount: totals.parkingAmount,
        parking_details: totals.parkings,
        total_amount: totals.totalAmount
    }]);

    if (saveErr) return { ok: false, totalAmount: totals.totalAmount, error: saveErr.message };
    return { ok: true, totalAmount: totals.totalAmount };
}

module.exports = { getBillingCycle, computeIncomeSummary, saveIncomeSession, computeTotals };