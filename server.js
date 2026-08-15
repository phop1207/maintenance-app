require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(__dirname, 'public')));

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────
const pagesRouter = require('./routes/pages');
const jobsApiRouter = require('./routes/jobsApi');
const authApiRouter = require('./routes/authApi');
const adminApiRouter = require('./routes/adminApi');
const incomeApiRouter = require('./routes/incomeApi');
const webhookRouter = require('./routes/webhook');
const { router: healthRouter, startKeepAlive } = require('./routes/health');

app.use(pagesRouter);
app.use(jobsApiRouter);
app.use(authApiRouter);
app.use(adminApiRouter);
app.use(incomeApiRouter);
app.use(webhookRouter);
app.use(healthRouter);

startKeepAlive(PORT);

app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
