const express=require('express')
const cors=require('cors')
const app=express();
const userRoutes=require('./routes/user')
const connection=require('./connection/connection')
const fileRoutes=require('./routes/file')
require('dotenv').config();

app.use(express.json())
app.use(cors())


connection
app.use('/api',userRoutes)
app.use('/api',fileRoutes)

app.listen(process.env.PORT,()=>{
    console.log(`Listening to port ${process.env.PORT}`)
})
