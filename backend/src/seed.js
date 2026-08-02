const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const path = require('path');
const logger = require('./logger');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

// Helper to call Gemini Embedding API
async function getGeminiEmbedding(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Return dummy 768-dimension vector
    return new Array(768).fill(0.0);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text }] },
          outputDimensionality: 768
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini Embedding API Error: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    const values = result.embedding.values;
    logger.info('AI_SEED', `Successfully generated embedding of size ${values.length} using gemini-embedding-001`);
    return values;
  } catch (error) {
    logger.error('AI_SEED', 'Failed to get Gemini embedding, using dummy vector', { error: error.message });
    return new Array(768).fill(0.0);
  }
}

const mockHistoricalThemes = [
  {
    title: "Payment Authorization Failures",
    problem_statement: "Users report being unable to complete payments because transactions fail or remain stuck during authorization.",
    product_area: "Payments",
    first_seen_date: new Date("2026-01-10T00:00:00Z")
  },
  {
    title: "Safari PDF Export Crashes",
    problem_statement: "Users running Mac Safari experience tab freezes and white screen crashes when attempting to export multi-page transaction reports.",
    product_area: "Reporting",
    first_seen_date: new Date("2026-02-15T00:00:00Z")
  },
  {
    title: "Slow Invoice Search Latency",
    problem_statement: "Search query performance degrades significantly when filtering historical billing records.",
    product_area: "Billing",
    first_seen_date: new Date("2026-03-20T00:00:00Z")
  },
  {
    title: "OAuth Token Revocation Bug",
    problem_statement: "Users logged out unexpectedly due to token validation failures when access tokens expire earlier than scheduled.",
    product_area: "Authentication",
    first_seen_date: new Date("2026-03-25T00:00:00Z")
  },
  {
    title: "CSV Parser Special Character Escape Failure",
    problem_statement: "Data ingestion pipeline crashes when CSV feedback fields contain unescaped emojis or trailing semicolons.",
    product_area: "Ingestion",
    first_seen_date: new Date("2026-04-05T00:00:00Z")
  },
  {
    title: "Mobile Keyboard Checkout Overlay",
    problem_statement: "Mobile users cannot click the final checkout submit button because the virtual keyboard remains active and covers the layout.",
    product_area: "UI",
    first_seen_date: new Date("2026-04-10T00:00:00Z")
  },
  {
    title: "Weekly Report Delivery Delay",
    problem_statement: "Weekly summary emails fail to send or are delayed by several hours due to mail worker queue limits.",
    product_area: "Messaging",
    first_seen_date: new Date("2026-04-18T00:00:00Z")
  },
  {
    title: "Premium Badge Visual Glitch",
    problem_statement: "Premium and Enterprise subscribers show a 'Free Account' badge on their dashboard due to profile state caching lags.",
    product_area: "UI",
    first_seen_date: new Date("2026-05-01T00:00:00Z")
  },
  {
    title: "Google Sign-in 403 Error",
    problem_statement: "Users using social Google login receive a 403 authorization error when authentication fails on Android devices.",
    product_area: "Authentication",
    first_seen_date: new Date("2026-05-05T00:00:00Z")
  },
  {
    title: "Transaction List Memory Leak",
    problem_statement: "Page performance degrades and crashes the browser tab after users scroll through more than 500 transaction rows.",
    product_area: "Performance",
    first_seen_date: new Date("2026-05-12T00:00:00Z")
  },
  {
    title: "Export CSV Column Mismatch",
    problem_statement: "CSV exports for transactions fail validation because the VAT columns are misaligned during header compilation.",
    product_area: "Reporting",
    first_seen_date: new Date("2026-05-20T00:00:00Z")
  },
  {
    title: "Enterprise SAML SSO Setup Loop",
    problem_statement: "Enterprise accounts experience an infinite redirect loop when authenticating via SAML integration.",
    product_area: "Authentication",
    first_seen_date: new Date("2026-06-01T00:00:00Z")
  }
];

const mockProductNotes = [
  {
    version: "v2.3",
    note_type: "RELEASE_NOTE",
    title: "Updated Checkout API Endpoints",
    description: "Updated Checkout API endpoints to support multi-currency authorization. Note: Ensure card endpoints are updated.",
    product_area: "Payments",
    release_date: new Date("2026-05-15T00:00:00Z")
  },
  {
    version: "v2.3.1",
    note_type: "BUGFIX",
    title: "Safari WebKit PDF Fix",
    description: "Fixed tab freezing issues on Safari browsers during PDF export operations.",
    product_area: "Reporting",
    release_date: new Date("2026-06-10T00:00:00Z")
  },
  {
    version: "v2.4.0",
    note_type: "PERFORMANCE",
    title: "Database Index Optimization",
    description: "Optimized index tables for billing and invoice transaction searches to lower latency below 100ms.",
    product_area: "Billing",
    release_date: new Date("2026-07-01T00:00:00Z")
  },
  {
    version: "v2.4.1",
    note_type: "BUGFIX",
    title: "Token Expiry Lifecycle Fix",
    description: "Patched OAuth verification logic to respect token life limits and auto-refresh credentials before early logout.",
    product_area: "Authentication",
    release_date: new Date("2026-07-05T00:00:00Z")
  },
  {
    version: "v2.4.2",
    note_type: "BUGFIX",
    title: "Semicolon Escape Handling update",
    description: "Fixed parser crashes by escaping special characters, emojis, and semicolons in import uploads.",
    product_area: "Ingestion",
    release_date: new Date("2026-07-08T00:00:00Z")
  },
  {
    version: "v2.5.0",
    note_type: "RELEASE_NOTE",
    title: "Responsive Mobile Flex Layouts",
    description: "Re-engineered checkout screens to dynamically adjust key buttons above the mobile screen virtual keyboard.",
    product_area: "UI",
    release_date: new Date("2026-07-12T00:00:00Z")
  },
  {
    version: "v2.5.1",
    note_type: "BUGFIX",
    title: "Weekly Email Queue Workers",
    description: "Deployed separate worker pools to handle bulk report emails, removing bottlenecks in SMTP sending queues.",
    product_area: "Messaging",
    release_date: new Date("2026-07-15T00:00:00Z")
  },
  {
    version: "v2.5.2",
    note_type: "BUGFIX",
    title: "Visual Badges Cache Refresh",
    description: "Flushed local subscriber state cache to immediately show updated Premium badges without lag.",
    product_area: "UI",
    release_date: new Date("2026-07-18T00:00:00Z")
  },
  {
    version: "v2.6.0",
    note_type: "RELEASE_NOTE",
    title: "Google API SDK upgrade",
    description: "Upgraded Google Identity Services APIs to prevent 403 auth errors on newer Android endpoints.",
    product_area: "Authentication",
    release_date: new Date("2026-07-20T00:00:00Z")
  },
  {
    version: "v2.6.1",
    note_type: "PERFORMANCE",
    title: "Virtual Scroll Transaction Grid",
    description: "Replaced standard tables with a virtual scrolling container that handles 10,000+ items without memory leaks.",
    product_area: "Performance",
    release_date: new Date("2026-07-22T00:00:00Z")
  },
  {
    version: "v2.6.2",
    note_type: "BUGFIX",
    title: "Tax Columns CSV Format update",
    description: "Fixed VAT misalignments in CSV compiling headers, enabling successful accounting uploads.",
    product_area: "Reporting",
    release_date: new Date("2026-07-25T00:00:00Z")
  },
  {
    version: "v2.7.0",
    note_type: "BUGFIX",
    title: "SAML Redirect Loop Hotfix",
    description: "Removed circular redirects in Single Sign-on auth flows by validating identity state before callbacks.",
    product_area: "Authentication",
    release_date: new Date("2026-08-01T00:00:00Z")
  }
];

async function seed() {
  logger.info('SEED', 'Starting database seeding...');
  
  try {
    // Clear existing historical data
    await prisma.historicalTheme.deleteMany();
    await prisma.productNote.deleteMany();
    
    // Seed Historical Themes
    for (const theme of mockHistoricalThemes) {
      const textToEmbed = `${theme.title} ${theme.problem_statement}`;
      const embedding = await getGeminiEmbedding(textToEmbed);
      await prisma.historicalTheme.create({
        data: {
          ...theme,
          embedding: JSON.stringify(embedding)
        }
      });
      logger.info('SEED', `Seeded Historical Theme: "${theme.title}"`);
    }

    // Seed Product Notes
    for (const note of mockProductNotes) {
      const textToEmbed = `${note.title} ${note.description}`;
      const embedding = await getGeminiEmbedding(textToEmbed);
      await prisma.productNote.create({
        data: {
          ...note,
          embedding: JSON.stringify(embedding)
        }
      });
      logger.info('SEED', `Seeded Product Note: "${note.title}" (${note.version})`);
    }

    logger.info('SEED', 'Database seeding completed successfully!');
  } catch (error) {
    logger.error('SEED', 'Seed script failed', { error: error.message, stack: error.stack });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  seed();
}

module.exports = seed;
