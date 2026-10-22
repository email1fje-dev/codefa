const pool=require('../db/pool');
async function requireAdmin(req,res,next){try{const q=await pool.query("SELECT role FROM users WHERE id=$1",[req.user.id]);if(!q.rowCount||q.rows[0].role!=='admin')return res.status(403).json({error:'دسترسی فقط برای مدیران مجاز است.'});req.user.role=q.rows[0].role;next();}catch(e){next(e)}}
module.exports={requireAdmin};
