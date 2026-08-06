const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables (checks current backend folder .env first, then root .env)
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL || '';
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

if (!dbUrl || !isPostgres) {
  console.error('Error: DATABASE_URL must be a valid PostgreSQL connection string in your .env file.');
  process.exit(1);
}

const templatePath = path.join(__dirname, 'prisma/schema.prisma.template');
const schemaPath = path.join(__dirname, 'prisma/schema.prisma');

if (!fs.existsSync(templatePath)) {
  console.error('Error: schema.prisma.template not found at', templatePath);
  process.exit(1);
}

let template = fs.readFileSync(templatePath, 'utf8');

// Perform template compile strictly for PostgreSQL
let schema = template.replace('TEMPLATE_PROVIDER', 'postgresql');
if (process.env.DIRECT_URL) {
  schema = schema.replace('TEMPLATE_DIRECT_URL', 'directUrl  = env("DIRECT_URL")');
} else {
  schema = schema.replace('TEMPLATE_DIRECT_URL', '');
}
schema = schema.replace('TEMPLATE_EXTENSIONS', 'extensions = [vector]');
schema = schema.replace('TEMPLATE_PREVIEW_FEATURES', 'previewFeatures = ["postgresqlExtensions"]');
schema = schema.replace(/TEMPLATE_EMBEDDING_TYPE/g, 'String');

fs.writeFileSync(schemaPath, schema);
console.log('Prisma schema compiled successfully for native: postgresql');
