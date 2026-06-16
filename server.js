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


const AUTO_BRANCH_SHOPS = ['mk'];

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
    'm499': 'LOTUS PAKCHONG', 'm191': 'BIG C CHACHOENGSAO 2'
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
                backgroundColor: '#2f3542',
                paddingAll: '14px',
                contents: [
                    { type: 'text', text: '🏪 เริ่มบันทึกงาน', weight: 'bold', size: 'lg', color: '#ffffff', align: 'center' },
                    { type: 'text', text: 'เลือกร้านค้าด้านล่าง', size: 'xs', color: '#aaaaaa', align: 'center', margin: 'xs' }
                ]
            },
            body: {
                type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '14px',
                contents: [
                    {
                        type: 'box', layout: 'horizontal', spacing: 'md',
                        contents: [
                            {
                                type: 'button', flex: 1,
                                style: 'primary', color: '#e74c3c',
                                action: { type: 'message', label: '🍲 MK', text: 'mk' }
                            },
                            {
                                type: 'button', flex: 1,
                                style: 'primary', color: '#2ecc71',
                                action: { type: 'message', label: '🍖 BBQ', text: 'bbq' }
                            }
                        ]
                    },
                    {
                        type: 'button',
                        style: 'primary', color: '#f1c40f',
                        action: { type: 'message', label: '🍜 Lucky Suki', text: 'Lucky Suki' }
                    }
                ]
            },
            footer: {
                type: 'box', layout: 'vertical',
                backgroundColor: '#f8f9fa',
                paddingAll: '12px',
                contents: [
                    {
                        type: 'text',
                        text: '💡 หรือพิมพ์ชื่อร้านเองได้เลยครับ',
                        size: 'xxs', color: '#888888', align: 'center'
                    }
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
            if (currentState && currentState.step === 'AWAITING_IMAGE') {
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
                    console.log(`[IMAGE] updating job id=${jobIdToSend} with image_path=${relativePath}`);

                    // ใช้ Supabase แทน (.select() เพื่อให้รู้ว่ามีแถวถูกอัปเดตจริงหรือไม่)
            const { data: updatedRows, error } = await supabase
                .from('jobs')
                .update({ image_path: relativePath })
                .eq('id', currentState.jobId)
                .select();

            console.log('[IMAGE] supabase update result:', JSON.stringify({ updatedRows, error }));

            delete userStates[userId];
            if (error) {
                await client.replyMessage({ replyToken: event.replyToken, messages: [makeAlertFlex('error', 'บันทึกรูปไม่สำเร็จ: ' + error.message)] });
            } else if (!updatedRows || updatedRows.length === 0) {
                console.error(`[IMAGE] WARNING: 0 rows updated for job id=${jobIdToSend}. Possible RLS policy block or wrong id.`);
                await client.replyMessage({ replyToken: event.replyToken, messages: [makeAlertFlex('error', `บันทึกรูปไม่สำเร็จ: ไม่พบงาน id=${jobIdToSend} ใน database (อาจถูก RLS บล็อก)`)] });
            } else {
                await sendJobSummaryAfterImage(userId, event.replyToken, currentState.jobId);
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

            // รอรูปอยู่แต่ส่งข้อความมา
            if (userStates[userId] && userStates[userId].step === 'AWAITING_IMAGE') {
                await client.replyMessage({ replyToken: event.replyToken, messages: [
                    makeAlertFlex('warning', 'กรุณาส่งรูปภาพใบงานเข้าแชท หรือพิมพ์ "ยกเลิก" เพื่อเริ่มต้นใหม่ครับ')
                ]});
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
                
                if (isAutoBranch) {
                    userStates[userId] = { step: 'AWAITING_BRANCH_CODE', shop_brand: detectedBrand, shop_name: formattedShopName, is_auto: true };
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeShopConfirmFlex(formattedShopName, detectedBrand, 'กรุณาป้อนรหัสสาขาครับ')
                    ]});
                } else {
                    userStates[userId] = { step: 'AWAITING_BRANCH_NAME_MANUAL', shop_brand: detectedBrand, shop_name: formattedShopName, is_auto: false };
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeShopConfirmFlex(formattedShopName, detectedBrand, 'กรุณาระบุชื่อสาขา หรือ สถานที่ทำงานครับ')
                    ]});
                }
                continue;
            }

            const currentState = userStates[userId];

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
    const date = now.toISOString().split('T')[0];
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