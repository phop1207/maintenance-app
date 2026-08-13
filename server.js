require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const line = require('@line/bot-sdk');
const multer = require('multer'); 
const { createClient } = require('@supabase/supabase-js'); // เอามาไว้กับตัวอื่น


// ตั้งค่า
const app = express();
const PORT = process.env.PORT || 3000;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
// ... (หลังบรรทัด const supabase = ...)

// เพิ่มส่วนนี้เข้าไปครับ
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET
};

// หลังจากประกาศ config แล้ว บรรทัดนี้ถึงจะทำงานได้ครับ
const client = new line.messagingApi.MessagingApiClient({ channelAccessToken: config.channelAccessToken });
const blobClient = new line.messagingApi.MessagingApiBlobClient({ channelAccessToken: config.channelAccessToken });

// ... (ส่วนการ config Line client เดิมของคุณ)


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(__dirname, 'public')));

const uploadDir = path.resolve(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir, { recursive: true }); }

// ─────────────────────────────────────────────
// Supabase Storage สำหรับเก็บรูปภาพ (แทนการเก็บไฟล์ใน local disk
// ซึ่งจะหายไปทุกครั้งที่ Render restart/redeploy)
// ─────────────────────────────────────────────
const STORAGE_BUCKET = 'job-images';

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
            const absolutePath = path.resolve(__dirname, 'public', imagePath);
            if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
        }
    } catch (err) {
        console.error('[STORAGE] เกิดข้อผิดพลาดตอนลบไฟล์รูปภาพ:', err.message);
    }
}

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


const AUTO_BRANCH_SHOPS = ['mk', 'bbq'];

// ─────────────────────────────────────────────
// ระบบบันทึกค่าตอบแทนเพิ่มเติมประจำเดือน (คำสั่งลับ "phopcheck")
// หมายเหตุ: รายการเหล่านี้ไม่ใช่ "รายได้" หลักของงาน ใช้แค่บันทึก/สรุปให้ดูเท่านั้น
// ─────────────────────────────────────────────
const INCOME_SECRET_COMMAND = 'phopcheck';
const OT_RATE_PER_HOUR = 125;   // บาท/ชั่วโมง
const KM_RATE_PER_KM = 5;       // บาท/กิโลเมตร

const BRANCH_MAP = {
    'm074': 'JUSCO SUK HUMVIT 71', 'm089': 'BIG C RAMA 4', 'm425': 'CENTRAL BANGRAK',
    'm342': 'TERMINAL 21 ASOK', 'm268': 'CHAMCHURI SQUARE', 'm071': 'FUTUREMART RAMA 3',
    'm477': 'RIVERSIDE PLAZA', 'm357': 'BIG C RAMA 2', 'm389': 'SEACON SQUARE BANGKAE',
    'm181': 'BIG C AOMYAI', 'm250': 'LOTUS SALAYA', 'm329': 'CIRCLE RATCHAPRUK',
    'm168': 'LOTUS CHARUNSANITWONG', 'm458': 'THE CRYSTAL RATCHAPRUEK', 'm203': 'ZEER RANGSIT',
    'm232': 'PURE PLACE RANGSIT', 'm501': 'BIG C PATHUMTHANI', 'm216': 'LOTUS LAMLUKKA',
    'm217': 'BIG C LAMLUKKA', 'm211': 'LOTUS VATCHARAPOL', 'm363': '101 HAPPY AVENUE',
    'm296': 'SF NAVAMIN CITY AVENUE', 'm457': 'THE JAS WANGHIN', 'm062': 'TOP KASET',
    'm306': 'เอสพละนาด-รัตนาธิเบศร์', 'm283': 'LOTUS RATTANATIBET', 'm020': 'BIG C CHAENGWATTHANA',
    'm422': 'LOTUS ORNUTCH', 'm586': 'SEACON SQUARE SRINAKARIN', 'm295': 'BIG C ROMKRAO',
    'm416': 'BIG C SRINAKARIN', 'm489': 'THE JAS SRINAKARIN', 'm132': 'BIG C SAMRONG',
    'm238': 'LOTUS BANGPOO', 'm201': 'SIAM FUTURE PETCHKASEM', 'm366': 'LOTUS BANBUNG',
    'm293': 'LOTUS CHONBURI', 'm351': 'BIG C CHANTABURI', 'm239': 'BIG C CHONBURI 1',
    'm225': 'BIG C-CHONBURI (2)', 'm304': 'LAEMTHONG BANGSAEN', 'm137': 'LOTUS RAYONG',
    'm449': 'LAEMTHONG RAYONG', 'm120': 'LOTUS PATTAYANUA', 'm149': 'BIG C PATTAYA',
    'm163': 'BIG C PATTAYA 2', 'm043': 'LOTUS PATTAYA', 'm272': 'LOTUS PRANBURI',
    'm409': 'LOTUS SAMUTSONGKHRAM', 'm493': 'TERMINAL 21 KORAT', 'm531': 'ROBINSON-CHAIYAPHUM',
    'm499': 'LOTUS PAKCHONG', 'm191': 'BIG C CHACHOENGSAO 2',

    // ── BBQ ──
    'b022': 'เซ็นทรัล ปิ่นเกล้า ชั้น G', 'b253': 'มาร์เก็ตเพลส เทพรักษ์', 'b255': 'โลตัส ประชาอุทิศ พลาซ่า',
    'b259': 'วิคตอเรีย การ์เด้นส์', 'b262': 'โอเอซิส เบลล่า พัฒนาการ 30', 'b263': 'ลิตเติ้ลวอล์ค พรานนก-พุทธมณฑล',
    'b001': 'เซ็นทรัล ลาดพร้าว', 'b123': 'เซ็นทรัลพระราม 9', 'b086': 'เซ็นทรัลเวิลด์',
    'b036': 'เซ็นทรัลบางนา', 'b062': 'เซ็นทรัลพระราม 2', 'b016': 'เดอะมอลล์บางกะปิ',
    'b222': 'เดอะมอลล์ท่าพระ', 'b021': 'แฟชั่น ไอซ์แลนด์', 'b012': 'ซีคอนบางแค',
    'b008': 'เดอะมอลล์งามวงศ์วาน', 'b269': 'เซ็นทรัลนอร์ธวิว', 'b077': 'เชียร์รังสิต',
    'b198': 'เก็ตเวย์ เอก บางซื่อ', 'b138': 'ยูเนี่ยน มอลล์', 'b081': 'ดิ เอสพละนาด รัชดา',
    'b156': 'เซ็นทรัลเฟสติวัล อีสวิลล์', 'b109': 'สยามเซ็นเตอร์', 'b137': 'สยามสแควร์วัน',
    'b040': 'สีลม คอมเพล็กซ์', 'b206': 'สามย่าน มิตรทาวน์', 'b194': 'เซ็นจูรี่ สุขุมวิท',
    'b203': 'เก็ตเวย์ เอกมัย', 'b242': 'วัน-โอ-วัน ทรู ดิจิทัล พาร์ค', 'b205': 'ไอคอน สยาม',
    'b111': 'เซ็นทรัลขอนแก่น', 'b069': 'บิ๊กซี เพชรเกษม 2', 'b046': 'บิ๊กซี รัชดา',
    'b230': 'เทอมินอล พระราม 3', 'b072': 'บิ๊กซี สุขสวัสดิ์', 'b054': 'บิ๊กซี บางปะกอก',
    'b151': 'เซ็นทรัล เวสเกต บางใหญ่', 'b018': 'ซีคอนสแควร์', 'b113': 'พาราไดซ์ พาร์ค',
    'b042': 'โลตัส พระราม 2', 'b097': 'มาเก็ตเพลสสุขาภิบาล1', 'b108': 'มาร์เก็ตเพลส นวมินทร์',
    'b213': 'เดอะซีน ทาวน์ อิน ทาวน์', 'b228': 'มาร์เก็ตเพลส วงศ์สว่าง', 'b099': 'ซูซูกิ อเวนิว รัชโยธิน',
    'b019': 'ฟิวเจอร์พาร์ค รังสิต', 'b184': 'ดิ เอ็กซ์เพลส กาญจนาภิเษก', 'b173': 'พาซิโอ กาญจนาภิเษก',
    'b238': 'เซ็นทรัล เวสต์วิลล์', 'b248': 'เนอวานา พอร์ช กรุงเทพกรีฑา', 'b226': 'สายไหม อเวนิว',
    'b092': 'โลตัส พระราม 1', 'b244': 'แจส กรีน วิลเลจ บางบัวทอง', 'b015': 'เดอะมอลล์บางแค ชั้น2',
    'b232': 'โลตัส นอร์ธ ราชพฤกษ์', 'b139': 'โลตัส บางใหญ่', 'b234': 'เซ็นทรัลวิลเลจ',
    'b209': 'โรบินสัน สุวรรณภูมิ (โรบินสัน ลาดกระบัง เดิม)', 'b195': 'โลตัส ศรีนครินทร์', 'b127': 'เมก้า บางนา',
    'b147': 'มาเก็ตวิลเลจ สุวรรณภูมิ', 'b104': 'เซ็นทรัล แจ้งวัฒนะ', 'b058': 'โลตัส รังสิต',
    'b011': 'เซ็นทรัล รามอินทรา', 'b102': 'บิ๊กซี รังสิต คลอง 6', 'b035': 'เซ็นทรัล พระราม 3',
    'b180': 'บิ๊กซี บางใหญ่', 'b175': 'โลตัส แจ้งวัฒนะ', 'b079': 'บิ๊กซี ลำลูกกา'
};

const userStates = {};

// ─────────────────────────────────────────────
// Flex Message Helpers
// ─────────────────────────────────────────────

/** Flex: ต้อนรับ + ขอพิมพ์ "เริ่มต้น" */
function makeWelcomeFlex() {
    return {
        type: 'flex',
        altText: 'ยินดีต้อนรับ กรุณาพิมพ์ "เริ่มต้น" เพื่อเริ่มใช้งาน',
        contents: {
            type: 'bubble',
            header: {
                type: 'box', layout: 'vertical',
                backgroundColor: '#2f3542',
                paddingAll: '14px',
                contents: [
                    { type: 'text', text: '🏪 ยินดีต้อนรับ', weight: 'bold', size: 'lg', color: '#ffffff', align: 'center' }
                ]
            },
            body: {
                type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '14px',
                contents: [
                    {
                        type: 'box', layout: 'vertical', alignItems: 'center',
                        contents: [
                            { type: 'text', text: '👋', size: 'xl', align: 'center' },
                            { type: 'text', text: 'กรุณาพิมพ์คำว่า', size: 'sm', color: '#888888', align: 'center', margin: 'md' },
                            { type: 'text', text: '"เริ่มต้น"', size: 'lg', weight: 'bold', color: '#27ae60', align: 'center', margin: 'xs' },
                            { type: 'text', text: 'เพื่อเริ่มบันทึกงาน', size: 'sm', color: '#888888', align: 'center', margin: 'xs' }
                        ]
                    }
                ]
            }
        }
    };
}

/** Flex: ทักทาย user พร้อมแสดงข้อมูล + ปุ่มเลือกร้าน */
function makeGreetingAndShopFlex(displayName) {
    const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const hour = now.getUTCHours();
    let greeting = '🌅 สวัสดีตอนเช้า';
    if (hour >= 12 && hour < 17) greeting = '🌞 สวัสดีตอนบ่าย';
    else if (hour >= 17) greeting = '🌙 สวัสดีตอนเย็น';

    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toISOString().split('T')[1].substring(0, 5);

    return {
        type: 'flex',
        altText: `${greeting} คุณ${displayName} เลือกร้านค้าเพื่อเริ่มบันทึกงาน`,
        contents: {
            type: 'bubble',
            header: {
                type: 'box', layout: 'vertical',
                backgroundColor: '#2f3542', paddingAll: '14px',
                contents: [
                    { type: 'text', text: `${greeting}!`, weight: 'bold', size: 'md', color: '#ffffff', align: 'center' },
                    { type: 'text', text: `คุณ ${displayName}`, size: 'lg', weight: 'bold', color: '#f1c40f', align: 'center', margin: 'xs' }
                ]
            },
            body: {
                type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px',
                contents: [
                    {
                        type: 'box', layout: 'horizontal', spacing: 'sm',
                        contents: [
                            {
                                type: 'box', layout: 'vertical', flex: 1,
                                backgroundColor: '#f8f9fa', cornerRadius: '8px', paddingAll: '8px',
                                contents: [
                                    { type: 'text', text: '📅 วันที่', size: 'xxs', color: '#888888' },
                                    { type: 'text', text: dateStr, size: 'sm', weight: 'bold', color: '#2c3e50', margin: 'xs' }
                                ]
                            },
                            {
                                type: 'box', layout: 'vertical', flex: 1,
                                backgroundColor: '#f8f9fa', cornerRadius: '8px', paddingAll: '8px',
                                contents: [
                                    { type: 'text', text: '⏰ เวลา', size: 'xxs', color: '#888888' },
                                    { type: 'text', text: timeStr + ' น.', size: 'sm', weight: 'bold', color: '#2c3e50', margin: 'xs' }
                                ]
                            }
                        ]
                    },
                    { type: 'separator', margin: 'md' },
                    { type: 'text', text: '🏪 เลือกร้านค้าที่เข้าทำงาน', size: 'sm', weight: 'bold', color: '#2f3542', margin: 'md' },
                    {
                        type: 'box', layout: 'horizontal', spacing: 'md', margin: 'sm',
                        contents: [
                            { type: 'button', flex: 1, style: 'primary', color: '#e74c3c', action: { type: 'message', label: '🍲 MK', text: 'mk' } },
                            { type: 'button', flex: 1, style: 'primary', color: '#2ecc71', action: { type: 'message', label: '🍖 BBQ', text: 'bbq' } }
                        ]
                    },
                    {
                        type: 'box', layout: 'horizontal', spacing: 'md', margin: 'sm',
                        contents: [
                            { type: 'button', flex: 1, style: 'primary', color: '#e67e22', action: { type: 'message', label: '🍱 Fuji', text: 'Fuji' } },
                            { type: 'button', flex: 1, style: 'primary', color: '#f1c40f', action: { type: 'message', label: '🍜 Lucky Suki', text: 'Lucky Suki' } }
                        ]
                    },
                    {
                        type: 'box', layout: 'horizontal', spacing: 'md', margin: 'sm',
                        contents: [
                            { type: 'button', flex: 1, style: 'primary', color: '#8e44ad', action: { type: 'message', label: '🍢 Bonus Suki', text: 'Bonus Suki' } }
                        ]
                    },
                    { type: 'separator', margin: 'md' },
                    {
                        type: 'button', style: 'secondary', margin: 'sm',
                        action: { type: 'message', label: '📊 ดูภาพรวมงานของฉัน', text: '__overview__' }
                    }
                ]
            },
            footer: {
                type: 'box', layout: 'vertical', backgroundColor: '#f8f9fa', paddingAll: '12px',
                contents: [{ type: 'text', text: '💡 หรือพิมพ์ชื่อร้านเองได้เลยครับ', size: 'xxs', color: '#888888', align: 'center' }]
            }
        }
    };
}

/** Flex: ปุ่มเลือกร้านสำหรับเริ่มงานครั้งต่อไป */
function makeShopSelectorFlex() {
    return {
        type: 'flex',
        altText: 'เลือกร้านค้าเพื่อเริ่มบันทึกงาน',
        contents: {
            type: 'bubble',
            header: {
                type: 'box', layout: 'vertical',
                backgroundColor: '#2f3542', paddingAll: '14px',
                contents: [
                    { type: 'text', text: '🏪 เริ่มบันทึกงานถัดไป', weight: 'bold', size: 'lg', color: '#ffffff', align: 'center' },
                    { type: 'text', text: 'เลือกร้านค้าด้านล่าง', size: 'xs', color: '#aaaaaa', align: 'center', margin: 'xs' }
                ]
            },
            body: {
                type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px',
                contents: [
                    {
                        type: 'box', layout: 'horizontal', spacing: 'md', margin: 'sm',
                        contents: [
                            { type: 'button', flex: 1, style: 'primary', color: '#e74c3c', action: { type: 'message', label: '🍲 MK', text: 'mk' } },
                            { type: 'button', flex: 1, style: 'primary', color: '#2ecc71', action: { type: 'message', label: '🍖 BBQ', text: 'bbq' } }
                        ]
                    },
                    {
                        type: 'box', layout: 'horizontal', spacing: 'md', margin: 'sm',
                        contents: [
                            { type: 'button', flex: 1, style: 'primary', color: '#e67e22', action: { type: 'message', label: '🍱 Fuji', text: 'Fuji' } },
                            { type: 'button', flex: 1, style: 'primary', color: '#f1c40f', action: { type: 'message', label: '🍜 Lucky Suki', text: 'Lucky Suki' } }
                        ]
                    },
                    {
                        type: 'box', layout: 'horizontal', spacing: 'md', margin: 'sm',
                        contents: [
                            { type: 'button', flex: 1, style: 'primary', color: '#8e44ad', action: { type: 'message', label: '🍢 Bonus Suki', text: 'Bonus Suki' } }
                        ]
                    },
                    { type: 'separator', margin: 'md' },
                    {
                        type: 'button', style: 'secondary', margin: 'sm',
                        action: { type: 'message', label: '📊 ดูภาพรวมงานของฉัน', text: '__overview__' }
                    }
                ]
            },
            footer: {
                type: 'box', layout: 'vertical', backgroundColor: '#f8f9fa', paddingAll: '12px',
                contents: [
                    { type: 'text', text: '💡 หรือพิมพ์ชื่อร้านเองได้เลยครับ', size: 'xxs', color: '#888888', align: 'center' }
                ]
            }
        }
    };
}

/** Flex: แจ้งร้าน + ขอรหัสสาขา / ชื่อสาขา */
function makeShopConfirmFlex(shopName, brand, nextPrompt) {
    return {
        type: 'flex',
        altText: `ร้าน: ${shopName} | ${nextPrompt}`,
        contents: {
            type: 'bubble',
            header: {
                type: 'box', layout: 'vertical',
                backgroundColor: '#2f3542',
                contents: [{ type: 'text', text: '🏪 ยืนยันร้านค้า', weight: 'bold', size: 'lg', color: '#ffffff' }]
            },
            body: {
                type: 'box', layout: 'vertical', spacing: 'sm',
                contents: [
                    { type: 'box', layout: 'horizontal', contents: [
                        { type: 'text', text: 'ร้าน', size: 'sm', color: '#888888', flex: 2 },
                        { type: 'text', text: shopName, size: 'sm', weight: 'bold', flex: 5, wrap: true }
                    ]},
                    { type: 'box', layout: 'horizontal', contents: [
                        { type: 'text', text: 'กลุ่มสถิติ', size: 'sm', color: '#888888', flex: 2 },
                        { type: 'text', text: brand, size: 'sm', weight: 'bold', color: '#1e90ff', flex: 5 }
                    ]},
                    { type: 'separator', margin: 'md' },
                    { type: 'text', text: `👉 ${nextPrompt}`, size: 'sm', color: '#2f3542', wrap: true, margin: 'md' }
                ]
            }
        }
    };
}

/** Flex: เลือกประเภทงาน */
function makeJobTypeFlex() {
    return {
        type: 'flex',
        altText: 'เลือกประเภทงาน',
        contents: {
            type: 'bubble',
            header: {
                type: 'box', layout: 'vertical',
                backgroundColor: '#2f3542',
                contents: [{ type: 'text', text: '⚙️ กรุณาเลือกประเภทงาน', weight: 'bold', size: 'lg', color: '#ffffff' }]
            },
            body: {
                type: 'box', layout: 'vertical', spacing: 'md',
                contents: [
                    { type: 'button', style: 'primary', color: '#ff4757', action: { type: 'message', label: '🛠 Repair', text: 'Repair' } },
                    { type: 'button', style: 'primary', color: '#2ed573', action: { type: 'message', label: '⚙️ Maintenance', text: 'Maintenance' } },
                    { type: 'button', style: 'primary', color: '#1e90ff', action: { type: 'message', label: '🏗 Installation', text: 'Installation' } }
                ]
            }
        }
    };
}

/** Flex: ถามรายละเอียดซ่อม */
function makeRepairDetailFlex() {
    return {
        type: 'flex',
        altText: 'ระบุรายละเอียดการซ่อม',
        contents: {
            type: 'bubble',
            header: {
                type: 'box', layout: 'vertical',
                backgroundColor: '#ff4757',
                contents: [{ type: 'text', text: '🔧 งานซ่อม (Repair)', weight: 'bold', size: 'lg', color: '#ffffff' }]
            },
            body: {
                type: 'box', layout: 'vertical', spacing: 'sm',
                contents: [
                    { type: 'text', text: 'ตรวจพบว่าเป็นงานซ่อม!', size: 'md', weight: 'bold', color: '#ff4757' },
                    { type: 'text', text: '👉 กรุณาพิมพ์รายละเอียดว่า "ซ่อมอะไร" ครับ', size: 'sm', color: '#555555', wrap: true, margin: 'md' }
                ]
            }
        }
    };
}

/** Flex: สรุปข้อมูลงาน (ระหว่างรอรูป - มี footer แจ้งส่งรูป) */
function makeJobSummaryFlex(date, time, shop_brand, shop_name, branch_code, branch_name, job_type, repair_detail) {
    const jobTypeColor   = job_type === 'Repair' ? '#e74c3c' : job_type === 'Maintenance' ? '#27ae60' : '#2980b9';
    const headerColor    = job_type === 'Repair' ? '#c0392b' : job_type === 'Maintenance' ? '#27ae60' : '#2471a3';

    const rows = [
        { icon: '📌', label: 'รหัสสาขา', value: branch_code || '-' },
        { icon: '🗺️', label: 'สาขา',     value: branch_name || '-' },
    ];

    const repairRow = (job_type === 'Repair' && repair_detail)
        ? [{ type: 'separator', margin: 'sm' },
           { type: 'box', layout: 'horizontal', contents: [
               { type: 'text', text: '🔧 ซ่อมอะไร', size: 'sm', color: '#888888', flex: 4, wrap: true },
               { type: 'text', text: repair_detail, size: 'sm', weight: 'bold', color: '#c0392b', flex: 6, wrap: true }
           ]}]
        : [];

    const altTextFull =
        `✅ บันทึกข้อมูลงานสำเร็จแล้ว!\n\n` +
        `📅 วันที่: ${date}\n⏰ เวลา: ${time}\n📦 แบรนด์: ${shop_brand}\n` +
        `🏪 ร้าน: ${shop_name}\n📌 รหัสสาขา: ${branch_code}\n🗺️ สาขา: ${branch_name}\n` +
        `⚙️ ประเภทงาน: ${job_type}` +
        (job_type === 'Repair' && repair_detail ? `\n🔧 ซ่อมอะไร: ${repair_detail}` : '');

    return {
        type: 'flex',
        altText: altTextFull,
        contents: {
            type: 'bubble',
            size: 'kilo',

            header: {
                type: 'box', layout: 'vertical',
                backgroundColor: '#27ae60',
                paddingAll: '14px',
                contents: [{
                    type: 'box', layout: 'horizontal', alignItems: 'center',
                    contents: [
                        { type: 'text', text: '✅', size: 'lg', flex: 0 },
                        { type: 'text', text: 'บันทึกข้อมูลงานสำเร็จ!',
                          weight: 'bold', size: 'md', color: '#ffffff', margin: 'sm' }
                    ]
                }]
            },

            body: {
                type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '14px',
                contents: [
                    {
                        type: 'box', layout: 'horizontal', alignItems: 'center',
                        paddingBottom: '12px',
                        contents: [
                            {
                                type: 'box', layout: 'vertical', flex: 0,
                                width: '40px', height: '40px',
                                cornerRadius: '20px',
                                backgroundColor: '#e8f5e9',
                                justifyContent: 'center', alignItems: 'center',
                                contents: [{ type: 'text', text: '🏪', size: 'lg' }]
                            },
                            {
                                type: 'box', layout: 'vertical', flex: 1, margin: 'sm',
                                contents: [
                                    { type: 'text', text: 'แบรนด์ / ร้าน', size: 'xxs', color: '#888888' },
                                    { type: 'text', text: `${shop_brand} · ${shop_name}`, size: 'sm', weight: 'bold', color: '#2c3e50', wrap: true }
                                ]
                            },
                            {
                                type: 'box', layout: 'vertical', flex: 0,
                                backgroundColor: '#e8f5e9',
                                paddingAll: '4px', paddingStart: '8px', paddingEnd: '8px',
                                cornerRadius: '20px',
                                contents: [{ type: 'text', text: job_type, size: 'xxs', color: headerColor, weight: 'bold' }]
                            }
                        ]
                    },

                    { type: 'separator' },

                    {
                        type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'sm',
                        contents: [
                            {
                                type: 'box', layout: 'vertical', flex: 1,
                                backgroundColor: '#f8f9fa', cornerRadius: '8px', paddingAll: '8px',
                                contents: [
                                    { type: 'text', text: '📅 วันที่', size: 'xxs', color: '#888888' },
                                    { type: 'text', text: date, size: 'sm', weight: 'bold', color: '#2c3e50', margin: 'xs' }
                                ]
                            },
                            {
                                type: 'box', layout: 'vertical', flex: 1,
                                backgroundColor: '#f8f9fa', cornerRadius: '8px', paddingAll: '8px',
                                contents: [
                                    { type: 'text', text: '⏰ เวลา', size: 'xxs', color: '#888888' },
                                    { type: 'text', text: time, size: 'sm', weight: 'bold', color: '#2c3e50', margin: 'xs' }
                                ]
                            }
                        ]
                    },

                    { type: 'separator', margin: 'sm' },

                    ...rows.map(r => ({
                        type: 'box', layout: 'horizontal', margin: 'xs',
                        contents: [
                            { type: 'text', text: `${r.icon} ${r.label}`, size: 'sm', color: '#888888', flex: 4, wrap: true },
                            { type: 'text', text: r.value, size: 'sm', weight: 'bold', color: '#2c3e50', flex: 6, wrap: true, align: 'end' }
                        ]
                    })),

                    ...repairRow
                ]
            },

            footer: {
                type: 'box', layout: 'horizontal', alignItems: 'center',
                backgroundColor: '#fff8e1', paddingAll: '12px', spacing: 'sm',
                contents: [
                    { type: 'text', text: '📷', size: 'lg', flex: 0 },
                    { type: 'text', text: 'กรุณาส่งรูปภาพใบงานเพื่อปิดงานครับ',
                      size: 'xs', color: '#7d5a00', wrap: true, flex: 1 }
                ]
            }
        }
    };
}

/** สร้างข้อความ Text สำหรับส่งหลังอัปโหลดรูป */
function makeJobSummaryText(date, time, shop_brand, shop_name, branch_code, branch_name, job_type, repair_detail) {
    let text = `✅ บันทึกข้อมูลงานสำเร็จ!\n\n`;
    text += `📅 วันที่: ${date}\n`;
    text += `⏰ เวลา: ${time}\n`;
    text += `📦 แบรนด์: ${shop_brand}\n`;
    text += `🏪 ร้าน: ${shop_name}\n`;
    text += `📌 รหัสสาขา: ${branch_code || '-'}\n`;
    text += `🗺️ สาขา: ${branch_name || '-'}\n`;
    text += `⚙️ ประเภทงาน: ${job_type}\n`;
    
    if (job_type === 'Repair' && repair_detail) {
        text += `🔧 ซ่อมอะไร: ${repair_detail}\n`;
    }
    
    text += `\n🎉 ปิดงานเสร็จสมบูรณ์แล้วครับ!`;
    
    return { type: 'text', text: text };
}


/** Flex: ถามว่าต้องการอัพโหลดรูปเพิ่มหรือไม่ */
function makeAskMoreImageFlex(count) {
    return {
        type: 'flex',
        altText: `อัพโหลดรูปที่ ${count} สำเร็จ! ต้องการอัพโหลดเพิ่มไหมครับ?`,
        contents: {
            type: 'bubble',
            header: {
                type: 'box', layout: 'vertical',
                backgroundColor: '#27ae60', paddingAll: '14px',
                contents: [
                    { type: 'text', text: `✅ อัพโหลดรูปที่ ${count} สำเร็จ!`, weight: 'bold', size: 'md', color: '#ffffff', align: 'center' }
                ]
            },
            body: {
                type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '14px',
                contents: [
                    { type: 'text', text: 'ต้องการแนบรูปใบงานเพิ่มเติมไหมครับ?', size: 'sm', color: '#555555', align: 'center', wrap: true },
                    { type: 'text', text: `(อัพโหลดไปแล้ว ${count} รูป)`, size: 'xs', color: '#aaaaaa', align: 'center', margin: 'xs' }
                ]
            },
            footer: {
                type: 'box', layout: 'horizontal', spacing: 'md', paddingAll: '12px',
                contents: [
                    {
                        type: 'button', flex: 1, style: 'primary', color: '#3498db',
                        action: { type: 'message', label: '📷 อัพโหลดเพิ่ม', text: 'อัพโหลดเพิ่ม' }
                    },
                    {
                        type: 'button', flex: 1, style: 'primary', color: '#27ae60',
                        action: { type: 'message', label: '✅ เสร็จสิ้น', text: 'เสร็จสิ้น' }
                    }
                ]
            }
        }
    };
}

/** Flex: แจ้งเตือนทั่วไป (พื้นหลังสีแดง ข้อความสีขาว) */
function makeAlertFlex(type, message) {
    const styles = {
        success: { color: '#2ed573', icon: '✅' },
        warning: { color: '#ffa502', icon: '⚠️' },
        error:   { color: '#ff4757', icon: '❌' },
        info:    { color: '#1e90ff', icon: 'ℹ️' },
    };
    const s = styles[type] || styles.info;
    
    return {
        type: 'flex',
        altText: `${s.icon} ${message}`,
        contents: {
            type: 'bubble',
            body: {
                type: 'box', layout: 'horizontal', spacing: 'md', alignItems: 'center',
                backgroundColor: s.color,
                paddingAll: '12px',
                cornerRadius: '8px',
                contents: [
                    { type: 'text', text: s.icon, size: 'xl', flex: 1 },
                    { type: 'text', text: message, size: 'sm', wrap: true, flex: 9, color: '#ffffff', weight: 'bold' }
                ]
            }
        }
    };
}

/** Flex: ปุ่มเลือกช่วงเวลาสำหรับดูภาพรวม */
function makeOverviewPeriodFlex() {
    return {
        type: 'flex',
        altText: 'เลือกช่วงเวลาที่ต้องการดูภาพรวม',
        contents: {
            type: 'bubble',
            header: {
                type: 'box', layout: 'vertical',
                backgroundColor: '#2c3e50', paddingAll: '14px',
                contents: [
                    { type: 'text', text: '📊 ภาพรวมงานของฉัน', weight: 'bold', size: 'lg', color: '#ffffff', align: 'center' },
                    { type: 'text', text: 'เลือกช่วงเวลาที่ต้องการดู', size: 'xs', color: '#aaaaaa', align: 'center', margin: 'xs' }
                ]
            },
            body: {
                type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '14px',
                contents: [
                    {
                        type: 'button', style: 'primary', color: '#3498db',
                        action: { type: 'message', label: '📅 วันนี้', text: '__overview_today__' }
                    },
                    {
                        type: 'button', style: 'primary', color: '#8e44ad',
                        action: { type: 'message', label: '🗓️ เดือนนี้', text: '__overview_month__' }
                    },
                    {
                        type: 'button', style: 'primary', color: '#27ae60',
                        action: { type: 'message', label: '📋 ทั้งหมด', text: '__overview_all__' }
                    }
                ]
            },
            footer: {
                type: 'box', layout: 'vertical', backgroundColor: '#f8f9fa', paddingAll: '10px',
                contents: [
                    { type: 'text', text: '💡 พิมพ์ "เริ่มต้น" เพื่อกลับไปบันทึกงาน', size: 'xxs', color: '#888888', align: 'center' }
                ]
            }
        }
    };
}

/** สร้าง Flex แสดงสถิติงานตามช่วงเวลา */
function makeOverviewResultFlex(jobs, periodLabel, displayName) {
    // Group jobs เหมือน frontend (date+time+shop_name+branch_name+job_type+user_id)
    const seen = new Set();
    const grouped = [];
    for (const j of jobs) {
        const key = `${j.date}|${j.time}|${j.shop_name}|${j.branch_name}|${j.job_type}|${j.user_id}`;
        if (!seen.has(key)) { seen.add(key); grouped.push(j); }
    }

    const total = grouped.length;
    const brandCount = {};
    const typeCount = { Maintenance: 0, Repair: 0, Installation: 0 };

    for (const j of grouped) {
        const b = j.shop_brand || 'Sme';
        brandCount[b] = (brandCount[b] || 0) + 1;
        if (typeCount[j.job_type] !== undefined) typeCount[j.job_type]++;
        else typeCount[j.job_type] = (typeCount[j.job_type] || 0) + 1;
    }

    const brandEmoji = { Mk: '🍲', Fuji: '🍱', Lucky: '🍜', Bonus: '🍢', Bbq: '🍖', Sme: '🏪' };
    const brandColor = { Mk: '#e74c3c', Fuji: '#e67e22', Lucky: '#f1c40f', Bonus: '#8e44ad', Bbq: '#2ecc71', Sme: '#95a5a6' };

    // สร้าง rows แสดงรายแบรนด์ (เฉพาะที่มีงาน)
    const brandRows = Object.entries(brandCount)
        .sort((a, b) => b[1] - a[1])
        .map(([brand, count]) => ({
            type: 'box', layout: 'horizontal', margin: 'sm',
            contents: [
                { type: 'text', text: `${brandEmoji[brand] || '🏪'} ${brand}`, size: 'sm', color: '#2c3e50', flex: 5 },
                {
                    type: 'box', layout: 'vertical', flex: 2, alignItems: 'flex-end',
                    contents: [{
                        type: 'box', layout: 'vertical',
                        backgroundColor: brandColor[brand] || '#95a5a6',
                        cornerRadius: '12px', paddingAll: '3px', paddingStart: '10px', paddingEnd: '10px',
                        contents: [{ type: 'text', text: `${count} งาน`, size: 'xs', color: '#ffffff', weight: 'bold' }]
                    }]
                }
            ]
        }));

    // สร้าง text สำหรับ copyable (ใส่ใน altText และปุ่มคัดลอก)
    const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];
    let copyText = `📊 ภาพรวมงาน${periodLabel} — ${displayName}\n`;
    copyText += `📆 สร้างเมื่อ: ${todayStr}\n`;
    copyText += `✅ งานทั้งหมด: ${total} งาน\n\n`;
    copyText += `🏪 แยกตามร้าน:\n`;
    Object.entries(brandCount).sort((a,b) => b[1]-a[1]).forEach(([b,c]) => {
        copyText += `  ${brandEmoji[b]||'🏪'} ${b}: ${c} งาน\n`;
    });
    copyText += `\n⚙️ แยกตามประเภท:\n`;
    if (typeCount.Maintenance) copyText += `  🔧 Maintenance: ${typeCount.Maintenance} งาน\n`;
    if (typeCount.Repair) copyText += `  🛠 Repair: ${typeCount.Repair} งาน\n`;
    if (typeCount.Installation) copyText += `  🏗 Installation: ${typeCount.Installation} งาน\n`;

    return {
        flex: {
            type: 'flex',
            altText: copyText,
            contents: {
                type: 'bubble',
                header: {
                    type: 'box', layout: 'vertical',
                    backgroundColor: '#2c3e50', paddingAll: '14px',
                    contents: [
                        { type: 'text', text: `📊 ภาพรวม${periodLabel}`, weight: 'bold', size: 'lg', color: '#ffffff', align: 'center' },
                        { type: 'text', text: displayName, size: 'xs', color: '#f1c40f', align: 'center', margin: 'xs' }
                    ]
                },
                body: {
                    type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px',
                    contents: [
                        // Total
                        {
                            type: 'box', layout: 'horizontal', alignItems: 'center',
                            backgroundColor: '#eaf4fb', cornerRadius: '8px', paddingAll: '10px',
                            contents: [
                                { type: 'text', text: '✅ งานทั้งหมด', size: 'sm', color: '#2c3e50', flex: 4, weight: 'bold' },
                                { type: 'text', text: `${total} งาน`, size: 'lg', color: '#2980b9', flex: 3, weight: 'bold', align: 'end' }
                            ]
                        },
                        { type: 'separator', margin: 'md' },
                        { type: 'text', text: '🏪 แยกตามร้าน', size: 'sm', weight: 'bold', color: '#2c3e50', margin: 'sm' },
                        ...brandRows,
                        { type: 'separator', margin: 'md' },
                        { type: 'text', text: '⚙️ แยกตามประเภทงาน', size: 'sm', weight: 'bold', color: '#2c3e50', margin: 'sm' },
                        {
                            type: 'box', layout: 'horizontal', margin: 'sm', spacing: 'sm',
                            contents: [
                                ...(typeCount.Maintenance ? [{
                                    type: 'box', layout: 'vertical', flex: 1,
                                    backgroundColor: '#e8f8f5', cornerRadius: '8px', paddingAll: '8px', alignItems: 'center',
                                    contents: [
                                        { type: 'text', text: '🔧', size: 'xl', align: 'center' },
                                        { type: 'text', text: 'MA', size: 'xs', color: '#27ae60', weight: 'bold', align: 'center' },
                                        { type: 'text', text: `${typeCount.Maintenance}`, size: 'md', weight: 'bold', color: '#27ae60', align: 'center' }
                                    ]
                                }] : []),
                                ...(typeCount.Repair ? [{
                                    type: 'box', layout: 'vertical', flex: 1,
                                    backgroundColor: '#fef9e7', cornerRadius: '8px', paddingAll: '8px', alignItems: 'center',
                                    contents: [
                                        { type: 'text', text: '🛠', size: 'xl', align: 'center' },
                                        { type: 'text', text: 'Repair', size: 'xs', color: '#e67e22', weight: 'bold', align: 'center' },
                                        { type: 'text', text: `${typeCount.Repair}`, size: 'md', weight: 'bold', color: '#e67e22', align: 'center' }
                                    ]
                                }] : []),
                                ...(typeCount.Installation ? [{
                                    type: 'box', layout: 'vertical', flex: 1,
                                    backgroundColor: '#eaf2ff', cornerRadius: '8px', paddingAll: '8px', alignItems: 'center',
                                    contents: [
                                        { type: 'text', text: '🏗', size: 'xl', align: 'center' },
                                        { type: 'text', text: 'Install', size: 'xs', color: '#2980b9', weight: 'bold', align: 'center' },
                                        { type: 'text', text: `${typeCount.Installation}`, size: 'md', weight: 'bold', color: '#2980b9', align: 'center' }
                                    ]
                                }] : [])
                            ]
                        }
                    ]
                },
                footer: {
                    type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px', backgroundColor: '#f8f9fa',
                    contents: [
                        {
                            type: 'button', style: 'secondary',
                            action: { type: 'clipboard', label: '📋 คัดลอกสรุป', clipboardText: copyText }
                        },
                        { type: 'text', text: '💡 พิมพ์ "เริ่มต้น" เพื่อกลับบันทึกงาน', size: 'xxs', color: '#aaaaaa', align: 'center', margin: 'sm' }
                    ]
                }
            }
        },
        copyText
    };
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

/** Flex: ถามวันที่ทำงาน — วันนี้ หรือ กรอกเอง */
function makeDatePickerFlex(shopName) {
    const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // แสดงตัวอย่าง: เมื่อวาน
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    return {
        type: 'flex',
        altText: `เลือกวันที่ทำงาน — ร้าน ${shopName}`,
        contents: {
            type: 'bubble',
            header: {
                type: 'box', layout: 'vertical',
                backgroundColor: '#2980b9', paddingAll: '14px',
                contents: [
                    { type: 'text', text: '📅 เลือกวันที่ทำงาน', weight: 'bold', size: 'lg', color: '#ffffff', align: 'center' },
                    { type: 'text', text: `ร้าน: ${shopName}`, size: 'xs', color: '#cce5ff', align: 'center', margin: 'xs' }
                ]
            },
            body: {
                type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '14px',
                contents: [
                    {
                        type: 'button', style: 'primary', color: '#27ae60',
                        action: { type: 'message', label: `✅ วันนี้ (${todayStr})`, text: `__date_today__` }
                    },
                    { type: 'separator' },
                    { type: 'text', text: '📝 หรือกรอกวันที่เอง', size: 'sm', weight: 'bold', color: '#2c3e50', align: 'center' },
                    {
                        type: 'box', layout: 'vertical',
                        backgroundColor: '#f8f9fa', cornerRadius: '8px', paddingAll: '10px',
                        contents: [
                            { type: 'text', text: 'รูปแบบที่ถูกต้อง:', size: 'xs', color: '#888888' },
                            { type: 'text', text: 'YYYY-MM-DD', size: 'sm', weight: 'bold', color: '#2980b9', margin: 'xs' },
                            { type: 'separator', margin: 'sm' },
                            { type: 'text', text: 'ตัวอย่าง:', size: 'xs', color: '#888888', margin: 'sm' },
                            { type: 'text', text: `${todayStr}  ← วันนี้`, size: 'xs', color: '#27ae60', margin: 'xs' },
                            { type: 'text', text: `${yesterdayStr}  ← เมื่อวาน`, size: 'xs', color: '#e67e22', margin: 'xs' }
                        ]
                    }
                ]
            },
            footer: {
                type: 'box', layout: 'vertical', backgroundColor: '#fff8e1', paddingAll: '10px',
                contents: [
                    { type: 'text', text: '⚠️ พิมพ์วันที่แล้วกด ส่ง ได้เลยครับ', size: 'xxs', color: '#7d5a00', align: 'center', wrap: true }
                ]
            }
        }
    };
}

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

app.get('/', (req, res) => { res.sendFile(path.resolve(__dirname, 'public', 'index.html')); });

function capitalizeTextBackend(text) {
    if (!text) return '-';
    return text.trim().split(' ').map(word => {
        if (!word) return '';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
}

function getBrandCategory(shopName) {
    if (!shopName) return 'Sme';
    const b = shopName.trim().toLowerCase();
    if (b.includes('mk')) return 'Mk';
    if (b.includes('fuji') || b.includes('ฟูจิ')) return 'Fuji';
    if (b.includes('lucky') || b.includes('ลัคกี้')) return 'Lucky';
    if (b.includes('bonus') || b.includes('โบนัส')) return 'Bonus';
    if (b.includes('bbq') || b.includes('บาร์บีคิว') || b.includes('plaza')) return 'Bbq';
    if (b.includes('seo')) return 'SEO';
    return 'Sme';
}

app.post('/api/jobs', upload.single('image'), async (req, res) => {
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

app.put('/api/jobs/:id', upload.single('image'), async (req, res) => {
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

app.delete('/api/jobs/:id', async (req, res) => {
    const { data: job } = await supabase.from('jobs').select('image_path').eq('id', req.params.id).single();
    if (job && job.image_path) await deleteImageFromStorage(job.image_path);

    const { error } = await supabase.from('jobs').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Deleted successfully' });
});

// ลบข้อมูลตามช่วงวันที่
app.delete('/api/jobs/danger/range', async (req, res) => {
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
app.delete('/api/jobs/danger/all', async (req, res) => {
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

// ─────────────────────────────────────────────
// Auth Routes
// ─────────────────────────────────────────────

// Login
app.post('/api/auth/login', async (req, res) => {
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
app.post('/api/auth/change-pin', async (req, res) => {
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

// ─────────────────────────────────────────────
// Admin — จัดการ Users
// ─────────────────────────────────────────────

// ดูรายชื่อ users ทั้งหมด + จำนวนงาน
app.get('/api/admin/users', async (req, res) => {
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
app.patch('/api/admin/users/:id/role', async (req, res) => {
    const { role } = req.body;
    if (!['admin', 'user'].includes(role))
        return res.status(400).json({ error: 'role ต้องเป็น admin หรือ user เท่านั้น' });

    const { error } = await supabase.from('users').update({ role }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: `เปลี่ยน role สำเร็จ` });
});

// รีเซ็ต PIN (admin เท่านั้น — ส่ง PIN ใหม่ไปเลย)
app.patch('/api/admin/users/:id/reset-pin', async (req, res) => {
    const newPin = req.body.new_pin || '1234';
    if (!/^\d{4,6}$/.test(newPin))
        return res.status(400).json({ error: 'PIN ต้องเป็นตัวเลข 4-6 หลัก' });

    const { error } = await supabase.from('users').update({ pin: newPin }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: `รีเซ็ต PIN เป็น ${newPin} สำเร็จ` });
});

// ลบ user (admin เท่านั้น)
app.delete('/api/admin/users/:id', async (req, res) => {
    // set null ก่อนลบ เพื่อไม่ให้ jobs reference error
    await supabase.from('jobs').update({ user_id: null }).eq('user_id', req.params.id);
    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'ลบผู้ใช้สำเร็จ' });
});

// GET users list (for admin dropdown)
app.get('/api/auth/users', async (req, res) => {
    const { data, error } = await supabase
        .from('users')
        .select('id, username, display_name, role')
        .order('display_name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// GET jobs — กรองตาม user (admin เห็นทั้งหมด, user เห็นแค่ตัวเอง)
app.get('/api/jobs', async (req, res) => {
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

// ─────────────────────────────────────────────
// Flex Helpers — ระบบบันทึกค่าตอบแทนเพิ่มเติม (คำสั่งลับ)
// ─────────────────────────────────────────────

/** แปลงข้อความวันที่แบบยืดหยุ่น: "วันนี้"/"today" หรือ YYYY-MM-DD (ห้ามเป็นอนาคต) */
function parseFlexibleIncomeDate(text) {
    const nowTH = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const todayStr = nowTH.toISOString().split('T')[0];
    const t = (text || '').trim();
    const tLower = t.toLowerCase();
    if (t === 'วันนี้' || tLower === 'today') return { ok: true, date: todayStr };
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
        const parsed = new Date(t);
        if (isNaN(parsed.getTime()) || t > todayStr) return { ok: false, todayStr };
        return { ok: true, date: t };
    }
    return { ok: false, todayStr };
}

/** แถวสรุป 1 บรรทัดในเมนูหลัก (label, detail, amount) */
function makeIncRow(label, detail, amount) {
    return {
        type: 'box', layout: 'horizontal', margin: 'sm', alignItems: 'center',
        contents: [
            { type: 'text', text: label, size: 'sm', color: '#2c3e50', flex: 4 },
            { type: 'text', text: detail || '-', size: 'xs', color: '#888888', flex: 3 },
            { type: 'text', text: `${amount.toLocaleString()} บ.`, size: 'sm', weight: 'bold', color: '#c0392b', flex: 3, align: 'end' }
        ]
    };
}

/** Flex: เมนูหลักของระบบบันทึกค่าตอบแทนเพิ่มเติม */
function makeIncomeMenuFlex(state) {
    const otEntries = state.ot_entries || [];
    const routes = state.routes || [];
    const tolls = state.tolls || [];
    const parkings = state.parkings || [];

    const otHours = otEntries.reduce((s, e) => s + e.hours, 0);
    const otAmount = otEntries.reduce((s, e) => s + e.amount, 0);
    const travelKm = routes.reduce((s, r) => s + r.total_km, 0);
    const travelAmount = routes.reduce((s, r) => s + r.amount, 0);
    const tollAmount = tolls.reduce((s, t) => s + t.amount, 0);
    const parkingAmount = parkings.reduce((s, t) => s + t.amount, 0);
    const grand = otAmount + travelAmount + tollAmount + parkingAmount;

    return {
        type: 'flex',
        altText: `บันทึกค่าตอบแทนเพิ่มเติม — รวม ${grand.toLocaleString()} บาท (ไม่ใช่รายได้หลัก)`,
        contents: {
            type: 'bubble',
            header: {
                type: 'box', layout: 'vertical', backgroundColor: '#34495e', paddingAll: '14px',
                contents: [
                    { type: 'text', text: '🗂️ ค่าตอบแทนเพิ่มเติมประจำเดือน', weight: 'bold', size: 'md', color: '#ffffff', align: 'center', wrap: true },
                    { type: 'text', text: '⚠️ ไม่ใช่รายได้หลัก — ใช้บันทึก/สรุปเท่านั้น', size: 'xxs', color: '#f1c40f', align: 'center', margin: 'xs', wrap: true }
                ]
            },
            body: {
                type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px',
                contents: [
                    makeIncRow('⏱ OT', `${otHours} ชม.`, otAmount),
                    makeIncRow('🚗 เดินทาง', `${routes.length} เที่ยว / ${travelKm} กม.`, travelAmount),
                    makeIncRow('🛣 ทางด่วน', `${tolls.length} รายการ`, tollAmount),
                    makeIncRow('🅿️ ที่จอดรถ', `${parkings.length} รายการ`, parkingAmount),
                    { type: 'separator', margin: 'md' },
                    {
                        type: 'box', layout: 'horizontal', margin: 'md',
                        contents: [
                            { type: 'text', text: 'รวมทั้งหมด', size: 'sm', weight: 'bold', color: '#2c3e50', flex: 5 },
                            { type: 'text', text: `${grand.toLocaleString()} บาท`, size: 'md', weight: 'bold', color: '#c0392b', flex: 4, align: 'end' }
                        ]
                    }
                ]
            },
            footer: {
                type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px',
                contents: [
                    { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
                        { type: 'button', flex: 1, style: 'primary', color: '#e67e22', action: { type: 'message', label: '⏱ จด OT', text: '__inc_ot__' } },
                        { type: 'button', flex: 1, style: 'primary', color: '#2980b9', action: { type: 'message', label: '🚗 เดินทาง', text: '__inc_travel__' } }
                    ]},
                    { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
                        { type: 'button', flex: 1, style: 'primary', color: '#8e44ad', action: { type: 'message', label: '🛣 ทางด่วน', text: '__inc_toll__' } },
                        { type: 'button', flex: 1, style: 'primary', color: '#16a085', action: { type: 'message', label: '🅿️ จอดรถ', text: '__inc_parking__' } }
                    ]},
                    { type: 'button', style: 'primary', color: '#27ae60', action: { type: 'message', label: '📋 ดูสรุป & บันทึก', text: '__inc_summary__' } },
                    { type: 'button', style: 'secondary', color: '#95a5a6', action: { type: 'message', label: '❌ ยกเลิกทั้งหมด', text: '__inc_cancel__' } }
                ]
            }
        }
    };
}

/** Flex: ถามข้อมูล 1 อย่าง (คำถาม + คำแนะนำเพิ่มเติม) */
function makeIncomeAskFlex(title, promptText, hint) {
    const bodyContents = [
        { type: 'text', text: promptText, size: 'sm', color: '#555555', weight: 'bold', wrap: true }
    ];
    if (hint) bodyContents.push({ type: 'text', text: hint, size: 'xs', color: '#aaaaaa', margin: 'sm', wrap: true });
    bodyContents.push({ type: 'text', text: '(พิมพ์ "ยกเลิก" เพื่อออกจากขั้นตอนนี้)', size: 'xxs', color: '#aaaaaa', margin: 'md' });

    return {
        type: 'flex',
        altText: promptText,
        contents: {
            type: 'bubble',
            header: {
                type: 'box', layout: 'vertical', backgroundColor: '#2980b9', paddingAll: '14px',
                contents: [{ type: 'text', text: title, weight: 'bold', size: 'lg', color: '#ffffff', align: 'center' }]
            },
            body: { type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '14px', contents: bodyContents }
        }
    };
}

/** Flex: บันทึกจุดเดินทางแล้ว + ปุ่มเพิ่มจุดต่อไป / บันทึก (จบเส้นทาง) */
function makeIncomePointMoreFlex(route, point) {
    const pointRows = route.points.map((p, i) => ({
        type: 'text',
        text: `${i + 1}. ${p.place} — ${p.purpose} (${p.km} กม.)`,
        size: 'xs', color: '#555555', wrap: true, margin: i === 0 ? 'none' : 'xs'
    }));

    return {
        type: 'flex',
        altText: `บันทึกจุดที่ ${route.points.length}: ${point.place} แล้ว`,
        contents: {
            type: 'bubble',
            header: {
                type: 'box', layout: 'vertical', backgroundColor: '#27ae60', paddingAll: '14px',
                contents: [
                    { type: 'text', text: `✅ บันทึกจุดที่ ${route.points.length} แล้ว`, weight: 'bold', size: 'md', color: '#ffffff', align: 'center' },
                    { type: 'text', text: `วันที่ ${route.date}`, size: 'xs', color: '#eafaf1', align: 'center', margin: 'xs' }
                ]
            },
            body: {
                type: 'box', layout: 'vertical', spacing: 'xs', paddingAll: '14px',
                contents: [
                    { type: 'text', text: '📍 เส้นทางที่บันทึกไว้:', size: 'xs', color: '#888888' },
                    ...pointRows,
                    { type: 'separator', margin: 'sm' },
                    { type: 'text', text: `มีจุดต่อไปอีกไหมครับ?`, size: 'sm', weight: 'bold', color: '#2c3e50', margin: 'sm', wrap: true }
                ]
            },
            footer: {
                type: 'box', layout: 'horizontal', spacing: 'md', paddingAll: '12px',
                contents: [
                    { type: 'button', flex: 1, style: 'primary', color: '#3498db', action: { type: 'message', label: '➕ จุดต่อไป', text: '__inc_point_more__' } },
                    { type: 'button', flex: 1, style: 'primary', color: '#27ae60', action: { type: 'message', label: '💾 บันทึก', text: '__inc_point_done__' } }
                ]
            }
        }
    };
}

/** Flex: สรุปรายการทั้งหมด + ปุ่มบันทึก/กลับเมนู */
function makeIncomeSummaryFlex(state) {
    const otEntries = state.ot_entries || [];
    const routes = state.routes || [];
    const tolls = state.tolls || [];
    const parkings = state.parkings || [];

    const otAmount = otEntries.reduce((s, e) => s + e.amount, 0);
    const travelAmount = routes.reduce((s, r) => s + r.amount, 0);
    const tollAmount = tolls.reduce((s, t) => s + t.amount, 0);
    const parkingAmount = parkings.reduce((s, t) => s + t.amount, 0);
    const grand = otAmount + travelAmount + tollAmount + parkingAmount;

    const detailRows = [];
    otEntries.forEach((e, i) => {
        detailRows.push({
            type: 'box', layout: 'horizontal', margin: i === 0 ? 'none' : 'md',
            contents: [
                { type: 'text', text: `⏱ OT #${i + 1} — ${e.date} (${e.hours} ชม.)`, size: 'xs', weight: 'bold', color: '#2c3e50', flex: 6, wrap: true },
                { type: 'text', text: `${e.amount.toLocaleString()} บ.`, size: 'xs', color: '#2c3e50', flex: 3, align: 'end' }
            ]
        });
        detailRows.push({ type: 'text', text: `เหตุผล: ${e.reason}`, size: 'xxs', color: '#888888', margin: 'xs', wrap: true });
    });
    routes.forEach((r, i) => {
        detailRows.push({
            type: 'box', layout: 'horizontal', margin: 'md',
            contents: [
                { type: 'text', text: `🚗 เดินทาง #${i + 1} — ${r.date} (${r.total_km} กม.)`, size: 'xs', weight: 'bold', color: '#2c3e50', flex: 6, wrap: true },
                { type: 'text', text: `${r.amount.toLocaleString()} บ.`, size: 'xs', color: '#2c3e50', flex: 3, align: 'end' }
            ]
        });
        r.points.forEach((p, j) => {
            detailRows.push({ type: 'text', text: `   ${j + 1}. ${p.place} — ${p.purpose} (${p.km} กม.)`, size: 'xxs', color: '#888888', margin: 'xs', wrap: true });
        });
    });
    tolls.forEach((t, i) => detailRows.push({
        type: 'box', layout: 'horizontal', margin: 'md',
        contents: [
            { type: 'text', text: `🛣 ค่าทางด่วน #${i + 1}`, size: 'xs', color: '#555555', flex: 6 },
            { type: 'text', text: `${t.amount.toLocaleString()} บ.`, size: 'xs', color: '#2c3e50', flex: 3, align: 'end' }
        ]
    }));
    parkings.forEach((t, i) => detailRows.push({
        type: 'box', layout: 'horizontal', margin: 'md',
        contents: [
            { type: 'text', text: `🅿️ ค่าจอดรถ #${i + 1}`, size: 'xs', color: '#555555', flex: 6 },
            { type: 'text', text: `${t.amount.toLocaleString()} บ.`, size: 'xs', color: '#2c3e50', flex: 3, align: 'end' }
        ]
    }));

    if (detailRows.length === 0) {
        detailRows.push({ type: 'text', text: 'ยังไม่มีรายการที่บันทึกไว้ครับ', size: 'sm', color: '#aaaaaa', align: 'center', margin: 'md' });
    }

    return {
        type: 'flex',
        altText: `สรุปค่าตอบแทนเพิ่มเติม รวม ${grand.toLocaleString()} บาท (ไม่ใช่รายได้หลัก)`,
        contents: {
            type: 'bubble',
            header: {
                type: 'box', layout: 'vertical', backgroundColor: '#2c3e50', paddingAll: '14px',
                contents: [
                    { type: 'text', text: '📋 สรุปค่าตอบแทนเพิ่มเติม', weight: 'bold', size: 'md', color: '#ffffff', align: 'center' },
                    { type: 'text', text: '⚠️ รายการนี้ไม่นับเป็นรายได้หลัก', size: 'xxs', color: '#f1c40f', align: 'center', margin: 'xs', wrap: true }
                ]
            },
            body: { type: 'box', layout: 'vertical', spacing: 'xs', paddingAll: '14px', contents: [
                ...detailRows,
                { type: 'separator', margin: 'md' },
                { type: 'box', layout: 'horizontal', margin: 'md', contents: [
                    { type: 'text', text: 'รวมทั้งหมด', size: 'sm', weight: 'bold', color: '#2c3e50', flex: 5 },
                    { type: 'text', text: `${grand.toLocaleString()} บาท`, size: 'md', weight: 'bold', color: '#c0392b', flex: 4, align: 'end' }
                ]}
            ]},
            footer: {
                type: 'box', layout: 'horizontal', spacing: 'md', paddingAll: '12px',
                contents: [
                    { type: 'button', flex: 1, style: 'primary', color: '#27ae60', action: { type: 'message', label: '💾 บันทึก', text: '__inc_save__' } },
                    { type: 'button', flex: 1, style: 'secondary', color: '#95a5a6', action: { type: 'message', label: '↩️ กลับเมนู', text: '__inc_back__' } }
                ]
            }
        }
    };
}

// ─────────────────────────────────────────────
// Webhook
// ─────────────────────────────────────────────

app.post('/webhook', async (req, res) => {
    const events = req.body.events || [];
    for (const event of events) {
        const userId = event.source.userId;

        // ── ตรวจสอบว่า LINE user นี้ลงทะเบียนแล้วหรือยัง ──
        const { data: existingUser } = await supabase
            .from('users')
            .select('id, display_name, username')
            .eq('line_user_id', userId)
            .single();

        // ── ถ้ายังไม่ลงทะเบียน และกำลังรอชื่อ ──
        if (!existingUser) {
            if (event.type === 'message' && event.message.type === 'text') {
                const text = event.message.text.trim();

                // ถ้าอยู่ในสถานะรอชื่อ
                if (userStates[userId] && userStates[userId].step === 'AWAITING_REGISTER_NAME') {
                    const displayName = text;
                    // สร้าง username จากชื่อ (ตัวเล็กไม่มีช่องว่าง) + random 3 ตัว
                    const baseUsername = text.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9ก-ฮ]/g, '').substring(0, 10);
                    const username = baseUsername + Math.floor(Math.random() * 900 + 100);
                    const defaultPin = '1234';

                    const { error: insertError } = await supabase.from('users').insert([{
                        line_user_id: userId,
                        display_name: displayName,
                        username: username,
                        pin: defaultPin,
                        role: 'user'
                    }]);

                    delete userStates[userId];

                    if (insertError) {
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeAlertFlex('error', 'ลงทะเบียนไม่สำเร็จ: ' + insertError.message)
                        ]});
                    } else {
                        await client.replyMessage({ replyToken: event.replyToken, messages: [{
                            type: 'flex',
                            altText: `ลงทะเบียนสำเร็จ! ยินดีต้อนรับ ${displayName}`,
                            contents: {
                                type: 'bubble',
                                header: {
                                    type: 'box', layout: 'vertical',
                                    backgroundColor: '#27ae60', paddingAll: '14px',
                                    contents: [{ type: 'text', text: '🎉 ลงทะเบียนสำเร็จ!', weight: 'bold', size: 'lg', color: '#ffffff', align: 'center' }]
                                },
                                body: {
                                    type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '14px',
                                    contents: [
                                        { type: 'text', text: `ยินดีต้อนรับ ${displayName}! 👋`, weight: 'bold', size: 'md', wrap: true },
                                        { type: 'separator', margin: 'md' },
                                        { type: 'text', text: '📋 ข้อมูลสำหรับเข้าเว็บไซต์', size: 'sm', color: '#888888', margin: 'md' },
                                        { type: 'box', layout: 'horizontal', margin: 'sm', contents: [
                                            { type: 'text', text: 'Username:', size: 'sm', color: '#555555', flex: 3 },
                                            { type: 'text', text: username, size: 'sm', weight: 'bold', color: '#2980b9', flex: 5 }
                                        ]},
                                        { type: 'box', layout: 'horizontal', margin: 'xs', contents: [
                                            { type: 'text', text: 'PIN เริ่มต้น:', size: 'sm', color: '#555555', flex: 3 },
                                            { type: 'text', text: defaultPin, size: 'sm', weight: 'bold', color: '#e74c3c', flex: 5 }
                                        ]},
                                        { type: 'text', text: '⚠️ กรุณาเปลี่ยน PIN หลังเข้าสู่ระบบครั้งแรกครับ', size: 'xxs', color: '#e74c3c', wrap: true, margin: 'md' }
                                    ]
                                },
                                footer: {
                                    type: 'box', layout: 'vertical', paddingAll: '12px',
                                    contents: [{ type: 'text', text: 'พิมพ์ "เริ่มต้น" เพื่อเริ่มบันทึกงานได้เลยครับ', size: 'xs', color: '#888888', align: 'center', wrap: true }]
                                }
                            }
                        }]});
                    }
                    continue;
                }

                // ยังไม่ลงทะเบียน + ข้อความอะไรก็ตาม → ขอชื่อก่อน
                userStates[userId] = { step: 'AWAITING_REGISTER_NAME' };
                await client.replyMessage({ replyToken: event.replyToken, messages: [{
                    type: 'flex',
                    altText: 'ยินดีต้อนรับ! กรุณาลงทะเบียนก่อนใช้งาน',
                    contents: {
                        type: 'bubble',
                        header: {
                            type: 'box', layout: 'vertical',
                            backgroundColor: '#2f3542', paddingAll: '14px',
                            contents: [{ type: 'text', text: '👋 ยินดีต้อนรับ!', weight: 'bold', size: 'lg', color: '#ffffff', align: 'center' }]
                        },
                        body: {
                            type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '14px',
                            contents: [
                                { type: 'text', text: 'ดูเหมือนว่าคุณยังไม่เคยใช้งานระบบนี้มาก่อนครับ', size: 'sm', color: '#555555', wrap: true },
                                { type: 'separator', margin: 'md' },
                                { type: 'text', text: '📝 กรุณาพิมพ์ชื่อของคุณเพื่อลงทะเบียน', size: 'sm', weight: 'bold', color: '#2f3542', wrap: true, margin: 'md' },
                                { type: 'text', text: 'เช่น: สมชาย หรือ Somchai', size: 'xs', color: '#888888', margin: 'sm' }
                            ]
                        }
                    }
                }]});
                continue;
            }
            continue; // event อื่น (sticker, follow ฯลฯ) ถ้ายังไม่ลงทะเบียน ข้ามไป
        }

        // ── รับรูปภาพ ──────────────────────────────────
        if (event.type === 'message' && event.message.type === 'image') {
            const currentState = userStates[userId];
            if (currentState && (currentState.step === 'AWAITING_IMAGE' || currentState.step === 'AWAITING_MORE_IMAGE')) {
                const messageId = event.message.id;
                const fileName = `job_${currentState.jobId}_${Date.now()}.jpg`;

                try {
                    const content = await blobClient.getMessageContent(messageId);

                    // @line/bot-sdk v11 ใช้ fetch ภายใน ทำให้ getMessageContent
                    // อาจคืนค่าเป็น Buffer, Web ReadableStream หรือ Node.js Readable
                    // ขึ้นอยู่กับเวอร์ชัน จึงต้องแปลงให้เป็น Buffer ก่อนเขียนไฟล์เสมอ
                    let buffer;
                    if (Buffer.isBuffer(content)) {
                        buffer = content;
                    } else if (typeof content.arrayBuffer === 'function') {
                        // Web ReadableStream / Response-like object
                        buffer = Buffer.from(await content.arrayBuffer());
                    } else if (typeof content.getReader === 'function') {
                        // Web ReadableStream (Streams API)
                        const reader = content.getReader();
                        const chunks = [];
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            chunks.push(Buffer.from(value));
                        }
                        buffer = Buffer.concat(chunks);
                    } else if (typeof content.pipe === 'function') {
                        // Node.js Readable stream (เวอร์ชันเก่า)
                        const chunks = [];
                        await new Promise((resolve, reject) => {
                            content.on('data', (chunk) => chunks.push(chunk));
                            content.on('end', resolve);
                            content.on('error', reject);
                        });
                        buffer = Buffer.concat(chunks);
                    } else {
                        throw new Error('ไม่รู้จักรูปแบบข้อมูลที่ได้รับจาก LINE');
                    }

                    let publicUrl;
                    try {
                        publicUrl = await uploadImageToStorage(buffer, fileName, 'image/jpeg');
                        console.log(`[IMAGE] uploaded to Supabase Storage: ${publicUrl}, size=${buffer.length} bytes`);
                    } catch (storageErr) {
                        console.error('[IMAGE] Supabase Storage upload error:', storageErr);
                        delete userStates[userId];
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeAlertFlex('error', 'อัปโหลดรูปไป Storage ไม่สำเร็จ: ' + storageErr.message)
                        ]});
                        continue;
                    }

                    const relativePath = publicUrl;
                    const jobIdToSend = currentState.jobId;

                    if (currentState.step === 'AWAITING_IMAGE') {
                        // รูปแรก → อัปเดต job เดิม
                        console.log(`[IMAGE] updating job id=${jobIdToSend} with image_path=${relativePath}`);
                        const { data: updatedRows, error } = await supabase
                            .from('jobs')
                            .update({ image_path: relativePath })
                            .eq('id', currentState.jobId)
                            .select();
                        console.log('[IMAGE] supabase update result:', JSON.stringify({ updatedRows, error }));
                        if (error) {
                            delete userStates[userId];
                            await client.replyMessage({ replyToken: event.replyToken, messages: [makeAlertFlex('error', 'บันทึกรูปไม่สำเร็จ: ' + error.message)] });
                        } else if (!updatedRows || updatedRows.length === 0) {
                            delete userStates[userId];
                            console.error(`[IMAGE] WARNING: 0 rows updated for job id=${jobIdToSend}.`);
                            await client.replyMessage({ replyToken: event.replyToken, messages: [makeAlertFlex('error', `บันทึกรูปไม่สำเร็จ: ไม่พบงาน id=${jobIdToSend} ใน database (อาจถูก RLS บล็อก)`)] });
                        } else {
                            currentState.imageCount = 1;
                            currentState.step = 'AWAITING_MORE_IMAGE';
                            await client.replyMessage({ replyToken: event.replyToken, messages: [makeAskMoreImageFlex(1)] });
                        }
                    } else {
                        // รูปที่ 2+ → สร้าง job ใหม่ copy ข้อมูลจาก job เดิม พร้อมรูปใหม่
                        const { data: origJob } = await supabase.from('jobs').select('*').eq('id', currentState.jobId).single();
                        if (!origJob) {
                            delete userStates[userId];
                            await client.replyMessage({ replyToken: event.replyToken, messages: [makeAlertFlex('error', 'ไม่พบข้อมูลงานต้นฉบับ')] });
                        } else {
                            const { error: insertErr } = await supabase.from('jobs').insert([{
                                date: origJob.date, time: origJob.time,
                                shop_brand: origJob.shop_brand, shop_name: origJob.shop_name,
                                branch_code: origJob.branch_code, branch_name: origJob.branch_name,
                                job_type: origJob.job_type, repair_detail: origJob.repair_detail,
                                image_path: relativePath, user_id: origJob.user_id
                            }]);
                            if (insertErr) {
                                delete userStates[userId];
                                await client.replyMessage({ replyToken: event.replyToken, messages: [makeAlertFlex('error', 'บันทึกใบงานเพิ่มไม่สำเร็จ: ' + insertErr.message)] });
                            } else {
                                currentState.imageCount = (currentState.imageCount || 1) + 1;
                                currentState.step = 'AWAITING_MORE_IMAGE';
                                await client.replyMessage({ replyToken: event.replyToken, messages: [makeAskMoreImageFlex(currentState.imageCount)] });
                            }
                        }
                    }
                } catch (error) {
                    delete userStates[userId];
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeAlertFlex('error', 'บอทไม่สามารถดาวน์โหลดไฟล์รูปได้ กรุณาลองส่งใหม่อีกครั้งครับ')
                    ]});
                }
            } else {
                // ได้รับรูปแต่ไม่ได้อยู่ในสถานะรอรูป (เช่น ยังไม่ได้บันทึกข้อมูลงาน หรือ state หาย)
                await client.replyMessage({ replyToken: event.replyToken, messages: [
                    makeAlertFlex('warning', 'บอทยังไม่พร้อมรับรูปภาพในขณะนี้ กรุณาพิมพ์ "เริ่มต้น" เพื่อเริ่มบันทึกงานใหม่ครับ')
                ]});
            }
            continue;
        }

        // ── รับข้อความ ─────────────────────────────────
        if (event.type === 'message' && event.message.type === 'text') {
            const text = event.message.text.trim();
            const textLower = text.toLowerCase();

            // ยกเลิก
            if (text === 'ยกเลิก' || textLower === 'cancel') {
                delete userStates[userId];
                await client.replyMessage({ replyToken: event.replyToken, messages: [
                    makeAlertFlex('warning', 'ยกเลิกการบันทึกงานปัจจุบันแล้วครับ')
                ]});
                continue;
            }

            // ── ระบบบันทึกค่าตอบแทนเพิ่มเติมประจำเดือน (คำสั่งลับ) ──
            if (textLower === INCOME_SECRET_COMMAND) {
                userStates[userId] = { step: 'INC_MENU', ot_entries: [], routes: [], tolls: [], parkings: [] };
                await client.replyMessage({ replyToken: event.replyToken, messages: [
                    makeIncomeMenuFlex(userStates[userId])
                ]});
                continue;
            }

            if (userStates[userId] && typeof userStates[userId].step === 'string' && userStates[userId].step.startsWith('INC_')) {
                const incState = userStates[userId];

                // ── เมนูหลัก ──
                if (incState.step === 'INC_MENU') {
                    if (text === '__inc_ot__') {
                        incState.step = 'INC_OT_HOURS';
                        incState.currentOt = {};
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeIncomeAskFlex('⏱ จด OT', 'กรุณาระบุจำนวนชั่วโมง OT', `เช่น 2 หรือ 1.5 (1 ชม. = ${OT_RATE_PER_HOUR} บาท)`)
                        ]});
                    } else if (text === '__inc_travel__') {
                        incState.step = 'INC_TRIP_DATE';
                        incState.currentRoute = { points: [] };
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeIncomeAskFlex('🚗 จดค่าเดินทาง', 'กรุณาระบุวันที่เดินทาง', 'พิมพ์ "วันนี้" หรือรูปแบบ YYYY-MM-DD (รองรับบันทึกย้อนหลัง)')
                        ]});
                    } else if (text === '__inc_toll__') {
                        incState.step = 'INC_TOLL_AMOUNT';
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeIncomeAskFlex('🛣 จดค่าทางด่วน', 'กรุณาระบุจำนวนเงินค่าทางด่วน (บาท)', null)
                        ]});
                    } else if (text === '__inc_parking__') {
                        incState.step = 'INC_PARKING_AMOUNT';
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeIncomeAskFlex('🅿️ จดค่าจอดรถ', 'กรุณาระบุจำนวนเงินค่าจอดรถ (บาท)', null)
                        ]});
                    } else if (text === '__inc_summary__' || text === '__inc_back__') {
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeIncomeSummaryFlex(incState)
                        ]});
                    } else if (text === '__inc_save__') {
                        const otEntries = incState.ot_entries || [];
                        const routes = incState.routes || [];
                        const tolls = incState.tolls || [];
                        const parkings = incState.parkings || [];
                        const otHours = otEntries.reduce((s, e) => s + e.hours, 0);
                        const otAmount = otEntries.reduce((s, e) => s + e.amount, 0);
                        const travelKm = routes.reduce((s, r) => s + r.total_km, 0);
                        const travelAmount = routes.reduce((s, r) => s + r.amount, 0);
                        const tollAmount = tolls.reduce((s, t) => s + t.amount, 0);
                        const parkingAmount = parkings.reduce((s, t) => s + t.amount, 0);
                        const totalAmount = otAmount + travelAmount + tollAmount + parkingAmount;

                        if (totalAmount <= 0) {
                            await client.replyMessage({ replyToken: event.replyToken, messages: [
                                makeAlertFlex('warning', 'ยังไม่มีรายการให้บันทึกครับ กรุณาเพิ่มรายการก่อน')
                            ]});
                            continue;
                        }

                        const { data: userRow } = await supabase.from('users').select('id').eq('line_user_id', userId).single();
                        const dbUserId = userRow ? userRow.id : null;
                        const nowTH = new Date(Date.now() + 7 * 60 * 60 * 1000);
                        const dateStr = nowTH.toISOString().split('T')[0];

                        const { error: saveErr } = await supabase.from('extra_income').insert([{
                            user_id: dbUserId,
                            line_user_id: userId,
                            date: dateStr,
                            ot_hours: otHours,
                            ot_amount: otAmount,
                            ot_details: otEntries,
                            travel_km: travelKm,
                            travel_amount: travelAmount,
                            travel_details: routes,
                            toll_amount: tollAmount,
                            parking_amount: parkingAmount,
                            total_amount: totalAmount
                        }]);

                        delete userStates[userId];

                        if (saveErr) {
                            await client.replyMessage({ replyToken: event.replyToken, messages: [
                                makeAlertFlex('error', 'บันทึกไม่สำเร็จ: ' + saveErr.message)
                            ]});
                        } else {
                            await client.replyMessage({ replyToken: event.replyToken, messages: [
                                makeAlertFlex('success', `บันทึกสำเร็จ! รวมค่าตอบแทนเพิ่มเติม ${totalAmount.toLocaleString()} บาท (⚠️ ไม่นับเป็นรายได้หลัก)`)
                            ]});
                        }
                    } else if (text === '__inc_cancel__') {
                        delete userStates[userId];
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeAlertFlex('warning', 'ยกเลิกการบันทึกค่าตอบแทนเพิ่มเติมแล้วครับ')
                        ]});
                    } else {
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeIncomeMenuFlex(incState)
                        ]});
                    }
                    continue;
                }

                // ── OT: รอจำนวนชั่วโมง ──
                if (incState.step === 'INC_OT_HOURS') {
                    const hours = parseFloat(text.replace(',', '.'));
                    if (isNaN(hours) || hours <= 0) {
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeAlertFlex('warning', 'กรุณาระบุจำนวนชั่วโมงเป็นตัวเลขที่มากกว่า 0 เช่น 2 หรือ 1.5')
                        ]});
                        continue;
                    }
                    incState.currentOt.hours = hours;
                    incState.step = 'INC_OT_REASON';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeIncomeAskFlex('⏱ จด OT', 'กรุณาระบุเหตุผลที่ทำ OT', 'เช่น เร่งงานติดตั้งให้ทันกำหนด')
                    ]});
                    continue;
                }

                // ── OT: รอเหตุผล ──
                if (incState.step === 'INC_OT_REASON') {
                    incState.currentOt.reason = text;
                    incState.step = 'INC_OT_DATE';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeIncomeAskFlex('⏱ จด OT', 'กรุณาระบุวันที่ทำ OT', 'พิมพ์ "วันนี้" หรือรูปแบบ YYYY-MM-DD (รองรับบันทึกย้อนหลัง)')
                    ]});
                    continue;
                }

                // ── OT: รอวันที่ → บันทึก ──
                if (incState.step === 'INC_OT_DATE') {
                    const parsed = parseFlexibleIncomeDate(text);
                    if (!parsed.ok) {
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeAlertFlex('warning', `รูปแบบวันที่ไม่ถูกต้องครับ พิมพ์ "วันนี้" หรือ YYYY-MM-DD เช่น ${parsed.todayStr}`)
                        ]});
                        continue;
                    }
                    const otEntry = incState.currentOt;
                    otEntry.date = parsed.date;
                    otEntry.amount = Math.round(otEntry.hours * OT_RATE_PER_HOUR * 100) / 100;
                    incState.ot_entries.push(otEntry);
                    incState.currentOt = null;
                    incState.step = 'INC_MENU';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeAlertFlex('success', `บันทึก OT ${otEntry.date} — ${otEntry.hours} ชม. = ${otEntry.amount.toLocaleString()} บาท แล้วครับ`),
                        makeIncomeMenuFlex(incState)
                    ]});
                    continue;
                }

                // ── เดินทาง: วันที่เดินทาง ──
                if (incState.step === 'INC_TRIP_DATE') {
                    const parsed = parseFlexibleIncomeDate(text);
                    if (!parsed.ok) {
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeAlertFlex('warning', `รูปแบบวันที่ไม่ถูกต้องครับ พิมพ์ "วันนี้" หรือ YYYY-MM-DD เช่น ${parsed.todayStr}`)
                        ]});
                        continue;
                    }
                    incState.currentRoute.date = parsed.date;
                    incState.currentPoint = {};
                    incState.step = 'INC_POINT_PLACE';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeIncomeAskFlex('🚗 จดค่าเดินทาง', 'จุดที่ 1: กรุณาระบุสถานที่', null)
                    ]});
                    continue;
                }

                // ── เดินทาง: สถานที่ของจุดนี้ ──
                if (incState.step === 'INC_POINT_PLACE') {
                    incState.currentPoint.place = text;
                    incState.step = 'INC_POINT_PURPOSE';
                    const pointNo = incState.currentRoute.points.length + 1;
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeIncomeAskFlex('🚗 จดค่าเดินทาง', `จุดที่ ${pointNo}: ไปทำอะไร`, 'เช่น ไปติดตั้งเครื่อง / ไปซ่อมงาน')
                    ]});
                    continue;
                }

                // ── เดินทาง: จุดประสงค์ของจุดนี้ ──
                if (incState.step === 'INC_POINT_PURPOSE') {
                    incState.currentPoint.purpose = text;
                    incState.step = 'INC_POINT_KM';
                    const pointNo = incState.currentRoute.points.length + 1;
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeIncomeAskFlex('🚗 จดค่าเดินทาง', `จุดที่ ${pointNo}: ระยะทางกี่กิโลเมตร`, `นับจากจุดก่อนหน้ามาถึงจุดนี้ (1 กม. = ${KM_RATE_PER_KM} บาท)`)
                    ]});
                    continue;
                }

                // ── เดินทาง: ระยะทางของจุดนี้ → บันทึกจุด แล้วถามว่ามีจุดต่อไปไหม ──
                if (incState.step === 'INC_POINT_KM') {
                    const km = parseFloat(text.replace(',', '.'));
                    if (isNaN(km) || km < 0) {
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeAlertFlex('warning', 'กรุณาระบุระยะทางเป็นตัวเลข เช่น 12 หรือ 12.5')
                        ]});
                        continue;
                    }
                    incState.currentPoint.km = km;
                    incState.currentRoute.points.push(incState.currentPoint);
                    const savedPoint = incState.currentPoint;
                    incState.currentPoint = null;
                    incState.step = 'INC_POINT_MORE';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeIncomePointMoreFlex(incState.currentRoute, savedPoint)
                    ]});
                    continue;
                }

                // ── เดินทาง: เพิ่มจุดต่อไป หรือ บันทึกจบเส้นทาง ──
                if (incState.step === 'INC_POINT_MORE') {
                    if (text === '__inc_point_more__') {
                        incState.currentPoint = {};
                        incState.step = 'INC_POINT_PLACE';
                        const pointNo = incState.currentRoute.points.length + 1;
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeIncomeAskFlex('🚗 จดค่าเดินทาง', `จุดที่ ${pointNo}: กรุณาระบุสถานที่`, null)
                        ]});
                    } else {
                        const route = incState.currentRoute;
                        route.total_km = Math.round(route.points.reduce((s, p) => s + p.km, 0) * 100) / 100;
                        route.amount = Math.round(route.total_km * KM_RATE_PER_KM * 100) / 100;
                        incState.routes.push(route);
                        incState.currentRoute = null;
                        incState.step = 'INC_MENU';
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeAlertFlex('success', `บันทึกเส้นทาง ${route.date} — ${route.points.length} จุด รวม ${route.total_km} กม. = ${route.amount.toLocaleString()} บาท แล้วครับ`),
                            makeIncomeMenuFlex(incState)
                        ]});
                    }
                    continue;
                }

                // ── ค่าทางด่วน ──
                if (incState.step === 'INC_TOLL_AMOUNT') {
                    const amount = parseFloat(text.replace(',', '.'));
                    if (isNaN(amount) || amount <= 0) {
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeAlertFlex('warning', 'กรุณาระบุจำนวนเงินเป็นตัวเลขที่มากกว่า 0 เช่น 65')
                        ]});
                        continue;
                    }
                    incState.tolls.push({ amount });
                    incState.step = 'INC_MENU';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeAlertFlex('success', `บันทึกค่าทางด่วน ${amount.toLocaleString()} บาท แล้วครับ`),
                        makeIncomeMenuFlex(incState)
                    ]});
                    continue;
                }

                // ── ค่าจอดรถ ──
                if (incState.step === 'INC_PARKING_AMOUNT') {
                    const amount = parseFloat(text.replace(',', '.'));
                    if (isNaN(amount) || amount <= 0) {
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeAlertFlex('warning', 'กรุณาระบุจำนวนเงินเป็นตัวเลขที่มากกว่า 0 เช่น 40')
                        ]});
                        continue;
                    }
                    incState.parkings.push({ amount });
                    incState.step = 'INC_MENU';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeAlertFlex('success', `บันทึกค่าจอดรถ ${amount.toLocaleString()} บาท แล้วครับ`),
                        makeIncomeMenuFlex(incState)
                    ]});
                    continue;
                }
            }

            // ── เปลี่ยน PIN ──
            if (text === 'เปลี่ยน pin' || textLower === 'change pin' || textLower === 'เปลี่ยนpin') {
                delete userStates[userId];
                userStates[userId] = { step: 'AWAITING_OLD_PIN' };
                await client.replyMessage({ replyToken: event.replyToken, messages: [{
                    type: 'flex', altText: 'เปลี่ยน PIN — กรุณาพิมพ์ PIN เก่า',
                    contents: {
                        type: 'bubble',
                        header: { type: 'box', layout: 'vertical', backgroundColor: '#2f3542', paddingAll: '14px',
                            contents: [{ type: 'text', text: '🔒 เปลี่ยน PIN', weight: 'bold', size: 'lg', color: '#ffffff', align: 'center' }]
                        },
                        body: { type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '14px',
                            contents: [
                                { type: 'text', text: 'กรุณาพิมพ์ PIN ปัจจุบันของคุณครับ', size: 'sm', color: '#555555', wrap: true },
                                { type: 'text', text: '(พิมพ์ "ยกเลิก" เพื่อออกจากขั้นตอนนี้)', size: 'xs', color: '#aaaaaa', margin: 'sm' }
                            ]
                        }
                    }
                }]});
                continue;
            }

            // รอ PIN เก่า
            if (userStates[userId] && userStates[userId].step === 'AWAITING_OLD_PIN') {
                userStates[userId].old_pin = text;
                userStates[userId].step = 'AWAITING_NEW_PIN';
                await client.replyMessage({ replyToken: event.replyToken, messages: [{
                    type: 'flex', altText: 'กรุณาพิมพ์ PIN ใหม่ (4-6 หลัก)',
                    contents: {
                        type: 'bubble',
                        header: { type: 'box', layout: 'vertical', backgroundColor: '#2980b9', paddingAll: '14px',
                            contents: [{ type: 'text', text: '🔑 PIN ใหม่', weight: 'bold', size: 'lg', color: '#ffffff', align: 'center' }]
                        },
                        body: { type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '14px',
                            contents: [
                                { type: 'text', text: 'กรุณาพิมพ์ PIN ใหม่ที่ต้องการ (ตัวเลข 4-6 หลัก) ครับ', size: 'sm', color: '#555555', wrap: true }
                            ]
                        }
                    }
                }]});
                continue;
            }

            // รอ PIN ใหม่ — ยืนยัน
            if (userStates[userId] && userStates[userId].step === 'AWAITING_NEW_PIN') {
                if (!/^\d{4,6}$/.test(text)) {
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeAlertFlex('warning', 'PIN ต้องเป็นตัวเลข 4-6 หลักเท่านั้นครับ กรุณาพิมพ์ใหม่')
                    ]});
                    continue;
                }
                const oldPin = userStates[userId].old_pin;
                delete userStates[userId];

                // เช็ค PIN เก่าและอัปเดต
                const { data: userRow } = await supabase.from('users').select('id, pin').eq('line_user_id', userId).single();
                if (!userRow) {
                    await client.replyMessage({ replyToken: event.replyToken, messages: [makeAlertFlex('error', 'ไม่พบข้อมูลผู้ใช้ในระบบ')]});
                    continue;
                }
                if (userRow.pin !== oldPin) {
                    await client.replyMessage({ replyToken: event.replyToken, messages: [makeAlertFlex('error', 'PIN เก่าไม่ถูกต้องครับ กรุณาลองใหม่อีกครั้ง')]});
                    continue;
                }
                const { error: updateErr } = await supabase.from('users').update({ pin: text }).eq('id', userRow.id);
                if (updateErr) {
                    await client.replyMessage({ replyToken: event.replyToken, messages: [makeAlertFlex('error', 'เปลี่ยน PIN ไม่สำเร็จ: ' + updateErr.message)]});
                } else {
                    await client.replyMessage({ replyToken: event.replyToken, messages: [makeAlertFlex('success', `เปลี่ยน PIN สำเร็จแล้วครับ! PIN ใหม่ของคุณคือ: ${text}`)]});
                }
                continue;
            }

            // รอรูปเพิ่มเติม — ผู้ใช้ตอบปุ่ม
            if (userStates[userId] && userStates[userId].step === 'AWAITING_MORE_IMAGE') {
                if (text === 'อัพโหลดเพิ่ม') {
                    // ให้ step กลับไปรอรูป
                    userStates[userId].step = 'AWAITING_IMAGE';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeAlertFlex('info', 'กรุณาส่งรูปภาพใบงานถัดไปเข้าแชทได้เลยครับ')
                    ]});
                } else if (text === 'เสร็จสิ้น') {
                    const jobId = userStates[userId].jobId;
                    delete userStates[userId];
                    await sendJobSummaryAfterImage(userId, event.replyToken, jobId);
                } else {
                    // ข้อความอื่น → แจ้งเตือน
                    const jobId = userStates[userId].jobId;
                    delete userStates[userId];
                    await sendJobSummaryAfterImage(userId, event.replyToken, jobId);
                }
                continue;
            }

            // รอรูปอยู่แต่ส่งข้อความมา
            if (userStates[userId] && userStates[userId].step === 'AWAITING_IMAGE') {
                await client.replyMessage({ replyToken: event.replyToken, messages: [
                    makeAlertFlex('warning', 'กรุณาส่งรูปภาพใบงานเข้าแชท หรือพิมพ์ "ยกเลิก" เพื่อเริ่มต้นใหม่ครับ')
                ]});
                continue;
            }

            // ── ภาพรวม: เลือกช่วงเวลา ──
            if (text === '__overview__') {
                await client.replyMessage({ replyToken: event.replyToken, messages: [makeOverviewPeriodFlex()] });
                continue;
            }

            // ── ภาพรวม: ดึงข้อมูลตามช่วงเวลา ──
            if (text === '__overview_today__' || text === '__overview_month__' || text === '__overview_all__') {
                const nowTH = new Date(Date.now() + 7 * 60 * 60 * 1000);
                const todayStr = nowTH.toISOString().split('T')[0];
                const monthStr = todayStr.substring(0, 7); // YYYY-MM

                // หา db user id ก่อน
                const { data: dbUser } = await supabase.from('users').select('id, display_name, username').eq('line_user_id', userId).single();
                const dbUserId = dbUser ? dbUser.id : null;
                const displayName = dbUser ? (dbUser.display_name || dbUser.username) : 'คุณ';

                let query = supabase.from('jobs').select('*').eq('user_id', dbUserId).order('date', { ascending: false });

                let periodLabel = '';
                if (text === '__overview_today__') {
                    query = query.eq('date', todayStr);
                    periodLabel = `วันนี้ (${todayStr})`;
                } else if (text === '__overview_month__') {
                    query = query.gte('date', `${monthStr}-01`).lte('date', todayStr);
                    periodLabel = `เดือนนี้ (${monthStr})`;
                } else {
                    periodLabel = 'ทั้งหมด';
                }

                const { data: jobs, error: jobErr } = await query;
                if (jobErr || !jobs) {
                    await client.replyMessage({ replyToken: event.replyToken, messages: [makeAlertFlex('error', 'ไม่สามารถดึงข้อมูลได้ครับ')] });
                    continue;
                }

                if (jobs.length === 0) {
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeAlertFlex('info', `ไม่พบข้อมูลงาน${periodLabel}ครับ`)
                    ]});
                    continue;
                }

                const { flex: overviewFlex } = makeOverviewResultFlex(jobs, periodLabel, displayName);
                await client.replyMessage({ replyToken: event.replyToken, messages: [overviewFlex] });
                continue;
            }

            // ── ตรวจสอบว่าผู้ใช้เริ่มต้นหรือยัง ──
            if (!userStates[userId]) {
                // ถ้าพิมพ์ "เริ่มต้น" ให้เริ่มการทำงาน
                if (text === 'เริ่มต้น' || textLower === 'เริ่มต้น' || text === 'start' || textLower === 'start') {
                    const greetFlex = makeGreetingAndShopFlex(existingUser.display_name || existingUser.username);
                    await client.replyMessage({ replyToken: event.replyToken, messages: [greetFlex] });
                    continue;
                }
                
                // ถ้าข้อความที่รับมาเป็นชื่อร้าน ให้สร้าง state และเริ่มกระบวนการ
                const detectedBrand = getBrandCategory(text);
                const formattedShopName = capitalizeTextBackend(text);
                const isAutoBranch = AUTO_BRANCH_SHOPS.includes(textLower);
                
                // ทุกร้าน → ถามวันที่ก่อนเสมอ
                userStates[userId] = {
                    step: 'AWAITING_DATE',
                    shop_brand: detectedBrand,
                    shop_name: formattedShopName,
                    is_auto: isAutoBranch
                };
                await client.replyMessage({ replyToken: event.replyToken, messages: [
                    makeDatePickerFlex(formattedShopName)
                ]});
                continue;
            }

            const currentState = userStates[userId];

            // ── รอวันที่ทำงาน ──
            if (currentState.step === 'AWAITING_DATE') {
                let chosenDate;
                const nowTH = new Date(Date.now() + 7 * 60 * 60 * 1000);
                const todayStr = nowTH.toISOString().split('T')[0];

                if (text === '__date_today__') {
                    chosenDate = todayStr;
                } else if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                    // ตรวจสอบว่าวันที่ถูกต้อง
                    const parsed = new Date(text);
                    if (isNaN(parsed.getTime()) || text > todayStr) {
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeAlertFlex('warning', `วันที่ไม่ถูกต้องครับ\nรูปแบบ: YYYY-MM-DD\nเช่น: ${todayStr}\n(ไม่สามารถใส่วันในอนาคตได้)`)
                        ]});
                        continue;
                    }
                    chosenDate = text;
                } else {
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeAlertFlex('warning', `รูปแบบวันที่ไม่ถูกต้องครับ\nกรุณาพิมพ์ในรูปแบบ: YYYY-MM-DD\nเช่น: ${todayStr}`)
                    ]});
                    continue;
                }

                // บันทึกวันที่แล้วไปขั้นตอนถัดไป
                currentState.chosen_date = chosenDate;
                if (currentState.is_auto) {
                    currentState.step = 'AWAITING_BRANCH_CODE';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeShopConfirmFlex(currentState.shop_name, currentState.shop_brand, `📅 วันที่: ${chosenDate}\n\nกรุณาป้อนรหัสสาขาครับ`)
                    ]});
                } else {
                    currentState.step = 'AWAITING_BRANCH_NAME_MANUAL';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeShopConfirmFlex(currentState.shop_name, currentState.shop_brand, `📅 วันที่: ${chosenDate}\n\nกรุณาระบุชื่อสาขา หรือ สถานที่ทำงานครับ`)
                    ]});
                }
                continue;
            }

            // รอรหัสสาขา (Auto)
            if (currentState.step === 'AWAITING_BRANCH_CODE') {
                const mappedBranch = BRANCH_MAP[textLower] || 'ไม่พบข้อมูลสาขาในระบบ';
                currentState.branch_code = text.toUpperCase();
                currentState.branch_name = capitalizeTextBackend(mappedBranch);
                currentState.step = 'AWAITING_JOB_TYPE';
                await client.replyMessage({ replyToken: event.replyToken, messages: [makeJobTypeFlex()] });
                continue;
            }

            // รอชื่อสาขา (Manual)
            if (currentState.step === 'AWAITING_BRANCH_NAME_MANUAL') {
                currentState.branch_code = '-';
                currentState.branch_name = capitalizeTextBackend(text);
                currentState.step = 'AWAITING_JOB_TYPE';
                await client.replyMessage({ replyToken: event.replyToken, messages: [makeJobTypeFlex()] });
                continue;
            }

            // รอประเภทงาน
            if (currentState.step === 'AWAITING_JOB_TYPE') {
                let finalJobType = text;
                let isRepair = false;

                if (textLower === 'ma' || textLower === 'maintenance') {
                    finalJobType = 'Maintenance';
                } else if (text === 'ติดตั้ง' || textLower === 'installation') {
                    finalJobType = 'Installation';
                } else if (text === 'ซ่อม' || textLower === 'repair') {
                    finalJobType = 'Repair';
                    isRepair = true;
                }

                currentState.job_type = finalJobType;

                if (isRepair) {
                    currentState.step = 'AWAITING_REPAIR_DETAIL';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [makeRepairDetailFlex()] });
                } else {
                    currentState.repair_detail = '';
                    await saveJobToDatabase(currentState, userId, event.replyToken);
                }
                continue;
            }

            // รอรายละเอียดซ่อม
            if (currentState.step === 'AWAITING_REPAIR_DETAIL') {
                currentState.repair_detail = text;
                await saveJobToDatabase(currentState, userId, event.replyToken);
                continue;
            }
        }
    }
    res.status(200).send('OK');
});

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
// Health Check Route
// ─────────────────────────────────────────────
app.get('/health', (req, res) => res.status(200).send('OK'));

// ─────────────────────────────────────────────
// Keep-Alive: ป้องกัน Render Free Tier หลับ
// ping ตัวเองทุก 10 นาที
// ─────────────────────────────────────────────
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

setInterval(async () => {
    try {
        const res = await fetch(`${SELF_URL}/health`);
        console.log(`[Keep-Alive] ping → ${res.status} (${new Date().toISOString()})`);
    } catch (err) {
        console.error('[Keep-Alive] ping failed:', err.message);
    }
}, 10 * 60 * 1000); // ทุก 10 นาที

app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });