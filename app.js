const Express = require("express");
const dotenv = require("dotenv");
require('dotenv').config();
const connectDB = require("./database/connection")

const app = Express();
connectDB();

app.get("/", (req, res) => {
    res.send("requested accepted.!");
}) 

app.listen(3000, () => {
        console.log("server start at port number");
    }
)

