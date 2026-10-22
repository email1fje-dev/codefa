require('dotenv').config();
const express = require('express');
const compression = require('compression');
const playgroundRoutes = require('./routes/playground');
const questRoutes = require('./routes/quests');
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
app.use(helmet({ contentSecurityPolicy: false }));
app.use((req,res,next)=>{
 const sandbox=req.path==='/sandbox';
 if(sandbox){
  const host=String(req.get('host')||'').replace(/[^a-zA-Z0-9.:-]/g,'');
  const policy="default-src 'none'; script-src 'self' https://"+host+" http://"+host+" 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob:; style-src 'self' https://"+host+" http://"+host+" 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://"+host+" http://"+host+"; worker-src 'self' blob:; font-src 'self' data:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'";
  res.setHeader('Content-Security-Policy',policy);
 } else {
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
 }
 next();
});
app.use(compression());
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: true, legacyHeaders: false }));
app.use('/api/admin', rateLimit({ windowMs: 60 * 1000, limit: 45, standardHeaders: true, legacyHeaders: false }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'CodeFa' }));
app.use(async (req,res,next)=>{try{if(req.path==='/api/health'||req.path.startsWith('/api/auth')||req.path.startsWith('/api/admin')||req.path==='/admin.html')return next();const s=await pool.query("SELECT value FROM settings WHERE key='maintenance_mode'");const raw=s.rows[0]?.value;const enabled=raw===true||raw==='true';if(!enabled)return next();let admin=false;try{const token=req.cookies.codefa_token;if(token){const d=jwt.verify(token,process.env.JWT_SECRET);const u=await pool.query("SELECT role,is_banned FROM users WHERE id=$1",[d.id]);admin=!!u.rowCount&&u.rows[0].role==='admin'&&!u.rows[0].is_banned;}}catch{}if(admin)return next();if(req.path.startsWith('/api/'))return res.status(503).json({error:'سایت موقتاً در حال به‌روزرسانی است. کمی بعد برگردید.'});return res.status(503).send('<!doctype html><html lang=fa dir=rtl><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>در حال به‌روزرسانی</title><body style="font-family:Tahoma,sans-serif;background:#101a14;color:#eef7ef;padding:3rem;text-align:center"><h1>یه تغییر خوب در راهه! 🛠️</h1><p>کدفا موقتاً در حال به‌روزرسانیه. کمی بعد برگرد.</p></body></html>');}catch(e){next(e)}});
app.use('/api/playground', playgroundRoutes);
app.use('/api', questRoutes);
app.use('/vendor/pyodide', (req,res,next)=>{res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Cross-Origin-Resource-Policy','cross-origin');res.setHeader('Cache-Control','public, max-age=31536000, immutable');next();},express.static(path.join(__dirname,'node_modules','pyodide'),{maxAge:'1y',immutable:true,fallthrough:false}));
app.use('/vendor/codemirror',express.static(path.join(__dirname,'node_modules','codemirror'),{maxAge:'1y',immutable:true}));
app.get('/sandbox.html',(_req,res)=>res.status(404).send('Not found'));
app.get('/sandbox',(req,res)=>res.sendFile(path.join(__dirname,'public','sandbox.html')));
app.get('/p/:shortId', (req,res,next)=>{if(!/^[a-f0-9]{8}$/.test(req.params.shortId))return res.status(404).sendFile(path.join(__dirname,'public','404.html'));res.sendFile(path.join(__dirname,'public','playground.html'));});


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
