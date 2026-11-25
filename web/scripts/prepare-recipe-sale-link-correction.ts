import fs from 'node:fs/promises';
import path from 'node:path';
import {buildRecipeSaleLinkCorrection,buildRecipeSaleLinkDiagnosis,type ConfirmedRecipeSaleLink} from '../lib/deploy/recipe-sale-link-correction';

const config=process.argv.find(value=>value.startsWith('--config='))?.slice(9);
const date=process.argv.find(value=>value.startsWith('--date='))?.slice(7);
if(!config)throw new Error('Use --config=path/to/private-confirmed-links.json; --date=YYYY-MM-DD prepares the correction.');
const links=JSON.parse(await fs.readFile(config,'utf8')) as ConfirmedRecipeSaleLink[];
const out=path.resolve('../output');await fs.mkdir(out,{recursive:true});
await fs.writeFile(path.join(out,'CHIFAA_RECIPE_SALE_LINK_DIAGNOSIS.sql'),buildRecipeSaleLinkDiagnosis(links));
if(date)await fs.writeFile(path.join(out,'CHIFAA_FIX_CONFIRMED_RECIPE_SALE_LINKS.sql'),buildRecipeSaleLinkCorrection(date,links));
console.log(JSON.stringify({diagnosis:'output/CHIFAA_RECIPE_SALE_LINK_DIAGNOSIS.sql',correction:date?'output/CHIFAA_FIX_CONFIRMED_RECIPE_SALE_LINKS.sql':null,effectiveDate:date??null,cloudExecuted:false}));
