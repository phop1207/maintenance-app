const express = require('express');
const router = express.Router();
const supabase = require('../config/supabaseClient');
const { computeIncomeSummary, getBillingCycle, computeTotals } = require('../services/incomeService');

// GET รายได้ (ใบงาน + OT/เดินทาง/ผ่านทาง/จอดรถ) ของรอบบิลปัจจุบัน
// role admin: ดูของ user_id ไหนก็ได้ (ไม่ระบุ = ของตัวเอง)
// role staff/user: ดูได้เฉพาะของตัวเอง (บังคับ user_id = requester_id เสมอ)
router.get('/api/income/summary', async (req, res) => {
    const { requester_id, role, user_id } = req.query;
    if (!requester_id || !role) return res.status(400).json({ error: 'ข้อมูลไม่ครบ (requester_id, role)' });
    if (!['admin', 'staff'].includes(role)) return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลรายได้' });

    const targetUserId = (role === 'admin' && user_id) ? user_id : requester_id;

    const { data: userRow } = await supabase.from('users').select('id, line_user_id').eq('id', targetUserId).single();
    if (!userRow) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

    const summary = await computeIncomeSummary({ userId: userRow.id, lineUserId: userRow.line_user_id });
    res.json(summary);
});

// GET รายการค่าตอบแทนเพิ่มเติม (extra_income) แต่ละแถวของรอบบิลปัจจุบัน — สำหรับแก้ไข/ลบทีละรายการ
router.get('/api/income/records', async (req, res) => {
    const { requester_id, role, user_id } = req.query;
    if (!requester_id || !role) return res.status(400).json({ error: 'ข้อมูลไม่ครบ (requester_id, role)' });
    if (!['admin', 'staff'].includes(role)) return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลรายได้' });

    const targetUserId = (role === 'admin' && user_id) ? user_id : requester_id;
    const { cycleStart, cycleEnd } = getBillingCycle();

    const { data, error } = await supabase
        .from('extra_income')
        .select('*')
        .eq('user_id', targetUserId)
        .gte('date', cycleStart)
        .lte('date', cycleEnd)
        .order('date', { ascending: false })
        .order('id', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// PATCH แก้ไขรายละเอียดเต็มของรายการค่าตอบแทนเพิ่มเติม 1 แถว
// รับ: date, ot_details[], travel_details[], toll_details[], parking_details[]
// เซิร์ฟเวอร์คำนวณยอดเงินใหม่ทั้งหมดจากรายละเอียดที่ส่งมา (สูตรเดียวกับตอนบันทึกจาก LINE) เพื่อกันข้อมูลไม่ตรงกัน
router.patch('/api/income/records/:id', async (req, res) => {
    const { requester_id, role, date, ot_details, travel_details, toll_details, parking_details } = req.body;
    if (!requester_id || !role) return res.status(400).json({ error: 'ข้อมูลไม่ครบ (requester_id, role)' });

    const { data: record, error: fetchErr } = await supabase
        .from('extra_income').select('*').eq('id', req.params.id).single();
    if (fetchErr || !record) return res.status(404).json({ error: 'ไม่พบรายการนี้' });
    if (role !== 'admin' && String(record.user_id) !== String(requester_id))
        return res.status(403).json({ error: 'ไม่มีสิทธิ์แก้ไขรายการของผู้อื่น' });

    let totals;
    try {
        totals = computeTotals({
            otDetails: Array.isArray(ot_details) ? ot_details : (record.ot_details || []),
            travelDetails: Array.isArray(travel_details) ? travel_details : (record.travel_details || []),
            tollDetails: Array.isArray(toll_details) ? toll_details : (record.toll_details || []),
            parkingDetails: Array.isArray(parking_details) ? parking_details : (record.parking_details || [])
        });
    } catch (e) {
        return res.status(400).json({ error: 'รูปแบบรายละเอียดไม่ถูกต้อง' });
    }

    const { error: updateErr } = await supabase.from('extra_income').update({
        date: date || record.date,
        ot_hours: totals.otHours, ot_amount: totals.otAmount, ot_details: totals.otEntries,
        travel_km: totals.travelKm, travel_amount: totals.travelAmount, travel_details: totals.routes,
        toll_amount: totals.tollAmount, toll_details: totals.tolls,
        parking_amount: totals.parkingAmount, parking_details: totals.parkings,
        total_amount: totals.totalAmount
    }).eq('id', req.params.id);

    if (updateErr) return res.status(500).json({ error: updateErr.message });
    res.json({ message: 'แก้ไขรายการสำเร็จ', totals });
});

// DELETE ลบรายการค่าตอบแทนเพิ่มเติม 1 แถว
router.delete('/api/income/records/:id', async (req, res) => {
    const { requester_id, role } = req.query;
    if (!requester_id || !role) return res.status(400).json({ error: 'ข้อมูลไม่ครบ (requester_id, role)' });

    const { data: record, error: fetchErr } = await supabase
        .from('extra_income').select('user_id').eq('id', req.params.id).single();
    if (fetchErr || !record) return res.status(404).json({ error: 'ไม่พบรายการนี้' });
    if (role !== 'admin' && String(record.user_id) !== String(requester_id))
        return res.status(403).json({ error: 'ไม่มีสิทธิ์ลบรายการของผู้อื่น' });

    const { error: deleteErr } = await supabase.from('extra_income').delete().eq('id', req.params.id);
    if (deleteErr) return res.status(500).json({ error: deleteErr.message });
    res.json({ message: 'ลบรายการสำเร็จ' });
});

module.exports = router;
