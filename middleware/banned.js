module.exports=(req,res,next)=>{if(req.user&&req.user.is_banned)return res.status(403).json({error:'حساب شما مسدود است.'});next();};
