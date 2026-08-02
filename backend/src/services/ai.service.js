const { spawn } = require('child_process');
const path = require('path');
const prisma = require('../db');
const logger = require('../logger');

const aiService = {
  // Spawn Python HDBSCAN engine and parse output JSON
  runClusteringEngine: (payload) => {
    return new Promise((resolve, reject) => {
      logger.info('AI_SERVICE', 'Spawning Python HDBSCAN engine...');
      const pythonScript = path.join(__dirname, '../../python_engine/cluster.py');
      const pythonProcess = spawn('python', [pythonScript]);

      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      pythonProcess.stderr.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      pythonProcess.stdin.write(JSON.stringify(payload));
      pythonProcess.stdin.end();

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          logger.error('AI_SERVICE', `Python engine exited with code ${code}`, { stderr: stderrData });
          return reject(new Error("Python clustering process failed. Check engine logs."));
        }

        try {
          const results = JSON.parse(stdoutData);
          return resolve(results);
        } catch (err) {
          logger.error('AI_SERVICE', 'Failed to parse clustering results JSON', { error: err.message, stdout: stdoutData });
          return reject(new Error("Failed to parse AI output."));
        }
      });
    });
  },

  // Calculate best matches against database themes and release notes using pgvector <=> operator
  findBestMatches: async (centroid) => {
    if (!centroid || centroid.length !== 768) {
      return { matched_historical_theme_ids: JSON.stringify([]), matched_product_note_ids: JSON.stringify([]) };
    }

    const matched_historical_theme_ids = [];
    const matched_product_note_ids = [];

    try {
      const vectorStr = `[${centroid.join(',')}]`;
      
      // Query Historical Themes using native pgvector cosine distance operator <=>
      // Cosine distance = 1 - cosine similarity. So distance < 0.35 matches similarity > 0.65.
      const historyMatches = await prisma.$queryRaw`
        SELECT id, title, (embedding <=> ${vectorStr}::vector) as distance
        FROM "HistoricalTheme"
        WHERE (embedding <=> ${vectorStr}::vector) < 0.35
        ORDER BY embedding <=> ${vectorStr}::vector;
      `;
      
      if (historyMatches && historyMatches.length > 0) {
        historyMatches.forEach(m => {
          matched_historical_theme_ids.push(m.id);
        });
      }

      // Query Product Release Notes using native pgvector cosine distance operator <=>
      const noteMatches = await prisma.$queryRaw`
        SELECT id, title, (embedding <=> ${vectorStr}::vector) as distance
        FROM "ProductNote"
        WHERE (embedding <=> ${vectorStr}::vector) < 0.35
        ORDER BY embedding <=> ${vectorStr}::vector;
      `;

      if (noteMatches && noteMatches.length > 0) {
        noteMatches.forEach(m => {
          matched_product_note_ids.push(m.id);
        });
      }
    } catch (err) {
      logger.error('AI_SERVICE', 'Native pgvector database query failed', { error: err.message });
    }

    return { 
      matched_historical_theme_ids: JSON.stringify(matched_historical_theme_ids), 
      matched_product_note_ids: JSON.stringify(matched_product_note_ids) 
    };
  }
};

module.exports = aiService;
