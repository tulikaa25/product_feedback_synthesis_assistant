const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'error' },
    { emit: 'stdout', level: 'info' },
    { emit: 'stdout', level: 'warn' }
  ]
});

const logger = require('./logger');

// Log Prisma queries using our structured logger
prisma.$on('query', (e) => {
  logger.info('DATABASE', `Query: ${e.query}`, { durationMs: e.duration, params: e.params });
});

module.exports = prisma;
