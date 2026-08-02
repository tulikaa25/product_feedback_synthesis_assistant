const express = require('express');
const multer = require('multer');
const path = require('path');
const themesController = require('../controllers/themes.controller');

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '../../uploads') });

// Ingestion
router.post('/upload-csv', upload.single('file'), themesController.uploadCSV);
router.post('/upload/abort', themesController.abortIngestion);

// Active Themes CRUD & Actions
router.get('/themes', themesController.getAllThemes);
router.put('/themes/:id', themesController.renameTheme);
router.post('/themes/:id/status', themesController.updateThemeStatus);
router.post('/themes/merge', themesController.mergeThemes);
router.post('/themes/:id/split', themesController.splitTheme);
router.delete('/themes', themesController.clearAllThemes);

// Report Generation
router.get('/report', themesController.generateReport);

// Database Seeding
router.get('/seed', themesController.seedDatabase);

module.exports = router;
