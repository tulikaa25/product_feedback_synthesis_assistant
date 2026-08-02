const { PrismaClient } = require('@prisma/client');
const assert = require('assert');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();
const themesService = require('../src/services/themes.service');

async function testIntegration() {
  console.log('==================================================');
  console.log('Starting End-to-End Database & Report Integration Test');
  console.log('==================================================\n');

  try {
    // 1. Check Database Seed Records
    console.log('Step 1: Auditing database seed values...');
    const histCount = await prisma.historicalTheme.count();
    const notesCount = await prisma.productNote.count();
    
    console.log(`- Found ${histCount} historical themes in SQLite.`);
    console.log(`- Found ${notesCount} product notes in SQLite.`);
    
    assert.ok(histCount > 0, 'Database should be pre-populated with historical themes.');
    assert.ok(notesCount > 0, 'Database should be pre-populated with product notes.');
    console.log('✓ Database seeding verified successfully!\n');

    // 2. Insert mock active theme for compiler validation
    console.log('Step 2: Inserting mock active theme...');
    
    // Clear old active themes
    await prisma.activeTheme.deleteMany();
    await prisma.rawFeedback.deleteMany();

    // Ingest sample raw rows
    await prisma.rawFeedback.create({
      data: {
        row_id: 100,
        feedback_text: "Tab freezes on multi-page download.",
        source: "Support",
        user_type: "Premium",
        product_area: "Reporting",
        date: new Date("2026-07-20T00:00:00Z"),
        rating: 1
      }
    });

    const mockTheme = await prisma.activeTheme.create({
      data: {
        title: "PDF Download Freeze",
        problem_statement: "Tab crashes on export operations.",
        primary_product_area: "Reporting",
        status: "APPROVED",
        supporting_row_ids: JSON.stringify([100]),
        is_pattern: false,
        embedding: JSON.stringify(new Array(768).fill(0.1))
      }
    });
    console.log(`- Successfully inserted mock theme "${mockTheme.title}".\n`);

    // 3. Test report compiler output layout
    console.log('Step 3: Compiling plaintext report...');
    const reportText = await themesService.compileReport();
    
    console.log('\n--- COMPILED REPORT PREVIEW ---');
    console.log(reportText);
    console.log('-------------------------------\n');
    
    assert.ok(reportText.includes('THEME 1: PDF DOWNLOAD FREEZE'), 'Report should contain the theme header.');
    assert.ok(reportText.includes('Tab crashes on export operations.'), 'Report should contain the problem statement.');
    assert.ok(reportText.includes('Row #100'), 'Report should contain the feedback row citation ID.');
    assert.ok(reportText.includes('█'), 'Report should contain the ASCII timeline bar.');
    
    console.log('✓ Plaintext report layout compiled and verified successfully!\n');
    
    // Cleanup mock theme
    await prisma.activeTheme.deleteMany();
    await prisma.rawFeedback.deleteMany();
    
    console.log('==================================================');
    console.log('🎉 INTEGRATION PIPELINE TEST PASSED SUCCESSFULLY!');
    console.log('==================================================');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ INTEGRATION PIPELINE TEST ENCOUNTERED AN ERROR:');
    console.error(err.message);
    console.error(err.stack);
    console.log('==================================================');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testIntegration();
