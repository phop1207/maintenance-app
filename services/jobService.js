const supabase = require('../config/supabaseClient');
const { client } = require('../config/lineClient');
const userStates = require('../state/userStates');
const { makeJobSummaryFlex, makeJobSummaryText, makeShopSelectorFlex, makeAlertFlex } = require('../flex/jobFlex');

// ─────────────────────────────────────────────
// Save Job
// ─────────────────────────────────────────────

async function saveJobToDatabase(currentState, userId, replyToken) {
    const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
    // ใช้วันที่ที่ผู้ใช้เลือก (chosen_date) ถ้ามี มิฉะนั้นใช้วันปัจจุบัน
    const date = currentState.chosen_date || now.toISOString().split('T')[0];
    const time = now.toISOString().split('T')[1].substring(0, 5);

    const { shop_brand, shop_name, branch_code, branch_name, job_type, repair_detail } = currentState;

    // หา user_id จาก line_user_id
    const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('line_user_id', userId)
        .single();
    const dbUserId = userRow ? userRow.id : null;

    try {
        const { data, error } = await supabase
            .from('jobs')
            .insert([{ 
                date, time, shop_brand, shop_name, branch_code, branch_name, 
                job_type, repair_detail, image_path: '',
                user_id: dbUserId
            }])
            .select();

        if (error) throw error;

        // บันทึกสำเร็จ
        currentState.jobId = data[0].id;
        currentState.step = 'AWAITING_IMAGE';

        const summaryFlex = makeJobSummaryFlex(date, time, shop_brand, shop_name, branch_code, branch_name, job_type, repair_detail);
        await client.replyMessage({ replyToken, messages: [summaryFlex] });

    } catch (err) {
        console.error('Supabase Error:', err);
        delete userStates[userId];
        await client.replyMessage({ replyToken, messages: [
            makeAlertFlex('error', 'เกิดข้อผิดพลาดในการบันทึกข้อมูลเข้า Cloud')
        ]});
    }
}

// ─────────────────────────────────────────────
// ดึงข้อมูลงานจาก DB เพื่อส่งข้อความสรุปหลังอัปโหลดรูป
// ─────────────────────────────────────────────
// ฟังก์ชันส่งสรุปงานหลังอัปโหลดรูป (ฉบับ Supabase)
async function sendJobSummaryAfterImage(userId, replyToken, jobId) {
    try {
        // ใช้ supabase ดึงข้อมูลแทน db.get
        const { data: job, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .single(); // เลือกรายการเดียวที่มี id ตรงกัน

        if (error || !job) {
            throw new Error('ไม่พบข้อมูลงาน');
        }

        // สร้างข้อความสรุปโดยใช้ข้อมูลจาก Supabase (job)
        const textMessage = makeJobSummaryText(
            job.date, job.time, 
            job.shop_brand, job.shop_name, 
            job.branch_code, job.branch_name, 
            job.job_type, job.repair_detail
        );
        
        const shopSelectorFlex = makeShopSelectorFlex();
        
        // ส่งข้อความตอบกลับไปที่ LINE
        await client.replyMessage({ replyToken, messages: [textMessage, shopSelectorFlex] });

    } catch (err) {
        console.error('Error in sendJobSummaryAfterImage:', err);
        await client.replyMessage({ replyToken, messages: [
            makeAlertFlex('error', 'ไม่พบข้อมูลงานหรือเกิดข้อผิดพลาดในการดึงข้อมูล')
        ]});
    }
}

module.exports = { saveJobToDatabase, sendJobSummaryAfterImage };
