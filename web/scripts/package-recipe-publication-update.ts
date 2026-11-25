import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildRecipePublicationUpdate,recipePublicationMigrations} from '../lib/deploy/recipe-publication-update';

const migrations=await Promise.all(recipePublicationMigrations.map(async name=>({name,sql:await fs.readFile(path.resolve('../supabase/migrations',name),'utf8')})));
const sql=buildRecipePublicationUpdate(migrations),destination=path.resolve('../output/CHIFAA_RECIPE_PUBLICATION_087_090.sql');
await fs.mkdir(path.dirname(destination),{recursive:true});
await fs.writeFile(destination,sql,'utf8');
await fs.copyFile(path.resolve('../supabase/diagnostics/recipe_publication_readiness.sql'),path.resolve('../output/CHIFAA_RECIPE_PUBLICATION_CHECK.sql'));
console.log(JSON.stringify({file:'output/CHIFAA_RECIPE_PUBLICATION_087_090.sql',diagnostics:'output/CHIFAA_RECIPE_PUBLICATION_CHECK.sql',migrations:recipePublicationMigrations,sha256:createHash('sha256').update(sql).digest('hex'),cloudExecuted:false}));
