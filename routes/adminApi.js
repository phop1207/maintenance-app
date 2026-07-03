const express = require('express');
const router = express.Router();
const supabase = require('../config/supabaseClient');

// ดูรายชื่อ users ทั้งหมด + จำนวนงาน
// ดูรายชื่อ users ทั้งหมด + จำนวนงาน
router.get('/api/admin/users', async (req, res) => {
    const { data: users, error } = await supabase
        .from('users')
        .select('id, username, display_name, role, created_at, line_user_id')
        .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    // นับจำนวนงานของแต่ละ user
    const { data: jobCounts } = await supabase
        .from('jobs')
        .select('user_id');

    const countMap = {};
    (jobCounts || []).forEach(j => {
        if (j.user_id) countMap[j.user_id] = (countMap[j.user_id] || 0) + 1;
    });

    const result = users.map(u => ({
        ...u,
        job_count: countMap[u.id] || 0,
        has_line: !!u.line_user_id
    }));
    res.json(result);
});

// แก้ Role
// แก้ Role
router.patch('/api/admin/users/:id/role', async (req, res) => {
    const { role } = req.body;
    if (!['admin', 'staff', 'user'].includes(role))
        return res.status(400).json({ error: 'role ต้องเป็น admin, staff หรือ user เท่านั้น' });

    const { error } = await supabase.from('users').update({ role }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: `เปลี่ยน role สำเร็จ` });
});

// รีเซ็ต PIN (admin เท่านั้น — ส่ง PIN ใหม่ไปเลย)
// รีเซ็ต PIN (admin เท่านั้น — ส่ง PIN ใหม่ไปเลย)
router.patch('/api/admin/users/:id/reset-pin', async (req, res) => {
    const newPin = req.body.new_pin || '1234';
    if (!/^\d{4,6}$/.test(newPin))
        return res.status(400).json({ error: 'PIN ต้องเป็นตัวเลข 4-6 หลัก' });

    const { error } = await supabase.from('users').update({ pin: newPin }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: `รีเซ็ต PIN เป็น ${newPin} สำเร็จ` });
});

// ลบ user (admin เท่านั้น)
// ลบ user (admin เท่านั้น)
router.delete('/api/admin/users/:id', async (req, res) => {
    // set null ก่อนลบ เพื่อไม่ให้ jobs reference error
    await supabase.from('jobs').update({ user_id: null }).eq('user_id', req.params.id);
    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'ลบผู้ใช้สำเร็จ' });
});

module.exports = router;
