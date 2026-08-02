const express = require('express');
const cors = require('cors');
const themesRoutes = require('./routes/themes.routes');
const logger = require('./logger');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Log incoming API requests
app.use((req, res, next) => {
  logger.info('HTTP_API', `${req.method} ${req.originalUrl}`, { ip: req.ip });
  next();
});

// API Routes
app.use('/api', themesRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error('HTTP_API', 'Unhandle Exception caught in Express app', { 
    error: err.message, 
    stack: err.stack 
  });
  return res.status(500).json({ message: "An unexpected server error occurred." });
});

module.exports = app;
