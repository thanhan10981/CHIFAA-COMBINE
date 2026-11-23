'use client';
import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {browserSupabase} from '@/lib/supabase/browser';
import {CurrencyInput} from '@/components/currency-input';
import {LoadingState,useNotify} from '@/components/feedback';
import {formatVnd} from '@/lib/format';
import {ensurePriceBasis,localDate,materialWriteWasRejected,type MaterialRow,type Unit} from './material-types';
type Resolution={id:string;revision:string;effective_from:string;created_at:string;purchase_unit_id:string;usage_unit_id:string;basis_unit_id:string|null;amount:string|null;verification:string;package_unit_id:string|null;package_content_unit_id:string|null;package_quantity:string|null;package_verified:boolean;formula_unit_id:string|null;formula_quantity:string|null;formula_verified:boolean;issue:string;evidence:string;source_data:Record<string,unknown>};
const clean=(value:string|null|undefined)=>value==null?'':String(value).replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
export function MaterialReview({userId,row,units,canVerify,onDone,onBusy}:{userId:string;row:MaterialRow;units:Unit[];canVerify:boolean;onDone:()=>void;onBusy:(busy:boolean)=>void}){
 const cache=useQueryClient(),notify=useNotify(),date=localDate();
 const costs=useQuery({queryKey:[userId,'material-cost-basis',row.id,date],queryFn:async()=>{const {data,error}=await browserSupabase().rpc('material_cost_basis',{p_material:row.id,p_date:date});if(error)throw new Error('Chưa tính được cơ sở giá đã lưu.');return data as {usage_cost_vnd:string|null;purchase_cost_vnd:string|null;usage_unit:string;usage_unit_id:string;usage_unit_locked:boolean;purchase_unit:string;official_ready:boolean};}});
 const history=useQuery({queryKey:[userId,'material-review',row.id],queryFn:async()=>{const {data,error}=await browserSupabase().from('material_resolutions').select('id,revision,effective_from,purchase_unit_id,usage_unit_id,basis_unit_id,amount,verification,package_unit_id,package_content_unit_id,package_quantity,package_verified,formula_unit_id,formula_quantity,formula_verified,issue').eq('material_id',row.id).order('effective_from',{ascending:false}).order('revision',{ascending:false}).limit(1);if(error)throw new Error('Chưa tải được dữ liệu vật tư.');return data as unknown as Resolution[];}});
 return <>{costs.isFetching&&<LoadingState compact/>}{costs.data&&<div className="material-cost-summary">Giá đã lưu tại {date}: {costs.data.official_ready?<><strong>{formatVnd(costs.data.usage_cost_vnd)} đ/{costs.data.usage_unit}</strong> · {costs.data.purchase_cost_vnd!==null?formatVnd(costs.data.purchase_cost_vnd)+' đ/'+costs.data.purchase_unit:'Quy cách mua chưa đủ xác minh'}</>:'CHỜ XÁC MINH — chưa có giá vốn chính thức'}. Giá xem trước cập nhật sau khi lưu phiên bản.</div>}{history.isFetching?<LoadingState label="Đang tải dữ liệu vật tư…"/>:history.data&&<ReviewForm key={history.data[0]?.id??row.id} {...{userId,row,units,canVerify,onBusy}} latest={history.data[0]} onSuccess={()=>{notify('Đã lưu phiên bản xác minh; toàn hệ thống dùng theo ngày hiệu lực.','success');for(const key of ['material-review','material-cost-basis','material-catalog','recipe-catalog','recipe-detail','recipe-form-options','recipe-workspace-cost','recipe-editor','inventory','production'])void cache.invalidateQueries({queryKey:[userId,key]});onDone();}}/>}</>;
}

function ReviewForm({row,units,canVerify,onBusy,latest,onSuccess}:{userId:string;row:MaterialRow;units:Unit[];canVerify:boolean;onBusy:(busy:boolean)=>void;latest?:Resolution;onSuccess:()=>void}){
 const [purchase,setPurchase]=useState(latest?.purchase_unit_id??row.purchase_unit_id);
 const [usage,setUsage]=useState(latest?.usage_unit_id??row.usage_unit_id);
 const [basis,setBasis]=useState(latest?.basis_unit_id??row.basis_unit_id??latest?.purchase_unit_id??row.purchase_unit_id);
 const [amount,setAmount]=useState(clean(latest?.amount??row.price_amount));
 const [effective,setEffective]=useState(localDate);
 const [pack,setPack]=useState(latest?.package_unit_id??latest?.purchase_unit_id??row.purchase_unit_id);
 const [content,setContent]=useState(latest?.package_content_unit_id??row.usage_unit_id);
 const [quantity,setQuantity]=useState(clean(latest?.package_quantity));
 const [formulaUnit,setFormulaUnit]=useState(latest?.formula_unit_id??latest?.usage_unit_id??row.usage_unit_id);
 const [formulaQuantity,setFormulaQuantity]=useState(clean(latest?.formula_quantity));
 const [issue]=useState(latest?.issue??row.price_issue??'');
 const [pending,setPending]=useState<{input:Record<string,unknown>;key:string;date:string}|null>(null);
 const priceBasis=basis||purchase,selectedUsage=usage,verified=amount!==''&&!!priceBasis;
 const updateUsage=(value:string)=>{if(value!==usage){setUsage(value);setFormulaUnit(value);setFormulaQuantity('');if(value!==row.usage_unit_id){setPack(purchase);setContent(row.usage_unit_id);setQuantity('');}}};
 const unit=(value:string,set:(v:string)=>void,optional=false,label?:string)=><select aria-label={label} required={!optional} value={value} onChange={e=>set(e.target.value)}><option value="">{optional?'Chưa xác định':'Chọn đơn vị'}</option>{units.map(u=><option key={u.id} value={u.id}>{u.code} · {u.name}</option>)}</select>;
 const unitCode=(id:string,fallback:string)=>units.find(u=>u.id===id)?.code||fallback;
 const save=useMutation({retry:false,mutationFn:async()=>{
  let request=pending;
  if(request){request={...request,input:ensurePriceBasis(request.input,priceBasis||purchase)};setPending(request);}
  if(!request){
   if(!purchase||!selectedUsage)throw new Error('Chọn đơn vị mua và đơn vị tiêu hao.');
   if(amount!==''&&!/^\d+(?:\.\d{1,6})?$/.test(amount))throw new Error('Đơn giá phải là số không âm, tối đa 6 chữ số thập phân.');
   if(quantity!==''&&!/^\d+(?:\.\d{1,9})?$/.test(quantity))throw new Error('Nhập số lượng quy đổi bằng số, ví dụ 30.');
   const stockUnitChanged=row.usage_unit_id!==selectedUsage;
   const identityPackage=purchase===selectedUsage&&pack===purchase&&content===selectedUsage;
   const hasPackageRatio=quantity!==''&&!identityPackage;
   if(stockUnitChanged&&!hasPackageRatio)throw new Error(`Đơn vị kho đang lưu là ${unitCode(row.usage_unit_id,'đơn vị cũ')} nhưng bạn chọn ${unitCode(selectedUsage,'đơn vị mới')}. Nhập và xác minh tỷ lệ chuyển đổi giữa hai đơn vị ở mục quy đổi nhập/kho.`);
   if(hasPackageRatio&&(!pack||!content||pack===content||Number(quantity)<=0))throw new Error('Quy đổi nhập/kho cần hai đơn vị khác nhau và số lượng dương.');
   if(formulaQuantity!==''&&(!/^\d+(?:\.\d{1,9})?$/.test(formulaQuantity)||!formulaUnit||formulaUnit===selectedUsage||Number(formulaQuantity)<=0))throw new Error('Chọn đơn vị công thức khác đơn vị kho và nhập số lượng dương.');
   request={date:effective,key:crypto.randomUUID(),input:{purchase_unit_id:purchase,usage_unit_id:selectedUsage,basis_unit_id:priceBasis||null,amount:amount||null,verification:verified?'verified':'needs_verification',package_unit_id:hasPackageRatio?pack:null,package_content_unit_id:hasPackageRatio?content:null,package_quantity:hasPackageRatio?quantity:null,package_verified:hasPackageRatio,issue:verified?'':issue}};
   setPending(request);onBusy(true);
  }
  const input={...request.input,formula_unit_id:formulaQuantity?formulaUnit:null,formula_quantity:formulaQuantity||null};
  let {error}=await browserSupabase().rpc('resolve_material',{p_material:row.id,p_expected_version:row.version,p_effective:request.date,p_input:input,p_key:request.key});
  if(error?.message.includes('PRICE_BASIS_REQUIRED')){const retryInput=ensurePriceBasis(input,priceBasis||purchase);request={...request,input:retryInput};setPending(request);({error}=await browserSupabase().rpc('resolve_material',{p_material:row.id,p_expected_version:row.version,p_effective:request.date,p_input:retryInput,p_key:request.key}));}
  if(error){
   if(materialWriteWasRejected(error.code)){setPending(null);onBusy(false);}
   throw new Error(error.message.includes('UNIT_CONVERSION_REQUIRED')?'Chưa quy đổi được đơn vị mua sang đơn vị kho. Kiểm tra quy đổi nhập/kho rồi lưu lại.':error.message.includes('VERSION_CONFLICT')?'Dữ liệu vừa thay đổi. Đóng và tải lại trước khi xác minh.':error.message.includes('INVALID_FORMULA_CONVERSION')?'Kiểm tra đơn vị công thức và nhập số lượng dương trong một đơn vị kho.':error.message.includes('INVALID_PACKAGE')||error.message.includes('UNIT_RATIO_MISMATCH')?'Quy đổi không hợp lệ. Kiểm tra lại tỷ lệ và hai đơn vị.':error.message.includes('PRICE_BASIS_REQUIRED')?'Máy chủ chưa nhận được đơn vị tính giá. Đóng hộp thoại, mở lại vật tư rồi lưu lại.':error.code==='55000'?'Database chưa cập nhật phiên bản xác minh vật tư; lần lưu bị từ chối và bạn có thể đóng cửa sổ.':error.code==='PGRST202'?'Database chưa cài chức năng xác minh vật tư; lần lưu chưa chạy và bạn có thể đóng cửa sổ.':error.message.includes('FORBIDDEN')?'Tài khoản cần quyền Admin và quyền duyệt giá vật tư.':'Chưa xác nhận lưu. Kiểm tra ngày hiệu lực hoặc kết nối; nếu mất mạng, hãy kiểm tra lại cùng lần gửi.');
  }
  return;
 },onSuccess:()=>{setPending(null);onBusy(false);onSuccess();}});
 const locked=save.isPending||!!pending,formulaRatioEntered=formulaQuantity!==''&&formulaUnit!==selectedUsage;
 return <>
  <p className="material-form-note">{row.code} — {row.name}. Đơn vị nhập, đơn vị kho và đơn vị công thức được khai báo riêng để không làm đổi số lượng kiểm kho.</p>
  <form className="material-review-form" onSubmit={e=>{e.preventDefault();save.mutate();}}>
   <fieldset disabled={!canVerify||locked}>
    <div className="form-grid">
     <label>Đơn vị mua (ví dụ: túi, bì){unit(purchase,setPurchase,false,'Đơn vị mua')}</label>
     <label>Đơn vị dùng/kho (ví dụ: cái, lá){unit(selectedUsage,updateUsage,false,'Đơn vị dùng / kho')}<small>Tồn kho, phiếu nhập và kiểm kê tiếp tục dùng đơn vị này.</small></label>
     <label>Đơn giá (đ)<div className="material-price-entry"><CurrencyInput value={amount} onValueChange={setAmount} placeholder="Chưa có giá"/><span>/</span>{unit(priceBasis,setBasis,true,'Đơn vị áp dụng giá')}</div><small>Giá đang áp dụng cho 1 đơn vị ở bên phải; nếu chưa chọn, mặc định theo đơn vị mua.</small></label>
     <div className="material-conversion-field">
      <strong>Quy đổi nhập/kho <small>(khi đơn vị mua/kho khác nhau hoặc đổi đơn vị kho đang lưu)</small></strong>
      {purchase===selectedUsage&&row.usage_unit_id===selectedUsage&&quantity===''?<small>Đơn vị mua và kho hiện giống nhau; đơn vị kho đang lưu cũng không đổi nên không cần tỷ lệ ở mục này.</small>:<>
       <div className="material-conversion-row"><span>1</span>{unit(pack,setPack,true,'Quy đổi từ đơn vị mua')}<span>=</span><input aria-label="Số đơn vị kho trong một đơn vị mua" inputMode="decimal" value={quantity} placeholder="Số lượng" onChange={e=>setQuantity(e.target.value.replace(',','.'))}/>{unit(content,setContent,true,'Đơn vị kho nhận')}</div>
       {row.usage_unit_id!==selectedUsage&&<small>Đơn vị kho đang lưu: {unitCode(row.usage_unit_id,'đơn vị cũ')} → đơn vị mới: {unitCode(selectedUsage,'đơn vị mới')}. Hãy nhập tỷ lệ giữa hai đơn vị; bản ghi kho cũ không bị sửa.</small>}
       <small>Quy đổi này dùng để chuẩn hóa nhập và tồn kho. Quy đổi công thức được khai báo riêng bên dưới.</small>
       <small className="material-conversion-preview">1 {unitCode(pack,'đơn vị mua')} = {quantity||'…'} {unitCode(content,'đơn vị kho')}</small>
      </>}
     </div>
     <div className="material-conversion-field">
      <strong>Quy đổi riêng dành cho công thức</strong>
      <div className="material-conversion-row"><span>1 {unitCode(selectedUsage,'đơn vị kho')}</span><span>=</span><input aria-label="Số đơn vị công thức trong một đơn vị kho" inputMode="decimal" value={formulaQuantity} placeholder="Số lượng" onChange={e=>setFormulaQuantity(e.target.value.replace(',','.'))}/>{unit(formulaUnit,setFormulaUnit,true,'Đơn vị dùng trong công thức')}</div>
      <small>Ví dụ: kho vẫn kiểm theo bì, khai báo 1 bì = 100 cái. Công thức chọn cái; quy đổi này không đổi đơn vị nhập/kho.</small>
      <small className="material-conversion-preview">{formulaRatioEntered?`1 ${unitCode(selectedUsage,'đơn vị kho')} = ${formulaQuantity} ${unitCode(formulaUnit,'đơn vị công thức')} · sẽ được xác minh khi lưu`:'Chưa khai báo quy đổi riêng; công thức dùng đơn vị kho hiện tại.'}</small>
     </div>
     <label>Ngày hiệu lực<input type="date" required min={latest?.effective_from} value={effective} onChange={e=>setEffective(e.target.value)}/></label>
    </div>
   </fieldset>
   <div className="material-dialog-actions"><button className="button primary" disabled={!canVerify||save.isPending}>{save.isPending?'Đang lưu…':pending?'Kiểm tra lại lần gửi':'Lưu xác minh'}</button></div>
  </form>
 </>;
}
