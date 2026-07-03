const express = require('express');
const router = express.Router();
const supabase = require('../config/supabaseClient');
const { client, blobClient } = require('../config/lineClient');
const userStates = require('../state/userStates');
const { BRANCH_MAP, AUTO_BRANCH_SHOPS, INCOME_SECRET_COMMAND, OT_RATE_PER_HOUR, KM_RATE_PER_KM } = require('../config/constants');
const { capitalizeTextBackend, getBrandCategory, parseFlexibleIncomeDate } = require('../utils/textHelpers');
const { uploadImageToStorage } = require('../services/imageStorage');
const { saveJobToDatabase, sendJobSummaryAfterImage } = require('../services/jobService');
const {
    makeGreetingAndShopFlex, makeShopConfirmFlex,
    makeJobTypeFlex, makeRepairDetailFlex, makeAskMoreImageFlex, makeAlertFlex, makeDatePickerFlex
} = require('../flex/jobFlex');
const { makeOverviewPeriodFlex, makeOverviewResultFlex } = require('../flex/overviewFlex');
const {
    makeIncomeMenuFlex, makeIncomeAskFlex, makeIncomeAskSkipFlex, makeIncomePointMoreFlex, makeIncomeSummaryFlex, makeIncomeHistoryFlex
} = require('../flex/incomeFlex');

// ─────────────────────────────────────────────
// Webhook
// ─────────────────────────────────────────────

router.post('/webhook', async (req, res) => {
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

                // ดึงรายการที่เคยบันทึก (เซฟลง Supabase) ไปแล้วในเดือนนี้ มาแสดงให้ดูก่อน
                const nowTH = new Date(Date.now() + 7 * 60 * 60 * 1000);
                const y = nowTH.getUTCFullYear();
                const m = nowTH.getUTCMonth();
                const monthStart = new Date(Date.UTC(y, m, 1)).toISOString().split('T')[0];
                const nextMonthStart = new Date(Date.UTC(y, m + 1, 1)).toISOString().split('T')[0];

                const { data: pastRecords, error: historyErr } = await supabase
                    .from('extra_income')
                    .select('*')
                    .eq('line_user_id', userId)
                    .gte('date', monthStart)
                    .lt('date', nextMonthStart)
                    .order('date', { ascending: true });

                const messages = [
                    makeIncomeHistoryFlex(historyErr ? [] : (pastRecords || [])),
                    makeIncomeMenuFlex(userStates[userId])
                ];
                await client.replyMessage({ replyToken: event.replyToken, messages });
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
                        incState.currentRoute = { legs: [] };
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeIncomeAskFlex('🚗 จดค่าเดินทาง', 'กรุณาระบุวันที่เดินทาง', 'พิมพ์ "วันนี้" หรือรูปแบบ DD-MM เช่น 20-06 (ใช้ปีปัจจุบัน, รองรับบันทึกย้อนหลัง)')
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
                        const routeTollAmount = routes.reduce((s, r) => s + (r.toll_amount || 0), 0);
                        const routeParkingAmount = routes.reduce((s, r) => s + (r.parking_amount || 0), 0);
                        const tollAmount = tolls.reduce((s, t) => s + t.amount, 0) + routeTollAmount;
                        const parkingAmount = parkings.reduce((s, t) => s + t.amount, 0) + routeParkingAmount;
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
                        makeIncomeAskFlex('⏱ จด OT', 'กรุณาระบุวันที่ทำ OT', 'พิมพ์ "วันนี้" หรือรูปแบบ DD-MM เช่น 20-06 (ใช้ปีปัจจุบัน, รองรับบันทึกย้อนหลัง)')
                    ]});
                    continue;
                }

                // ── OT: รอวันที่ → บันทึก ──
                if (incState.step === 'INC_OT_DATE') {
                    const parsed = parseFlexibleIncomeDate(text);
                    if (!parsed.ok) {
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeAlertFlex('warning', `รูปแบบวันที่ไม่ถูกต้องครับ พิมพ์ "วันนี้" หรือรูปแบบ DD-MM เช่น 20-06`)
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
                            makeAlertFlex('warning', `รูปแบบวันที่ไม่ถูกต้องครับ พิมพ์ "วันนี้" หรือรูปแบบ DD-MM เช่น 20-06`)
                        ]});
                        continue;
                    }
                    incState.currentRoute.date = parsed.date;
                    incState.currentLeg = {};
                    incState.step = 'INC_LEG_FROM';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeIncomeAskFlex('🚗 จดค่าเดินทาง', 'จุดเริ่มต้น: กรุณาระบุสถานที่เริ่มต้น', 'เช่น สำนักงาน / บ้าน')
                    ]});
                    continue;
                }

                // ── เดินทาง: จุดเริ่มต้น (ถามเฉพาะช่วงทางแรกของวัน) ──
                if (incState.step === 'INC_LEG_FROM') {
                    incState.currentLeg.from = text;
                    incState.step = 'INC_LEG_JOB';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeIncomeAskFlex('🚗 จดค่าเดินทาง', 'งาน: ระบุงานที่ทำในช่วงทางนี้', 'เช่น Repair Bella Bot Bonus Suki / กลับ')
                    ]});
                    continue;
                }

                // ── เดินทาง: งานของช่วงทางนี้ ──
                if (incState.step === 'INC_LEG_JOB') {
                    incState.currentLeg.job = text;
                    incState.step = 'INC_LEG_TO';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeIncomeAskFlex('🚗 จดค่าเดินทาง', 'จุดสิ้นสุด: กรุณาระบุสถานที่ปลายทาง', null)
                    ]});
                    continue;
                }

                // ── เดินทาง: จุดสิ้นสุดของช่วงทางนี้ ──
                if (incState.step === 'INC_LEG_TO') {
                    incState.currentLeg.to = text;
                    incState.step = 'INC_LEG_KM';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeIncomeAskFlex('🚗 จดค่าเดินทาง', `รวมระยะทางกี่กิโลเมตร (${incState.currentLeg.from} → ${incState.currentLeg.to})`, `1 กม. = ${KM_RATE_PER_KM} บาท`)
                    ]});
                    continue;
                }

                // ── เดินทาง: ระยะทางของช่วงทางนี้ → คำนวณยอดเบิกน้ำมัน แล้วถามค่าผ่านทางพิเศษ ──
                if (incState.step === 'INC_LEG_KM') {
                    const km = parseFloat(text.replace(',', '.'));
                    if (isNaN(km) || km < 0) {
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeAlertFlex('warning', 'กรุณาระบุระยะทางเป็นตัวเลข เช่น 12 หรือ 12.5')
                        ]});
                        continue;
                    }
                    incState.currentLeg.km = km;
                    incState.currentLeg.amount = Math.round(km * KM_RATE_PER_KM * 100) / 100;
                    incState.step = 'INC_LEG_TOLL';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeIncomeAskSkipFlex('🛣 ค่าผ่านทางพิเศษ', 'ช่วงทางนี้มีค่าผ่านทางพิเศษไหมครับ ถ้ามีกรุณาระบุจำนวนเงิน (บาท)', null, '⏭ ข้าม (ไม่มี)', '__inc_leg_toll_skip__')
                    ]});
                    continue;
                }

                // ── เดินทาง: ค่าผ่านทางพิเศษของช่วงทางนี้ (มีปุ่มข้าม) → ถามค่าจอดรถต่อ ──
                if (incState.step === 'INC_LEG_TOLL') {
                    if (text === '__inc_leg_toll_skip__') {
                        incState.currentLeg.toll_amount = 0;
                    } else {
                        const amount = parseFloat(text.replace(',', '.'));
                        if (isNaN(amount) || amount <= 0) {
                            await client.replyMessage({ replyToken: event.replyToken, messages: [
                                makeAlertFlex('warning', 'กรุณาระบุจำนวนเงินเป็นตัวเลขที่มากกว่า 0 เช่น 65 หรือกดปุ่มข้ามถ้าไม่มี')
                            ]});
                            continue;
                        }
                        incState.currentLeg.toll_amount = amount;
                    }
                    incState.step = 'INC_LEG_PARKING';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeIncomeAskSkipFlex('🅿️ ค่าจอดรถ', 'ช่วงทางนี้มีค่าจอดรถไหมครับ ถ้ามีกรุณาระบุจำนวนเงิน (บาท)', null, '⏭ ข้าม (ไม่มี)', '__inc_leg_parking_skip__')
                    ]});
                    continue;
                }

                // ── เดินทาง: ค่าจอดรถของช่วงทางนี้ (มีปุ่มข้าม) → บันทึกช่วงทาง แล้วถามว่ามีช่วงทางต่อไปไหม ──
                if (incState.step === 'INC_LEG_PARKING') {
                    if (text === '__inc_leg_parking_skip__') {
                        incState.currentLeg.parking_amount = 0;
                    } else {
                        const amount = parseFloat(text.replace(',', '.'));
                        if (isNaN(amount) || amount <= 0) {
                            await client.replyMessage({ replyToken: event.replyToken, messages: [
                                makeAlertFlex('warning', 'กรุณาระบุจำนวนเงินเป็นตัวเลขที่มากกว่า 0 เช่น 40 หรือกดปุ่มข้ามถ้าไม่มี')
                            ]});
                            continue;
                        }
                        incState.currentLeg.parking_amount = amount;
                    }
                    incState.currentRoute.legs.push(incState.currentLeg);
                    const savedLeg = incState.currentLeg;
                    incState.currentLeg = null;
                    incState.step = 'INC_LEG_MORE';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeIncomePointMoreFlex(incState.currentRoute, savedLeg)
                    ]});
                    continue;
                }

                // ── เดินทาง: เพิ่มช่วงทางต่อไป (จุดสิ้นสุดเดิม = จุดเริ่มต้นใหม่) หรือ บันทึกจบเส้นทาง ──
                if (incState.step === 'INC_LEG_MORE') {
                    if (text === '__inc_point_more__') {
                        const lastLeg = incState.currentRoute.legs[incState.currentRoute.legs.length - 1];
                        incState.currentLeg = { from: lastLeg.to };
                        incState.step = 'INC_LEG_JOB';
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeIncomeAskFlex('🚗 จดค่าเดินทาง', `งาน: ระบุงานที่ทำในช่วงทางนี้ (จาก ${lastLeg.to})`, 'เช่น Repair Pudu Bot / กลับ')
                        ]});
                    } else {
                        const route = incState.currentRoute;
                        route.total_km = Math.round(route.legs.reduce((s, l) => s + l.km, 0) * 100) / 100;
                        route.amount = Math.round(route.legs.reduce((s, l) => s + l.amount, 0) * 100) / 100;
                        route.toll_amount = Math.round(route.legs.reduce((s, l) => s + (l.toll_amount || 0), 0) * 100) / 100;
                        route.parking_amount = Math.round(route.legs.reduce((s, l) => s + (l.parking_amount || 0), 0) * 100) / 100;
                        incState.routes.push(route);
                        incState.currentRoute = null;
                        incState.step = 'INC_MENU';
                        const extraParts = [];
                        if (route.toll_amount) extraParts.push(`ค่าผ่านทางพิเศษ ${route.toll_amount.toLocaleString()} บ.`);
                        if (route.parking_amount) extraParts.push(`ค่าจอดรถ ${route.parking_amount.toLocaleString()} บ.`);
                        const extraText = extraParts.length ? ` (+${extraParts.join(', ')})` : '';
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeAlertFlex('success', `บันทึกเส้นทาง ${route.date} — ${route.legs.length} ช่วงทาง รวม ${route.total_km} กม. = ${route.amount.toLocaleString()} บาท แล้วครับ${extraText}`),
                            makeIncomeMenuFlex(incState)
                        ]});
                    }
                    continue;
                }

                // ── ค่าทางด่วน (จดเดี่ยว ไม่ผูกเส้นทาง) ──
                if (incState.step === 'INC_TOLL_AMOUNT') {
                    const amount = parseFloat(text.replace(',', '.'));
                    if (isNaN(amount) || amount <= 0) {
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeAlertFlex('warning', 'กรุณาระบุจำนวนเงินเป็นตัวเลขที่มากกว่า 0 เช่น 65')
                        ]});
                        continue;
                    }
                    incState.currentToll = { amount };
                    incState.step = 'INC_TOLL_DETAIL';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeIncomeAskFlex('🛣 จดค่าทางด่วน', 'กรุณาระบุรายละเอียด/เหตุผลของค่าทางด่วนนี้', 'เช่น เดินทางไปไซต์งาน ABC')
                    ]});
                    continue;
                }

                // ── ค่าทางด่วน (จดเดี่ยว): รายละเอียด → บันทึก ──
                if (incState.step === 'INC_TOLL_DETAIL') {
                    incState.currentToll.detail = text;
                    incState.tolls.push(incState.currentToll);
                    const amount = incState.currentToll.amount;
                    incState.currentToll = null;
                    incState.step = 'INC_MENU';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeAlertFlex('success', `บันทึกค่าทางด่วน ${amount.toLocaleString()} บาท แล้วครับ`),
                        makeIncomeMenuFlex(incState)
                    ]});
                    continue;
                }

                // ── ค่าจอดรถ (จดเดี่ยว ไม่ผูกเส้นทาง) ──
                if (incState.step === 'INC_PARKING_AMOUNT') {
                    const amount = parseFloat(text.replace(',', '.'));
                    if (isNaN(amount) || amount <= 0) {
                        await client.replyMessage({ replyToken: event.replyToken, messages: [
                            makeAlertFlex('warning', 'กรุณาระบุจำนวนเงินเป็นตัวเลขที่มากกว่า 0 เช่น 40')
                        ]});
                        continue;
                    }
                    incState.currentParking = { amount };
                    incState.step = 'INC_PARKING_DETAIL';
                    await client.replyMessage({ replyToken: event.replyToken, messages: [
                        makeIncomeAskFlex('🅿️ จดค่าจอดรถ', 'กรุณาระบุรายละเอียด/เหตุผลของค่าจอดรถนี้', 'เช่น จอดที่ไซต์งาน ABC')
                    ]});
                    continue;
                }

                // ── ค่าจอดรถ (จดเดี่ยว): รายละเอียด → บันทึก ──
                if (incState.step === 'INC_PARKING_DETAIL') {
                    incState.currentParking.detail = text;
                    incState.parkings.push(incState.currentParking);
                    const amount = incState.currentParking.amount;
                    incState.currentParking = null;
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

module.exports = router;
