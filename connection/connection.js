const mongoose=require('mongoose')

const connect=mongoose.connect('mongodb+srv://dawarali:dawarali@cluster0.ijo1mym.mongodb.net')

// const connect=mongoose.connect('mongodb://127.0.0.1/locationheatmap')

module.exports=connect