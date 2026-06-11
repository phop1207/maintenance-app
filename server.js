require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const line = require('@line/bot-sdk');
const multer = require('multer'); 
const { createClient } = require('@supabase/supabase-js'); // เอามาไว้กับตัวอื่น
// เปลี่ยนจากการใช้เวลาของ server ตรงๆ เป็น...
// แทนที่จะใช้ new Date() ตรงๆ ให้ใช้ฟังก์ชันนี้ครับ
const now = new Date();
// ปรับเวลาให้เป็น UTC+7 (ประเทศไทย)
const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));

// ดึงเฉพาะวันที่ และ เวลา ออกมา
const date = thailandTime.toISOString().split('T')[0]; // จะได้รูปแบบ YYYY-MM-DD
const time = thailandTime.toTimeString().split(' ')[0].substring(0, 5); // จะได้รูปแบบ HH:MM

// แล้วค่อยเอาค่า date กับ time นี้ไปใส่ใน object ที่จะ insert ครับ
const { data, error } = await supabase.from('jobs').insert([{
    date: date,
    time: time,
    // ... ฟิลด์อื่นๆ ของคุณ
}]);

// แล้วเอาค่า thaiTime นี้ไปใส่ใน object ที่จะ insert ลง Supabase ครับ

// ตั้งค่า
app.use('/uploads', express.static('uploads'));
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

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'web-' + uniqueSuffix + path.extname(file.originalname));
    }
});
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
                backgroundColor: '#e53935',
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

app.get('/api/jobs', async (req, res) => {
    const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('date', { ascending: false })
        .order('time', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/jobs', upload.single('image'), async (req, res) => {
    // 1. เพิ่ม Console Log เพื่อเช็คว่าได้รับข้อมูลอะไรมาบ้างจาก LINE
    console.log("Received body:", req.body);
    console.log("Received file:", req.file);

    const { date, time, shop_brand, shop_name, branch_code, branch_name, job_type, repair_detail } = req.body;
    const image_path = req.file ? 'uploads/' + req.file.filename : '';

    // 2. ตรวจสอบว่าถ้าไม่มีข้อมูลบังคับ (เช่น date) ให้ตอบกลับ Error ทันที
    if (!date || !time) {
        return res.status(400).json({ error: "Missing required fields: date or time" });
    }

    const { data, error } = await supabase.from('jobs').insert([{
        date, 
        time,
        shop_brand: capitalizeTextBackend(shop_brand || getBrandCategory(shop_name)),
        shop_name: capitalizeTextBackend(shop_name),
        branch_code: (branch_code || '-').toUpperCase(),
        branch_name: capitalizeTextBackend(branch_name),
        job_type,
        repair_detail: job_type === 'Repair' ? repair_detail : '',
        image_path
    }]).select();

    if (error) {
        console.error("Supabase Insert Error:", error); // ดู Error ละเอียดใน Log
        return res.status(500).json({ error: error.message });
    }
    
    res.json({ message: 'Created successfully', id: data[0].id });
});

app.put('/api/jobs/:id', upload.single('image'), async (req, res) => {
    const { id } = req.params;
    let updateData = { ...req.body };
    if (req.file) updateData.image_path = 'uploads/' + req.file.filename;

    const { error } = await supabase.from('jobs').update(updateData).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Updated successfully' });
});

app.delete('/api/jobs/:id', async (req, res) => {
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
            rows.forEach(row => {
                if (row.image_path) {
                    const absolutePath = path.resolve(__dirname, 'public', row.image_path);
                    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
                }
            });
        }

        // 2. สั่งลบข้อมูลใน Supabase
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
            rows.forEach(row => {
                if (row.image_path) {
                    const absolutePath = path.resolve(__dirname, 'public', row.image_path);
                    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
                }
            });
        }

        // 2. ลบข้อมูลทั้งหมดในตาราง jobs
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
// Webhook
// ─────────────────────────────────────────────

app.post('/webhook', async (req, res) => {
    const events = req.body.events || [];
    for (const event of events) {
        const userId = event.source.userId;

        // ── รับรูปภาพ ──────────────────────────────────
        if (event.type === 'message' && event.message.type === 'image') {
            const currentState = userStates[userId];
            if (currentState && currentState.step === 'AWAITING_IMAGE') {
                const messageId = event.message.id;
                const fileName = `job_${currentState.jobId}_${Date.now()}.jpg`;
                const localFilePath = path.join(uploadDir, fileName);

                try {
                    const stream = await blobClient.getMessageContent(messageId);
                    const writer = fs.createWriteStream(localFilePath);
                    stream.pipe(writer);
                    await new Promise((resolve, reject) => { writer.on('finish', resolve); writer.on('error', reject); });

                    const relativePath = `uploads/${fileName}`;
                    const jobIdToSend = currentState.jobId;
                    
                    // ใช้ Supabase แทน
            const { error } = await supabase
                .from('jobs')
                .update({ image_path: relativePath })
                .eq('id', currentState.jobId);

            delete userStates[userId];
            if (error) {
                await client.replyMessage({ replyToken: event.replyToken, messages: [makeAlertFlex('error', 'บันทึกรูปไม่สำเร็จ')] });
            } else {
                await sendJobSummaryAfterImage(userId, event.replyToken, currentState.jobId);
            }
                } catch (error) {
                    delete userStates[userId];
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeAlertFlex('error', 'บอทไม่สามารถดาวน์โหลดไฟล์รูปได้ กรุณาลองส่งใหม่อีกครั้งครับ')
                    ]});
                }
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
                    await client.replyMessage({ replyToken: event.replyToken, messages: [makeShopSelectorFlex()] });
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
                    saveJobToDatabase(currentState, userId, event.replyToken);
                }
                continue;
            }

            // รอรายละเอียดซ่อม
            if (currentState.step === 'AWAITING_REPAIR_DETAIL') {
                currentState.repair_detail = text;
                saveJobToDatabase(currentState, userId, event.replyToken);
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
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // รูปแบบ YYYY-MM-DD
    const time = now.toTimeString().split(' ')[0].substring(0, 5); // รูปแบบ HH:MM

    const { shop_brand, shop_name, branch_code, branch_name, job_type, repair_detail } = currentState;

    try {
        // ใช้ supabase แทน db.run
        const { data, error } = await supabase
            .from('jobs')
            .insert([{ 
                date, 
                time, 
                shop_brand, 
                shop_name, 
                branch_code, 
                branch_name, 
                job_type, 
                repair_detail, 
                image_path: '' // เราจะอัปเดตค่านี้หลังจากอัปโหลดรูป
            }])
            .select(); // เพื่อให้ได้ ID ของงานที่เพิ่งบันทึกกลับมา

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

app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });