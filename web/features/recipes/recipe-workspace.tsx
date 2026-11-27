'use client';
import {sortProductsByMenuOrder} from '@/lib/product-order';
import {loadRecipeMenuPages} from './recipe-catalog';
import Link from 'next/link';
import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import Decimal from 'decimal.js';
import {browserSupabase} from '@/lib/supabase/browser';
import {LoadingState,ToastNotice,useNotify} from '@/components/feedback';
import {Icon} from '@/components/icons';
import {formatQuantity,formatVnd,formatVndCurrency} from '@/lib/format';
import {RecipeForm} from './recipe-form';
import {today,recipeKinds,type Recipe,type Detail,type DetailLine} from './recipe-types';
import {publicationFailure,uncertainRecipeResponse,type RecipePublicationRequest,type RecipePublicationResult} from './recipe-publication';
import {recipeCalculationQueryKeys} from './recipe-cache';
import './recipes.css';
const views:Record<string,{title:string;kind:string}>={recipes:{title:'Công thức món ăn',kind:'product'},toppings:{title:'Công thức topping',kind:'topping'},batches:{title:'Công thức nhân & bán thành phẩm',kind:'sauce'},rice:{title:'Công thức cơm chín',kind:'rice'},packaging:{title:'Định mức bao bì từng đơn vị bán',kind:'packaging'},cost:{title:'Tổng hợp giá vốn',kind:'product'}};
const quantity=formatQuantity;
const massAmount=(value:string|null|undefined,unit:string|null|undefined)=>{
 if(value==null)return '—';
 const code=unit?.trim().toLocaleLowerCase('vi-VN');const amount=new Decimal(value);
 if(code==='kg'&&amount.abs().lt(1))return `${quantity(amount.mul(1000).toString())} g`;
 if((code==='g'||code==='gr'||code==='gram')&&amount.abs().gte(1000))return `${quantity(amount.div(1000).toString())} kg`;
 return `${quantity(value)}${unit?' '+unit:''}`;
};
const money=(value:string|null|undefined)=>value==null?'Chờ xác minh':formatVnd(value)+' đ';
const dateLabel=(value:string)=>value.split('-').reverse().join('/');
function FormulaConversion({line}:{line:DetailLine}){
 if(line.type==='recipe')return <span className="muted">Theo công thức con</span>;
 if(line.type!=='material')return <span>—</span>;
 if(line.formula_verified===undefined)return <span className="recipe-issue">Chưa tải được quy đổi công thức</span>;
 return <div className="recipe-formula-conversion">
  <strong>{line.formula_converted!=null&&line.formula_unit?`${quantity(line.formula_converted)} ${line.formula_unit}`:'Chưa xác minh'}</strong>
  {line.formula_quantity!=null&&line.formula_source_unit&&line.formula_unit?<small>1 {line.formula_source_unit} = {quantity(line.formula_quantity)} {line.formula_unit}</small>:<small>Theo ĐVT công thức</small>}
  {line.formula_effective_from&&<small>Từ {dateLabel(line.formula_effective_from)}</small>}
  {line.formula_issue&&<small className="recipe-issue">Chưa có quy đổi công thức đã xác minh tại ngày xem.</small>}
 </div>;
}
const costState=(recipe:Recipe,canReadCost:boolean)=>{
 if(!canReadCost)return {label:'Không có quyền xem cost',detail:''};
 if(!recipe.version_id)return {label:'Chưa có công thức hiệu lực',detail:'Chưa có phiên bản áp dụng tại ngày đã chọn.'};
 if(recipe.cost?.complete)return {label:'Đủ cost',detail:''};
 const missing=recipe.cost?.lines.filter(line=>line.unit_cost_vnd==null).map(line=>line.code+' — '+line.name)??[];
 if(missing.length)return {label:'Thiếu giá vật tư đã xác minh',detail:missing.join(', ')};
 if(recipe.review_issue)return {label:'Công thức cần đối chiếu',detail:recipe.review_issue};
 if(recipe.cost?.issue?.startsWith('UNIT_NEEDS_VERIFICATION'))return {label:'Chưa xác minh quy đổi công thức',detail:publicationFailure(recipe.cost.issue)};
 if(recipe.cost?.issue==='RECIPE_NEEDS_REVIEW')return {label:'Công thức cần đối chiếu',detail:'Có thành phần chưa liên kết hoặc dữ liệu công thức cần rà soát.'};
 if(recipe.cost?.issue==='CHILD_OUTPUT_UNIT_MISMATCH')return {label:'Sai đơn vị công thức con',detail:'Đơn vị thành phần phải khớp đơn vị đầu ra của công thức con.'};
 return {label:'Thiếu định lượng hoặc dữ liệu cost',detail:'Kiểm tra thành phần, số lượng và các công thức liên kết.'};
};
type Catalog={rows:Recipe[];total:number;stats:{products:number;batches:number;materials:number|null;unpriced:number|null}};
export function RecipeWorkspace({slug,userId,canCreate,canEdit,canReadCost,canApprove=false}:{slug:string;userId:string;canCreate:boolean;canEdit:boolean;canReadCost:boolean;canApprove?:boolean}){
 const meta=views[slug]??views.recipes,notify=useNotify(),cache=useQueryClient();
 const [search,setSearch]=useState(''),[filter,setFilter]=useState(''),[page,setPage]=useState(0),[date,setDate]=useState(today()),[selectedId,setSelectedId]=useState(''),[pinned,setPinned]=useState<Recipe|null>(null),[versionId,setVersionId]=useState(''),[editor,setEditor]=useState<'new'|'edit'|'clone'|null>(null),[showSource,setShowSource]=useState(false);
 const list=useQuery({queryKey:[userId,'recipe-catalog',meta.kind,date,filter,page],queryFn:async()=>{const read=async(offset:number,limit=25)=>{const {data,error}=await browserSupabase().rpc('recipe_catalog',{p_kind:meta.kind,p_date:date,p_search:filter,p_offset:offset,p_limit:limit});if(error)throw new Error('Chưa tải được công thức. Kiểm tra quyền và bản cập nhật027.');return data as unknown as Catalog;};if(meta.kind!=='product')return read(page*25);const all=await loadRecipeMenuPages(read);return {...all,rows:all.rows.slice(page*25,page*25+25)};}});
 const catalogRows=meta.kind==='product'?sortProductsByMenuOrder(list.data?.rows??[]):list.data?.rows??[];
 const selected=pinned??catalogRows.find(r=>r.id===selectedId)??catalogRows[0];
 const activeId=versionId||selected?.version_id||'';
 const detail=useQuery({queryKey:[userId,'recipe-detail',activeId,date],enabled:slug!=='cost'&&!!activeId,queryFn:async()=>{const {data,error}=await browserSupabase().rpc('recipe_detail',{p_version:activeId,p_date:date});if(error)throw new Error(error.code==='42702'?'Chi tiết công thức bị lỗi truy vấn 42702 (bí danh “v” bị trùng). Hãy áp dụng migration 074 để khôi phục phần chi tiết và topping.':`Chưa đọc được chi tiết công thức (${error.code??'lỗi RPC'}).`);return data as unknown as Detail;}});
 const [publishPending,setPublishPending]=useState<RecipePublicationRequest|null>(null);
 const publish=useMutation({retry:false,mutationFn:async()=>{
  let request=publishPending;
  if(!request){
   if(!activeId||!canApprove||!date)throw new Error('Chọn công thức, ngày công bố và kiểm tra quyền duyệt.');
   const {data:current,error}=await browserSupabase().from('recipe_versions').select('version').eq('id',activeId).single();
   if(error)throw new Error('Chưa đọc được phiên bản công thức để công bố. Tải lại dữ liệu rồi thử lại.');
   request={p_version:activeId,p_expected_version:String(current.version),p_effective_from:date,p_key:crypto.randomUUID()};
   setPublishPending(request);
  }
  const {data,error}=await browserSupabase().rpc('publish_recipe_at',request);
  if(error){if(!uncertainRecipeResponse(error.code))setPublishPending(null);throw new Error(publicationFailure(error.message,error.code));}
  const result=data as RecipePublicationResult;
  if(!result?.version_id)throw new Error('Chưa nhận đủ xác nhận công bố. Bấm “Kiểm tra lại lần công bố” để nhận đúng phiên bản.');
  return result;
 },onSuccess:async result=>{
  setPublishPending(null);
  await selectSavedRecipe(result.recipe_id,result.version_id,result.effective_from);
  await Promise.all(recipeCalculationQueryKeys.map(key=>cache.invalidateQueries({queryKey:[userId,key]})));
  notify('Đã kiểm tra và công bố công thức cùng các công thức con từ '+dateLabel(result.effective_from)+'.','success');
 },onError:error=>notify(error.message,'error')});
 const publicationLocked=publish.isPending||!!publishPending;
 const choose=(r:Recipe)=>{if(publicationLocked)return;setPinned(null);setSelectedId(r.id);setVersionId('');setShowSource(false);};
 async function openChild(id:string,childVersion:string){if(publicationLocked)return;const {data,error}=await browserSupabase().from('recipes').select('id,code,name,kind,version').eq('id',id).single();if(error){notify('Chưa mở được công thức con.','error');return;}setPinned({...data,version:String(data.version),version_id:childVersion} as Recipe);setVersionId(childVersion);setShowSource(false);}
 async function selectSavedRecipe(id:string,savedVersionId:string,effectiveFrom:string){
  setEditor(null);setSelectedId(id);setVersionId(savedVersionId);setDate(effectiveFrom);setShowSource(false);
  // A child opened from another recipe group is absent from this group's list.
  // Preserve its identity while reading its newly incremented edit version.
  setPinned(selected?.id===id?{...selected,version_id:savedVersionId}:null);
  const {data,error}=await browserSupabase().from('recipes').select('id,code,name,kind,version').eq('id',id).single();
  if(!error)setPinned({...data,version:String(data.version),version_id:savedVersionId} as Recipe);
 }
 const v=detail.data?.version,cost=detail.data?.cost;
 const stats=list.data?.stats;
 return <section className="recipe-catalog"><div className="page-heading"><div><p className="eyebrow">CHIFAA COMBINE / QUẢN LÝ VẬN HÀNH</p><h1>{meta.title}</h1><p>{slug==='cost'?'Tính giá vốn theo định lượng công thức, giá vật tư đã xác minh và ngày hiệu lực.':'Định lượng theo mẻ, công thức liên kết và giá vốn theo ngày hiệu lực.'}</p></div>{slug!=='cost'&&canCreate&&canReadCost&&<button className="button primary" disabled={publicationLocked} onClick={()=>setEditor('new')}><Icon name="plus" size={16}/>Thêm công thức</button>}</div>
 <div className="stats">{[['Món ăn đang quản lý',stats?.products,'Công thức món ăn'],['Công thức mẻ',stats?.batches,'Nhân, sốt, cơm và bao bì'],['Vật tư trong danh mục',stats?.materials,'Dùng chung danh mục vật tư'],['Vật tư chờ xác minh giá',stats?.unpriced,'Cần kiểm tra cơ sở giá']].map(([label,value,caption],i)=><div className="stat" key={String(label)}><div><label>{label}</label><strong>{value??'—'}</strong><span>{caption}</span></div><div className="stat-icon"><Icon name={['recipe','box','dashboard','warning'][i]}/></div></div>)}</div>
 <nav className="recipe-links" aria-label="Liên kết công thức">{Object.entries(views).map(([key,value])=><Link key={key} href={'/app/'+key} aria-current={slug===key?'page':undefined}>{value.title}</Link>)}<Link href="/app/materials">Danh mục vật tư</Link><Link href="/app/products">Món bán</Link></nav>
 <form className="recipe-filters" onSubmit={e=>{e.preventDefault();setPage(0);setFilter(search.trim());setPinned(null);setVersionId('');}}><label>Tìm mã hoặc tên<input disabled={publicationLocked} placeholder="Tìm mã hoặc tên công thức…" value={search} onChange={e=>setSearch(e.target.value)}/></label><button className="button" type="submit" disabled={publicationLocked}><Icon name="search" size={16}/>Tìm</button><label>Ngày xem & công bố<input aria-label="Ngày xem và công bố công thức" type="date" required disabled={publicationLocked} value={date} onChange={e=>{setDate(e.target.value);if(!pinned)setVersionId('');}}/></label></form>
 {slug==='cost'&&<section className="card cost-report"><div className="card-head"><div><h3>Giá vốn công thức / đơn vị bán</h3><p>Giá vốn được tính theo BOM, giá vật tư và ngày hiệu lực.</p></div></div>{list.data&&<div className="recipe-total cost-summary-total"><strong>Kết quả: {list.data.total} công thức</strong><span>Trang {page+1}: {list.data.rows.filter(row=>row.cost?.complete).length} đủ cost · Chưa đủ dữ liệu: {list.data.rows.filter(row=>!row.cost?.complete).length} công thức</span></div>}<div className="tablebox"><table className="table"><thead><tr>{['STT','Mã','Tên công thức','Đầu ra / mẻ','Giá vốn / mẻ','Giá vốn / đơn vị bán','Cost nguồn','Tình trạng'].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>{list.isPending?<tr><td colSpan={8}><LoadingState label="Đang tính giá vốn…"/></td></tr>:catalogRows.map((r,i)=>{const state=costState(r,canReadCost);return <tr key={r.id}><td>{page*25+i+1}</td><td>{r.code}</td><td className="strong">{r.name}</td><td>{quantity(r.output_quantity)} {r.output_unit}</td><td>{canReadCost&&r.cost?.complete?money(r.cost.total_vnd):canReadCost?'Chưa đủ dữ liệu':'—'}</td><td>{canReadCost&&r.cost?.complete&&r.cost.total_vnd&&r.output_quantity?formatVndCurrency(new Decimal(r.cost.total_vnd).div(r.output_quantity).mul(r.sale_quantity??1).toString())+' đ':'—'} / {r.sale_unit??r.output_unit}</td><td>{canReadCost?r.source_reference??'—':'—'}</td><td><span>{state.label}</span>{state.detail&&<small className="cost-status-note">{state.detail}</small>}</td></tr>;})}</tbody></table>{list.data?.total===0&&<p className="reference-recipe-empty">Chưa có công thức phù hợp.</p>}</div><div className="toolbar cost-pagination"><span>{list.data?.total?`Trang ${page+1} / ${Math.ceil(list.data.total/25)}`:'Không có trang dữ liệu'}</span><div><button className="button" disabled={!page||list.isPending} onClick={()=>setPage(page-1)}>Trang trước</button><button className="button" disabled={!list.data||list.isPending||(page+1)*25>=list.data.total} onClick={()=>setPage(page+1)}>Trang sau</button></div></div><p className="note">Không thay cost thiếu bằng 0. Nếu công thức thiếu định lượng, giá vật tư hoặc quy đổi đã xác minh, hệ thống giữ trạng thái chưa đủ và nêu nguyên nhân để bổ sung dữ liệu.</p></section>}
 {slug!=='cost'&&<div className="split recipe-split"><section className="card recipe-selector"><div className="card-head"><div><h3>Danh sách {recipeKinds[meta.kind].toLowerCase()}</h3><p>{list.data?.total??'—'} công thức</p></div></div><div className="recipe-list">{list.isPending?<LoadingState label="Đang tải công thức…"/>:catalogRows.map(r=><button disabled={publicationLocked} className={'recipe-row'+(selected?.id===r.id?' on':'')} key={r.id} onClick={()=>choose(r)}><span className="initial"><Icon name="recipe"/></span><span className="rec-text"><b title={r.name}>{r.name}</b><small>{r.code} · {quantity(r.output_quantity)} {r.output_unit}/mẻ</small></span><span className="rec-cost">{canReadCost?(r.cost?.complete?money(r.cost.total_vnd):'Chờ xác minh'):'—'}</span></button>)}</div>{list.data?.total===0&&<p className="reference-recipe-empty">Chưa có công thức phù hợp.</p>}<div className="toolbar"><button className="button" disabled={!page} onClick={()=>{setPage(page-1);setPinned(null);setVersionId('');}}>Trước</button><span>Trang {page+1}</span><button className="button" disabled={!list.data||(page+1)*25>=list.data.total} onClick={()=>{setPage(page+1);setPinned(null);setVersionId('');}}>Sau</button></div></section>
 <section className="card detail" id="recipe-detail"><div className="detail-head"><div className="detail-top"><span className="badge badge-orange">{selected?.code??'Công thức'}</span><div className="recipe-actions">{canCreate&&canReadCost&&detail.data&&<button className="button" disabled={publicationLocked} onClick={()=>setEditor('clone')}><Icon name="copy" size={16}/>Sao chép</button>}{canEdit&&canReadCost&&detail.data&&<button className="button" disabled={publicationLocked} onClick={()=>setEditor('edit')}><Icon name="edit" size={16}/>Chỉnh sửa</button>}</div></div><h3>{selected?.name??'Chọn công thức'}</h3><p className="meta">{recipeKinds[selected?.kind??meta.kind]}</p>{v&&<div className="recipe-publication-status"><span className={'badge '+(v.status==='published'?'badge-blue':'badge-orange')}>{v.status==='published'?'Đã công bố':v.status==='draft'?'Bản nháp':'Đã ngừng dùng'} · phiên bản {v.revision}</span><span>Áp dụng từ {dateLabel(v.effective_from)}</span>{canApprove&&canEdit&&v.status==='draft'&&<button className="button" disabled={publish.isPending} onClick={()=>publish.mutate()}>{publish.isPending?'Đang kiểm tra…':publishPending?'Kiểm tra lại lần công bố':'Kiểm tra & công bố'}</button>}</div>}{v?.review_issue&&<p className="warning-note">{v.review_issue}</p>}{v?.status==='draft'&&<p className="note">Kiểm tra và công bố từ {dateLabel(date)} theo ngày đã chọn ở trên. Các công thức con còn nháp từ ngày cũ được tạo phiên bản mới với cùng định lượng và đơn vị để áp dụng từ ngày này; công thức đã công bố và chứng từ đã chốt giữ lịch sử của mình.</p>}{detail.data?.source?.raw&&<button className="button" onClick={()=>setShowSource(!showSource)}>{showSource?'Ẩn':'Xem'} dữ liệu nguồn</button>}{showSource&&detail.data?.source&&<div className="recipe-source"><p>Giá nguồn tham khảo không thay thế giá đã xác minh.</p>{detail.data.source.reference&&<p>Cost nguồn: {detail.data.source.reference} đ</p>}<pre>{detail.data.source.raw?.map(row=>row.filter(Boolean).join(' | ')).join('\n')}</pre></div>}
 <div className="pillrow"><div className="pill"><label>Sản lượng / mẻ</label><b>{quantity(v?.output_quantity)} {v?.output_unit}</b></div><div className="pill"><label>Giá vốn / mẻ</label><b>{!canReadCost?'Không có quyền':cost?.complete?money(cost.total_vnd):'Chưa đủ dữ liệu'}</b></div><div className="pill"><label>Giá vốn / {v?.output_unit??'đơn vị'}</label><b>{cost?.complete&&cost.total_vnd&&v?money(new Decimal(cost.total_vnd).div(v.output_quantity).toFixed(2)):'—'}</b></div><div className="pill"><label>Số thành phần trực tiếp</label><b>{detail.data?.lines.length??'—'}</b></div></div>{cost&&!cost.complete&&<p className="warning-note">Chưa đủ dữ liệu để xác định giá vốn chính thức. Kiểm tra thành phần, công thức con và cơ sở giá.</p>}</div>
 <div className="section-label">Chi tiết định lượng & giá vốn</div>{detail.isFetching?<LoadingState label="Đang đọc chi tiết…"/>:<div className="tablebox"><table className="table"><thead><tr>{['STT','Mã SP','Nguyên liệu / Thành phần','ĐVT công thức','Định lượng mẻ','/ 1 '+(v?.output_unit??'đơn vị'),'Quy đổi công thức','Đơn giá / ĐVT công thức','Thành tiền'].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{detail.data?.lines.map((line,i)=><tr key={line.id}><td>{i+1}</td><td>{line.type==='recipe'&&line.recipe_id&&line.target_id?<button className="recipe-text-link" onClick={()=>void openChild(line.recipe_id!,line.target_id!)}>{line.code}</button>:line.type==='material'?<Link href="/app/materials">{line.code}</Link>:'—'}</td><td><b>{line.name}</b>{line.cost_exempt&&<span className="badge badge-orange">Không tính giá</span>}{line.type==='recipe'&&<span className="badge badge-blue">Công thức liên kết</span>}{line.issue&&<small className="recipe-issue">{publicationFailure(line.issue)}</small>}</td><td>{line.unit}</td><td className="right" title={line.type==='material'&&line.quantity?`${quantity(line.quantity)} ${line.unit}`:undefined}>{line.type==='material'?massAmount(line.quantity,line.unit):quantity(line.quantity)}</td><td className="right" title={line.type==='material'&&line.per_output?`${quantity(line.per_output)} ${line.unit}`:undefined}>{line.type==='material'?massAmount(line.per_output,line.unit):quantity(line.per_output)}</td><td><FormulaConversion line={line}/></td><td className="right">{canReadCost?money(line.unit_cost_vnd):'—'}</td><td className="right">{canReadCost?money(line.line_cost_vnd):'—'}</td></tr>)}</tbody></table>{!detail.data&&<p className="reference-recipe-empty">Chọn phiên bản để xem thành phần.</p>}</div>}
 <div className="recipe-total"><strong>TỔNG COST / {quantity(v?.output_quantity)} {v?.output_unit}</strong><strong>{cost?.complete?money(cost.total_vnd):'Chưa đủ dữ liệu'}</strong></div><div className="note">Quy đổi công thức lấy từ Quy cách vật tư đã lưu và xác minh tại ngày xem. Ngày bắt đầu áp dụng có hiệu lực cho các ngày tiếp theo, không cần lưu lại mỗi ngày. Công thức con trong bản nháp tự cập nhật theo lần sửa mới nhất; công thức đã công bố và snapshot sản xuất giữ nguyên phiên bản. Vật tư lấy giá theo ngày xem. Giá thiếu hoặc quy đổi chưa xác minh không được tính thành 0. Định lượng dự kiến khác với xuất kho thực tế.</div>
 {selected?.kind==='product'&&!!detail.data?.toppings?.length&&<section className="recipe-topping-costs"><div><h4>Giá vốn topping tùy chọn (tách riêng)</h4><p>Giá vốn món chính ở trên không cộng topping. Mỗi topping được tính theo số món khách phân bổ; không làm thay đổi giá bán.</p></div>{detail.data.toppings.map(t=><div key={t.version_id}><span>{t.code} · {t.name} ({quantity(t.output_quantity)} {t.output_unit})</span><strong>{canReadCost&&t.cost?.complete&&t.cost.total_vnd?`${money(new Decimal(t.cost.total_vnd).div(t.output_quantity).toFixed(2))} / ${t.output_unit} · ${money(t.cost.total_vnd)} / mẻ`:'Chưa đủ dữ liệu cost'}</strong></div>)}</section>}{sortProductsByMenuOrder(detail.data?.products??[]).map(p=><p className="note" key={p.id}>Đã liên kết <Link href="/app/products">{p.code} — {p.name}</Link>: {quantity(p.quantity)} {v?.output_unit}/món.</p>)}
 </section></div>}
 {(list.error||detail.error)&&<ToastNotice tone="error" message={list.error?.message||detail.error?.message}/>}
 {editor&&<RecipeForm key={editor+activeId} userId={userId} defaultDate={date} kind={meta.kind} recipe={editor==='new'?undefined:selected} detail={editor==='new'?undefined:detail.data} clone={editor==='clone'} canApprove={canApprove&&canEdit} onClose={()=>setEditor(null)} onSaved={(id,savedVersionId,effectiveFrom)=>void selectSavedRecipe(id,savedVersionId,effectiveFrom)}/>}
 </section>;
}
