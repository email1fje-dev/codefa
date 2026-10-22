const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./pool');
const { seedLessons } = require('./seed-lessons');
async function init() {
 await pool.query(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));
 await seedLessons();
 const username=process.env.ADMIN_USERNAME, password=process.env.ADMIN_PASSWORD;
 if (username && password) {
  if (password.length < 12) console.error('هشدار امنیتی: ADMIN_PASSWORD باید حداقل ۱۲ نویسه باشد؛ حساب ادمین ساخته یا تغییر رمز داده نشد.');
  else if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) console.error('هشدار: ADMIN_USERNAME باید ۳ تا ۲۰ حرف انگلیسی، عدد یا زیرخط باشد.');
  else {
   const found=await pool.query('SELECT id FROM users WHERE username=$1',[username]);
   if (!found.rowCount) {
    const hash=await bcrypt.hash(password,12);
    await pool.query("INSERT INTO users(username,password_hash,display_name,role,is_verified) VALUES($1,$2,$1,'admin',true)",[username,hash]);
    console.log('حساب ادمین اولیه ساخته شد.');
   } else await pool.query("UPDATE users SET role='admin',is_verified=true WHERE username=$1",[username]);
  }
 } else console.warn('هشدار: برای ساخت حساب ادمین، ADMIN_USERNAME و ADMIN_PASSWORD را در محیط تنظیم کنید.');
}
module.exports = { init };
