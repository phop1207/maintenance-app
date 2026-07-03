const express = require('express');
const router = express.Router();
const supabase = require('../config/supabaseClient');
const { computeIncomeSummary, getBillingCycle } = require('../services/incomeService');

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
        .order('date', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
});

// PATCH แก้ไขยอดของรายการค่าตอบแทนเพิ่มเติม 1 แถว (ot_amount / travel_amount / toll_amount / parking_amount)
// แก้ผ่านหน้าเว็บแล้วข้อมูลจะตรงกับ LINE ทันที เพราะอ่าน/เขียนตาราง extra_income เดียวกัน
router.patch('/api/income/records/:id', async (req, res) => {
    const { requester_id, role, ot_amount, travel_amount, toll_amount, parking_amount } = req.body;
    if (!requester_id || !role) return res.status(400).json({ error: 'ข้อมูลไม่ครบ (requester_id, role)' });

    const { data: record, error: fetchErr } = await supabase
        .from('extra_income').select('*').eq('id', req.params.id).single();
    if (fetchErr || !record) return res.status(404).json({ error: 'ไม่พบรายการนี้' });
    if (role !== 'admin' && String(record.user_id) !== String(requester_id))
        return res.status(403).json({ error: 'ไม่มีสิทธิ์แก้ไขรายการของผู้อื่น' });

    const newOt = ot_amount !== undefined ? Number(ot_amount) : record.ot_amount;
    const newTravel = travel_amount !== undefined ? Number(travel_amount) : record.travel_amount;
    const newToll = toll_amount !== undefined ? Number(toll_amount) : record.toll_amount;
    const newParking = parking_amount !== undefined ? Number(parking_amount) : record.parking_amount;
    if ([newOt, newTravel, newToll, newParking].some(v => isNaN(v) || v < 0))
        return res.status(400).json({ error: 'จำนวนเงินไม่ถูกต้อง' });

    const newTotal = newOt + newTravel + newToll + newParking;

    const { error: updateErr } = await supabase.from('extra_income').update({
        ot_amount: newOt, travel_amount: newTravel, toll_amount: newToll, parking_amount: newParking,
        total_amount: newTotal
    }).eq('id', req.params.id);

    if (updateErr) return res.status(500).json({ error: updateErr.message });
    res.json({ message: 'แก้ไขรายการสำเร็จ' });
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
