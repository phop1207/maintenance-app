const express = require('express');
const path = require('path');
const router = express.Router();
const supabase = require('../config/supabaseClient');
const { uploadImageToStorage, deleteImageFromStorage, upload } = require('../services/imageStorage');
const { capitalizeTextBackend, getBrandCategory } = require('../utils/textHelpers');

// ตรวจสิทธิ์ admin จากฐานข้อมูลจริง (ไม่เชื่อ role ที่ client ส่งมาตรงๆ) — ใช้ก่อนอนุญาตทำรายการอันตราย เช่น ลบข้อมูลทั้งหมด
async function requireAdmin(req, res) {
    const requesterId = req.query.requester_id || req.body.requester_id;
    if (!requesterId) {
        res.status(400).json({ error: 'ต้องระบุ requester_id' });
        return null;
    }
    const { data: user, error } = await supabase.from('users').select('id, role').eq('id', requesterId).single();
    if (error || !user || user.role !== 'admin') {
        res.status(403).json({ error: 'เฉพาะ Admin เท่านั้นที่ทำรายการนี้ได้' });
        return null;
    }
    return user;
}

router.post('/api/jobs', upload.single('image'), async (req, res) => {
    const { date, time, shop_brand, shop_name, branch_code, branch_name, job_type, repair_detail, user_id } = req.body;
    let image_path = '';
    if (req.file) {
        const fileName = `web-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(req.file.originalname)}`;
        try {
            image_path = await uploadImageToStorage(req.file.buffer, fileName, req.file.mimetype);
        } catch (err) {
            return res.status(500).json({ error: 'อัปโหลดรูปไม่สำเร็จ: ' + err.message });
        }
    }

    const { data, error } = await supabase.from('jobs').insert([{
        date, time,
        shop_brand: capitalizeTextBackend(shop_brand || getBrandCategory(shop_name)),
        shop_name: capitalizeTextBackend(shop_name),
        branch_code: (branch_code || '-').toUpperCase(),
        branch_name: capitalizeTextBackend(branch_name),
        job_type,
        repair_detail: job_type === 'Repair' ? repair_detail : '',
        image_path,
        user_id: user_id || null
    }]).select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Created successfully', id: data[0].id });
});

router.put('/api/jobs/:id', upload.single('image'), async (req, res) => {
    const { id } = req.params;
    let updateData = { ...req.body };
    if (req.file) {
        const fileName = `web-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(req.file.originalname)}`;
        try {
            updateData.image_path = await uploadImageToStorage(req.file.buffer, fileName, req.file.mimetype);
        } catch (err) {
            return res.status(500).json({ error: 'อัปโหลดรูปไม่สำเร็จ: ' + err.message });
        }

        // ลบรูปเก่าทิ้ง (ถ้ามี) เพื่อไม่ให้ Storage รก
        const { data: oldJob } = await supabase.from('jobs').select('image_path').eq('id', id).single();
        if (oldJob && oldJob.image_path) await deleteImageFromStorage(oldJob.image_path);
    }

    const { error } = await supabase.from('jobs').update(updateData).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Updated successfully' });
});

// ลบงานเดี่ยว
router.delete('/api/jobs/:id', async (req, res) => {
    const { data: job } = await supabase.from('jobs').select('image_path').eq('id', req.params.id).single();
    if (job && job.image_path) await deleteImageFromStorage(job.image_path);

    const { error } = await supabase.from('jobs').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Deleted successfully' });
});

// ลบข้อมูลตามช่วงวันที่
// ลบข้อมูลตามช่วงวันที่
router.delete('/api/jobs/danger/range', async (req, res) => {
    if (!(await requireAdmin(req, res))) return;

    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'Missing start/end date' });

    try {
        // 1. ดึงข้อมูลรูปภาพเพื่อลบไฟล์ในเครื่องก่อน
        const { data: rows, error: selectError } = await supabase
            .from('jobs')
            .select('image_path')
            .gte('date', start)
            .lte('date', end);

        if (selectError) throw selectError;

        if (rows) {
            for (const row of rows) {
                await deleteImageFromStorage(row.image_path);
            }
        }
        const { error: deleteError } = await supabase
            .from('jobs')
            .delete()
            .gte('date', start)
            .lte('date', end);

        if (deleteError) throw deleteError;

        res.json({ message: `ลบข้อมูลในช่วงวันที่ ${start} ถึง ${end} สำเร็จ` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ล้างข้อมูลทั้งหมด
// ล้างข้อมูลทั้งหมด
router.delete('/api/jobs/danger/all', async (req, res) => {
    if (!(await requireAdmin(req, res))) return;

    try {
        // 1. ดึงทุกแถวเพื่อลบไฟล์รูปภาพในเครื่อง
        const { data: rows, error: selectError } = await supabase
            .from('jobs')
            .select('image_path');

        if (selectError) throw selectError;

        if (rows) {
            for (const row of rows) {
                await deleteImageFromStorage(row.image_path);
            }
        }
        const { error: deleteError } = await supabase
            .from('jobs')
            .delete()
            .neq('id', 0); // ลบทุกอย่างที่มี ID (ถ้าไม่มี ID 0 ให้เปลี่ยนเป็นเงื่อนไขที่ครอบคลุมทั้งหมด)

        if (deleteError) throw deleteError;

        res.json({ message: `ล้างข้อมูลระบบเรียบร้อย!` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET jobs — กรองตาม user (admin เห็นทั้งหมด, user เห็นแค่ตัวเอง)
// GET jobs — กรองตาม user (admin เห็นทั้งหมด, user เห็นแค่ตัวเอง)
router.get('/api/jobs', async (req, res) => {
    const { user_id, role } = req.query;

    let query = supabase
        .from('jobs')
        .select('*, users(display_name, username)')
        .order('date', { ascending: false })
        .order('time', { ascending: false });

    // ถ้าไม่ใช่ admin → กรองเฉพาะของตัวเอง
    if (role !== 'admin' && user_id) {
        query = query.eq('user_id', user_id);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

module.exports = router;
