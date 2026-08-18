// Idempotent realistic seed data for Supplier Risk Graph.
CREATE CONSTRAINT company_id IF NOT EXISTS FOR (n:Company) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT facility_id IF NOT EXISTS FOR (n:Facility) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT material_id IF NOT EXISTS FOR (n:Material) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT port_id IF NOT EXISTS FOR (n:Port) REQUIRE n.id IS UNIQUE;
CREATE CONSTRAINT country_id IF NOT EXISTS FOR (n:Country) REQUIRE n.code IS UNIQUE;

UNWIND [
  {id:'aether', name:'Aether Devices', sector:'Consumer electronics', tier:0},
  {id:'orbit', name:'Orbit Components', sector:'Electronics manufacturing', tier:1},
  {id:'lumen', name:'Lumen Glassworks', sector:'Specialty materials', tier:1},
  {id:'terra', name:'Terra Minerals', sector:'Mining', tier:2},
  {id:'nova', name:'Nova Cells', sector:'Battery manufacturing', tier:1},
  {id:'solstice', name:'Solstice Refining', sector:'Metals refining', tier:2}
] AS row MERGE (n:Company {id:row.id}) SET n += row;

UNWIND [
  {id:'vn', name:'Vietnam', code:'VN', risk:'medium'}, {id:'cn', name:'China', code:'CN', risk:'medium'},
  {id:'cl', name:'Chile', code:'CL', risk:'low'}, {id:'kr', name:'South Korea', code:'KR', risk:'low'},
  {id:'de', name:'Germany', code:'DE', risk:'low'}
] AS row MERGE (n:Country {code:row.code}) SET n += row;

UNWIND [
  {id:'hcm', name:'Ho Chi Minh Assembly', city:'Ho Chi Minh City', country:'VN', score:78},
  {id:'shenzhen', name:'Shenzhen Components', city:'Shenzhen', country:'CN', score:41},
  {id:'antofagasta', name:'Antofagasta Mine', city:'Antofagasta', country:'CL', score:62},
  {id:'busan', name:'Busan Cell Plant', city:'Busan', country:'KR', score:86},
  {id:'dresden', name:'Dresden Glass Lab', city:'Dresden', country:'DE', score:91}
] AS row MERGE (n:Facility {id:row.id}) SET n += row;

UNWIND [
  {id:'lithium', name:'Lithium carbonate', category:'Battery mineral'}, {id:'cobalt', name:'Cobalt sulfate', category:'Battery mineral'},
  {id:'display', name:'OLED display', category:'Component'}, {id:'battery', name:'Battery cell', category:'Component'}
] AS row MERGE (n:Material {id:row.id}) SET n += row;

MATCH (a:Company {id:'aether'}), (o:Company {id:'orbit'}) MERGE (a)-[:SOURCES_FROM {annualSpend:4200000, critical:true}]->(o);
MATCH (a:Company {id:'aether'}), (l:Company {id:'lumen'}) MERGE (a)-[:SOURCES_FROM {annualSpend:1800000, critical:false}]->(l);
MATCH (a:Company {id:'aether'}), (n:Company {id:'nova'}) MERGE (a)-[:SOURCES_FROM {annualSpend:5600000, critical:true}]->(n);
MATCH (o:Company {id:'orbit'}), (s:Company {id:'solstice'}) MERGE (o)-[:SOURCES_FROM {annualSpend:2100000, critical:true}]->(s);
MATCH (n:Company {id:'nova'}), (t:Company {id:'terra'}) MERGE (n)-[:SOURCES_FROM {annualSpend:3600000, critical:true}]->(t);
MATCH (o:Company {id:'orbit'}), (n:Company {id:'nova'}), (l:Company {id:'lumen'}), (t:Company {id:'terra'}), (s:Company {id:'solstice'}), (b:Material {id:'battery'}), (co:Material {id:'cobalt'}), (li:Material {id:'lithium'}), (d:Material {id:'display'})
MERGE (o)-[:PRODUCES]->(d) MERGE (n)-[:PRODUCES]->(b) MERGE (n)-[:REQUIRES]->(li) MERGE (n)-[:REQUIRES]->(co) MERGE (t)-[:EXTRACTS]->(li) MERGE (s)-[:REFINES]->(co) MERGE (l)-[:PRODUCES]->(d);
MATCH (h:Facility {id:'hcm'}), (a:Company {id:'aether'}), (vn:Country {code:'VN'}) MERGE (h)-[:OPERATED_BY]->(a) MERGE (h)-[:LOCATED_IN]->(vn);
MATCH (sh:Facility {id:'shenzhen'}), (o:Company {id:'orbit'}), (cn:Country {code:'CN'}) MERGE (sh)-[:OPERATED_BY]->(o) MERGE (sh)-[:LOCATED_IN]->(cn);
MATCH (an:Facility {id:'antofagasta'}), (t:Company {id:'terra'}), (cl:Country {code:'CL'}) MERGE (an)-[:OPERATED_BY]->(t) MERGE (an)-[:LOCATED_IN]->(cl);
MATCH (bu:Facility {id:'busan'}), (n:Company {id:'nova'}), (kr:Country {code:'KR'}) MERGE (bu)-[:OPERATED_BY]->(n) MERGE (bu)-[:LOCATED_IN]->(kr);
MATCH (dr:Facility {id:'dresden'}), (l:Company {id:'lumen'}), (de:Country {code:'DE'}) MERGE (dr)-[:OPERATED_BY]->(l) MERGE (dr)-[:LOCATED_IN]->(de);
