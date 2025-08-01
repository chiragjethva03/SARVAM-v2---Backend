const jwt = require("jsonwebtoken");

export const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) return res.status(401).json({ message: 'No token' });

  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // decoded should include user id
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
