import fs from 'node:fs';

// Uses only the app's public key and read-only catalog RPCs. No orders or
// recipe publications are created, and credentials are never printed.
if(fs.existsSync('.env.local'))process.loadEnvFile('.env.local');
const date=process.argv.find(value=>value.startsWith('--date='))?.slice(7)??new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
const expected=process.argv.filter(value=>value.startsWith('--expect=')).map(value=>value.slice(9));
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY before checking the public catalogs.');
if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Use --date=YYYY-MM-DD.');
async function catalog(name,body){
 const response=await fetch(new URL('/rest/v1/rpc/'+name,url),{method:'POST',headers:{apikey:key,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error(name+' returned HTTP '+response.status+'. Check the database migrations and API access.');
 return response.json();
}
const products=[];
for(let offset=0;offset<10000;offset+=100){
 const page=await catalog('public_order_catalog',{p_date:date,p_offset:offset,p_limit:100});
 if(!Array.isArray(page.rows))throw new Error('Unexpected public product catalog response.');
 products.push(...page.rows);
 if(page.rows.length<100||products.length>=Number(page.total))break;
}
const toppings=await catalog('public_order_topping_catalog',{p_date:date});
if(!Array.isArray(toppings))throw new Error('Unexpected public topping catalog response.');
let schemaReady=false,versionedToppings=toppings,versionedError;
try{
 const versioned=await catalog('public_order_topping_catalog_v2',{p_date:date});
 schemaReady=versioned?.schema_version===1&&Array.isArray(versioned.rows);
 if(schemaReady)versionedToppings=versioned.rows;
 else versionedError='Unsupported topping catalog contract.';
}catch(error){versionedError=error.message;}
const byProduct=new Map(versionedToppings.map(row=>[row.product_id,row]));
const dishes=products.map(product=>{
 const row=byProduct.get(product.product_id),options=row?.options??[];
 return {code:product.code,name:product.name,configured:!!row,required:row?.required??options.length>0,unavailable:Number(row?.unavailable_count??0),toppings:options.map(option=>({code:option.code,name:option.name,unit:option.unit}))};
});
const missing=expected.filter(code=>!dishes.some(dish=>dish.code===code&&dish.toppings.length>0&&dish.unavailable===0));
console.log(JSON.stringify({readOnly:true,source:new URL(url).hostname,date,schemaReady,versionedError,productCount:products.length,configuredProductCount:versionedToppings.length,dishes,expectedCodes:expected,missingExpectedToppings:missing,passed:schemaReady&&missing.length===0},null,2));
if(!schemaReady||missing.length)process.exitCode=1;
