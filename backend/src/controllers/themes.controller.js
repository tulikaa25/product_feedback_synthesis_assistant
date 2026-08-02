const fs = require('fs');
const logger = require('../logger');
const themesService = require('../services/themes.service');
const aiService = require('../services/ai.service');

const themesController = {
  // POST /api/upload-csv
  uploadCSV: async (req, res) => {
    const file = req.file;
    if (!file) {
      logger.warn('CONTROLLER', 'Upload CSV called with no file');
      return res.status(400).json({ message: "No CSV file provided." });
    }

    try {
      const { themes, citations, filename } = await themesService.ingestCSV(file.path, file.originalname);
      return res.json({ themes, citations, filename });
    } catch (error) {
      logger.error('CONTROLLER', 'CSV Upload failed', { error: error.message });
      return res.status(400).json({ message: error.message || "Failed to process CSV file." });
    } finally {
      // Ensure file cleanup
      if (file && file.path && fs.existsSync(file.path)) {
        fs.unlink(file.path, () => {});
      }
    }
  },

  // GET /api/themes
  getAllThemes: async (req, res) => {
    try {
      const result = await themesService.getThemesAndCitations();
      return res.json(result);
    } catch (error) {
      logger.error('CONTROLLER', 'Failed to retrieve themes', { error: error.message });
      return res.status(500).json({ message: "Database read error." });
    }
  },

  // PUT /api/themes/:id
  renameTheme: async (req, res) => {
    const { id } = req.params;
    const { title, problem_statement } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Theme title is required." });
    }

    try {
      const updated = await themesService.renameTheme(id, title, problem_statement);
      return res.json(updated);
    } catch (error) {
      logger.error('CONTROLLER', 'Rename theme failed', { error: error.message });
      return res.status(500).json({ message: "Failed to update theme details." });
    }
  },

  // POST /api/themes/:id/status
  updateThemeStatus: async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: "Invalid status value. Must be PENDING, APPROVED, or REJECTED." });
    }

    try {
      const updated = await themesService.updateStatus(id, status);
      return res.json(updated);
    } catch (error) {
      logger.error('CONTROLLER', 'Status update failed', { error: error.message });
      return res.status(500).json({ message: "Failed to update status." });
    }
  },

  // POST /api/themes/merge
  mergeThemes: async (req, res) => {
    const { sourceId, targetId } = req.body;

    if (!sourceId || !targetId) {
      return res.status(400).json({ message: "Source and target IDs are required." });
    }

    try {
      const merged = await themesService.mergeThemes(sourceId, targetId);
      return res.json(merged);
    } catch (error) {
      logger.error('CONTROLLER', 'Merge themes failed', { error: error.message });
      return res.status(500).json({ message: error.message || "Failed to merge themes." });
    }
  },

  // POST /api/themes/:id/split
  splitTheme: async (req, res) => {
    const { id } = req.params;
    const { splitRowIds, title, problem_statement } = req.body;

    if (!splitRowIds || splitRowIds.length === 0) {
      return res.status(400).json({ message: "No feedback rows selected to split." });
    }

    try {
      const result = await themesService.splitTheme(id, splitRowIds, title, problem_statement);
      return res.json(result);
    } catch (error) {
      logger.error('CONTROLLER', 'Split theme failed', { error: error.message });
      return res.status(500).json({ message: error.message || "Failed to split theme." });
    }
  },

  // GET /api/report
  generateReport: async (req, res) => {
    try {
      const reportText = await themesService.compileReport();
      res.setHeader('Content-Type', 'text/plain');
      return res.send(reportText);
    } catch (error) {
      logger.error('CONTROLLER', 'Report compilation failed', { error: error.message });
      return res.status(500).send(error.message || "Report compiler failed.");
    }
  },

  // GET /api/seed
  seedDatabase: async (req, res) => {
    try {
      const seed = require('../seed');
      await seed();
      return res.json({ message: "Database pre-populated successfully with mock themes & notes." });
    } catch (error) {
      logger.error('CONTROLLER', 'Seed trigger failed', { error: error.message });
      return res.status(500).json({ message: "Seed script failed." });
    }
  },

  // DELETE /api/themes
  clearAllThemes: async (req, res) => {
    try {
      const result = await themesService.clearAll();
      return res.json(result);
    } catch (error) {
      logger.error('CONTROLLER', 'Clear all active themes failed', { error: error.message });
      return res.status(500).json({ message: "Failed to clear themes." });
    }
  }
};

module.exports = themesController;
