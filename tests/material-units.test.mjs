import test from 'node:test';import assert from 'node:assert/strict';
import {unitFactor,materialUnitState,cleanRecord,costRecipe,inventory,sourceIssues} from '../src/shared/domain.js';import {gas} from './gas-mock.mjs';import {send} from './auth-helpers.mjs';import {client} from './client-fixture.mjs';
const spec=(extra={})=>({version:1,purchaseUnit:'chai',packageType:'chai',packageQuantity:250,packageUnit:'g',usageUnit:'g',standardUnit:'g',originalPrice:200000,priceBasis:'kg',priceStatus:'verified',note:'Source explicitly priced per kilogram',source:{cell:'Catalog!Y2'},...extra});
test('Package weight and price basis are independent; quantities share physical units without implicit density',()=>{
  assert.equal(unitFactor(spec(),'chai','g'),250);assert.equal(unitFactor(spec(),'kg','g'),1000);assert.equal(unitFactor(spec(),'l','g'),null);
  assert.equal(unitFactor(spec({purchaseUnit:'can',packageType:'can',packageQuantity:5,packageUnit:'l',usageUnit:'ml',standardUnit:'ml'}),'can','ml'),5000);
  const material={purchaseUnit:'chai',unit:'g',conversion:250,purchasePrice:200000,unitSpec:spec()};assert.equal(materialUnitState(material).standardPrice,200);
  assert.equal(materialUnitState({...material,unitSpec:spec({priceBasis:'chai'})}).standardPrice,800);assert.equal(materialUnitState({...material,unitSpec:spec({priceStatus:'pending'})}).standardPrice,null);
  assert.equal(materialUnitState({...material,purchasePrice:1}).standardPrice,null);assert.equal(materialUnitState({...material,conversion:1000}).standardPrice,null);
});
test('Missing thresholds remain unconfigured while explicit zero and zero prices remain valid',()=>{
  const material=cleanRecord('materials',{name:'Test',purchaseUnit:'kg',unit:'g',conversion:'',purchasePrice:0,minimum:''});assert.equal(material.conversion,1000);assert.equal(material.minimum,'');
  const data={materials:[{recordId:'m',...material}],stock:[{materialId:'m',date:'2026-11-01',type:'nhap',quantity:10,unitCost:0}]};let row=inventory(data,'2026-11-02')[0];assert.equal(row.minimum,null);assert.equal(row.replenish,null);assert.match(row.completeness,/Chưa thiết lập/);data.materials[0].minimum=0;row=inventory(data,'2026-11-02')[0];assert.equal(row.minimum,0);assert.equal(row.replenish,0);
});
test('Pending catalog prices do not become zero COGS; historical receipts retain their standard-unit prices',()=>{
  const material={recordId:'m',purchaseUnit:'chai',unit:'g',conversion:250,purchasePrice:'',unitSpec:spec({priceStatus:'pending'})},data={materials:[material],recipes:[{recordId:'r',yield:1,lines:[{type:'material',id:'m',quantity:5}]}],stock:[]};
  assert.equal(costRecipe('r',1,data,'current').total,null);data.stock=[{materialId:'m',type:'nhap',date:'2026-11-01',unitCost:200}];assert.equal(costRecipe('r',1,data,'2026-11-02').total,1000);material.unit='ml';assert.equal(costRecipe('r',1,data,'2026-11-02').total,null);
});
test('Admin unit verification is signed, version checked, journaled and idempotent; staff cannot access it',()=>{
  const g=gas(),token=g.ctx.issueSession_('admin@example.com','admin').token;g.ctx.writeRow_('materials',{recordId:'m',version:1,deleted:false,name:'Test',purchaseUnit:'chai',unit:'g',conversion:250,purchasePrice:200000,minimum:''});
  const before=g.ctx.rawRows_('materials')[0],args={token,operation:'saveMaterialUnits',id:'m',expectedVersion:1,expectedHash:before._hash,key:'unit-save-fixture-0001',spec:spec()};
  assert.equal(send(g,'maintenance',args).ok,true);assert.equal(send(g,'maintenance',args).ok,true);const row=g.ctx.rawRows_('materials')[0];assert.equal(row.version,2);assert.equal(row.unitState.standardPrice,200);assert.equal(row.minimum,'');assert.equal(g.ctx.workflowRows_().filter(w=>w.kind==='material-units').length,1);
  assert.equal(send(g,'maintenance',{...args,key:'unit-save-fixture-0002'}).error.code,'CONFLICT');
  g.ctx.append_('_Users',['staff','staff@example.com','staff','{}',true,1]);const staff=g.ctx.issueSession_('staff@example.com','staff').token;assert.equal(send(g,'maintenance',{token:staff,operation:'inspectMaterialUnits'}).error.code,'FORBIDDEN');
});
test('Import preserves original price provenance atomically, and rejects unit relabeling after stock exists',()=>{
  const g=gas(),unit=spec({priceStatus:'pending'}),bundle={records:[{module:'materials',recordId:'m',record:{name:'Source',purchaseUnit:'chai',unit:'g',conversion:250,purchasePrice:'',minimum:''},unitSpec:unit}]};
  const preview=g.ctx.previewImport_(bundle);assert.equal(preview.errors.length,0);g.ctx.applyImport_(bundle,preview.digest,'unit-import-fixture-0001');let row=g.ctx.rawRows_('materials')[0];assert.equal(row.unitSpec.originalPrice,200000);assert.equal(row.unitState.standardPrice,null);assert.equal(g.ctx.workflowRows_().filter(w=>w.kind==='material-units').length,1);
  g.ctx.writeRow_('stock',{recordId:'s',version:1,date:'2026-11-01',materialId:'m',type:'nhap',quantity:1,unitCost:1,note:''});const token=g.ctx.issueSession_('admin@example.com','admin').token;
  const result=send(g,'maintenance',{token,operation:'saveMaterialUnits',id:'m',expectedVersion:row.version,expectedHash:row._hash,key:'unit-linked-fixture-0001',spec:spec({usageUnit:'kg',standardUnit:'kg'})});assert.equal(result.error.code,'LINKED');assert.equal(g.ctx.rawRows_('materials')[0].unit,'g');
  row={...g.ctx.rawRows_('materials')[0],unit:'ml'};assert.match(sourceIssues({materials:[row]})[0].message,/migration/);
});
test('Admin unit screen exposes price basis and source separately and displays unknown minimum',async()=>{
  const c=await client();c.run(`state.demo=false;call=async()=>({rows:[{recordId:'m',version:1,_hash:'h',name:'Material',purchaseUnit:'chai',unit:'g',conversion:250,purchasePrice:200000,minimum:'',unitState:{status:'pending',standardPrice:null}}],total:1,next:null});globalThis.unitCard=el('div');document.body.append(unitCard);renderMaterialUnitMaintenance(unitCard);`);
  const load=[...c.document.querySelectorAll('button')].find(n=>n.textContent==='Tải bảng quy đổi');load.click();for(let i=0;i<12;i++)await Promise.resolve();assert.match(c.run('unitCard.textContent'),/Chưa thiết lập/);assert.match(c.run('unitCard.textContent'),/Đơn vị tính đơn giá gốc/);assert.match(c.run('unitCard.textContent'),/Cần xác minh đơn giá/);
});
