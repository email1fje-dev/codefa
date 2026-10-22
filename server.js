require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { init } = require('./db/init');
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/course');
const progressRoutes = require('./routes/progress');
const leaderboardRoutes = require('./routes/leaderboard');
const profileRoutes = require('./routes/profile');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const { errors } = require('./middleware/errors');
const pool = require('./db/pool');
const jwt = require('jsonwebtoken');

if (!process.env.DATABASE_URL) { console.error('خطا: متغیر DATABASE_URL تنظیم نشده است.'); process.exit(1); }
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) { console.error('خطا: JWT_SECRET باید حداقل ۳۲ نویسه باشد.'); process.exit(1); }

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], workerSrc: ["'self'", 'blob:'], frameSrc: ["'self'", 'blob:'], objectSrc: ["'none'"] } } }));
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: true, legacyHeaders: false }));
app.use('/api/admin', rateLimit({ windowMs: 60 * 1000, limit: 45, standardHeaders: true, legacyHeaders: false }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'CodeFa' }));
app.use('/api/auth', authRoutes);
app.use('/api', courseRoutes);
app.use('/api', progressRoutes);
app.use('/api', leaderboardRoutes);
app.use('/api', profileRoutes);
app.use('/api', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.get('/admin.html', async (req, res) => { try { const token=req.cookies.codefa_token; if(!token) return res.status(403).send('<!doctype html><html lang=fa dir=rtl><meta charset=utf-8><p>دسترسی مدیر لازم است. <a href="/">ورود</a></p>'); const decoded=jwt.verify(token,process.env.JWT_SECRET); const q=await pool.query('SELECT role,is_banned FROM users WHERE id=$1',[decoded.id]); if(!q.rowCount||q.rows[0].role!=='admin'||q.rows[0].is_banned) return res.status(403).send('<!doctype html><html lang=fa dir=rtl><meta charset=utf-8><meta http-equiv="refresh" content="2;url=/app.html"><p>دسترسی غیرمجاز؛ در حال بازگشت به اپ…</p>'); return res.sendFile(path.join(__dirname,'public','admin.html')); } catch(e) { return res.status(403).send('<!doctype html><html lang=fa dir=rtl><meta charset=utf-8><p>دسترسی غیرمجاز است. <a href="/app.html">بازگشت</a></p>'); } });
app.use(express.static(path.join(__dirname, 'public')));
app.use((_req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));
app.use(errors);
init().then(() => {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => console.log('CodeFa روی پورت ' + port + ' آماده است.'));
}).catch(err => { console.error('خطا در آماده‌سازی دیتابیس:', err.message); process.exit(1); });
