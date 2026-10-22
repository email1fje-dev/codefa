const fs = require('fs');
const path = require('path');
const pool = require('./pool');

function validateExercises(exercises, lessonTitle) {
 if (!Array.isArray(exercises) || exercises.length < 6) throw new Error('درس باید دست‌کم ۶ تمرین داشته باشد: ' + lessonTitle);
 const allowed = new Set(['multiple_choice','fill_blank','reorder','code_exercise','predict_output','web_exercise']);
 for (const [i,e] of exercises.entries()) {
  if (!e || !allowed.has(e.type) || typeof e.prompt !== 'string' || typeof e.explanation !== 'string') throw new Error('ساختار تمرین شماره ' + (i+1) + ' در «' + lessonTitle + '» نامعتبر است.');
  if (!['python','javascript','html'].includes(e.language) || typeof e.visualize!=='boolean' || !e.preview || !['console','html','none'].includes(e.preview.mode) || typeof e.preview.live!=='boolean' || typeof e.preview.show_expected!=='boolean') throw new Error('زبان یا تنظیمات پیش‌نمایش تمرین نامعتبر است: '+lessonTitle);\n  if (e.hints != null && (!Array.isArray(e.hints) || e.hints.length > 2 || e.hints.some(h => typeof h !== 'string'))) throw new Error('راهنمای تمرین نامعتبر است: ' + lessonTitle);
  if (e.type === 'multiple_choice' && (!Array.isArray(e.options) || e.options.length < 2 || !('answer' in e))) throw new Error('گزینه یا پاسخ تمرین چندگزینه‌ای نامعتبر است: ' + lessonTitle);
  if (e.type === 'fill_blank' && (typeof e.code!=='string' || !('answer' in e))) throw new Error('کد یا پاسخ جای خالی نامعتبر است: '+lessonTitle);\n  if (e.type === 'reorder' && (!Array.isArray(e.lines) || !Array.isArray(e.answer))) throw new Error('خطوط تمرین مرتب‌سازی نامعتبر است: '+lessonTitle);\n  if (e.type === 'predict_output' && (typeof e.code!=='string' || !Array.isArray(e.options) || !('answer' in e))) throw new Error('کد یا گزینه‌های پیش‌بینی خروجی نامعتبر است: '+lessonTitle);\n  if (e.type === 'code_exercise' && (typeof e.starter_code !== 'string' || !Array.isArray(e.tests) || !e.tests.length || e.tests.some(t=>!((typeof t.expected_output==='string')||(typeof t.expected==='string')||(typeof t.call==='string'))))) throw new Error('کد آغازین یا تست‌های تمرین کدنویسی نامعتبر است: ' + lessonTitle);
  if (e.type === 'web_exercise' && (typeof e.starter_html !== 'string' || typeof e.starter_css !== 'string' || typeof e.expected_html !== 'string' || !Array.isArray(e.checks))) throw new Error('ساختار تمرین وب نامعتبر است: ' + lessonTitle);
 }
}
async function seedLessons() {
 const count = await pool.query('SELECT count(*)::int AS n FROM courses');
 if (count.rows[0].n) return;
 const root = path.join(__dirname, '..', 'lessons');
 const courses = [
  {slug:'html-css',title:'HTML و CSS',description:'ساخت صفحه‌های وب و طراحی آن‌ها',icon:'🎨',order:1},
  {slug:'javascript',title:'JavaScript مقدماتی',description:'یادگیری منطق و زبان جاوااسکریپت',icon:'⚡',order:2},
  {slug:'python',title:'Python مقدماتی',description:'از print و متغیر تا حلقه، تابع و مجموعه‌ها',icon:'🐍',order:3}
 ];
 for (const course of courses) {
  const folder = path.join(root, course.slug);
  if (!fs.existsSync(folder)) { if(course.slug==='python') throw new Error('فایل‌های دوره Python پیدا نشدند: lessons/python'); else continue; }
  const files = fs.readdirSync(folder).filter(f => /^unit\d+\.json$/.test(f)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));
  if (!files.length) throw new Error('هیچ فایل واحدی در دوره پیدا نشد: ' + course.slug);
  const c = await pool.query('INSERT INTO courses(slug,title,description,icon,order_index) VALUES($1,$2,$3,$4,$5) RETURNING id',[course.slug,course.title,course.description,course.icon,course.order]);
  for (const file of files) {
   let data;
   try { data=JSON.parse(fs.readFileSync(path.join(folder,file),'utf8')); } catch(e) { throw new Error('JSON درس قابل‌خواندن نیست ('+file+'): '+e.message); }
   if (!data.unit || !Array.isArray(data.lessons) || !data.lessons.length) throw new Error('ساختار فایل درس نامعتبر است: '+file);
   const unitOrder=Number(String(data.unit.id||file).match(/\d+/)?.[0])||1;
   const u=await pool.query('INSERT INTO units(course_id,title,description,order_index) VALUES($1,$2,$3,$4) RETURNING id',[c.rows[0].id,data.unit.title,data.unit.description||'',unitOrder]);
   for(let i=0;i<data.lessons.length;i++){
    const l=data.lessons[i];
    if(!l.title||!l.intro||!Array.isArray(l.exercises)) throw new Error('ساختار درس نامعتبر است: '+(l.title||file));
    validateExercises(l.exercises,l.title);
    await pool.query('INSERT INTO lessons(unit_id,title,intro,exercises,xp_reward,order_index) VALUES($1,$2,$3,$4,$5,$6)',[u.rows[0].id,l.title,l.intro,JSON.stringify(l.exercises),l.xp_reward||15,i+1]);
   }
  }
 }
}
module.exports={seedLessons,validateExercises};
