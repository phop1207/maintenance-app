// ─────────────────────────────────────────────
// Flex Message Builders — งานหลัก (welcome / shop / job type / summary / alert)
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

module.exports = {
    makeWelcomeFlex,
    makeGreetingAndShopFlex,
    makeShopSelectorFlex,
    makeShopConfirmFlex,
    makeJobTypeFlex,
    makeRepairDetailFlex,
    makeJobSummaryFlex,
    makeJobSummaryText,
    makeAskMoreImageFlex,
    makeAlertFlex,
    makeDatePickerFlex
};
