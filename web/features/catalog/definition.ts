import {z} from 'zod';
import {materialCategories} from './material-types';
export function catalogOptionLabel(value:string){return ({...materialCategories,verified:'Đã xác minh',needs_verification:'Cần xác minh',cash:'Tiền mặt',bank:'Ngân hàng',mass:'Khối lượng',volume:'Thể tích',count:'Số lượng',package:'Đóng gói',ingredient:'Nguyên liệu',finished:'Thành phẩm',kiosk:'Ki-ốt'} as Record<string,string>)[value]??value;}
export type Field={key:string;label:string;type:'text'|'decimal'|'boolean'|'select';required?:boolean;options?:readonly string[];reference?:string};
const text=(key:string,label:string,required=true):Field=>({key,label,type:'text',required});
const decimal=(key:string,label:string,required=false):Field=>({key,label,type:'decimal',required});
export const catalogs:Record<string,{table:string;module:string;title:string;fields:Field[]}>= {
 accounts:{table:'bank_accounts',module:'cash',title:'Tài khoản quỹ & ngân hàng',fields:[text('code','Mã tài khoản'),text('name','Tên quỹ / ngân hàng'),{key:'kind',label:'Loại tài khoản',type:'select',options:['cash','bank'],required:true},{key:'archived',label:'Ngừng sử dụng',type:'boolean'}]},
 materials:{table:'materials',module:'materials',title:'Danh mục vật tư',fields:[text('code','Mã vật tư'),text('name','Tên vật tư'),{key:'category',label:'Nhóm',type:'select',options:Object.keys(materialCategories),required:true},{...text('purchase_unit_id','Đơn vị mua',false),reference:'material_units'},{...text('usage_unit_id','Đơn vị sử dụng',false),reference:'material_units'},decimal('minimum_quantity','Tồn tối thiểu — trống: chưa thiết lập'),{key:'price_status',label:'Xác minh giá',type:'select',options:['needs_verification','verified'],required:true}]},
 products:{table:'products',module:'products',title:'Danh mục món bán',fields:[text('code','Mã món'),text('name','Tên món'),text('sale_unit','Đơn vị bán'),{key:'published',label:'Công bố cho khách',type:'boolean'}]},
 stores:{table:'stores',module:'stores',title:'Danh mục điểm bán',fields:[text('code','Mã điểm bán'),text('name','Tên điểm bán'),text('address','Địa chỉ',false),text('contact','Liên hệ',false)]},
 employees:{table:'employees',module:'employees',title:'Danh mục nhân viên',fields:[text('code','Mã nhân viên'),text('name','Họ tên'),{...text('department_id','Bộ phận'),reference:'departments'}]},
 units:{table:'material_units',module:'materials',title:'Đơn vị chuẩn',fields:[text('code','Mã đơn vị'),text('name','Tên đơn vị'),{key:'dimension',label:'Loại đơn vị',type:'select',options:['mass','volume','count','package'],required:true}]},
 departments:{table:'departments',module:'employees',title:'Bộ phận',fields:[text('code','Mã bộ phận'),text('name','Tên bộ phận')]},
 warehouses:{table:'warehouses',module:'inventory',title:'Danh mục kho',fields:[text('code','Mã kho'),text('name','Tên kho'),{key:'kind',label:'Loại kho',type:'select',options:['ingredient','finished','kiosk'],required:true}]},
};
export function validateCatalog(slug:string,values:Record<string,unknown>){
 const definition=catalogs[slug];if(!definition)throw new Error('Phân hệ không hợp lệ');
 const shape:Record<string,z.ZodType>={};for(const field of definition.fields){let schema:z.ZodType;
  if(field.type==='decimal')schema=z.string().regex(/^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/,'Nhập số không âm, tối đa 6 số lẻ');
  else if(slug==='departments'&&field.key==='code')schema=z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$/,'Mã gồm tối đa 20 chữ cái, số, gạch ngang hoặc gạch dưới');
  else if(field.type==='boolean')schema=z.boolean();else if(field.type==='select')schema=z.enum(field.options as [string,...string[]]);else schema=z.string().trim().min(1,'Không được để trống').max(250);
  if(field.key.endsWith('_id'))schema=z.uuid();
  shape[field.key]=field.required?schema:z.union([schema,z.literal(''),z.null()]).optional();
 }
 const result=z.object(shape).strict().parse(values);return Object.fromEntries(Object.entries(result).map(([key,value])=>[key,value===''?null:slug==='departments'&&key==='code'&&typeof value==='string'?value.toUpperCase():value]));
}
export function catalogFormValues(slug:string,row?:Record<string,unknown>|null){return Object.fromEntries(catalogs[slug].fields.map(field=>[field.key,row?(field.type==='decimal'?String(row[field.key]??''):row[field.key]??''):field.type==='boolean'?false:field.type==='select'?field.options?.[0]:'']));}
export function catalogChanges(slug:string,values:Record<string,unknown>,row?:Record<string,unknown>|null){const input=validateCatalog(slug,values);if(!row)return input;const before=validateCatalog(slug,catalogFormValues(slug,row));return Object.fromEntries(Object.entries(input).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(before[key])));}
