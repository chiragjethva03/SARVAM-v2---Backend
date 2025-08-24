const dotenv = require("dotenv");
dotenv.config(); // Load env first!

const Express = require("express");
const cors = require("cors");
const connectDB = require("./database/connection");


const app = Express();

// Middlewares
app.use(Express.json());
app.use(cors());

// Connect DB
connectDB();

// --- Authentication routes --- //
const authRoutes = require("./routes/auth.js");
app.use("/", authRoutes);

// --- Post routes --- // 
const postRoutes = require("./routes/post.js");
app.use("/", postRoutes);

// --- USER routes --- //
const userRoutes = require("./routes/user.js");
app.use("/user", userRoutes);

// --- ROOT ENDPOINT --- //
app.get("/", (req, res) => {
  return res.send("requested accepted.!");
});


app.use("*", (req, res) => {
  res.send("page not found");
})

app.listen(3000, () => {
  console.log("server start at port 3000 number");
});
