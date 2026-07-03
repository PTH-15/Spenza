const mongoose = require('mongoose')



const User = mongoose.Schema({
    name:{type :String,required:true},
    email:{type :String,required:true},
    password:{type :String,required:true},
    otp:{type:Number,default:null},
    monthlyBudget: {type: Number,default: 0}
})


module.exports = mongoose.model("User",User)
