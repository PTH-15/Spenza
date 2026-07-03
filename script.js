const express = require('express')
const app = express()
const path = require('path')
const mongoose = require('mongoose')
require("dotenv").config()
mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Error:", err));
const User = require("./models/user")
const Expenses = require("./models/expenses")
const { register } = require('module')
const { error } = require('console')
const bcrypt = require('bcrypt')
const { hash } = require('crypto')
const session = require("express-session")

app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public')))
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie:{
        secure :false
    }
}))
function isLoggedIn(req, res, next) {

    // console.log("Session in middleware:", req.session); addded for debugging

    if (!req.session.userId) {
        return res.redirect("/login");
    }

    next();
}

function getWeeklyData(transactions) {
  const days = [0,0,0,0,0,0,0];
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  startOfWeek.setHours(0,0,0,0);

  transactions.forEach(t => {
    if (t.type !== 'expense') return;
    const d = new Date(t.date);
    if (d >= startOfWeek) {
      const dayIndex = (d.getDay() + 6) % 7;
      days[dayIndex] += t.amount;
    }
  });
  return days;
}

function getMonthlyData(transactions) {
  const months = Array(12).fill(0);
  const year = new Date().getFullYear();
  transactions.forEach(t => {
    if (t.type !== 'expense') return;
    const d = new Date(t.date);
    if (d.getFullYear() === year) {
      months[d.getMonth()] += t.amount;
    }
  });
  return months;
}

function getCategoryBreakdown(transactions) {
  const map = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    map[t.category] = (map[t.category] || 0) + t.amount;
  });
  return Object.entries(map)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a,b) => b.amount - a.amount);
}
function categoryEmoji(category) {
    switch (category) {
        case "Food":
            return "🍕";
        case "Travel":
            return "🚗";
        case "Shopping":
            return "🛍️";
        case "Bills":
            return "💡";
        case "Entertainment":
            return "🎮";
        case "Salary":
            return "💰";
        default:
            return "💸";
    }
}
app.get('/', (req, res) => {
    res.render('home')
})
app.get("/login", (req, res) => {
    res.render('login')
})
app.post("/login", async (req, res) => {
    let { email, password } = req.body
    let user = await User.findOne({ email })
    if (!user) {
        return res.send("User Not Found...")
    }
    bcrypt.compare(password, user.password, (err, result) => {
        if (result) {
            req.session.userId = user._id
            
            // console.log(req.session);
            res.redirect('/transaction')
        }
        else {
            res.send("Incorrect Password")
        }
    })
    
})
app.get("/register", (req, res) => {
    res.render('register')
})
app.post("/register", async (req, res) => {

    const { name, email, password, confirmPassword } = req.body
    if (password !== confirmPassword) {
        return res.render("register", { error: "Password ain't matching ngga" });
    }
    const existingUser = await User.findOne({ email })
    if (existingUser) {
        return res.render("register", { error: "Email Already Exists!!!" })
    }
    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {

            const newUser = await User.create({
                name,
                email,
                password: hash
            })
            console.log(newUser)
            res.redirect("/login")
        })
    })


});
app.get("/forgot-password", async (req, res) => {
    res.render("forgotpass")
})
app.post("/forgot-password/send-otp", async (req, res) => {
    const email = req.body.email
    const user = await User.findOne({ email })
    if (!user) {
        return res.json({
            success: false,
            message: "Enter a registered email"
        })
    }
    user.otp = 123456;
    await user.save();

    res.json({
        success: true,
        message: "OTP sent"
});
})
app.post("/forgot-password/verify-otp", async (req, res) => {
    const { otp, email } = req.body
    const user = await User.findOne({ email })
    if (!user) {
        return res.json({
            success: false,
            message: "User Not Found"
        })
    }

    if (user.otp != otp) {
        return res.json({
            success: false,
            message: "Otp ain't Verified"
        })
    }
    res.json({
        success: true,
        message: "Otp Verified"
    })
})
app.post("/forgot-password/reset", async (req, res) => {
    const { email, password, confirmPassword } = req.body
    if (password !== confirmPassword) {
        return res.json({
            success: false,
            message: "Password Dont match.."
        })
    }

    const user = await User.findOne({ email })

    if (!user) {
        return res.json({
            success: false,
            message: "User Not Found"
        })
    }

    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {
            user.password = hash
            user.otp = null
            await user.save()
            res.redirect("/login")
        })
    })
})

app.get('/users', async (req, res) => {
    const users = await User.find()
    res.send(users)
})
app.get("/user/:email", async (req, res) => {
    const user = await User.findOne({ email: req.params.email })
    res.send(user)
})
app.get("/update/:email", async (req, res) => {
    const Updated = await User.findOneAndUpdate({ email: req.params.email }, { name: req.body.name }, { returnDocument: "after" })
    res.send(Updated)
})
app.get("/delete/:email", async (req, res) => {
    const deleteuser = await User.findOneAndDelete({ email: req.params.email })
    res.send(deleteuser)
})
app.get("/transaction", isLoggedIn, async (req, res) => {
    // console.log("Session:", req.session);
    // console.log(req.query)
    let query = {
    user: req.session.userId
    }
    if (req.query.type) {
        query.type = req.query.type
    }
    if (req.query.category) {
        query.category = req.query.category
    }
    if (req.query.paymentMethod){ 
        query.paymentMethod = req.query.paymentMethod;
    }
    if (req.query.search) {
        query.title = {
            $regex: req.query.search,
            $options: "i"
        }
    }
    let transaction = Expenses.find(query)
    if (req.query.sort === "newest") {
        transaction = transaction.sort({ date: -1 });
    }

    if (req.query.sort === "oldest") {
        transaction = transaction.sort({ date: 1 });
    }

    if (req.query.sort === "amount-high") {
        transaction = transaction.sort({ amount: -1 });
    }

    if (req.query.sort === "amount-low") {
        transaction = transaction.sort({ amount: 1 });
    }
    if (req.query.paymentMethod) {
    query.paymentMethod = req.query.paymentMethod;
    }
    transaction = await transaction
    const income = transaction.filter(val => val.type === "income")
    const totalIncome = income.reduce((sum, val) => { return sum + val.amount }, 0)
    const expense = transaction.filter(val => val.type === "expense")
    const totalExpense = expense.reduce((sum, val) => { return sum + val.amount }, 0)
    const netSaving = totalIncome - totalExpense
    res.render("transaction", {
        transaction,
        categoryVal: req.query.category,
        typeVal: req.query.type,
        sortVal: req.query.sort,
        searchVal: req.query.search,
        totalIncome,
        totalExpense,
        paymentMethodVal: req.query.paymentMethod

    })
})

app.get("/transaction/add", isLoggedIn, (req, res) => {
    res.render("add-transaction", { error: null, old: null })
})
app.post("/transaction/add", isLoggedIn, async (req, res) => {
    const { title, amount, category, type, date, paymentMethod } = req.body;

    // if (!title || !amount || !category || !type || !date || !paymentMethod) {
    //     return res.render("add-transaction", {
    //         error: "All fields are required.",
    //         old: req.body
    //     });
    // }

    await Expenses.create({ ...req.body, user: req.session.userId });
    res.redirect("/transaction");
});
app.get("/transaction/edit/:id", isLoggedIn, async (req, res) => {
    const transaction = await Expenses.findOne({
        _id: req.params.id,
        user: req.session.userId
    });
    if (!transaction) return res.redirect("/transaction");
    res.render("edit-transaction", { transaction });
});

app.post("/transaction/edit/:id", isLoggedIn, async (req, res) => {
    await Expenses.findOneAndUpdate(
        { _id: req.params.id, user: req.session.userId },
        req.body
    );
    res.redirect("/transaction");
});

app.post("/transaction/delete/:id", isLoggedIn, async (req, res) => {
    await Expenses.findOneAndDelete({
        _id: req.params.id,
        user: req.session.userId
    });
    res.redirect("/transaction");
});

app.get("/home", isLoggedIn, async (req, res) => {
    const user = await User.findById(req.session.userId);
    const transaction = await Expenses.find({
        user: req.session.userId
    });

    const now = new Date();
    const thisMonth = transaction.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
    const income = transaction.filter(val => val.type === "income");
    const totalIncome = income.reduce((sum, val) => sum + val.amount, 0);

    const expense = transaction.filter(val => val.type === "expense");
    const totalExpense = expense.reduce((sum, val) => sum + val.amount, 0);
    const monthlyBudget = totalIncome 
    const remainingBudget = monthlyBudget - totalExpense
    const netSaving = totalIncome - totalExpense;
    const budgetUsedPct   = monthlyBudget > 0 
    ? Math.round((totalExpense / monthlyBudget) * 100) 
    : 0;

    const recentTransactions = await Expenses.find({
        user: req.session.userId
    })
    .sort({ date: -1 })
    .limit(5);

    res.render("home", {
        user,
        totalIncome,
        totalExpense,
        netSaving,
        remainingBudget,
        monthlyBudget,
        recentTransactions: [...transaction]
      .sort((a,b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5),
        budgetUsedPct
    });

});
app.get("/dashboard", isLoggedIn, async (req, res) => {
    const user = await User.findById(req.session.userId);
    const transaction = await Expenses.find({
        user: req.session.userId
    });
    const now = new Date();
    const thisMonth = transaction.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const income = transaction.filter(val => val.type === "income");
    const totalIncome = income.reduce((sum, val) => sum + val.amount, 0);

    const expense = transaction.filter(val => val.type === "expense");
    const totalExpense = expense.reduce((sum, val) => sum + val.amount, 0);
    const monthlyBudget = totalIncome 
    const remainingBudget = monthlyBudget - totalExpense
    const netSaving = totalIncome - totalExpense;

    const recentTransactions = await Expenses.find({
        user: req.session.userId
    })
    .sort({ date: -1 })
    .limit(5);
    const budgetUsedPct   = monthlyBudget > 0   // 👈 this was missing
    ? Math.round((totalExpense / monthlyBudget) * 100)
    : 0;

    res.render('dashboard', {
    user,
    totalIncome,
    totalExpense,
    remainingBudget,
    monthlyBudget,
    budgetUsedPct,
    recentTransactions: [...transaction].sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0,6),
    topExpenses: [...transaction].filter(t=>t.type==='expense').sort((a,b)=>b.amount-a.amount).slice(0,5),
    categoryBreakdown: getCategoryBreakdown(thisMonth),  
    weeklyData:  getWeeklyData(transaction),            
    monthlyData: getMonthlyData(transaction),            
    weeklyIncome:  [0,0,0,0,0,0,0],
    monthlyIncome: Array(12).fill(0), 
});


});

app.get("/profile", isLoggedIn, async (req, res) => {
    const user = await User.findById(req.session.userId);
    const monthlyBudget = user.monthlyBudget
    const transaction = await Expenses.find({user: req.session.userId});
    const totalIncome = transaction
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transaction
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + t.amount, 0);

    const netSavings = totalIncome - totalExpense;
    const txCount = transaction.length;


    res.render("profile", {
        user,
        totalIncome,
        txCount,
        totalExpense,
        netSavings,
        monthlyBudget
    });
 })


app.post("/profile/update",isLoggedIn,async (req,res)=>{
    const { name, email} = req.body;
    await User.findByIdAndUpdate(req.session.userId , { name, email }, { returnDocument: "after" })
    res.redirect("/profile")
})

app.post("/profile/budget",isLoggedIn, async (req,res)=>{
    const monthlyBudget = Number(req.body.monthlyBudget);
    await User.findByIdAndUpdate(
    req.session.userId, { monthlyBudget }, { new: true });
    res.redirect("/profile")
})

app.post("/profile/change-password",isLoggedIn,async (req,res)=>{
    
})
app.get('/logout', isLoggedIn, (req, res) => {
  res.render('logout');
});
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.log(err);
    res.redirect('/login');
  });
});
app.get("/reports", isLoggedIn, async (req, res) => {
   
    const user = await User.findById(req.session.userId);
    const transaction = await Expenses.find({
        user: req.session.userId
    });
    const income = transaction.filter(val => val.type === "income");
    const totalIncome = income.reduce((sum, val) => sum + val.amount, 0);

    const expense = transaction.filter(val => val.type === "expense");
    const totalExpense = expense.reduce((sum, val) => sum + val.amount, 0);
    
    const monthlyData = {};
    transaction.forEach(t => {
        const month = new Date(t.date).toLocaleString("default", {
            month: "short"
        });
        monthlyData[month] = (monthlyData[month] || 0) + t.amount;
    });

    const categoryData = {};
    transaction.forEach(t => {
        if (t.type === "expense") {
            categoryData[t.category] =
                (categoryData[t.category] || 0) + t.amount;
        }
    });
 
    res.render("reports", {
        user,
        transaction,
        totalIncome,
        totalExpense,
        monthlyData,
        categoryData
    });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});