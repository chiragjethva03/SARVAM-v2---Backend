const multer = require("multer");

// Store files temporarily in memory
const storage = multer.memoryStorage();

const upload = multer({ storage });

module.exports = upload;
