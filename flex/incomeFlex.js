// ─────────────────────────────────────────────
// Flex Helpers — ระบบบันทึกค่าตอบแทนเพิ่มเติม (คำสั่งลับ)
// ─────────────────────────────────────────────

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

module.exports = { makeIncRow, makeIncomeMenuFlex, makeIncomeAskFlex, makeIncomePointMoreFlex, makeIncomeSummaryFlex };
