const multer=require('multer')
const upload = multer({ storage: multer.memoryStorage() });
 const {parseExcel}=require('../controller/file')
const router=require('express').Router();

router.post('/parse-excel',upload.single('file'),parseExcel)

module.exports=router;