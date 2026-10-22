const fs = require('fs');
const path = require('path');
const pool = require('./pool');
async function seedLessons() {
 const { rows } = await pool.query('SELECT count(*)::int AS n FROM courses');
 if (rows[0].n) return;
 const root = path.join(__dirname, '..', 'lessons');
 for (const slug of ['html-css','javascript']) {
  const courseFiles = fs.readdirSync(path.join(root, slug)).filter(f => /^unit\d+\.json$/.test(f)).sort();
  const courseData = { title: slug === 'html-css' ? 'HTML و CSS' : 'JavaScript مقدماتی', description: slug === 'html-css' ? 'ساخت صفحه‌های وب و طراحی آن‌ها' : 'یادگیری منطق و زبان جاوااسکریپت', icon: slug === 'html-css' ? '🎨' : '⚡' };
  const c = await pool.query('INSERT INTO courses(slug,title,description,icon,order_index) VALUES($1,$2,$3,$4,$5) RETURNING id',[slug,courseData.title,courseData.description,courseData.icon,slug==='html-css'?1:2]);
  for (const file of courseFiles) {
   const data = JSON.parse(fs.readFileSync(path.join(root,slug,file),'utf8'));
   if (!data.unit || !Array.isArray(data.lessons)) throw new Error('ساختار فایل درس نامعتبر است: '+file);
   const u = await pool.query('INSERT INTO units(course_id,title,description,order_index) VALUES($1,$2,$3,$4) RETURNING id',[c.rows[0].id,data.unit.title,data.unit.description||'',Number((data.unit.id||'unit1').replace(/\D/g,''))||1]);
   for (let i=0;i<data.lessons.length;i++) {
    const l=data.lessons[i];
    if (!l.title || !l.intro || !Array.isArray(l.exercises)) throw new Error('ساختار درس نامعتبر است: '+l.title);
    await pool.query('INSERT INTO lessons(unit_id,title,intro,exercises,xp_reward,order_index) VALUES($1,$2,$3,$4,$5,$6)',[u.rows[0].id,l.title,l.intro,JSON.stringify(l.exercises),l.xp_reward||15,i+1]);
   }
  }
 }
}
module.exports = { seedLessons };
