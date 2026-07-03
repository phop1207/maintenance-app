const express = require('express');
const router = express.Router();

// ─────────────────────────────────────────────
// Health Check Route
// ─────────────────────────────────────────────
router.get('/health', (req, res) => res.status(200).send('OK'));

// ─────────────────────────────────────────────
// Keep-Alive: ป้องกัน Render Free Tier หลับ
// ping ตัวเองทุก 10 นาที
// ─────────────────────────────────────────────
function startKeepAlive(port) {
    const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;

    setInterval(async () => {
        try {
            const res = await fetch(`${SELF_URL}/health`);
            console.log(`[Keep-Alive] ping → ${res.status} (${new Date().toISOString()})`);
        } catch (err) {
            console.error('[Keep-Alive] ping failed:', err.message);
        }
    }, 10 * 60 * 1000); // ทุก 10 นาที
}

module.exports = { router, startKeepAlive };
