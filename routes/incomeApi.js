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

module.exports = router;
