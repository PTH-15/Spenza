const mongoose = require('mongoose')


const Expenses = mongoose.Schema({
    title:{type :String,required:true},
    category:{type :String,required:true},
    description:{type :String},
    amount:{type :Number,required:true},
    date:{type :Date,required:true},
    type:{type :String,required:true},
    user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true},
    paymentMethod: {
    type: String,
    required: true}
})


module.exports = mongoose.model("Expense",Expenses)
