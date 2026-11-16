import fs from 'node:fs';import {propertyScenario} from '../tests/performance-fixture.mjs';
const results=['sync','summary','mutate'].map(action=>({action,before:propertyScenario(action,true),after:propertyScenario(action,false)}));
const output={environment:'Node/GAS mock service-call counts, not Google latency or guaranteed quota consumption',results};fs.writeFileSync('output/master-properties-benchmark.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
