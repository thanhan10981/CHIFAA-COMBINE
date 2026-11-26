import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryPages,orderReplenishment,type InventoryRow,type InventoryResult,type ReplenishmentDemand} from '../features/operations/inventory-replenishment';

const row=(id='m',overrides:Partial<InventoryRow>={}):InventoryRow=>({id,code:id,name:'Synthetic material',category:'ingredient',unit_id:'kg-id',unit:'kg',quantity:'5',minimum:'3',needed:'900',suggested:'898',status:'ok',stock_average_unit_cost:null,...overrides});
const inventory=(rows:InventoryRow[]):InventoryResult=>({rows,total:rows.length,summary:{materials:rows.length,known:rows.filter(r=>r.quantity!==null).length,unknown:rows.filter(r=>r.quantity===null).length,low:rows.filter(r=>r.status==='low').length},needs_complete:true,planned:true,inventory_version:'1'});
const demand=(quantity='10'):ReplenishmentDemand=>({products:[{product_id:'p',quantity:'2'}],issues:[],materials:[{material_id:'m',code:'m',name:'Synthetic material',unit_code:'kg',quantity,stock_quantity:'1000',minimum_quantity:'99',shortage_quantity:'0',status:'ok'}]});

test('KH-01/KH-10 order demand replaces plan demand and uses selected warehouse stock, never the all-warehouse balance',()=>{
 const stock=inventory([row()]),orders=demand(),before=structuredClone({stock,orders});
 const result=orderReplenishment(stock,orders,'attention',0);
 assert.equal(result.total,1);assert.equal(result.rows[0].needed,'10');assert.equal(result.rows[0].suggested,'8');assert.equal(result.rows[0].status,'ok');
 assert.deepEqual({stock,orders},before);
 orders.materials[0].stock_quantity='999999';assert.equal(orderReplenishment(stock,orders,'all',0).rows[0].suggested,'8');
 const accumulated=demand('0.1');accumulated.materials.push({...accumulated.materials[0],quantity:'0.2'});
 assert.equal(orderReplenishment(inventory([row('m',{quantity:'0',minimum:'0'})]),accumulated,'all',0).rows[0].suggested,'0.3');
});

test('unknown stock, unset minima and incompatible units stay unknown; confirmed zero remains usable',()=>{
 const stock=inventory([row('m',{quantity:null}),row('minimum',{minimum:null}),row('unit',{unit_id:null,unit:null}),row('zero',{quantity:'0',minimum:'0'}),row('mismatch')]);
 const orders=demand();orders.materials.push({...orders.materials[0],material_id:'mismatch',unit_code:'l'});
 const result=orderReplenishment(stock,orders,'all',0);
 assert.equal(result.rows[0].suggested,null);assert.equal(result.rows[1].suggested,null);assert.equal(result.rows[2].needed,null);assert.equal(result.rows[3].suggested,'0');assert.equal(result.rows[4].needed,null);assert.equal(result.rows[4].suggested,null);
 assert.equal(orderReplenishment(stock,orders,'attention',0).total,4,'uncertain requirements need attention even when stock is above the minimum');
});

test('partial or failed demand never produces purchase quantities; empty approved orders allow minimum-only replenishment',()=>{
 const stock=inventory([row(),row('absent')]),partial=demand();partial.issues.push({issue:'PUBLISHED_PRODUCT_RECIPE_REQUIRED',product_id:'missing'});
 let result=orderReplenishment(stock,partial,'all',0);assert.equal(result.needs_complete,false);assert.equal(result.rows[0].needed,'10');assert.equal(result.rows[1].needed,null);assert.ok(result.rows.every(r=>r.suggested===null));
 result=orderReplenishment(stock,undefined,'all',0);assert.ok(result.rows.every(r=>r.needed===null&&r.suggested===null));
 result=orderReplenishment(inventory([row('m',{quantity:'1',status:'low'})]),{products:[],materials:[],issues:[]},'attention',0);assert.equal(result.rows[0].needed,'0');assert.equal(result.rows[0].suggested,'2');
});

test('attention filtering and pagination run after matching all inventory pages to order demand',async()=>{
 const rows=Array.from({length:104},(_,i)=>row('m'+String(i).padStart(3,'0'))),offsets:number[]=[];
 const all=await inventoryPages(async offset=>{offsets.push(offset);return {...inventory(rows),rows:rows.slice(offset,offset+50)};});
 assert.deepEqual(offsets,[0,50,100]);assert.equal(all.rows.length,104);
 const orders=demand();orders.materials=rows.slice(50).map(r=>({...orders.materials[0],material_id:r.id}));
 let result=orderReplenishment(all,orders,'attention',0);assert.equal(result.total,54);assert.equal(result.rows.length,50);assert.equal(result.rows[0].id,'m050');
 result=orderReplenishment(all,orders,'attention',50);assert.equal(result.rows.length,4);assert.equal(result.rows[3].id,'m103');
 assert.equal(orderReplenishment(all,orders,'ok',0).total,104);
});

test('a failed, duplicated or changed subsequent page is rejected instead of returning partial stock',async()=>{
 const stock=inventory([row()]);stock.total=2;
 await assert.rejects(()=>inventoryPages(async offset=>{if(offset)throw new Error('offline');return stock;}),/offline/);
 await assert.rejects(()=>inventoryPages(async()=>stock),/Số liệu kho/);
 await assert.rejects(()=>inventoryPages(async offset=>offset?{...stock,rows:[row('next')],inventory_version:'2'}:stock),/Số liệu kho/);
 await assert.rejects(()=>inventoryPages(async offset=>offset?{...stock,rows:[]}:stock),/Số liệu kho/);
});
