const { parse } = require('csv-parse');
const fs = require('fs');
const prisma = require('../db');
const logger = require('../logger');
const aiService = require('./ai.service');

// Helper: Deterministic calculation of statistics in Javascript
function calculateStats(rowIds, rawFeedbackRows) {
  const filtered = rawFeedbackRows.filter(row => rowIds.includes(row.row_id));
  const total_count = filtered.length;

  const source_distribution = {};
  const user_type_distribution = {};
  const frequency = {};

  filtered.forEach(row => {
    // Source Split
    if (row.source) {
      source_distribution[row.source] = (source_distribution[row.source] || 0) + 1;
    }
    
    // User Type Split
    if (row.user_type) {
      user_type_distribution[row.user_type] = (user_type_distribution[row.user_type] || 0) + 1;
    }

    // Monthly bucket frequency
    const date = new Date(row.date);
    if (!isNaN(date.getTime())) {
      const monthLabel = date.toLocaleString('en-US', { month: 'long', year: 'numeric' }); // "June 2026"
      frequency[monthLabel] = (frequency[monthLabel] || 0) + 1;
    }
  });

  return { total_count, source_distribution, user_type_distribution, frequency };
}

const themesService = {
  // Ingest uploaded CSV file
  ingestCSV: (filePath, originalName) => {
    return new Promise((resolve, reject) => {
      const rawRows = [];

      fs.createReadStream(filePath)
        .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
        .on('data', (row) => {
          rawRows.push(row);
        })
        .on('end', async () => {
          if (rawRows.length === 0) {
            return reject(new Error("The CSV file is empty."));
          }

          // Normalize row keys to allow both space and underscore separators (e.g. feedback_text vs feedback text)
          const normalizedRows = rawRows.map(row => {
            const normalized = {};
            for (const [key, value] of Object.entries(row)) {
              const normKey = key.trim().toLowerCase().replace(/[\s\-_]+/g, '_');
              normalized[normKey] = value;
            }
            return normalized;
          });

          // Header Validation
          const sample = normalizedRows[0];
          const requiredKeys = ['feedback_text', 'source', 'user_type', 'product_area', 'date'];
          const missing = requiredKeys.filter(k => !(k in sample));
          if (missing.length > 0) {
            const friendlyNames = missing.map(k => k.replace(/_/g, ' '));
            return reject(new Error(`Missing required CSV column headers: ${friendlyNames.join(', ')}`));
          }

          try {
            // Delete previous runs to ensure clean data state
            await prisma.activeTheme.deleteMany();
            await prisma.rawFeedback.deleteMany();

            const feedbackRowsToCreate = normalizedRows.map((row, idx) => {
              let parsedDate = new Date(row.date);
              if (isNaN(parsedDate.getTime())) {
                parsedDate = new Date();
              }

              let rowId = idx;
              if (row.row_id !== undefined && row.row_id !== '') {
                const parsed = parseInt(row.row_id, 10);
                if (!isNaN(parsed)) rowId = parsed;
              }

              return {
                row_id: rowId,
                feedback_text: row.feedback_text,
                source: row.source,
                user_type: row.user_type,
                product_area: row.product_area,
                date: parsedDate,
                rating: row.rating !== undefined && row.rating !== '' ? parseInt(row.rating, 10) : 
                        (row.optional_rating !== undefined && row.optional_rating !== '' ? parseInt(row.optional_rating, 10) : null)
              };
            });

            await prisma.rawFeedback.createMany({ data: feedbackRowsToCreate });
            logger.info('THEMES_SERVICE', `Saved ${feedbackRowsToCreate.length} feedback items to DB.`);

            const historicalThemes = await prisma.historicalTheme.findMany();
            const productNotes = await prisma.productNote.findMany();

            const historyMap = new Map(historicalThemes.map(h => [h.id, { title: h.title, desc: h.problem_statement }]));
            const noteMap = new Map(productNotes.map(n => [n.id, { title: `v${n.version} (${n.title})`, desc: n.description, date: n.release_date, type: n.note_type }]));

            const inputPayload = {
              feedback_items: feedbackRowsToCreate.map(r => ({
                row_id: r.row_id,
                feedback_text: r.feedback_text,
                product_area: r.product_area
              })),
              historical_themes: historicalThemes.map(h => ({
                id: h.id,
                title: h.title,
                problem_statement: h.problem_statement,
                embedding: JSON.parse(h.embedding)
              })),
              product_notes: productNotes.map(p => ({
                id: p.id,
                title: p.title,
                description: p.description,
                embedding: JSON.parse(p.embedding)
              })),
              gemini_api_key: process.env.GEMINI_API_KEY
            };

            // Call Python AI Clustering Service
            const results = await aiService.runClusteringEngine(inputPayload);
            const activeThemesToSave = results.themes || [];

            for (const theme of activeThemesToSave) {
              await prisma.activeTheme.create({
                data: {
                  title: theme.title,
                  problem_statement: theme.problem_statement,
                  primary_product_area: theme.primary_product_area,
                  status: "PENDING",
                  supporting_row_ids: JSON.stringify(theme.supporting_row_ids),
                  is_pattern: theme.is_pattern,
                  matched_historical_theme_ids: JSON.stringify(theme.matched_historical_theme_ids || []),
                  matched_product_note_ids: JSON.stringify(theme.matched_product_note_ids || []),
                  embedding: JSON.stringify(theme.embedding)
                }
              });
            }

            logger.info('THEMES_SERVICE', `Seeded ${activeThemesToSave.length} active themes from clustering run.`);

            const allActiveThemes = await prisma.activeTheme.findMany();
            const allCitations = {};
            feedbackRowsToCreate.forEach(row => {
              allCitations[row.row_id] = {
                text: row.feedback_text,
                source: row.source,
                user_type: row.user_type
              };
            });

            // Map and calculate statistics
            const parsedThemes = allActiveThemes.map(t => {
              const ids = JSON.parse(t.supporting_row_ids);
              const stats = calculateStats(ids, feedbackRowsToCreate);

              const matchedHistIds = JSON.parse(t.matched_historical_theme_ids || '[]');
              const matchedHistThemes = matchedHistIds.map(hId => {
                const h = historyMap.get(hId);
                return h ? { id: hId, title: h.title, problem_statement: h.desc } : null;
              }).filter(Boolean);

              const matchedNoteIds = JSON.parse(t.matched_product_note_ids || '[]');
              const matchedNoteThemes = matchedNoteIds.map(nId => {
                const n = noteMap.get(nId);
                return n ? { id: nId, title: n.title, description: n.desc, date: n.date, type: n.type } : null;
              }).filter(Boolean);

              return {
                id: t.id,
                title: t.title,
                problem_statement: t.problem_statement,
                primary_product_area: t.primary_product_area,
                status: t.status,
                supporting_row_ids: ids,
                is_pattern: t.is_pattern,
                matched_historical_themes: matchedHistThemes,
                matched_product_notes: matchedNoteThemes,
                ...stats
              };
            });

            await prisma.auditLog.create({
              data: {
                action: "UPLOAD",
                details: JSON.stringify({ filename: originalName, count: feedbackRowsToCreate.length })
              }
            });

            return resolve({ themes: parsedThemes, citations: allCitations, filename: originalName });

          } catch (error) {
            return reject(error);
          }
        })
        .on('error', (err) => {
          return reject(err);
        });
    });
  },

  // Get all active themes and citations lists
  getThemesAndCitations: async () => {
    const rawFeedback = await prisma.rawFeedback.findMany();
    const activeThemes = await prisma.activeTheme.findMany();
    const historicalThemes = await prisma.historicalTheme.findMany();
    const productNotes = await prisma.productNote.findMany();

    const historyMap = new Map(historicalThemes.map(h => [h.id, { title: h.title, desc: h.problem_statement }]));
    const noteMap = new Map(productNotes.map(n => [n.id, { title: `v${n.version} (${n.title})`, desc: n.description, date: n.release_date, type: n.note_type }]));

    const citations = {};
    rawFeedback.forEach(row => {
      citations[row.row_id] = {
        text: row.feedback_text,
        source: row.source,
        user_type: row.user_type
      };
    });

    const parsedThemes = activeThemes.map(t => {
      const ids = JSON.parse(t.supporting_row_ids);
      const stats = calculateStats(ids, rawFeedback);

      const matchedHistIds = JSON.parse(t.matched_historical_theme_ids || '[]');
      const matchedHistThemes = matchedHistIds.map(hId => {
        const h = historyMap.get(hId);
        return h ? { id: hId, title: h.title, problem_statement: h.desc } : null;
      }).filter(Boolean);

      const matchedNoteIds = JSON.parse(t.matched_product_note_ids || '[]');
      const matchedNoteThemes = matchedNoteIds.map(nId => {
        const n = noteMap.get(nId);
        return n ? { id: nId, title: n.title, description: n.desc, date: n.date, type: n.type } : null;
      }).filter(Boolean);

      return {
        id: t.id,
        title: t.title,
        problem_statement: t.problem_statement,
        primary_product_area: t.primary_product_area,
        status: t.status,
        supporting_row_ids: ids,
        is_pattern: t.is_pattern,
        matched_historical_themes: matchedHistThemes,
        matched_product_notes: matchedNoteThemes,
        ...stats
      };
    });

    const latestUpload = await prisma.auditLog.findFirst({
      where: { action: "UPLOAD" },
      orderBy: { created_at: "desc" }
    });
    const filename = latestUpload ? JSON.parse(latestUpload.details).filename : null;

    return { themes: parsedThemes, citations, filename };
  },

  // Rename theme title and problem statement
  renameTheme: async (id, title, problem_statement) => {
    const updated = await prisma.activeTheme.update({
      where: { id },
      data: { title, problem_statement }
    });

    await prisma.auditLog.create({
      data: {
        action: "RENAME",
        details: JSON.stringify({ id, title })
      }
    });

    return updated;
  },

  // Update theme status (Approve / Discard)
  updateStatus: async (id, status) => {
    const updated = await prisma.activeTheme.update({
      where: { id },
      data: { status }
    });

    await prisma.auditLog.create({
      data: {
        action: "STATUS_CHANGE",
        details: JSON.stringify({ id, status })
      }
    });

    return updated;
  },

  // Merge Themes Action
  mergeThemes: async (sourceId, targetId) => {
    const sourceTheme = await prisma.activeTheme.findUnique({ where: { id: sourceId } });
    const targetTheme = await prisma.activeTheme.findUnique({ where: { id: targetId } });

    if (!sourceTheme || !targetTheme) {
      throw new Error("One or both themes not found.");
    }

    const sourceIds = JSON.parse(sourceTheme.supporting_row_ids);
    const targetIds = JSON.parse(targetTheme.supporting_row_ids);
    const mergedIds = [...new Set([...sourceIds, ...targetIds])];

    // Compute combined centroid
    const sourceEmb = JSON.parse(sourceTheme.embedding);
    const targetEmb = JSON.parse(targetTheme.embedding);
    const mergedEmb = sourceEmb.map((val, idx) => (val + targetEmb[idx]) / 2);

    // Compute updated similarity matches
    const matches = await aiService.findBestMatches(mergedEmb);

    const updatedTarget = await prisma.activeTheme.update({
      where: { id: targetId },
      data: {
        supporting_row_ids: JSON.stringify(mergedIds),
        is_pattern: true,
        embedding: JSON.stringify(mergedEmb),
        ...matches
      }
    });

    // Deactivate source theme card
    await prisma.activeTheme.update({
      where: { id: sourceId },
      data: { status: "MERGED" }
    });

    await prisma.auditLog.create({
      data: {
        action: "MERGE",
        details: JSON.stringify({ sourceId, targetId, combinedCount: mergedIds.length })
      }
    });

    return updatedTarget;
  },

  // Split Theme Action
  splitTheme: async (id, splitRowIds, customTitle, customProblemStatement) => {
    const originalTheme = await prisma.activeTheme.findUnique({ where: { id } });
    if (!originalTheme) {
      throw new Error("Original theme not found.");
    }

    const originalIds = JSON.parse(originalTheme.supporting_row_ids);
    const remainingIds = originalIds.filter(rowId => !splitRowIds.includes(rowId));

    if (remainingIds.length === 0) {
      throw new Error("Cannot split all rows. Leave at least one row in the original theme.");
    }

    const originalEmb = JSON.parse(originalTheme.embedding);

    const updatedOriginal = await prisma.activeTheme.update({
      where: { id },
      data: {
        supporting_row_ids: JSON.stringify(remainingIds),
        is_pattern: remainingIds.length > 1
      }
    });

    // Create a new split active theme
    const newTheme = await prisma.activeTheme.create({
      data: {
        title: customTitle || `Split from ${originalTheme.title}`,
        problem_statement: customProblemStatement || `Customer issues split off from theme: ${originalTheme.title}.`,
        primary_product_area: originalTheme.primary_product_area,
        status: "PENDING",
        supporting_row_ids: JSON.stringify(splitRowIds),
        is_pattern: splitRowIds.length > 1,
        embedding: JSON.stringify(originalEmb),
        matched_historical_theme_ids: JSON.stringify([]),
        matched_product_note_ids: JSON.stringify([])
      }
    });

    await prisma.auditLog.create({
      data: {
        action: "SPLIT",
        details: JSON.stringify({ parentId: id, childId: newTheme.id, splitCount: splitRowIds.length })
      }
    });

    return { updatedOriginal, newTheme };
  },

  // Compile ASCII Report
  compileReport: async () => {
    const rawFeedback = await prisma.rawFeedback.findMany();
    const approvedThemes = await prisma.activeTheme.findMany({
      where: { status: "APPROVED" }
    });

    if (approvedThemes.length === 0) {
      throw new Error("No themes have been APPROVED yet.");
    }

    const historicalThemes = await prisma.historicalTheme.findMany();
    const productNotes = await prisma.productNote.findMany();

    const historyMap = new Map(historicalThemes.map(h => [h.id, h.title]));
    const noteMap = new Map(productNotes.map(n => [n.id, `v${n.version} (${n.title})`]));

    let report = "";

    approvedThemes.forEach((theme, index) => {
      const ids = JSON.parse(theme.supporting_row_ids);
      const stats = calculateStats(ids, rawFeedback);

      report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      report += `THEME ${index + 1}: ${theme.title.toUpperCase()}\n`;
      report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      report += `Problem Statement:\n${theme.problem_statement}\n\n`;
      
      report += `Today's Volume:\n${theme.is_pattern ? "Repeated Pattern" : "Isolated Comment"}\n\n`;
      
      const matchedHistIds = JSON.parse(theme.matched_historical_theme_ids || '[]');
      const matchedHistTitles = matchedHistIds.map(id => historyMap.get(id)).filter(Boolean);
      const histMatch = matchedHistTitles.length > 0 ? matchedHistTitles.join(', ') : "None";

      const matchedNoteIds = JSON.parse(theme.matched_product_note_ids || '[]');
      const matchedNoteTitles = matchedNoteIds.map(id => noteMap.get(id)).filter(Boolean);
      const noteMatch = matchedNoteTitles.length > 0 ? matchedNoteTitles.join(', ') : "None";
      
      report += `Historical Classification:\n${matchedHistIds.length > 0 ? "Recurring User Problem (Seen in past months)" : "New User Problem"}\n\n`;
      
      report += `Historical Matches & Releases:\n`;
      report += `⚠️ Matches Historical Themes: ${histMatch}\n`;
      report += `🚀 Related Release Notes: ${noteMatch}\n\n`;
      
      report += `Feedback Count:\n${stats.total_count}\n\n`;
      report += `Product Area:\n${theme.primary_product_area}\n\n`;
      
      report += `SOURCE DISTRIBUTION\n`;
      Object.entries(stats.source_distribution).forEach(([source, count]) => {
        report += `${source.padEnd(14)}${count}\n`;
      });
      
      report += `\nUSER TYPE DISTRIBUTION\n`;
      Object.entries(stats.user_type_distribution).forEach(([type, count]) => {
        report += `${type.padEnd(14)}${count}\n`;
      });
      
      report += `\nFEEDBACK FREQUENCY\n`;
      Object.entries(stats.frequency).forEach(([month, count]) => {
        const bar = "█".repeat(Math.max(1, count * 3));
        report += `${month.padEnd(14)}${bar.padEnd(12)}${count}\n`;
      });
      
      report += `\nSUPPORTING CITATIONS & RAW EVIDENCE\n`;
      const filteredFeedback = rawFeedback.filter(row => ids.includes(row.row_id));
      filteredFeedback.forEach(row => {
        report += `• Row #${row.row_id} [${row.source} / ${row.user_type}]: "${row.feedback_text}"\n`;
      });
      report += `\n\n`;
    });

    return report;
  },

  // Clear all active themes and raw feedback
  clearAll: async () => {
    await prisma.activeTheme.deleteMany();
    await prisma.rawFeedback.deleteMany();

    await prisma.auditLog.create({
      data: {
        action: "CLEAR",
        details: JSON.stringify({ cleared_at: new Date() })
      }
    });

    return { message: "Workspace cleared successfully." };
  }
};

module.exports = themesService;
