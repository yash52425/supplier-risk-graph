const http = require('http');
const fs = require('fs');
const path = require('path');

// Keep demo mode dependency-free; dotenv is used by the seed script after npm install.
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

const port = Number(process.env.PORT || 3000);
const hasDatabase = ['COGNODB_URI', 'COGNODB_USERNAME', 'COGNODB_PASSWORD'].every((key) => process.env[key]);
let driver;
if (hasDatabase) {
  const neo4j = require('neo4j-driver');
  driver = neo4j.driver(process.env.COGNODB_URI, neo4j.auth.basic(process.env.COGNODB_USERNAME, process.env.COGNODB_PASSWORD));
}

const demo = {
  summary: { companies: 6, facilities: 5, critical: 3, spend: '$11.6m', mode: 'Demo data' },
  risks: [
    { supplier: 'Nova Cells', material: 'Lithium carbonate', hops: 2, country: 'Chile', score: 62, impact: 'High', path: 'Aether Devices → Nova Cells → Terra Minerals' },
    { supplier: 'Orbit Components', material: 'Cobalt sulfate', hops: 2, country: 'China', score: 41, impact: 'High', path: 'Aether Devices → Orbit Components → Solstice Refining' },
    { supplier: 'Lumen Glassworks', material: 'OLED display', hops: 1, country: 'Germany', score: 91, impact: 'Low', path: 'Aether Devices → Lumen Glassworks' }
  ],
  alternatives: [
    { material: 'OLED display', primary: 'Orbit Components', alternative: 'Lumen Glassworks', country: 'Germany', score: 91, rationale: 'Independent country and route; 50 points stronger facility score.' }
  ]
};
function send(res, status, body, type = 'application/json') { res.writeHead(status, { 'content-type': `${type}; charset=utf-8` }); res.end(body); }
function records(result) { return result.records.map((r) => r.toObject()); }
async function querySummary() {
  const session = driver.session();
  try {
    const result = await session.executeRead((tx) => tx.run(`MATCH (c:Company) OPTIONAL MATCH (f:Facility) OPTIONAL MATCH ()-[r:SOURCES_FROM {critical:true}]->() RETURN count(DISTINCT c) AS companies, count(DISTINCT f) AS facilities, count(DISTINCT r) AS critical`, {}));
    const x = result.records[0].toObject();
    return { companies: x.companies.toNumber(), facilities: x.facilities.toNumber(), critical: x.critical.toNumber(), spend: 'Live', mode: 'CognoDB live' };
  } finally { await session.close(); }
}
async function queryRisks(minScore) {
  const session = driver.session();
  try {
    // Multi-hop traversal: buyer → supplier → upstream supplier, parameterised throughout.
    const result = await session.executeRead((tx) => tx.run(`MATCH p=(buyer:Company {id:$buyerId})-[:SOURCES_FROM*2..3]->(upstream:Company) MATCH (upstream)-[:OPERATED_BY]-(f:Facility)-[:LOCATED_IN]->(country:Country) OPTIONAL MATCH (upstream)-[:EXTRACTS|REFINES|PRODUCES]->(m:Material) WHERE f.score < $minScore RETURN upstream.name AS supplier, coalesce(m.name,'Multiple materials') AS material, length(p) AS hops, country.name AS country, f.score AS score, CASE WHEN f.score < 55 THEN 'High' WHEN f.score < 75 THEN 'Medium' ELSE 'Low' END AS impact, reduce(s='', n IN nodes(p) | s + CASE WHEN s='' THEN n.name ELSE ' → ' + n.name END) AS path ORDER BY f.score ASC`, { buyerId: 'aether', minScore }));
    return records(result).map((r) => ({ ...r, hops: r.hops.toNumber(), score: r.score.toNumber() }));
  } finally { await session.close(); }
}
async function queryAlternatives() {
  const session = driver.session();
  try {
    // This finds substitute producers that do not share the same operating country.
    const result = await session.executeRead((tx) => tx.run(`MATCH (:Company {id:$buyerId})-[:SOURCES_FROM]->(primary:Company)-[:PRODUCES]->(m:Material)<-[:PRODUCES]-(alternative:Company) WHERE primary <> alternative MATCH (alternative)<-[:OPERATED_BY]-(f:Facility)-[:LOCATED_IN]->(country:Country) RETURN DISTINCT m.name AS material, primary.name AS primary, alternative.name AS alternative, country.name AS country, f.score AS score ORDER BY f.score DESC`, { buyerId: 'aether' }));
    return records(result).map((r) => ({ ...r, score: r.score.toNumber(), rationale: 'Alternative producer discovered through a shared material node.' }));
  } finally { await session.close(); }
}
async function api(res, route) {
  try {
    if (!hasDatabase) return send(res, 200, JSON.stringify(route === 'summary' ? demo.summary : demo[route]));
    const data = route === 'summary' ? await querySummary() : route === 'risks' ? await queryRisks(75) : await queryAlternatives();
    return send(res, 200, JSON.stringify(data));
  } catch (error) {
    return send(res, 503, JSON.stringify({ error: 'CognoDB is currently unavailable. Check your network and .env settings.', detail: error.code || error.message }));
  }
}
http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/summary') return api(res, 'summary');
  if (url.pathname === '/api/risks') return api(res, 'risks');
  if (url.pathname === '/api/alternatives') return api(res, 'alternatives');
  const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const target = path.join(__dirname, 'public', file);
  if (!target.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(target)) return send(res, 404, 'Not found', 'text/plain');
  return send(res, 200, fs.readFileSync(target), target.endsWith('.css') ? 'text/css' : target.endsWith('.js') ? 'text/javascript' : 'text/html');
}).listen(port, () => console.log(`Supplier Risk Graph is running at http://localhost:${port} (${hasDatabase ? 'CognoDB live' : 'demo mode'})`));
