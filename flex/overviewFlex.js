// ─────────────────────────────────────────────
// Flex Message Builders — ภาพรวมสถิติงาน
// ─────────────────────────────────────────────

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
    const typeCount = { Maintenance: 0, Repair: 0, Installation: 0, Demo: 0, 'Site Survey': 0 };

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
    if (typeCount.Demo) copyText += `  🎬 Demo: ${typeCount.Demo} งาน\n`;
    if (typeCount['Site Survey']) copyText += `  📐 Site Survey: ${typeCount['Site Survey']} งาน\n`;

    // กล่องแสดงแต่ละประเภทงาน (เฉพาะที่มีงาน) แบ่งเป็นแถวละสูงสุด 3 กล่อง กันแน่นเกินไปเวลามีหลายประเภท
    const typeBoxDefs = [
        { key: 'Maintenance', icon: '🔧', label: 'MA', color: '#27ae60', bg: '#e8f8f5' },
        { key: 'Repair', icon: '🛠', label: 'Repair', color: '#e67e22', bg: '#fef9e7' },
        { key: 'Installation', icon: '🏗', label: 'Install', color: '#2980b9', bg: '#eaf2ff' },
        { key: 'Demo', icon: '🎬', label: 'Demo', color: '#7c3aed', bg: '#f3e8ff' },
        { key: 'Site Survey', icon: '📐', label: 'Survey', color: '#0d9488', bg: '#e6fffa' }
    ].filter(d => typeCount[d.key]);

    const typeBoxes = typeBoxDefs.map(d => ({
        type: 'box', layout: 'vertical', flex: 1,
        backgroundColor: d.bg, cornerRadius: '8px', paddingAll: '8px', alignItems: 'center',
        contents: [
            { type: 'text', text: d.icon, size: 'xl', align: 'center' },
            { type: 'text', text: d.label, size: 'xs', color: d.color, weight: 'bold', align: 'center' },
            { type: 'text', text: `${typeCount[d.key]}`, size: 'md', weight: 'bold', color: d.color, align: 'center' }
        ]
    }));

    const typeRows = [];
    for (let i = 0; i < typeBoxes.length; i += 3) {
        typeRows.push({
            type: 'box', layout: 'horizontal', margin: 'sm', spacing: 'sm',
            contents: typeBoxes.slice(i, i + 3)
        });
    }

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
                        ...typeRows
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

module.exports = { makeOverviewPeriodFlex, makeOverviewResultFlex };
