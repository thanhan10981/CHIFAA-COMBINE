import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{ROUTES}from'../src/shared/schema.js';
test('every actual data-page route from supplied HTML exists in app',()=>{const html=fs.readFileSync('source/CHIFAA_COMBINE_PHAT_THAO.html','utf8'),original=[...html.matchAll(/<button[^>]*class=["'][^"']*navitem[^>]*data-page=["']([^"']+)["']/g)].map(m=>m[1]);assert.equal(original.length,32);const routes=new Set(ROUTES.map(r=>r[0]));for(const id of original)assert.ok(routes.has(id),id);});
test('business data stays in RAM; app session uses only the dedicated non-exportable-key store',()=>{const app=fs.readFileSync('src/client/app.js','utf8');assert.equal(/localStorage|sessionStorage/.test(app),false);const auth=fs.readFileSync('src/server/auth.js','utf8');assert.match(auth,/hash_\(token\)/);});
test('Apps Script server sources avoid logical assignment rejected by editor',()=>{for(const file of ['src/shared/schema.js','src/shared/domain.js','src/shared/auth-protocol.js','src/server/storage.js','src/server/auth.js','src/server/oauth.js','src/server/api.js','src/server/operations.js'])assert.equal(/\|\|=|&&=|\?\?=/.test(fs.readFileSync(file,'utf8')),false,file);});
test('GIS and external verifier removed, owner-executed manifest permits signed-in DEV testers',()=>{
  const app=fs.readFileSync('src/client/app.js','utf8'),auth=fs.readFileSync('src/server/auth.js','utf8')+fs.readFileSync('src/server/oauth.js','utf8');
  assert.equal(/google\.accounts|gsi\/client/.test(app),false);assert.equal(/VERIFIER_URL|googleapis\.com\/tokeninfo|Session\./.test(auth),false);
  const manifest=JSON.parse(fs.readFileSync('src/server/appsscript.json','utf8'));assert.deepEqual(manifest.webapp,{access:'ANYONE',executeAs:'USER_DEPLOYING'});
  assert.equal(fs.existsSync('verifier/server.mjs'),false);
});
