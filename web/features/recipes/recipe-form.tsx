'use client';
import {useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import Decimal from 'decimal.js';
import {browserSupabase} from '@/lib/supabase/browser';
import {ActionDialog,LoadingState,useNotify} from '@/components/feedback';
import {Icon} from '@/components/icons';
import {recipeKinds,today,type Recipe,type Detail} from './recipe-types';
type Line={type:'material'|'recipe';id:string;quantity:string;unit:string;cost_exempt:boolean;source?:string};
type Option={id:string;code:string;name:string;usage_unit_id?:string;formula_unit_id?:string|null;formula_quantity?:string|null;formula_verified?:boolean};
type Child={id:string;recipe_id:string;revision:number;status:string;output_unit_id:string;recipes:{name:string;code:string}|null};
type Request={p_id:string|null;p_expected_version:string|null;p_recipe:Record<string,string>;p_items:Record<string,unknown>[];p_evidence:string;p_key:string};
function roundedComponentQuantity(value:string|null|undefined){if(value==null||!value.trim())return '';try{return new Decimal(value).toDecimalPlaces(2,Decimal.ROUND_HALF_UP).toString();}catch{return value;}}
async function allRows<T>(table:string,columns:string,filter?:string){const rows:T[]=[];for(let start=0;start<5000;start+=200){let q=browserSupabase().from(table).select(columns).order('id').range(start,start+199);if(filter)q=q.eq('archived',false);const {data,error}=await q;if(error)throw new Error('Chưa tải được danh mục '+table);rows.push(...data as T[]);if(data.length<200)return rows;}throw new Error('Danh mục quá lớn, cần thu hẹp lựa chọn.');}
export function RecipeForm({userId,recipe,detail,kind,clone=false,onClose,onSaved}:{userId:string;recipe?:Recipe;detail?:Detail;kind:string;clone?:boolean;onClose:()=>void;onSaved:(id:string,versionId:string)=>void}){
 const notify=useNotify(),client=useQueryClient();
 const [code,setCode]=useState(clone?'':recipe?.code??''),[name,setName]=useState((recipe?.name??'')+(clone?' (bản sao)':'')),[type,setType]=useState(recipe?.kind??kind),[date,setDate]=useState(today()),[output,setOutput]=useState(roundedComponentQuantity(detail?.version.output_quantity??'1')),[unit,setUnit]=useState(detail?.version.output_unit_id??''),[pending,setPending]=useState<Request|null>(null);
 const [lines,setLines]=useState<Line[]>(detail?.lines.map(l=>({type:l.type==='recipe'?'recipe':'material',id:l.target_id??'',quantity:roundedComponentQuantity(l.quantity),unit:l.unit_id??'',cost_exempt:l.cost_exempt??false,source:l.type==='unresolved'?l.name+' · '+l.issue:undefined}))??[{type:'material',id:'',quantity:'',unit:'',cost_exempt:false}]);
 const options=useQuery({queryKey:[userId,'recipe-form-options',date],queryFn:async()=>{const [materialResult,units,children]=await Promise.all([browserSupabase().rpc('recipe_material_units',{p_date:date}),allRows<Option>('material_units','id,code,name','active'),allRows<Child>('recipe_versions','id,recipe_id,revision,status,output_unit_id,recipes(name,code)')]);if(materialResult.error)throw new Error('Chưa tải được đơn vị kho và quy đổi riêng cho công thức.');const materials=materialResult.data as unknown as Option[];return {materials,units,children:children.filter(c=>c.status!=='retired'&&(!recipe||clone||c.recipe_id!==recipe.id))};}});
 const locked=!!pending;const patch=(index:number,change:Partial<Line>)=>setLines(rows=>rows.map((r,i)=>i===index?{...r,...change}:r));
 const save=useMutation({retry:false,mutationFn:async()=>{let request=pending;if(!request){const outputDecimal=/^[0-9]{1,12}(\.[0-9]{1,2})?$/,componentDecimal=/^[0-9]{1,12}(\.[0-9]{1,2})?$/;if(!code.trim()||!name.trim()||!unit||!outputDecimal.test(roundedComponentQuantity(output))||Number(output)<=0)throw new Error('Nhập mã, tên, sản lượng dương và đơn vị.');const items=lines.map(l=>{const quantity=roundedComponentQuantity(l.quantity);if(!l.id||!l.unit||!componentDecimal.test(quantity)||Number(quantity)<=0)throw new Error('Liên kết và nhập đủ định lượng/đơn vị dương cho mọi dòng. Thành phần tối đa 2 chữ số thập phân.');return {material_id:l.type==='material'?l.id:null,child_version_id:l.type==='recipe'?l.id:null,quantity,unit_id:l.unit,cost_exempt:l.cost_exempt};});request={p_id:clone?null:recipe?.id??null,p_expected_version:clone?null:recipe?.version??null,p_recipe:{code:code.trim(),name:name.trim(),kind:type,effective_from:date,output_quantity:roundedComponentQuantity(output),output_unit_id:unit},p_items:items,p_evidence:'',p_key:crypto.randomUUID()};setPending(request);}const {data,error}=await browserSupabase().rpc('save_recipe_revision',request);if(error){if(error.code==='P0001'||error.code.startsWith('23')||error.code.startsWith('22'))setPending(null);throw new Error(error.message.includes('UNIT_NEEDS_VERIFICATION')?'Chưa có quy đổi riêng cho công thức đã xác minh. Mở Danh mục vật tư, nhập số đơn vị công thức trong một đơn vị kho (ví dụ 1 bì = 100 cái), lưu xác minh rồi chọn đơn vị công thức.':error.message.includes('VERSION_CONFLICT')?'Công thức đã thay đổi. Đóng và tải lại trước khi sửa.':'Chưa xác nhận lưu. Kiểm tra ngày trùng, quyền và định lượng; khi mất mạng hãy kiểm tra lại cùng lần gửi.');}return data as {recipe_id:string;version_id:string};},onSuccess:data=>{setPending(null);void client.invalidateQueries({queryKey:[userId,'recipe-catalog']});void client.invalidateQueries({queryKey:[userId,'recipe-detail']});void client.invalidateQueries({queryKey:[userId,'recipe-form-options']});notify('Đã lưu phiên bản mới và làm mới công thức.','success');onSaved(data.recipe_id,data.version_id);},onError:error=>notify(error.message,'error')});
 return <ActionDialog title={clone?'Sao chép công thức':recipe?'Chỉnh sửa công thức — phiên bản mới':'Thêm công thức'} onClose={onClose} busy={locked||save.isPending} className="recipe-form">
  <form onSubmit={e=>{e.preventDefault();save.mutate();}}>
   {options.isPending?<LoadingState label="Đang tải thành phần…"/>:options.error?<p role="alert">{options.error.message}</p>:<>
    <fieldset disabled={locked||save.isPending}>
     <div className="form-grid">
      <label>Mã công thức *<input required readOnly={!!recipe&&!clone} value={code} onChange={e=>setCode(e.target.value)}/></label>
      <label>Nhóm công thức<select value={type} onChange={e=>setType(e.target.value)}>{Object.entries(recipeKinds).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label className="recipe-full">Tên công thức *<input required value={name} onChange={e=>setName(e.target.value)}/></label>
      <label>Sản lượng / mẻ *<input inputMode="decimal" value={output} onChange={e=>setOutput(e.target.value)} onBlur={e=>setOutput(roundedComponentQuantity(e.currentTarget.value))}/></label>
      <label>Đơn vị sản lượng<select value={unit} onChange={e=>setUnit(e.target.value)}><option value="">Chọn đơn vị</option>{options.data?.units.map(u=><option key={u.id} value={u.id}>{u.code} · {u.name}</option>)}</select></label>
      <label>Ngày hiệu lực<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
     </div>
     <div className="recipe-line-heading"><h3>Thành phần & định lượng</h3><button type="button" className="button" disabled={lines.length>=200} onClick={()=>setLines([...lines,{type:'material',id:'',quantity:'',unit:'',cost_exempt:false}])}><Icon name="plus" size={15}/>Thêm thành phần</button></div>
     <div className="recipe-form-lines">
      {lines.map((line,index)=>{
       const material=line.type==='material'?options.data?.materials.find(m=>m.id===line.id):undefined;
       const stockUnit=options.data?.units.find(u=>u.id===material?.usage_unit_id);
       const formulaUnit=options.data?.units.find(u=>u.id===material?.formula_unit_id);
       return <div className="recipe-edit-line" key={index}>
        {line.source&&<p className="recipe-full warning-note">Nguồn: {line.source}. Chọn liên kết đúng bên dưới hoặc bỏ dòng có lý do.</p>}
        {material&&<p className="recipe-full note">Đơn vị kho: {stockUnit?.code??'chưa có'}. {material.formula_verified&&material.formula_unit_id&&formulaUnit?<>Quy đổi công thức đã xác minh: 1 {stockUnit?.code} = {material.formula_quantity} {formulaUnit.code}. Chọn {formulaUnit.code} nếu định lượng theo cái.</>:<>Chưa có quy đổi riêng cho công thức; dùng {stockUnit?.code??'đơn vị kho'} hoặc khai báo tỷ lệ tại phần xác minh vật tư.</>}</p>}
        <label>Loại<select aria-label={'Loại thành phần '+(index+1)} value={line.type} onChange={e=>patch(index,{type:e.target.value as Line['type'],id:'',unit:''})}><option value="material">Vật tư</option><option value="recipe">Công thức con</option></select></label>
        <label>Thành phần<select aria-label={'Thành phần '+(index+1)} value={line.id} onChange={e=>{const id=e.target.value;patch(index,{id,unit:(line.type==='material'?options.data?.materials.find(m=>m.id===id)?.usage_unit_id:options.data?.children.find(c=>c.id===id)?.output_unit_id)??''});}}><option value="">Chọn thành phần…</option>{line.type==='material'?options.data?.materials.map(m=><option key={m.id} value={m.id}>{m.code} — {m.name}</option>):options.data?.children.map(c=><option key={c.id} value={c.id}>{c.recipes?.code} — {c.recipes?.name}</option>)}</select></label>
        <label>Số lượng<input aria-label={'Định lượng '+(index+1)} inputMode="decimal" value={line.quantity} onChange={e=>patch(index,{quantity:e.target.value})} onBlur={e=>patch(index,{quantity:roundedComponentQuantity(e.currentTarget.value)})}/></label>
        <label>ĐVT<select aria-label={'Đơn vị '+(index+1)} value={line.unit} onChange={e=>patch(index,{unit:e.target.value})}><option value="">Chọn</option>{options.data?.units.map(u=><option key={u.id} value={u.id}>{u.code}</option>)}</select></label>
        <label className="recipe-cost-exempt"><input type="checkbox" checked={line.cost_exempt} onChange={e=>patch(index,{cost_exempt:e.target.checked})}/>Không tính giá</label>
        <button type="button" className="button" disabled={lines.length===1} aria-label={'Bỏ thành phần '+(index+1)} onClick={event=>{setLines(lines.filter((_,i)=>i!==index));event.currentTarget.closest('.recipe-form')?.querySelector<HTMLButtonElement>('.recipe-line-heading button')?.focus();}}><Icon name="close" size={15}/></button>
       </div>;
      })}
     </div>
     <p className="note">Định lượng thành phần tối đa 2 chữ số thập phân (ví dụ 1.12); số lẻ thêm được làm tròn khi rời ô hoặc lưu. Chọn đơn vị nhỏ hơn nếu cần định lượng chính xác hơn.</p>
     <p className="note">Tích “Không tính giá” để bỏ dòng này khỏi tổng cost; định lượng vẫn được giữ trong nhu cầu và kho.</p>
     <p className="note">Đơn giá và nhu cầu được tính theo quy đổi riêng dành cho công thức, tách khỏi đơn vị nhập/kho. Khi thiếu tỷ lệ đã xác minh, chỉ dùng được đơn vị kho. Sửa công thức tạo phiên bản mới; công thức con giữ đúng phiên bản đã chọn.</p>
    </fieldset>
    <footer className="toolbar"><button type="button" className="button" disabled={locked||save.isPending} onClick={onClose}>Hủy</button><button className="button primary" disabled={save.isPending}>{save.isPending?'Đang lưu…':pending?'Kiểm tra lại lần lưu':'Lưu công thức'}</button></footer>
   </>}
  </form>
 </ActionDialog>;
}
