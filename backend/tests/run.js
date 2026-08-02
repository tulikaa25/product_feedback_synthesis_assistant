const analyticsTests = require('./analytics.test');
const csvTests = require('./csv.test');

console.log('==================================================');
console.log('Starting AI Feedback Synthesis Assistant Test Suite');
console.log('==================================================\n');

try {
  analyticsTests.runTests();
  console.log('');
  csvTests.runTests();
  console.log('\n==================================================');
  console.log(' ALL UNIT TESTS COMPLETED SUCCESSFULLY!');
  console.log('==================================================');
  process.exit(0);
} catch (error) {
  console.error('\n❌ UNIT TEST RUN ENCOUNTERED AN FAILURE:');
  console.error(error.message);
  console.error(error.stack);
  console.log('==================================================');
  process.exit(1);
}
