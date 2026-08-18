require('dotenv').config();
const fs = require('fs');
const neo4j = require('neo4j-driver');
const required = ['COGNODB_URI', 'COGNODB_USERNAME', 'COGNODB_PASSWORD'];
if (required.some((key) => !process.env[key])) throw new Error('Missing CognoDB settings. Copy .env.example to .env first.');
const driver = neo4j.driver(process.env.COGNODB_URI, neo4j.auth.basic(process.env.COGNODB_USERNAME, process.env.COGNODB_PASSWORD));
(async () => {
  const session = driver.session();
  try {
    const cypher = fs.readFileSync('data/seed.cypher', 'utf8');
    for (const statement of cypher.split(';').map((s) => s.trim()).filter(Boolean)) await session.run(statement);
    console.log('Seed data loaded successfully.');
  } finally { await session.close(); await driver.close(); }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
