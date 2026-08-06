const { spawn } = require('child_process');
const path = require('path');
const prisma = require('../db');
const logger = require('../logger');

let activePythonProcess = null;

const aiService = {
  // Spawn Python HDBSCAN engine and parse output JSON
  runClusteringEngine: (payload) => {
    return new Promise((resolve, reject) => {
      if (activePythonProcess) {
        try {
          activePythonProcess.kill('SIGTERM');
        } catch (e) {}
      }
      
      logger.info('AI_SERVICE', 'Spawning Python HDBSCAN engine...');
      const pythonScript = path.join(__dirname, '../../python_engine/cluster.py');
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
      const pythonProcess = spawn(pythonCmd, [pythonScript]);
      activePythonProcess = pythonProcess;

      pythonProcess.on('error', (err) => {
        activePythonProcess = null;
        logger.error('AI_SERVICE', `Failed to spawn Python process: ${pythonCmd}`, { error: err.message });
        reject(new Error(`Failed to spawn Python clustering engine: ${err.message}`));
      });

      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      pythonProcess.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderrData += text;
        logger.info('AI_SERVICE_STDERR', text.trim());
      });

      pythonProcess.stdin.write(JSON.stringify(payload));
      pythonProcess.stdin.end();

      pythonProcess.on('close', (code) => {
        activePythonProcess = null;
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
      const historyMatches = await prisma.$queryRaw`
        SELECT id, title, (embedding::vector <=> ${vectorStr}::vector) as distance
        FROM "HistoricalTheme"
        WHERE (embedding::vector <=> ${vectorStr}::vector) < 0.35
        ORDER BY embedding::vector <=> ${vectorStr}::vector;
      `;
      
      if (historyMatches && historyMatches.length > 0) {
        historyMatches.forEach(m => {
          matched_historical_theme_ids.push(m.id);
        });
      }

      // Query Product Release Notes using native pgvector cosine distance operator <=>
      const noteMatches = await prisma.$queryRaw`
        SELECT id, title, (embedding::vector <=> ${vectorStr}::vector) as distance
        FROM "ProductNote"
        WHERE (embedding::vector <=> ${vectorStr}::vector) < 0.35
        ORDER BY embedding::vector <=> ${vectorStr}::vector;
      `;

      if (noteMatches && noteMatches.length > 0) {
        noteMatches.forEach(m => {
          matched_product_note_ids.push(m.id);
        });
      }
    } catch (err) {
      logger.error('AI_SERVICE', 'Database vector search query failed', { error: err.message });
    }

    return { 
      matched_historical_theme_ids: JSON.stringify(matched_historical_theme_ids), 
      matched_product_note_ids: JSON.stringify(matched_product_note_ids) 
    };
  },

  // Terminate any running Python process
  abortActiveEngine: () => {
    if (activePythonProcess) {
      try {
        activePythonProcess.kill('SIGKILL');
        activePythonProcess = null;
        logger.warn('AI_SERVICE', 'Active Python clustering engine was manually aborted.');
        return true;
      } catch (e) {
        logger.error('AI_SERVICE', 'Failed to abort Python process', { error: e.message });
      }
    }
    return false;
  }
};

module.exports = aiService;
