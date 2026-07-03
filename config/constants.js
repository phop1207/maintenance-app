// ─────────────────────────────────────────────
// ระบบบันทึกค่าตอบแทนเพิ่มเติมประจำเดือน (คำสั่งลับ "phopcheck")
// หมายเหตุ: รายการเหล่านี้ไม่ใช่ "รายได้" หลักของงาน ใช้แค่บันทึก/สรุปให้ดูเท่านั้น
// ─────────────────────────────────────────────
const INCOME_SECRET_COMMAND = 'phopcheck';
const OT_RATE_PER_HOUR = 125;   // บาท/ชั่วโมง
const KM_RATE_PER_KM = 5;       // บาท/กิโลเมตร

const AUTO_BRANCH_SHOPS = ['mk'];

// ─────────────────────────────────────────────
// Supabase Storage สำหรับเก็บรูปภาพ (แทนการเก็บไฟล์ใน local disk
// ซึ่งจะหายไปทุกครั้งที่ Render restart/redeploy)
// ─────────────────────────────────────────────
const STORAGE_BUCKET = 'job-images';

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

module.exports = {
    INCOME_SECRET_COMMAND,
    OT_RATE_PER_HOUR,
    KM_RATE_PER_KM,
    AUTO_BRANCH_SHOPS,
    STORAGE_BUCKET,
    BRANCH_MAP
};
