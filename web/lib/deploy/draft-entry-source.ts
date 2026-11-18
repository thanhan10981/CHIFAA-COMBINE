import ts from 'typescript';
import {createHash} from 'node:crypto';
// Parse literals only. Never execute JavaScript, inline events or instructions in HTML.
export function extractDraftEntry(html:string){
 const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).join('\n');
 const file=ts.createSourceFile('source.js',script,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 function literal(node:ts.Expression):unknown{
  if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return node.text;
  if(ts.isNumericLiteral(node))return Number(node.text);
  if(node.kind===ts.SyntaxKind.NullKeyword)return null;
  if(node.kind===ts.SyntaxKind.TrueKeyword)return true;
  if(node.kind===ts.SyntaxKind.FalseKeyword)return false;
  if(ts.isArrayLiteralExpression(node))return node.elements.map(x=>literal(x as ts.Expression));
  if(ts.isObjectLiteralExpression(node))return Object.fromEntries(node.properties.map(p=>{if(!ts.isPropertyAssignment(p)||!p.name||!(ts.isIdentifier(p.name)||ts.isStringLiteral(p.name)))throw new Error('Nonliteral source property');return [p.name.text,literal(p.initializer)];}));
  if(ts.isPrefixUnaryExpression(node)&&node.operator===ts.SyntaxKind.MinusToken)return -Number(literal(node.operand));
  throw new Error('Executable source expression refused');
 }
 const names=['materials','stores','dishes','employees','v9DefaultPlans','v9InitialLoans','v9LegacyCash','v9CashCats','V14_NEW_TARGETS'];const values:Record<string,unknown>={};
 for(const statement of file.statements)if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations)if(ts.isIdentifier(declaration.name)&&names.includes(declaration.name.text)&&declaration.initializer)values[declaration.name.text]=literal(declaration.initializer);
 if(names.some(n=>!(n in values)))throw new Error('Incomplete source HTML');
 return {hash:createHash('sha256').update(html).digest('hex'),values};
}
export function buildEntrySourceImport(source:ReturnType<typeof extractDraftEntry>){
 const rows:{key:string;module:string;date:string|null;payload:unknown}[]=[];
 const array=(name:string)=>source.values[name] as Record<string,unknown>[];
 const iso=(x:unknown)=>{const s=String(x??'');if(/^\d{4}-\d\d-\d\d$/.test(s))return s;const m=/^(\d\d)\/(\d\d)\/(\d{4})$/.exec(s);return m?`${m[3]}-${m[2]}-${m[1]}`:null;};
 for(const [name,module] of [['materials','inventory'],['stores','sales'],['dishes','sales'],['employees','attendance'],['v9InitialLoans','loans'],['v9LegacyCash','cash']] as const)array(name).forEach((payload,i)=>rows.push({key:name+':'+i,module,date:iso(payload.date),payload}));
 const plans=source.values.v9DefaultPlans as {months:{month:string}[];targets:Record<string,unknown>};
 plans.months.forEach((month,i)=>rows.push({key:'plans:'+i,module:'targets',date:month.month+'-01',payload:{...month,targets:{...plans.targets,...source.values.V14_NEW_TARGETS as object}}}));
 for(const scope of ['receivables','payroll','production'])rows.push({key:'empty:'+scope,module:scope,date:null,payload:{status:'empty_in_source',note:'Không có phiếu giao dịch mặc định trong file phát thảo; không tự tạo số liệu.'}});
 const quote=(s:string)=>"'"+s.replaceAll("'","''")+"'";
 const sql=`-- Supplied HTML source, DEV after032. Preserve catalogue UUIDs and legacy evidence.\n-- Loans and explicit monthly targets are imported. Legacy cash stays read-only, as in the draft.\n-- No fabricated sale allocation, attendance, cash opening balance or stock posting.\ndo $source032$ declare source record;item record;row_id uuid;v_period uuid;document_id uuid;existing numeric;begin\n if current_user not in ('postgres','supabase_admin') then raise exception 'SQL_EDITOR_OWNER_REQUIRED';end if;\n perform pg_advisory_xact_lock(170032);\n if to_regclass('private.entry_source_rows') is null then raise exception 'PATCH_032_REQUIRED';end if;\n`+rows.map(row=>` insert into private.entry_source_rows(source_hash,source_key,module,business_date,payload) values(${quote(source.hash)},${quote(row.key)},${quote(row.module)},${row.date?quote(row.date)+'::date':'null'},${quote(JSON.stringify(row.payload))}::jsonb) on conflict(source_hash,source_key) do nothing;`).join('\n')+`
 for source in select * from private.entry_source_rows where source_hash=${quote(source.hash)} and source_key like 'v9InitialLoans:%' loop
  row_id=md5(source.source_hash||':'||source.source_key)::uuid;
  if not exists(select 1 from public.entry_journal where id=row_id) then
   if exists(select 1 from public.loans where name=source.payload->>'id') then raise exception 'SOURCE_LOAN_ALREADY_EXISTS_REVIEW_REQUIRED';end if;
   insert into public.loans(name,lender,borrowed_on,principal_vnd,due_on) values(source.payload->>'id',source.payload->>'lender',source.business_date,(source.payload->>'principal')::bigint,case when source.payload->>'term' is not null then (source.business_date+make_interval(months => (source.payload->>'term')::integer))::date end) returning id into document_id;
   insert into public.entry_journal(id,module,action,business_date,input,result) values(row_id,'loans','loan',source.business_date,source.payload||jsonb_build_object('source_hash',source.source_hash,'source_key',source.source_key),jsonb_build_object('id',document_id,'source_import',true));
  end if;
 end loop;
 for source in select * from private.entry_source_rows where source_hash=${quote(source.hash)} and source_key like 'plans:%' loop
  insert into public.target_periods(starts_on,ends_on,name) values(source.business_date,(source.business_date+interval '1 month -1 day')::date,to_char(source.business_date,'MM/YYYY')) on conflict(starts_on,ends_on) do update set name=public.target_periods.name returning id into v_period;
  for item in select key,value from jsonb_each(source.payload->'targets') where value<>'null'::jsonb and key<>'laborCost'
   union all select 'revenue',source.payload->'revenue' where source.payload->'revenue'<>'null'::jsonb
   union all select 'fixedBudget',source.payload->'fixed' where source.payload->'fixed'<>'null'::jsonb
   union all select 'profit',source.payload->'profit' where source.payload->'profit'<>'null'::jsonb loop
   row_id=md5(source.source_hash||':'||source.source_key||':'||item.key)::uuid;
   if exists(select 1 from public.entry_journal where id=row_id) then continue;end if;
   select value into existing from public.targets where public.targets.period_id=v_period and metric=item.key;
   if found and existing is distinct from (item.value#>>'{}')::numeric then raise exception 'SOURCE_TARGET_CONFLICT_REVIEW_REQUIRED';end if;
   insert into public.targets(period_id,metric,value,denominator) values(v_period,item.key,(item.value#>>'{}')::numeric,case when item.key in('foodCost','productionLabor','managementLabor','fixedRate','depreciationRate','marketingRate') then 'net_revenue' else null end) on conflict(period_id,metric) do update set value=public.targets.value returning id into document_id;
   insert into public.entry_journal(id,module,action,business_date,input,result) values(row_id,'targets','target',source.business_date,jsonb_build_object('metric',item.key,'value',item.value,'source_hash',source.source_hash,'source_key',source.source_key),jsonb_build_object('id',document_id,'source_import',true));
  end loop;
 end loop;
end $source032$;
select '032_SOURCE_READY' as status;
`;
 return {rows,sql,counts:Object.fromEntries([...new Set(rows.map(r=>r.module))].map(m=>[m,rows.filter(r=>r.module===m).length]))};
}
