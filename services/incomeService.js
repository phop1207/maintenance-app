// ─────────────────────────────────────────────
// Income Service — คำนวณรายได้รวม (ใบงาน + OT/เดินทาง/ผ่านทาง/จอดรถ)
// รอบบิล: วันที่ 26 ถึง 25 ของเดือนถัดไป
// ─────────────────────────────────────────────
const supabase = require('../config/supabaseClient');
const { JOB_INCOME_RATE, JOB_INCOME_TYPES, BILLING_CYCLE_START_DAY } = require('../config/constants');

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
            .select('id, job_type')
            .eq('user_id', userId)
            .in('job_type', JOB_INCOME_TYPES)
            .gte('date', start)
            .lte('date', end);
        jobCount = (jobs || []).length;
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

module.exports = { getBillingCycle, computeIncomeSummary };
