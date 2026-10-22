const jwt=require('jsonwebtoken');
const pool=require('../db/pool');
async function requireAuth(req,res,next){
 try { const token=req.cookies.codefa_token; if(!token) return res.status(401).json({error:'ابتدا وارد حساب خود شوید.'});
 const decoded=jwt.verify(token,process.env.JWT_SECRET); const q=await pool.query('SELECT id,username,display_name,role,is_verified,is_banned,banned_reason FROM users WHERE id=$1',[decoded.id]);
 if(!q.rowCount) return res.status(401).json({error:'حساب کاربری پیدا نشد.'});
 if(q.rows[0].is_banned) return res.status(403).json({error:'حساب شما مسدود است: '+(q.rows[0].banned_reason||'دلیل ثبت نشده')});
 req.user=q.rows[0]; next(); } catch(e){ return res.status(401).json({error:'نشست شما منقضی شده است؛ دوباره وارد شوید.'});}
}
module.exports={requireAuth};
