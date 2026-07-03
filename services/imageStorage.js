const path = require('path');
const fs = require('fs');
const multer = require('multer');
const supabase = require('../config/supabaseClient');
const { STORAGE_BUCKET } = require('../config/constants');

const uploadDir = path.resolve(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir, { recursive: true }); }

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ─────────────────────────────────────────────
// Supabase Storage สำหรับเก็บรูปภาพ (แทนการเก็บไฟล์ใน local disk
// ซึ่งจะหายไปทุกครั้งที่ Render restart/redeploy)
// ─────────────────────────────────────────────

/** อัปโหลด buffer ขึ้น Supabase Storage แล้วคืน public URL */
async function uploadImageToStorage(buffer, fileName, contentType = 'image/jpeg') {
    const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, buffer, { contentType, upsert: true });

    if (error) throw error;

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
}

/** ลบไฟล์จาก Supabase Storage โดยรับ image_path ที่เก็บไว้ (อาจเป็น public URL หรือ path เก่าแบบ local) */
async function deleteImageFromStorage(imagePath) {
    if (!imagePath) return;
    try {
        if (imagePath.startsWith('http')) {
            // ดึงชื่อไฟล์ออกจาก public URL: .../object/public/<bucket>/<fileName>
            const marker = `/${STORAGE_BUCKET}/`;
            const idx = imagePath.indexOf(marker);
            if (idx === -1) return;
            const fileName = imagePath.substring(idx + marker.length);
            const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([fileName]);
            if (error) console.error('[STORAGE] ลบไฟล์ไม่สำเร็จ:', error.message);
        } else {
            // path เก่าที่เก็บใน local disk
            const absolutePath = path.resolve(__dirname, '..', 'public', imagePath);
            if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
        }
    } catch (err) {
        console.error('[STORAGE] เกิดข้อผิดพลาดตอนลบไฟล์รูปภาพ:', err.message);
    }
}

module.exports = { uploadImageToStorage, deleteImageFromStorage, upload, uploadDir };
