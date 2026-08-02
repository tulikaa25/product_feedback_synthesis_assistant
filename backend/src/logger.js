const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function writeLog(level, category, message, meta = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    ...meta
  };

  const logString = JSON.stringify(logEntry) + '\n';
  
  // Write to console
  if (level === 'ERROR') {
    console.error(`[${logEntry.timestamp}] [${level}] [${category}] ${message}`, meta);
  } else {
    console.log(`[${logEntry.timestamp}] [${level}] [${category}] ${message}`);
  }

  // Append to log file
  fs.appendFile(LOG_FILE, logString, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });
}

const logger = {
  info: (category, message, meta) => writeLog('INFO', category, message, meta),
  warn: (category, message, meta) => writeLog('WARN', category, message, meta),
  error: (category, message, meta) => writeLog('ERROR', category, message, meta),
  audit: (category, message, meta) => writeLog('AUDIT', category, message, meta)
};

module.exports = logger;
