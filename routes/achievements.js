const router=require('express').Router();
const pool=require('../db/pool');
const {requireAuth}=require('../middleware/auth');
router.get('/achievements',requireAuth,async(req,res,next)=>{try{const q=await pool.query('SELECT a.code,a.title,a.description,a.icon,ua.earned_at FROM achievements a LEFT JOIN user_achievements ua ON ua.achievement_code=a.code AND ua.user_id=$1 ORDER BY ua.earned_at NULLS LAST,a.title',[req.user.id]);res.json({achievements:q.rows});}catch(e){next(e)}});
module.exports=router;
