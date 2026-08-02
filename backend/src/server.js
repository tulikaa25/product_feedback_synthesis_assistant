const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const app = require('./app');
const logger = require('./logger');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  logger.info('SERVER', `Feedback Synthesis Backend listening on port ${PORT}`);
});
