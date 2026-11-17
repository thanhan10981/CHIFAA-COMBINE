import {createHash} from 'node:crypto';
export type SourceLine={code:string;label:string;unit:string;quantity:string|null;child?:string;issue?:string;raw:string[]};
export type SourceRecipe={code:string;name:string;kind:string;output:string;unit:string;items:SourceLine[];issue:string;raw:string[][];product?:string;productQuantity?:string;reference?:string};
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/Đ/g,'D').replace(/đ/g,'d').toUpperCase().replace(/\s+/g,' ').trim();
export function sourceNumber(value:string):string|null{const s=value.trim().replace(/\./g,'').replace(',','.');return /^\d+(\.\d+)?$/.test(s)?s:null;}
const numeric=(s:string)=>sourceNumber(s)??'';
export function parseRecipeSource(text:string,products:{code:string;name:string}[]){
 const rows=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(line=>line.split('\t').map(v=>v.trim())).filter(row=>row.some(Boolean));
 const recipes:SourceRecipe[]=[];const summary=rows.filter(r=>/^\d+$/.test(r[0])&&r[5]?.startsWith('1 ')&&r[1]);
 const matchProduct=(name:string)=>products.find(p=>norm(p.name)===norm(name));
 const starts=rows.map((r,i)=>({r,i})).filter(({r})=>r[0]&&r.slice(1).every(v=>!v)&&(/^(CƠM NẮM|CƠM CUỘN|CÔNG THỨC NHÂN [^/]|SỐT PHÔ MAI \(|CÔNG THỨC CƠM \()/u.test(r[0])));
 let batch=0;
 for(let n=0;n<starts.length;n++){
  const {r,i}=starts[n],title=r[0];const end=starts[n+1]?.i??rows.findIndex((r,j)=>j>i&&r[0].startsWith('CHI PHÍ BAO BÌ'));
  const raw=rows.slice(i,end<0?rows.length:end);const rice=title.startsWith('CÔNG THỨC CƠM ('),sauce=title.startsWith('CÔNG THỨC NHÂN ')||title.startsWith('SỐT PHÔ MAI (');
  const name=title.replace(/^CÔNG THỨC /u,'').replace(/ \(1 MẺ.*$/u,'');const product=matchProduct(title);
  const code=rice?'B-RICE':sauce?'B'+String(++batch).padStart(3,'0'):product?.code;
  if(!code)throw new Error('Không tìm được món bán cho '+title);
  const yieldRow=raw.find(r=>/^Số phần/.test(r[0]));
  const items=raw.filter(r=>/^\d+$/.test(r[0])&&r[3]).map(r=>({code:r[1],label:r[2]||r[1],unit:r[3],quantity:sourceNumber(r[4]??''),raw:r}));
  const common=rows.find(r=>r[0].startsWith('Khối lượng cơm chín'));
  recipes.push({code,name:rice?'CƠM CHÍN (1 KG GẠO)':name,kind:rice?'rice':sauce?'sauce':'product',output:rice?numeric(common?.[4]??''):sauce?numeric(yieldRow?.[2]??''):'1',unit:rice?'g':'phần',items,issue:'',raw,product:product?.code,productQuantity:'1',reference:summary.find(r=>norm(r[1])===norm(title))?.[6]});
 }
 const rice=recipes.find(r=>r.kind==='rice');if(!rice?.output)throw new Error('Thiếu sản lượng cơm chín trong thông số chung');
 // Resolve named nested recipes; quantity/unit contradictions remain unresolved lines.
 for(const recipe of recipes)for(const item of recipe.items){
  if(item.code)continue;
  if(/^Cơm/.test(item.label)){item.child=rice.code;continue;}
  const base=norm(item.label).replace(/ \(.*$/,'');
  const child=recipes.find(r=>r.kind==='sauce'&&(norm(r.name)===base||norm(r.name).replace(' SOT BO TOI','')===base.replace(' SOT BO TOI','')));
  if(child){if(/\(1 phần/.test(item.label)&&item.quantity!=='1')item.issue='Tên ghi 1 phần sốt nhưng định lượng ghi '+item.quantity+' phần; cần xác minh, không tự đổi thành gram';else item.child=child.code;}
  else item.issue='Thành phần chưa có mã vật tư/công thức: '+item.label;
 }
 const packagingStart=rows.findIndex(r=>r[0].startsWith('CHI PHÍ BAO BÌ'));
 const packaging=rows.slice(packagingStart);const divide=packaging.findIndex(r=>r[2]?.startsWith('6 món'));
 const packs=[{code:'PK-CC',name:'BAO BÌ CƠM CUỘN',unit:'hộp',raw:packaging.slice(0,divide)},{code:'PK-CN',name:'BAO BÌ CƠM NẮM',unit:'phần',raw:packaging.slice(divide)}];
 for(const pack of packs)recipes.push({...pack,kind:'packaging',output:'1',issue:'',items:pack.raw.filter(r=>r[1]&&r[3]&&(!r[0]||/^\d+$/.test(r[0]))).map(r=>({code:r[1],label:r[2]||r[1],unit:r[3],quantity:sourceNumber(r[4]??''),raw:r}))});
 for(const recipe of recipes.filter(r=>r.kind==='product')){
  if(norm(recipe.name).startsWith('COM NAM')){recipe.items=recipe.items.filter(i=>i.code!=='TEM');recipe.items.push({code:'',label:'Bao bì cơm nắm',child:'PK-CN',unit:'phần',quantity:'1',raw:[]});}
  else {
   // Keep integer slice counts. A whole roll yields N slices; a box consumes M slices.
   const cuts=recipe.raw.find(r=>r[2]==='Số lát cắt / 1 cây'),box=recipe.raw.find(r=>r[2]==='Số lát / 1 hộp');
   if(!cuts||!box)throw new Error('Thiếu số lát cây/hộp: '+recipe.code);
   const whole=products.find(p=>norm(p.name)===norm(recipe.name)+' NGUYEN CAY');if(!whole)throw new Error('Thiếu món nguyên cây');
   const tree={...recipe,code:whole.code,name:whole.name,output:numeric(cuts[6]),unit:'lát',product:whole.code,productQuantity:numeric(cuts[6]),items:recipe.items.map(i=>({...i})),reference:summary.find(r=>norm(r[1])===norm(whole.name))?.[6]};
   recipes.push(tree);recipe.unit='hộp';recipe.items=[{code:'',label:tree.name,child:tree.code,unit:'lát',quantity:numeric(box[6]),raw:box},{code:'',label:'Bao bì cơm cuộn',child:'PK-CC',unit:'hộp',quantity:'1',raw:[]}];
  }
 }
 for(const row of summary){const p=matchProduct(row[1]);if(p&&!recipes.some(r=>r.product===p.code))recipes.push({code:p.code,name:p.name,kind:'product',output:'1',unit:row[5].slice(2),product:p.code,productQuantity:'1',reference:row[6],issue:'Nguồn chỉ có giá tham khảo, chưa có định lượng thành phần',items:[{code:'',label:'Chưa có công thức chi tiết',quantity:null,unit:'',issue:'Thiếu định lượng từ nguồn',raw:row}],raw:[row]});}
 if(recipes.filter(r=>r.kind==='product').length!==summary.length||recipes.some(r=>!r.output)||new Set(recipes.map(r=>r.code)).size!==recipes.length)throw new Error('Không khớp số công thức/sản lượng/mã với bảng nguồn');
 return {hash:createHash('sha256').update(text).digest('hex'),recipes,raw:rows};
}
export function buildRecipeImport(source:ReturnType<typeof parseRecipeSource>,date:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Ngày không hợp lệ');
 const payload=JSON.stringify(source).replace(/'/g,"''");
 return `-- CHIFAA: import supplied recipe sheet as DRAFTS after patch027 and material/commercial imports.
-- Preserves raw source, stable IDs, nested draft links, unresolved lines. No official publication or stock posting.
do $recipe_import$
declare src jsonb='${payload}'::jsonb;r jsonb;i jsonb;recipe uuid;v uuid;target uuid;u uuid;child uuid;seq integer;mapping jsonb='{}';
begin
 if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;
 if to_regprocedure('public.recipe_detail(uuid,date)') is null then raise exception 'RECIPE_PATCH_027_REQUIRED';end if;
 perform set_config('lock_timeout','5s',true);perform pg_advisory_xact_lock(170011);
 if exists(select 1 from public.app_settings where key='recipe_import:'||(src->>'hash')) then return;end if;
 insert into public.material_units(code,name,dimension) values('phần','Phần','count'),('hộp','Hộp','package'),('cây','Cây','count'),('lát','Lát','count') on conflict(code) do nothing;
 for r in select * from jsonb_array_elements(src->'recipes') loop
 if exists(select 1 from public.recipes where code=r->>'code') then raise exception 'EXISTING_RECIPE_REVIEW: %',r->>'code';end if;
 select id into strict u from public.material_units where code=r->>'unit' and not archived;
 insert into public.recipes(code,name,kind) values(r->>'code',r->>'name',r->>'kind') returning id into recipe;
 insert into public.recipe_versions(recipe_id,revision,effective_from,output_quantity,output_unit_id,review_issue) values(recipe,1,'${date}',(r->>'output')::numeric,u,r->>'issue') returning id into v;
 mapping=mapping||jsonb_build_object(r->>'code',v);
 insert into private.catalog_sources(entity,entity_id,source_hash,source_data) values('recipe:source',v,src->>'hash',r);
 end loop;
 for r in select * from jsonb_array_elements(src->'recipes') loop
 v=(mapping->>(r->>'code'))::uuid;seq=0;
 for i in select * from jsonb_array_elements(r->'items') loop
 seq=seq+1;target=null;child=null;u=null;
 select id into u from public.material_units where code=i->>'unit' and not archived;
 if i->>'child' is not null then child=(mapping->>(i->>'child'))::uuid;
 else select id into target from public.materials where code=i->>'code' and not archived;end if;
 if coalesce(i->>'issue','')<>'' or(target is null and child is null) or u is null or i->>'quantity' is null or (i->>'quantity')::numeric<=0 then
 insert into public.recipe_unresolved_items(recipe_version_id,label,quantity,unit_label,issue,sort_order) values(v,i->>'label',(i->>'quantity')::numeric,i->>'unit',coalesce(nullif(i->>'issue',''),'Chưa liên kết được vật tư/đơn vị từ nguồn'),seq);
 else insert into public.recipe_items(recipe_version_id,material_id,child_version_id,quantity,unit_id,sort_order) values(v,target,child,(i->>'quantity')::numeric,u,seq);end if;
 end loop;
 end loop;
 insert into private.catalog_sources(entity,source_hash,source_data) values('recipe:original',src->>'hash',src->'raw');
 insert into public.app_settings(key,value) values('recipe_import:'||(src->>'hash'),jsonb_build_object('recipes',jsonb_array_length(src->'recipes'),'effective_from','${date}','published',false,'inventory_posted',false));
end $recipe_import$;
select r.code,r.name,v.status,v.review_issue,(select count(*) from public.recipe_unresolved_items where recipe_version_id=v.id) unresolved from public.recipes r join public.recipe_versions v on v.recipe_id=r.id order by r.kind,r.code;
`;
}
