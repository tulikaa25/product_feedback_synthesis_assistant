const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL || '';
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');
const provider = isPostgres ? 'postgresql' : 'sqlite';

const templatePath = path.join(__dirname, 'prisma/schema.prisma.template');
const schemaPath = path.join(__dirname, 'prisma/schema.prisma');

if (!fs.existsSync(templatePath)) {
  console.error('Error: schema.prisma.template not found at', templatePath);
  process.exit(1);
}

let template = fs.readFileSync(templatePath, 'utf8');

// If using SQLite and no DATABASE_URL is set, default to local SQLite file url
let finalUrl = dbUrl;
if (!isPostgres && !dbUrl) {
  finalUrl = 'file:./dev.db';
  // Also write to .env so Prisma CLI can find it
  const envPath = path.join(__dirname, '../.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  if (!envContent.includes('DATABASE_URL')) {
    fs.writeFileSync(envPath, (envContent + '\nDATABASE_URL="file:./dev.db"\n').trim() + '\n');
  }
}

// Perform template compile
let schema = template.replace('TEMPLATE_PROVIDER', provider);

if (provider === 'postgresql') {
  schema = schema.replace('TEMPLATE_EXTENSIONS', 'extensions = [pgvector]');
  schema = schema.replace('TEMPLATE_PREVIEW_FEATURES', 'previewFeatures = ["postgresqlExtensions"]');
  schema = schema.replace(/TEMPLATE_EMBEDDING_TYPE/g, 'Unsupported("vector(768)")');
} else {
  // SQLite Compilation
  schema = schema.replace('TEMPLATE_EXTENSIONS', '');
  schema = schema.replace('TEMPLATE_PREVIEW_FEATURES', '');
  schema = schema.replace(/TEMPLATE_EMBEDDING_TYPE/g, 'String');
  schema = schema.replace('env("DATABASE_URL")', `"${finalUrl}"`);
}

fs.writeFileSync(schemaPath, schema);
console.log(`Prisma schema compiled successfully for native: ${provider}`);
