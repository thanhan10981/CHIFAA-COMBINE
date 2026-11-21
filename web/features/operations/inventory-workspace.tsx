'use client';
import {ingredientWarehouseId,IngredientWarehouseStatus} from '@/features/operations/ingredient-warehouse';
import {useState,useEffect,useRef,type ChangeEvent} from 'react';
import {useSearchParams} from 'next/navigation';
import Link from 'next/link';
import Decimal from 'decimal.js';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {ActionDialog,LoadingState,ToastNotice} from '@/components/feedback';
import {browserSupabase} from '@/lib/supabase/browser';
import {materialCategories,localDate} from '@/features/catalog/material-types';
import {formatQuantity,formatVnd} from '@/lib/format';
import {Icon} from '@/components/icons';
import {createInventoryWorkbook,parseInventoryWorkbook,type InventoryImportRow} from './inventory-excel';
import './inventory-workspace.css';
type Row={id:string;code:string;name:string;category:string;unit_id:string|null;unit:string|null;quantity:string|null;minimum:string|null;needed:string|null;suggested:string|null;status:string;stock_average_unit_cost:string|null};
type Result={rows:Row[];total:number;summary:{materials:number;known:number;unknown:number;low:number};needs_complete:boolean;planned:boolean;inventory_version:string};
type History={id:string;line_id:string;movement_version:string|null;line_version:string|null;moved_on:string;kind:string;status:string;note:string;source_batch_id:string|null;reverses_id:string|null;created_at:string;created_by:string;code:string;name:string;unit:string;quantity:string;unit_cost:string|null;unit_cost_source:string;line_value:string|null};
type Request={action:string;args:Record<string,unknown>};
const labels:Record<string,string>={unknown:'Chưa có số liệu tồn',low:'Dưới tối thiểu',ok:'Đủ tối thiểu',minimum_missing:'Chưa đặt tối thiểu',unit_missing:'Chưa có ĐVT chuẩn',receipt:'Nhập kho',issue:'Xuất kho',adjustment:'Điều chỉnh',reversal:'Đảo phiếu'};
const nextDay=(date:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return '';const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);};
export function InventoryWorkspace({slug,userId,canPost,canCount,canCorrect,canExport,canImport}:{slug:string;userId:string;canPost:boolean;canCount:boolean;canCorrect:boolean;canExport:boolean;canImport:boolean}){
 const params=useSearchParams(),initialDate=/^\d{4}-\d\d-\d\d$/.test(params.get('date')??'')?params.get('date')!:localDate(),historyMaterial=params.get('material')||null;
 const cache=useQueryClient(),[date,setDate]=useState(initialDate),[needDate,setNeedDate]=useState(''),[search,setSearch]=useState(''),[category,setCategory]=useState(''),[status,setStatus]=useState(slug==='reorder'?'attention':'all'),[offset,setOffset]=useState(0);
 const [editor,setEditor]=useState<{row:Row;kind:string;version:string}|null>(null),[quantity,setQuantity]=useState(''),[unitCost,setUnitCost]=useState(''),[pending,setPending]=useState<Request|null>(null),[message,setMessage]=useState('');
 const [messageError,setMessageError]=useState(''),[importPreview,setImportPreview]=useState<InventoryImportRow[]|null>(null),[importFileName,setImportFileName]=useState(''),[pendingImport,setPendingImport]=useState<Request|null>(null),[importHistoryDate,setImportHistoryDate]=useState('');
 const [exporting,setExporting]=useState(false),fileInput=useRef<HTMLInputElement>(null);
 const [correction,setCorrection]=useState<History|null>(null),[correctionQuantity,setCorrectionQuantity]=useState(''),[correctionUnitCost,setCorrectionUnitCost]=useState(''),[correctionReason,setCorrectionReason]=useState(''),[pendingCorrection,setPendingCorrection]=useState<Request|null>(null);
 const historyMode=slug==='stockhistory',reorder=slug==='reorder',needsOn=needDate||nextDay(date);
 const warehouses=useQuery({queryKey:[userId,'inventory','warehouses'],queryFn:async()=>{const {data,error}=await browserSupabase().from('warehouses').select('id,name').eq('active',true).eq('kind','ingredient').order('name');if(error)throw new Error('Không tải được kho. Kiểm tra kết nối và quyền xem Kho.');return data as {id:string;name:string}[];}});
 const warehouse=ingredientWarehouseId(warehouses.data);
 const query=useQuery({queryKey:[userId,'inventory','workspace',warehouse,date,needsOn,search,category,status,offset],enabled:!!warehouse&&!!date&&!!needsOn&&!historyMode,queryFn:async()=>{const {data,error}=await browserSupabase().rpc('inventory_workspace',{p_warehouse:warehouse,p_date:date,p_need_date:needsOn,p_search:search,p_category:category,p_status:status,p_offset:offset});if(error)throw new Error('Chưa tải được bảng tồn. Cần bản cập nhật kho 030 và quyền xem Kho.');return data as Result;}});
 const history=useQuery({queryKey:[userId,'inventory','history',warehouse,date,historyMaterial,offset],enabled:!!warehouse&&!!date&&historyMode,queryFn:async()=>{const {data,error}=await browserSupabase().rpc('inventory_history',{p_warehouse:warehouse,p_date:date,p_material:historyMaterial,p_offset:offset});if(error)throw new Error('Chưa tải được lịch sử kho. Cần bản cập nhật kho 030/046 để xem giá từng lần nhập.');return data as History[];}});
 const save=useMutation({retry:false,mutationFn:async()=>{
  if(!editor||!warehouse||!query.data)throw new Error('Chọn kho và vật tư trước khi ghi phiếu.');
  let request=pending;
  if(!request){if(!/^\d+(?:\.\d{1,6})?$/.test(quantity)||new Decimal(quantity).gte('1e14')||editor.kind!=='count'&&new Decimal(quantity).lte(0))throw new Error('Nhập số lượng hợp lệ; số đếm kiểm kê có thể bằng 0.');
   if(editor.kind==='receipt'&&unitCost!==''&&(!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/.test(unitCost)||new Decimal(unitCost).gte('1e14')))throw new Error('Đơn giá nhập phải là số không âm, tối đa 6 chữ số thập phân.');
   if(!editor.row.unit_id)throw new Error('Vật tư chưa có đơn vị chuẩn. Cập nhật danh mục trước.');
   request=editor.kind==='count'?{action:'post_stock_count',args:{p_warehouse:warehouse,p_date:date,p_inventory_version:editor.version,p_lines:[{material_id:editor.row.id,counted_quantity:quantity}],p_key:crypto.randomUUID()}}:{action:'post_inventory',args:{p_warehouse:warehouse,p_date:date,p_kind:editor.kind,p_lines:[{material_id:editor.row.id,unit_id:editor.row.unit_id,quantity:editor.kind==='issue'?'-'+quantity:quantity,...(editor.kind==='receipt'?{unit_cost:unitCost||null}:{})}],p_note:labels[editor.kind]+' - '+date,p_key:crypto.randomUUID()}};
   setPending(request);
  }
  const {error}=await browserSupabase().rpc(request.action,request.args);
  if(error){if(error.code==='P0001'||/^(22|23|42)/.test(error.code)){setPending(null);throw new Error(error.message.includes('INVENTORY_VERSION_CONFLICT')?'Tồn đã thay đổi. Đóng phiếu, tải lại tồn và đối chiếu số đếm trước khi lưu.':'Chưa lưu: kiểm tra kỳ khóa, quyền, đơn vị, tồn kho. '+error.message);}throw new Error('Chưa nhận được xác nhận. Bấm kiểm tra lại cùng lần gửi để tránh cộng trùng.');}
 },onSuccess:()=>{setPending(null);setEditor(null);setMessage('Đã ghi phiếu. Tồn kho và lịch sử đã được cập nhật.');for(const key of ['inventory','counts','usage-evidence','production-materials','material-catalog','dashboard'])void cache.invalidateQueries({queryKey:[userId,key]});}});
 const correct=useMutation({retry:false,mutationFn:async()=>{
  if(!correction)throw new Error('Chọn phiếu nhập cần sửa.');
  let request=pendingCorrection;
  if(!request){
   if(!/^\d+(?:\.\d{1,6})?$/.test(correctionQuantity)||new Decimal(correctionQuantity).lte(0)||new Decimal(correctionQuantity).gte('1e14'))throw new Error('Nhập số lượng hợp lệ, lớn hơn 0.');
   if(correctionUnitCost!==''&&(!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/.test(correctionUnitCost)||new Decimal(correctionUnitCost).gte('1e14')))throw new Error('Đơn giá phải là số không âm, tối đa 6 chữ số thập phân.');
   if(correctionReason.trim().length<3||correctionReason.trim().length>1000)throw new Error('Nêu lý do sửa từ 3 đến 1.000 ký tự.');
   request={action:'correct_inventory_receipt',args:{p_movement:correction.id,p_line:correction.line_id,p_movement_version:correction.movement_version,p_line_version:correction.line_version,p_quantity:correctionQuantity,p_unit_cost:correctionUnitCost||null,p_reason:correctionReason.trim(),p_key:crypto.randomUUID()}};setPendingCorrection(request);
  }
  const {error}=await browserSupabase().rpc(request.action,request.args);
  if(error){if(error.code==='P0001'||/^(22|23|42)/.test(error.code)){setPendingCorrection(null);throw new Error(error.message.includes('VERSION_CONFLICT')?'Phiếu đã thay đổi. Tải lại lịch sử và chọn phiếu mới nhất.':error.message.includes('PERIOD_CLOSED')?'Kỳ của phiếu đã khóa. Không thể sửa phiếu này.':'Chưa thể sửa phiếu: '+error.message);}throw new Error('Chưa nhận được xác nhận. Bấm lưu lại để kiểm tra cùng yêu cầu, không tạo phiếu trùng.');}
 },onSuccess:()=>{setPendingCorrection(null);setCorrection(null);setMessageError('');setMessage('Đã ghi phiếu điều chỉnh có liên kết. Lịch sử giữ phiếu gốc và cập nhật số tồn theo phiếu thay thế.');for(const key of ['inventory','material-catalog','dashboard'])void cache.invalidateQueries({queryKey:[userId,key]});}});
 const importStock=useMutation({retry:false,mutationFn:async()=>{
  if(!warehouse||!importPreview)throw new Error('Chọn kho và file Excel hợp lệ trước khi nhập.');
  let request=pendingImport;
  if(!request){request={action:'import_inventory_excel',args:{p_warehouse:warehouse,p_date:date,p_lines:importPreview,p_source_name:importFileName,p_key:crypto.randomUUID()}};setPendingImport(request);}
  const {data,error}=await browserSupabase().rpc(request.action as 'import_inventory_excel',request.args as never);
  if(error){if(error.code==='P0001'||/^(22|23|42)/.test(error.code)){setPendingImport(null);throw new Error('Chưa nhập: '+error.message);}throw new Error('Chưa nhận được xác nhận. Bấm kiểm tra lại cùng lần gửi để tránh cộng trùng.');}
  return data as {movement_id:string|null;materials_created:number;materials_updated:number;receipt_lines:number};
 },onSuccess:data=>{
  setPendingImport(null);setImportPreview(null);setImportHistoryDate(data.receipt_lines?date:'');setMessageError('');
  setMessage(`Đã nhập Excel: ${data.materials_created} mã mới, ${data.materials_updated} mã đã có, ${data.receipt_lines} vật tư được cộng tồn.`);
  for(const key of ['inventory','counts','usage-evidence','production-materials','material-catalog','dashboard'])void cache.invalidateQueries({queryKey:[userId,key]});
 }});
 const exportExcel=async()=>{
  if(!warehouse)return;
  setExporting(true);setMessageError('');
  try{
   const all:Row[]=[];let total=0,at=0;
   do{
    const {data,error}=await browserSupabase().rpc('inventory_excel_export',{p_warehouse:warehouse,p_date:date,p_offset:at,p_limit:500});
    if(error||!data)throw new Error('Chưa tải đủ bảng tồn để xuất Excel.');
    const page=data as Result;total=page.total;all.push(...page.rows);at+=page.rows.length;
    if(!page.rows.length)break;
   }while(all.length<total);
   const blob=await createInventoryWorkbook(all.map(row=>({code:row.code,name:row.name,category:row.category,unit:row.unit,quantity:row.quantity,minimum:row.minimum,average:row.stock_average_unit_cost})));
   const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=`ton-kho-${date}.xlsx`;anchor.click();URL.revokeObjectURL(url);
  }catch(error){setMessageError(error instanceof Error?error.message:'Không xuất được file Excel.');}
  finally{setExporting(false);}
 };
 const chooseImportFile=async(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.currentTarget.files?.[0];event.currentTarget.value='';
  if(!file)return;
  try{
   if(!file.name.toLocaleLowerCase().endsWith('.xlsx'))throw new Error('Chọn file .xlsx đã xuất từ trang Tồn kho.');
   if(file.size>10*1024*1024)throw new Error('File Excel vượt quá 10 MB.');
   const rows=await parseInventoryWorkbook(await file.arrayBuffer());
   setImportFileName(file.name);setImportPreview(rows);setPendingImport(null);importStock.reset();setMessageError('');
  }catch(error){setMessageError(error instanceof Error?error.message:'Không đọc được file Excel.');}
 };
 const quantityInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(editor)quantityInput.current?.focus();},[editor]);
 const locked=save.isPending||!!pending;
 const correctionLocked=correct.isPending||!!pendingCorrection;
 const open=(row:Row,kind:string)=>{setEditor({row,kind,version:query.data?.inventory_version??''});setQuantity('');setUnitCost('');save.reset();setMessage('');};
 const openCorrection=(row:History)=>{setCorrection(row);setCorrectionQuantity(row.quantity);setCorrectionUnitCost(row.unit_cost??'');setCorrectionReason('');setPendingCorrection(null);correct.reset();setMessage('');};
 const resetPage=()=>setOffset(0);
 const importSummary=importPreview?(()=>{
  let receiptCount=0,unpricedCount=0;
  const quantities=new Map<string,Decimal>();
  for(const row of importPreview){
   if(row.added_quantity===null)continue;
   receiptCount++;
   if(row.unit_cost===null)unpricedCount++;
   quantities.set(row.unit_code,(quantities.get(row.unit_code)??new Decimal(0)).plus(row.added_quantity));
  }
  return {materialCount:importPreview.length,receiptCount,catalogOnlyCount:importPreview.length-receiptCount,unpricedCount,quantities:[...quantities].map(([unit,total])=>({unit,total:formatQuantity(total.toFixed(6))}))};
 })():null;
 return <section className="inventory-workspace">
  <div className="page-heading"><div><p className="eyebrow">CHIFAA / KHO & TỒN KHO</p><h1>{historyMode?'Lịch sử kho':reorder?'Cảnh báo & bổ sung hàng':'Tồn kho & nhập xuất vật tư'}</h1><p>Vật tư dùng chung với danh mục. Số tồn được tính riêng theo kho từ các phiếu đã ghi.</p></div><div className="inventory-heading-links"><Link className="button" href={'/app/counts?date='+date}>Phiếu kiểm kê chung</Link><Link className="button" href="/app/materials">Danh mục vật tư</Link></div></div>
  <details className="inventory-guide"><summary><Icon name="info" size={16}/> Hướng dẫn nhập, xuất, kiểm kê và Excel</summary><p>Vật tư mới tự xuất hiện trong bảng kho. Kiểm kê ghi tổng số thực đếm; nhập cộng thêm, xuất trừ đi. Chưa có số liệu tồn được giữ trống. Giá trung bình tính từ giá của các phiếu nhập đã ghi; nếu thiếu giá của một lần nhập thì chưa xác định giá trung bình. Trong Excel, cột “Tồn hiện tại” chỉ để xem; dùng riêng cột “Số lượng nhập thêm” để cộng tồn. Kế hoạch chỉ tính nhu cầu; sản xuất đã ghi mới xuất định mức.</p></details>
  <div className="panel inventory-scope"><div className="form-grid"><div className="inventory-default-warehouse"><span>Kho</span><strong>Nguyên liệu</strong></div><label>Tồn đến ngày<input type="date" value={date} onChange={e=>{setDate(e.target.value);resetPage();}}/></label>{!historyMode&&<label>Ngày cần chuẩn bị<input type="date" value={needsOn} onChange={e=>{setNeedDate(e.target.value);resetPage();}}/></label>}</div>
   {warehouses.isFetching&&<LoadingState compact label="Đang tải kho…"/>}{warehouses.isError&&<ToastNotice tone="error" message={warehouses.error.message}/>}
   <IngredientWarehouseStatus rows={warehouses.data}/>
  </div>
  {warehouse&&<div className="panel inventory-data">{!historyMode&&<><div className="stats">{[['Mã vật tư danh mục',query.data?.summary.materials],['Đã có số liệu tồn',query.data?.summary.known],['Chưa có số liệu tồn',query.data?.summary.unknown],['Dưới tối thiểu',query.data?.summary.low]].map(([label,value])=><div className="stat" key={label}><label>{label}</label><strong>{value??'—'}</strong></div>)}</div><div className="inventory-filters"><div className="inventory-search"><Icon name="search" size={18}/><input aria-label="Tìm vật tư trong kho" placeholder="Tìm mã hoặc tên vật tư…" value={search} maxLength={100} onChange={e=>{setSearch(e.target.value);resetPage();}}/></div><select aria-label="Nhóm vật tư" value={category} onChange={e=>{setCategory(e.target.value);resetPage();}}><option value="">Tất cả nhóm</option>{Object.entries(materialCategories).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><select aria-label="Trạng thái tồn" value={status} onChange={e=>{setStatus(e.target.value);resetPage();}}><option value="all">Mọi trạng thái</option><option value="attention">Cần chú ý / bổ sung</option>{Object.entries(labels).filter(([id])=>['unknown','low','ok','minimum_missing','unit_missing'].includes(id)).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div>{!query.data?.needs_complete&&<p className="muted">Chưa đủ kế hoạch, công thức hoặc quyền xem nhu cầu cho ngày {needsOn}. Chưa tính đề xuất mua.</p>}<p className="muted">Đề xuất = tối đa(0, tối thiểu + nhu cầu ngày kế hoạch − tồn). Chỉ tính khi đủ dữ liệu và cùng đơn vị chuẩn.</p></>}

   <div className="inventory-table-meta"><span>{historyMode?(historyMaterial?'Lịch sử giá và phiếu của vật tư':'Lịch sử phiếu đã ghi'):(query.data?.total??'—')+' vật tư'}</span>{historyMode&&historyMaterial&&<Link href={'/app/stockhistory?date='+date}>Xem tất cả vật tư</Link>}{!historyMode&&<div className="inventory-legend" aria-label="Thao tác kho"><button type="button" className="button inventory-excel-button" disabled={exporting||!warehouse||!canExport} onClick={exportExcel}><Icon name="stock-out" size={15}/>{exporting?'Đang xuất…':'Xuất Excel / tải mẫu'}</button><button type="button" className="button inventory-excel-button" disabled={!canImport||!warehouse} onClick={()=>fileInput.current?.click()}><Icon name="stock-in" size={15}/>Nhập Excel</button><input ref={fileInput} className="inventory-file-input" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="Chọn file Excel tồn kho" onChange={chooseImportFile}/><span><Icon name="stock-in" size={15}/>Nhập</span><span><Icon name="stock-out" size={15}/>Xuất</span><span><Icon name="count" size={15}/>Kiểm kê</span></div>}</div>
   {(query.isFetching||history.isFetching)&&<LoadingState compact label="Đang tải dữ liệu kho…"/>}{(query.isError||history.isError)&&<ToastNotice tone="error" message={query.error?.message??history.error?.message}/>}
   {historyMode?<div className="table-wrap"><table className="inventory-table inventory-history"><thead><tr>{['Ngày','Mã / vật tư','Loại phiếu','Số lượng','Đơn giá nhập','Nguồn / ghi chú','Người / thời điểm ghi','Thao tác'].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{history.data?.slice(0,50).map((h,i)=><tr key={h.id+h.line_id+i}><td>{h.moved_on}</td><td><b>{h.code}</b><small>{h.name}</small></td><td>{labels[h.kind]??h.kind}<small>{h.status}</small></td><td>{formatQuantity(h.quantity)} {h.unit}</td><td>{h.kind==='receipt'&&h.unit_cost!==null?<>{formatVnd(h.unit_cost)} đ / {h.unit}<small>{h.line_value===null?'':`Thành tiền: ${formatVnd(h.line_value)} đ`}</small>{h.unit_cost_source==='legacy_snapshot'&&<small>Giá lưu từ trước</small>}</>:h.kind==='receipt'?'Chưa ghi giá':'—'}</td><td>{h.note}<small>Phiếu: {h.id}</small>{h.source_batch_id&&<small>Đợt SX: {h.source_batch_id}</small>}{h.reverses_id&&<small>Đảo phiếu: {h.reverses_id}</small>}</td><td>{h.created_by}<small>{h.created_at}</small></td><td>{canCorrect&&h.kind==='receipt'&&h.status==='posted'&&<button type="button" className="button" disabled={correctionLocked} onClick={()=>openCorrection(h)}>Sửa giá / số lượng</button>}</td></tr>)}</tbody></table>{history.data?.length===0&&<p className="empty">Chưa có chuyển động kho đến ngày đã chọn. Phiếu kiểm kê 0 không phát sinh điều chỉnh kho.</p>}</div>:query.data&&<div className="table-wrap"><table className="inventory-table"><thead><tr>{['Mã / vật tư','Nhóm','ĐVT chuẩn','Tồn hiện tại','Tối thiểu','Giá trung bình','Cần chuẩn bị','Trạng thái','Đề xuất bổ sung','Thao tác'].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{query.data.rows.map(row=><tr key={row.id}><td><b>{row.code}</b><small>{row.name}</small><Link className="inventory-history-link" href={'/app/stockhistory?date='+date+'&material='+encodeURIComponent(row.id)}>Xem lần nhập và giá</Link></td><td>{materialCategories[row.category as keyof typeof materialCategories]??row.category}</td><td>{row.unit??'Chưa thiết lập'}</td><td>{formatQuantity(row.quantity)}</td><td>{formatQuantity(row.minimum)}</td><td>{row.stock_average_unit_cost===null?'—':`${formatVnd(row.stock_average_unit_cost)} đ / ${row.unit??''}`}</td><td>{formatQuantity(row.needed)}</td><td><span className={"inventory-status status-"+row.status}>{labels[row.status]??row.status}</span></td><td>{formatQuantity(row.suggested)}</td><td><div className="inventory-actions"><button className="button inventory-action action-receipt" aria-label="Nhập" title={"Nhập kho: "+row.name} disabled={!canPost||!row.unit_id} onClick={()=>open(row,'receipt')}><Icon name="stock-in" size={18}/></button><button className="button inventory-action action-issue" aria-label="Xuất" title={"Xuất kho: "+row.name} disabled={!canPost||!row.unit_id||row.quantity===null} onClick={()=>open(row,'issue')}><Icon name="stock-out" size={18}/></button><button className="button inventory-action action-count" aria-label="Kiểm kê" title={"Kiểm kê: "+row.name} disabled={!canCount||!row.unit_id} onClick={()=>open(row,'count')}><Icon name="count" size={18}/></button></div></td></tr>)}</tbody></table>{!query.data.rows.length&&<p className="empty">Không có vật tư phù hợp bộ lọc. Thêm vật tư mới trong danh mục nếu chưa có mã hàng.</p>}</div>}
   <div className="toolbar"><button className="button" disabled={offset===0} onClick={()=>setOffset(offset-50)}>Trước</button><span>Trang {offset/50+1}</span><button className="button" disabled={historyMode?(history.data?.length??0)<=50:offset+50>=(query.data?.total??0)} onClick={()=>setOffset(offset+50)}>Sau</button></div>
  </div>}
  {message&&<ToastNotice tone="success" message={message}/>}{messageError&&<ToastNotice tone="error" message={messageError}/>}{importHistoryDate&&<p className="inventory-import-history"><Link href={'/app/stockhistory?date='+importHistoryDate}>Xem các dòng nhập Excel trong Lịch sử kho</Link></p>}
  {importPreview&&importSummary&&<ActionDialog title="Rà soát nhập kho từ Excel" busy={importStock.isPending||!!pendingImport} className="inventory-dialog inventory-import-dialog" onClose={()=>{setImportPreview(null);setPendingImport(null);importStock.reset();}}>
   <div className="inventory-import-body">
    <div className="inventory-import-file">
     <span className="inventory-import-file-icon"><Icon name="stock-in" size={21}/></span>
     <div className="inventory-import-file-name"><span>FILE EXCEL · KHO NGUYÊN LIỆU</span><strong title={importFileName}>{importFileName}</strong></div>
     <div className="inventory-import-date"><span>NGÀY GHI PHIẾU</span><strong>{date}</strong></div>
     <span className="inventory-import-step">BƯỚC 2 / 2</span>
    </div>

    <div className="inventory-import-summary" aria-label="Tóm tắt file nhập">
     <article><span>Mã vật tư trong file</span><strong>{importSummary.materialCount}</strong><small>Sẽ đối chiếu theo mã</small></article>
     <article className="summary-receipt"><span>Sẽ cộng tồn</span><strong>{importSummary.receiptCount}</strong><small>Có số lượng nhập thêm</small></article>
     <article><span>Chỉ cập nhật danh mục</span><strong>{importSummary.catalogOnlyCount}</strong><small>Không tạo phiếu nhập</small></article>
     <article className={importSummary.unpricedCount?'summary-unpriced':''}><span>Chưa có giá nhập</span><strong>{importSummary.unpricedCount}</strong><small>{importSummary.unpricedCount?'Lượng vẫn được cộng':importSummary.receiptCount?'Tất cả dòng nhập đã có giá':'Không có dòng nhập thêm'}</small></article>
    </div>

    {importSummary.quantities.length>0&&<div className={'inventory-import-totals'+(importSummary.quantities.length===1?' totals-single-unit':'')}><span>Tổng lượng dự kiến cộng</span><div>{importSummary.quantities.map(item=><strong key={item.unit}>{item.total} <small>{item.unit}</small></strong>)}</div></div>}

    <div className="inventory-import-callout">
     <span className="inventory-import-callout-icon"><Icon name="info" size={18}/></span>
     <p><strong>Tồn cũ không bị ghi đè.</strong> Chỉ “Số lượng nhập thêm” được cộng kho. “Tồn hiện tại” và “Giá trung bình” chỉ để xem; phiếu mới lấy giá từ “Giá nhập thêm”. Mã trùng cập nhật danh mục.</p>
    </div>
    {importSummary.unpricedCount>0&&<div className="inventory-import-callout warning">
     <span className="inventory-import-callout-icon"><Icon name="warning" size={18}/></span>
     <p><strong>{importSummary.unpricedCount} dòng nhập chưa có giá.</strong> Số lượng vẫn cộng; giá để trống, không ghi 0đ. Giá trung bình có thể chưa xác định.</p>
    </div>}

    <div className="inventory-import-table-heading"><div><h3>Chi tiết từng vật tư</h3><p>Kiểm tra số lượng và đơn giá trước khi xác nhận.</p></div><span>{importPreview.length} dòng</span></div>
    <div className="table-wrap inventory-import-preview">
     <table className="inventory-table inventory-import-preview-table"><thead><tr>{['Vật tư','Nhóm','ĐVT','Số lượng cộng','Giá nhập thêm','Thao tác'].map(label=><th key={label}>{label}</th>)}</tr></thead>
      <tbody>{importPreview.map(row=><tr key={row.code}>
       <td><div className="inventory-import-material"><strong>{row.name}</strong><small>{row.code}</small></div></td>
       <td>{materialCategories[row.category as keyof typeof materialCategories]??row.category}</td>
       <td>{row.unit_code}</td>
       <td className="inventory-import-number">{row.added_quantity!==null?formatQuantity(row.added_quantity):'—'}</td>
       <td className="inventory-import-number">{row.unit_cost!==null?<>{formatVnd(row.unit_cost)} đ</>:row.added_quantity!==null?<span className="inventory-import-unknown">Chưa rõ</span>:'—'}</td>
       <td>{row.added_quantity!==null?<span className="inventory-import-badge badge-receipt">Cộng tồn</span>:<span className="inventory-import-badge">Danh mục</span>}</td>
      </tr>)}</tbody>
     </table>
    </div>
    {importStock.isError&&<ToastNotice tone="error" message={importStock.error.message}/>}
   </div>
   <footer className="inventory-import-actions"><span>{importSummary.receiptCount?`${importSummary.receiptCount} dòng sẽ tạo phiếu nhập kho.`:'Không có lượng nhập thêm; chỉ cập nhật danh mục.'}</span><div><button className="button" type="button" disabled={importStock.isPending||!!pendingImport} onClick={()=>{setImportPreview(null);importStock.reset();}}>Hủy</button><button className="button primary" type="button" disabled={importStock.isPending} onClick={()=>importStock.mutate()}>{importStock.isPending?'Đang ghi phiếu…':pendingImport?'Kiểm tra lại lần gửi':importSummary.receiptCount?'Xác nhận nhập kho':'Xác nhận cập nhật danh mục'}</button></div></footer>
  </ActionDialog>}
  {editor&&<ActionDialog title={(editor.kind==='count'?'Kiểm kê':labels[editor.kind])+' · '+editor.row.code} busy={locked} className="inventory-dialog" onClose={()=>setEditor(null)}><p>{editor.row.name} · Đơn vị chuẩn: <b>{editor.row.unit}</b>. Tồn theo sổ: {formatQuantity(editor.row.quantity)}.</p><p>{editor.kind==='count'?'Nhập tổng số thực đếm để điều chỉnh về số này. Số 0 là xác nhận đã hết hàng.':'Nhập lượng phát sinh của phiếu này. Nhập kho cộng thêm, xuất kho trừ đi.'}</p><form onSubmit={e=>{e.preventDefault();save.mutate();}}><fieldset disabled={locked}><label>{editor.kind==='count'?'Số đếm thực tế':'Số lượng phát sinh'}<input ref={quantityInput} aria-label="Số lượng phiếu kho" inputMode="decimal" required value={quantity} onChange={e=>setQuantity(e.target.value.trim().replace(',','.'))}/></label>{editor.kind==='receipt'&&<label>Đơn giá nhập (đ / {editor.row.unit})<input aria-label="Đơn giá nhập" inputMode="decimal" value={unitCost} onChange={e=>setUnitCost(e.target.value.trim().replace(',', '.'))} placeholder="Chưa rõ giá"/><small>Giá được lưu riêng theo phiếu này. Bỏ trống nếu chưa có giá.</small>{quantity&&unitCost&&/^\d+(?:\.\d{1,6})?$/.test(quantity)&&/^\d+(?:\.\d{1,6})?$/.test(unitCost)&&<small>Thành tiền phiếu: {formatVnd(new Decimal(quantity).mul(unitCost).toFixed(6))} đ</small>}</label>}</fieldset>{editor.kind==='count'&&<p>Phiếu lưu người ghi, ngày kiểm kê, số theo sổ và số đếm. Số tồn được kiểm tra lại khi lưu.</p>}{save.isError&&<ToastNotice tone="error" message={save.error.message}/>}<div className="toolbar"><button className="button" type="button" disabled={locked} onClick={()=>setEditor(null)}>Hủy</button><button className="button primary" disabled={save.isPending}>{save.isPending?'Đang lưu…':pending?'Kiểm tra lại lần lưu':'Lưu phiếu kho'}</button></div></form></ActionDialog>}
  {correction&&<ActionDialog title={'Sửa phiếu nhập · '+correction.code} busy={correctionLocked} className="inventory-dialog" onClose={()=>setCorrection(null)}><p>{correction.name} · {correction.moved_on} · Phiếu gốc <b>{correction.id}</b></p><p>Sửa số lượng và đơn giá của lần nhập này. Hệ thống giữ phiếu gốc, đồng thời ghi phiếu đảo và phiếu nhập thay thế có lý do để tồn kho và lịch sử luôn đối chiếu được.</p><form onSubmit={e=>{e.preventDefault();correct.mutate();}}><fieldset disabled={correctionLocked}><label>Số lượng nhập ({correction.unit})<input aria-label="Số lượng nhập cần sửa" inputMode="decimal" required value={correctionQuantity} onChange={e=>setCorrectionQuantity(e.target.value.trim().replace(',','.'))}/></label><label>Đơn giá nhập (đ / {correction.unit})<input aria-label="Đơn giá nhập cần sửa" inputMode="decimal" value={correctionUnitCost} onChange={e=>setCorrectionUnitCost(e.target.value.trim().replace(',','.'))} placeholder="Bỏ trống nếu chưa rõ giá"/><small>Giá để trống sẽ không được tính vào giá nhập bình quân.</small></label><label>Lý do sửa<input aria-label="Lý do sửa phiếu nhập" required minLength={3} maxLength={1000} value={correctionReason} onChange={e=>setCorrectionReason(e.target.value)}/></label></fieldset>{correctionReason&&correctionQuantity&&correctionUnitCost&&/^\d+(?:\.\d{1,6})?$/.test(correctionQuantity)&&/^\d+(?:\.\d{1,6})?$/.test(correctionUnitCost)&&<p>Thành tiền thay thế: {formatVnd(new Decimal(correctionQuantity).mul(correctionUnitCost).toFixed(6))} đ</p>}{correct.isError&&<ToastNotice tone="error" message={correct.error.message}/>}<div className="toolbar"><button className="button" type="button" disabled={correctionLocked} onClick={()=>setCorrection(null)}>Hủy</button><button className="button primary" disabled={correct.isPending}>{correct.isPending?'Đang ghi…':pendingCorrection?'Kiểm tra lại lần sửa':'Lưu điều chỉnh'}</button></div></form></ActionDialog>}
 </section>;
}
