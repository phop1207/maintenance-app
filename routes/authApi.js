const express = require('express');
const router = express.Router();
const supabase = require('../config/supabaseClient');

// Login
// Login
router.post('/api/auth/login', async (req, res) => {
    const { username, pin } = req.body;
    if (!username || !pin) return res.status(400).json({ error: 'กรุณากรอก username และ PIN' });

    const { data: user, error } = await supabase
        .from('users')
        .select('id, username, display_name, role, pin')
        .eq('username', username.toLowerCase().trim())
        .single();

    if (error || !user) return res.status(401).json({ error: 'ไม่พบชื่อผู้ใช้นี้ในระบบ' });
    if (user.pin !== pin) return res.status(401).json({ error: 'PIN ไม่ถูกต้อง' });

    // ส่งข้อมูล user กลับ (ไม่ส่ง pin)
    res.json({ 
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role
    });
});

// เปลี่ยน PIN (ต้องใส่ PIN เก่าก่อน)
// เปลี่ยน PIN (ต้องใส่ PIN เก่าก่อน)
router.post('/api/auth/change-pin', async (req, res) => {
    const { user_id, old_pin, new_pin } = req.body;
    if (!user_id || !old_pin || !new_pin) 
        return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
    if (!/^\d{4,6}$/.test(new_pin))
        return res.status(400).json({ error: 'PIN ใหม่ต้องเป็นตัวเลข 4-6 หลักเท่านั้น' });

    const { data: user, error } = await supabase
        .from('users').select('pin').eq('id', user_id).single();

    if (error || !user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    if (user.pin !== old_pin) return res.status(401).json({ error: 'PIN เก่าไม่ถูกต้อง' });

    const { error: updateErr } = await supabase
        .from('users').update({ pin: new_pin }).eq('id', user_id);

    if (updateErr) return res.status(500).json({ error: updateErr.message });
    res.json({ message: 'เปลี่ยน PIN สำเร็จแล้วครับ!' });
});

// GET ข้อมูล user ปัจจุบันใหม่จากฐานข้อมูล (ใช้ตอนเปิดเว็บเพื่อรีเฟรช role ล่าสุด
// เผื่อ admin เพิ่งเปลี่ยน role ให้ ระหว่างที่ session เก่ายังค้างอยู่ในเบราว์เซอร์)
router.get('/api/auth/me/:id', async (req, res) => {
    const { data: user, error } = await supabase
        .from('users')
        .select('id, username, display_name, role')
        .eq('id', req.params.id)
        .single();

    if (error || !user) return res.status(404).json({ error: 'ไม่พบผู้ใช้ กรุณาเข้าสู่ระบบใหม่' });
    res.json(user);
});

// GET users list (for admin dropdown)
// GET users list (for admin dropdown)
router.get('/api/auth/users', async (req, res) => {
    const { data, error } = await supabase
        .from('users')
        .select('id, username, display_name, role')
        .order('display_name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

module.exports = router;
