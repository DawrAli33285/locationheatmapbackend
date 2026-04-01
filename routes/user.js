const router=require('express').Router();
const {userRegister,userLogin,resetPassword}=require('../controller/user');
const { middleware } = require('../middleware/middleware');

router.post('/register',userRegister)
router.post('/login',userLogin)
router.post('/userresetPassword',resetPassword)

module.exports=router;