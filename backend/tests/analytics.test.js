const assert = require('assert');

// The exact function cloned from server.js for testing math calculations
function calculateStats(rowIds, rawFeedbackRows) {
  const filtered = rawFeedbackRows.filter(row => rowIds.includes(row.row_id));
  const total_count = filtered.length;

  const source_distribution = { Support: 0, "App Store": 0, Email: 0 };
  const user_type_distribution = { Free: 0, Premium: 0, Enterprise: 0 };
  const frequency = {};

  filtered.forEach(row => {
    // Source Split
    if (row.source === 'Support') source_distribution.Support++;
    else if (row.source === 'App Store') source_distribution["App Store"]++;
    else if (row.source === 'Email') source_distribution.Email++;
    
    // User Type Split
    if (row.user_type === 'Free') user_type_distribution.Free++;
    else if (row.user_type === 'Premium') user_type_distribution.Premium++;
    else if (row.user_type === 'Enterprise') user_type_distribution.Enterprise++;

    // Monthly bucket frequency
    const date = new Date(row.date);
    if (!isNaN(date.getTime())) {
      const monthLabel = date.toLocaleString('en-US', { month: 'long', year: 'numeric' }); // "June 2026"
      frequency[monthLabel] = (frequency[monthLabel] || 0) + 1;
    }
  });

  return { total_count, source_distribution, user_type_distribution, frequency };
}

// Sample dataset mimicking RawFeedback rows in the DB
const mockRawFeedback = [
  { row_id: 0, source: 'Support', user_type: 'Premium', date: '2026-06-05T00:00:00Z', feedback_text: 'Text 0' },
  { row_id: 1, source: 'Support', user_type: 'Free', date: '2026-06-15T00:00:00Z', feedback_text: 'Text 1' },
  { row_id: 2, source: 'App Store', user_type: 'Enterprise', date: '2026-07-02T00:00:00Z', feedback_text: 'Text 2' },
  { row_id: 3, source: 'Email', user_type: 'Premium', date: '2026-07-10T00:00:00Z', feedback_text: 'Text 3' },
  { row_id: 4, source: 'Support', user_type: 'Premium', date: '2026-07-20T00:00:00Z', feedback_text: 'Text 4' }
];

function runTests() {
  console.log('Running deterministic analytics tests...');

  // Test Case 1: All items included
  const statsAll = calculateStats([0, 1, 2, 3, 4], mockRawFeedback);
  
  assert.strictEqual(statsAll.total_count, 5);
  
  assert.strictEqual(statsAll.source_distribution.Support, 3);
  assert.strictEqual(statsAll.source_distribution["App Store"], 1);
  assert.strictEqual(statsAll.source_distribution.Email, 1);
  
  assert.strictEqual(statsAll.user_type_distribution.Free, 1);
  assert.strictEqual(statsAll.user_type_distribution.Premium, 3);
  assert.strictEqual(statsAll.user_type_distribution.Enterprise, 1);
  
  assert.strictEqual(statsAll.frequency["June 2026"], 2);
  assert.strictEqual(statsAll.frequency["July 2026"], 3);

  // Test Case 2: Subset of items
  const statsSubset = calculateStats([0, 2], mockRawFeedback);
  
  assert.strictEqual(statsSubset.total_count, 2);
  assert.strictEqual(statsSubset.source_distribution.Support, 1);
  assert.strictEqual(statsSubset.source_distribution["App Store"], 1);
  assert.strictEqual(statsSubset.source_distribution.Email, 0);
  
  assert.strictEqual(statsSubset.frequency["June 2026"], 1);
  assert.strictEqual(statsSubset.frequency["July 2026"], 1);

  console.log('✓ All analytics math assertions passed successfully!');
}

module.exports = { runTests };
