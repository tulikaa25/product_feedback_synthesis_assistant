const assert = require('assert');

// The validation function cloned from server.js
function validateCSVHeaders(sampleRow) {
  const requiredKeys = ['feedback text', 'source', 'user type', 'product area', 'date'];
  const missing = requiredKeys.filter(k => !(k in sampleRow));
  return {
    isValid: missing.length === 0,
    missingColumns: missing
  };
}

function runTests() {
  console.log('Running CSV header validation tests...');

  // Test Case 1: Valid Headers
  const validRow = {
    'feedback text': 'Stripe button fails',
    'source': 'Support',
    'user type': 'Premium',
    'product area': 'Payments',
    'date': '2026-06-12',
    'rating': '4'
  };
  const result1 = validateCSVHeaders(validRow);
  assert.strictEqual(result1.isValid, true);
  assert.strictEqual(result1.missingColumns.length, 0);

  // Test Case 2: Missing Headers
  const invalidRow = {
    'feedback text': 'Stripe button fails',
    'source': 'Support',
    // 'user type' and 'date' columns missing
    'product area': 'Payments'
  };
  const result2 = validateCSVHeaders(invalidRow);
  assert.strictEqual(result2.isValid, false);
  assert.deepStrictEqual(result2.missingColumns, ['user type', 'date']);

  console.log('✓ All CSV validation assertions passed successfully!');
}

module.exports = { runTests };
