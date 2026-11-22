import {EntryWorkspace} from '@/features/entry/entry-workspace';
import {InventoryWorkspace} from '@/features/operations/inventory-workspace';
// This offline visual fixture is bundled into ignored output/, never a Next route.
import {createRoot} from 'react-dom/client';
import {FeedbackProvider,RequestActivity} from '@/components/feedback';
import {Providers} from '@/components/providers';
import {FeedbackFixture} from './feedback-fixture';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {AppShell} from '@/components/app-shell';
import {PortalShell} from '@/components/portal-shell';
import {PublicShop} from '@/features/orders/public-shop';
import {MaterialWorkspace} from '@/features/catalog/material-workspace';
import {CatalogPage} from '@/features/catalog/catalog-page';
import {CommercialWorkspace} from '@/features/catalog/commercial-workspace';
import {catalogs} from '@/features/catalog/definition';
import {RecipeWorkspace} from '@/features/recipes/recipe-workspace';
import {Dashboard} from '@/features/dashboard/dashboard';
import {OperationEditor} from '@/features/operations/editor';
import {StockCount} from '@/features/operations/stock-count';
import {ProductionMaterials,periodRange} from '@/features/operations/production-materials';
import {ActivityLog} from '@/features/admin/activity-log';
import {Kiosk} from '@/features/operations/kiosk';
import {Accounts} from '@/features/admin/accounts';
import {ReviewOrders} from '@/features/orders/review-orders';
import {BlueprintPage} from '@/features/design/blueprint-page';
import {modules} from '@/lib/navigation';
import {referencePageForSlug} from '@/features/design/routes';
const user='visual-fixture',client=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false,refetchOnWindowFocus:false}}});
if(window.location.pathname==='/app/assets')window.history.replaceState(null,'','/app/entry');
if(window.location.pathname==='/app/warehouses')window.history.replaceState(null,'','/app/inventory');
if(window.location.pathname==='/portal/account')window.history.replaceState({},'','/portal');
const path=window.location.pathname.split('/').pop()??'',reference=referencePageForSlug(path==='app'?'':path);
const role=new URLSearchParams(window.location.search).get('role');
const access={user_id:user,enabled:true,permissions:role==='staff'?[{module:'materials',action:'view'}]:[...new Set(['dashboard',...modules.map(([, ,module])=>module)])].flatMap(module=>['view','create','edit','approve','manage'].map(action=>({module,action})))};
const rows=Array.from({length:6},(_,index)=>({id:'material-'+index,version:1,code:'MAT-'+(index+1),name:'Nguyên liệu kiểm thử '+(index+1),category:'ingredient',purchase_unit_id:'kg',usage_unit_id:'kg',minimum_quantity:index===0?0:null,price_status:'needs_verification'}));
client.setQueryData([user,'catalog','materials',0,''],{rows,total:rows.length});
for(const slug of Object.keys(catalogs))if(slug!=='materials')client.setQueryData([user,'catalog',slug,0,''],{rows:[],total:0});
client.setQueryData([user,'catalog','materials','count'],rows.length);
client.setQueryData([user,'account-roles'],role==='staff'?['accountant']:['admin']);
client.setQueryData([user,'activity-log',0,''],{rows:[],total:0});
client.setQueryData([user,'admin','profiles'],{users:[
 {id:'account-employee-1',display_name:'Tĩnh Trương',enabled:true,created_at:'2026-10-10T00:00:00.000Z',roles:['manager']},
 {id:'account-employee-2',display_name:'Võ Thanh An',enabled:false,created_at:'2026-11-17T00:00:00.000Z',roles:[]},
],rolePermissions:[{role_id:'manager',module:'cash',action:'view'},{role_id:'manager',module:'inventory',action:'view'}]});
client.setQueryData([user,'orders',0],[]);
client.setQueryData([user,'public-order-link-stores'],[{id:'store-fixture',code:'GUEST-S',name:'Điểm nhận đơn kiểm thử'}]);
client.setQueryData([user,'public-order-links'],[]);
if(new URLSearchParams(window.location.search).has('guest-order')||new URLSearchParams(window.location.search).has('guest-order-linked')){
 const linked=new URLSearchParams(window.location.search).has('guest-order-linked');
 client.setQueryData([user,'orders',0],[{id:'guest-fixture',version:'1',store_id:linked?'guest-store':null,customer_id:null,delivery_date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date()),shift:'AM',status:'submitted',note:'Đơn công khai kiểm thử',guest_name:'Khách kiểm thử',guest_phone:'0900000035',guest_address:'Địa chỉ kiểm thử không phải dữ liệu thật',store_code:linked?'SYN-STORE':null,store_name:linked?'Synthetic linked store':null}]);
 client.setQueryData([user,'order-store-options'],[{id:'guest-store',code:'GUEST-S',name:'Điểm nhận đơn kiểm thử'}]);
 client.setQueryData([user,'order-lines','guest-fixture'],[{id:'guest-line',product_id:'guest-rice',quantity:'2',price_vnd:'15000',discount_rate:'0',product_name:'Cơm nắm kiểm thử',product_code:'CN',sale_unit:'Phần'}]);
}

client.setQueryData([user,'catalog-reference','material_units'],[{id:'kg',code:'kg',name:'Kilogram'}]);
for(const kind of ['product','rice','sauce','packaging'])client.setQueryData([user,'recipe-workspace',kind,0,''],{rows:[],total:0});
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
// Synthetic recipe catalogue: exercise the actual components without exposing business source.
for(const kind of ['product','rice','sauce','packaging']){
 const id='recipe-'+kind,vid='version-'+kind,cost={complete:false,total_vnd:null,lines:[]};
 const row={id,code:'SYN-'+kind,name:'Công thức kiểm thử '+kind,kind,version:'1',version_id:vid,revision:1,status:'draft',effective_from:date,output_quantity:kind==='rice'?'2000':'1',output_unit:kind==='rice'?'g':'phần',review_issue:'',cost};
 client.setQueryData([user,'recipe-catalog',kind,date,'',0],{rows:[row],total:1,stats:{products:1,batches:3,materials:6,unpriced:1}});
 client.setQueryData([user,'recipe-catalog','versions',id],[{id:vid,version:'1',revision:1,effective_from:date,status:'draft',output_quantity:row.output_quantity}]);
 client.setQueryData([user,'recipe-detail',vid,date],{version:{id:vid,revision:1,effective_from:date,status:'draft',output_quantity:row.output_quantity,output_unit_id:kind==='rice'?'g':'portion',output_unit:row.output_unit,review_issue:''},cost,source:{reference:'1234',raw:[['Synthetic source','not official cost']],product:'SYN-P',productQuantity:'1'},products:[],lines:[{id:'line-'+kind,type:'material',target_id:'material-0',recipe_id:null,code:'SYN-M',name:'Nguyên liệu kiểm thử',quantity:'125',unit:'g',unit_id:'g',per_output:'125',converted:'.125',stock_unit:'kg',unit_cost_vnd:'10',line_cost_vnd:'1250',issue:''},{id:'missing-'+kind,type:'unresolved',name:'Thành phần nguồn chưa xác minh',quantity:'1',unit:'phần',issue:'Cần xác minh đơn vị và định lượng'}]});
}
client.setQueryData([user,'recipe-form-options'],{materials:[{id:'material-0',code:'SYN-M',name:'Nguyên liệu kiểm thử',usage_unit_id:'kg'}],units:[{id:'kg',code:'kg',name:'Kilôgam'},{id:'g',code:'g',name:'Gam'},{id:'portion',code:'phần',name:'Phần'}],children:[{id:'version-sauce',recipe_id:'recipe-sauce',revision:1,status:'draft',output_unit_id:'portion',recipes:{code:'SYN-S',name:'Sốt kiểm thử'}}]});
client.setQueryData([user,'recipe-catalog','products'],[{id:'product-fixture',code:'SYN-P',name:'Món kiểm thử'}]);
const nextMonth=new Date(Date.UTC(Number(date.slice(0,4)),Number(date.slice(5,7)),1)).toISOString().slice(0,7);
client.setQueryData([user,'monthly-allowance','employee-fixture',date.slice(0,7)],{current:{id:'monthly-fixture',amount_vnd:'300000'},history:[{id:'monthly-fixture',revision:'1',amount_vnd:'300000',month:date.slice(0,7)+'-01',note:'Phụ cấp tháng kiểm thử',created_at:new Date().toISOString()}]});
client.setQueryData([user,'monthly-allowance','employee-fixture',nextMonth],{current:null,history:[]});
const commercialRows={stores:[{id:'store-fixture',version:'1',code:'SYN-S',name:'Điểm bán kiểm thử',address:'Địa chỉ kiểm thử',contact:'',active:true,policy_id:'policy-fixture',common_rate:'0.15',enabled:true,effective_from:'0001-01-01',items:[{product_id:'product-fixture',eligible:true,override_rate:null},{product_id:'whole-fixture',eligible:false,override_rate:null}]}],products:[{id:'product-fixture',version:'1',code:'SYN-P',name:'Món kiểm thử',sale_unit:'Phần',price_vnd:'15000',recipe_cost_vnd:'5000',recipe_cost_complete:true,recipe_cost_status:'ready',published:false,archived:false}],employees:[{id:'employee-fixture',version:'1',code:'SYN-E',name:'Nhân viên kiểm thử',phone:'',note:'Chưa có bộ phận',department_id:null,department_name:null,hourly_vnd:'25000',monthly_allowance_vnd:'300000',active:true}]} ;
for(const kind of ['stores','products','employees','discounts']){
 client.setQueryData([user,'commercial',kind,date,'','',0],{rows:commercialRows[kind==='discounts'?'stores':kind as keyof typeof commercialRows],total:'1',metrics:{total:1,active:1,missing:1,policies:1,published:0,departments:0}});
 for(const action of ['metadata','discount','price','store_price','pay','recipe'])client.setQueryData([user,'commercial-options',action,kind],{departments:[{id:'department-fixture',code:'SX',name:'Sản xuất'}],products:[{id:'product-fixture',code:'SYN-P',name:'Món kiểm thử'},{id:'whole-fixture',code:'SYN-W',name:'Món nguyên cây kiểm thử'}],versions:[],recipes:[]});
}
for(const [kind,id] of [['discount','store-fixture'],['store_price','store-fixture'],['price','product-fixture'],['recipe','product-fixture'],['pay','employee-fixture']])client.setQueryData([user,'commercial-history',kind,id],[{id:'version-fixture',effective_from:kind==='discount'?'0001-01-01':date,common_rate:'0.15',enabled:true,price_vnd:'15000',hourly_vnd:'25000',daily_allowance_vnd:'0',evidence:'Nguồn kiểm thử tổng hợp',items:kind==='discount'?[{product:'SYN-P · Món kiểm thử',eligible:true,override_rate:null},{product:'SYN-W · Món nguyên cây kiểm thử',eligible:false,override_rate:null}]:undefined}]);
client.setQueryData([user,'portal','stores'],[{id:'store-fixture',name:'Điểm bán kiểm thử'}]);
client.setQueryData([user,'portal','catalog','store-fixture',date],[{product_id:'product-fixture',code:'TEST',name:'Món kiểm thử với tên dài để kiểm tra bố cục trên điện thoại',sale_unit:'phần',price_vnd:'25000',discount_rate:'0'}]);
client.setQueryData([user,'portal','orders','store-fixture'],[{id:'order-fixture',delivery_date:date,status:'submitted',shift:'Ca sáng'}]);
client.setQueryData([user,'material-units'],[{id:'kg',code:'kg',name:'Kilogram'},{id:'g',code:'g',name:'Gam'},{id:'chai',code:'chai',name:'Chai'}]);
client.setQueryData([user,'material-review','material-1'],[{id:'resolution-fixture',revision:'1',effective_from:date,created_at:new Date().toISOString(),purchase_unit_id:'chai',usage_unit_id:'g',basis_unit_id:'kg',amount:'16000.000000',verification:'verified',package_unit_id:'chai',package_content_unit_id:'g',package_quantity:'250.000000000',package_verified:true,issue:'',evidence:'Synthetic source checked',source_data:{original:{unit:'Original source',price:'16000'}}}]);
client.setQueryData([user,'material-review','material-5'],[{id:'pending-resolution-fixture',revision:'1',effective_from:date,created_at:new Date().toISOString(),purchase_unit_id:'quả',usage_unit_id:'quả',basis_unit_id:'quả',amount:'2500.000000',verification:'needs_verification',package_unit_id:null,package_content_unit_id:null,package_quantity:null,package_verified:false,issue:'',evidence:'',source_data:{original:{unit:'quả',price:'2500'}}}]);
client.setQueryData([user,'material-cost-basis','material-1',date],{usage_cost_vnd:'16',purchase_cost_vnd:'4000',usage_unit:'g',purchase_unit:'chai',official_ready:true});
client.setQueryData([user,'material-cost-basis','material-5',date],{usage_cost_vnd:null,purchase_cost_vnd:'2500',usage_unit:'quả',purchase_unit:'quả',official_ready:false});
client.setQueryData([user,'material-catalog',date,'','','default',0],{metrics:{total:6,kg:6,categories:1,unpriced:0},total:'6',rows:rows.map((row,index)=>({...row,version:'1',unit_code:'kg',usage_unit_code:'kg',price_amount:index===5?'2500.000000':'16000.000000',price_verification:index===5?'needs_verification':'verified',basis_unit_id:'kg',price_date:date,source_unit_label:'kg',specification:'1 kg = 1.000 g',reference_quantity:null,stock_quantity:null,stock_reference:null,stock_average_unit_cost:index===0?'4500.000000':null,stock_receipt_count:index===0?'2':'0',stock_unpriced_receipt_count:'0',price_unit_code:index===5?'quả':'kg',price_resolved:index===1,conversions:[]}))});
client.setQueryData([user,'material-conversions','material-0'],[]);
client.setQueryData([user,'kiosk',date,date,0,0],{sources:[{id:'source-fixture',version:1,document_version:1,sold_on:date,store:'Điểm kiểm thử',product:'Món kiểm thử',quantity:'10',lot_id:null,lot_version:null,status:'pending',approved_on:null,received_on:null,rejected_on:null}],inventory:[{id:'lot-fixture',version:2,received_on:date,store:'Điểm kiểm thử',product:'Món kiểm thử',warehouse:'Kho ki-ốt kiểm thử',received:'10',sold:'0',balance:'10'}],sales:[],checked_at:new Date().toISOString(),valuation:null});
client.setQueryData([user,'kiosk-options'],{warehouses:[{id:'warehouse-fixture',name:'Kho ki-ốt kiểm thử'}],stores:[{id:'store-fixture',name:'Điểm ki-ốt kiểm thử'}],accounts:[]});
client.setQueryData([user,'production','options',date],{warehouses:[{id:'pm-w',name:'Kho nguyên liệu kiểm thử'}],products:[]});
const pmProduct={id:'pm-p',code:'SYN-P',name:'Món kiểm thử sản xuất',sale_unit:'phần',recipe_version_id:'synthetic-version',approved_quantity:null,main_quantity:'100',extra_quantity:'30',rejected_quantity:'5',sales:{delivered:'100',sold:'80',returned:'10',store_borne:'10'}};
const pmMaterial={material_id:'pm-m',code:'SYN-M',name:'Nguyên liệu kiểm thử đối chiếu',unit_id:'kg',unit:'kg',quantity:'0.52',checked_theory:'0.52',actual:'0.5616',difference:'0.0416',percent:'8',checked_days:1,theory_days:2,minimum:'1',stock:'10',check:{id:'pm-check',opening:'10',incoming:'0',closing:'9.4384',other_out:'0',evidence:'Chứng từ kiểm thử tổng hợp'},check_history:[]};
for(const period of ['day','week','rolling7','month','quarter'])for(const basis of ['planned','actual']){
 const range=periodRange(date,period);
 client.setQueryData([user,'production-materials','pm-w',range.from,range.to,basis],{capabilities:{reconciliation:true,production_correction:true},products:[pmProduct,{...pmProduct,id:'pm-p2',code:'SYN-NO',name:'Món chưa có công thức',recipe_version_id:null,main_quantity:null,extra_quantity:null,rejected_quantity:null,sales:null}],materials:[pmMaterial,{...pmMaterial,material_id:'pm-m2',code:'SYN-M2',name:'Nguyên liệu chưa kiểm kê',check:null,actual:null,percent:null,checked_theory:null,difference:null,checked_days:0}],sources:[{material_id:'pm-m',unit_id:'kg',product_id:'pm-p',recipe_version_id:'synthetic-version',quantity:'0.52',batch_id:'synthetic-batch',date},{product_id:'pm-p2',issue:'PUBLISHED_PRODUCT_RECIPE_REQUIRED'}],plan_id:'pm-plan',production_version:'synthetic-token',plan_lines:[{product_id:'pm-p',quantity:'100'}],history:[{id:'pm-plan',reason:'Nguồn kế hoạch kiểm thử',created_at:date,created_by:'synthetic-user'}],batches:[],...range,calculated_at:date});
}
client.setQueryData([user,'usage-evidence','pm-w',date,'pm-m'],{version:'synthetic-evidence-token',complete:true,unclassified:0,values:{opening:'10',incoming:'0',closing:'9.4384',other_out:'0'},opening_count:{id:'syn-opening',certification_id:'cert-opening'},closing_count:{id:'syn-closing',certification_id:'cert-closing'},counts:[{id:'syn-opening',counted_on:date,counted_quantity:'10',version:'1',certification_id:'cert-opening'},{id:'syn-closing',counted_on:date,counted_quantity:'9.4384',version:'1',certification_id:'cert-closing'}],documents:[{id:'syn-theory',date,kind:'issue',quantity:'-0.52',flow:'production',classification_id:null,note:'Xuất định mức kiểm thử'},{id:'syn-adjustment',date,kind:'adjustment',quantity:'-0.0416',flow:'count',classification_id:null,note:'Điều chỉnh kiểm kê kiểm thử'}]});
client.setQueryData([user,'consumption-history','pm-w'],[]);
client.setQueryData([user,'inventory','options',date],{warehouses:[],products:[]});
client.setQueryData([user,'inventory','warehouses'],new URLSearchParams(window.location.search).has('empty-warehouse')?[]:[{id:'inv-w',name:'Kho kiểm thử'}]);
const invNeed=new Date(date+'T00:00:00Z');invNeed.setUTCDate(invNeed.getUTCDate()+1);
for(const status of ['all','attention'])client.setQueryData([user,'inventory','workspace','inv-w',date,invNeed.toISOString().slice(0,10),'','',status,0],{rows:[{id:'inv-m',code:'INV-M',name:'Vật tư kiểm thử nhập kho',category:'ingredient',unit_id:'kg',unit:'kg',quantity:null,minimum:'3',needed:'12',suggested:null,status:'unknown'},{id:'inv-z',code:'INV-Z',name:'Vật tư tồn không đã xác nhận',category:'ingredient',unit_id:'kg',unit:'kg',quantity:'0',minimum:'3',needed:'12',suggested:'15',status:'low'}],total:2,summary:{materials:2,known:1,unknown:1,low:1},needs_complete:true,planned:true,inventory_version:'123'});
client.setQueryData([user,'counts','snapshot','inv-w',date,'',0],{inventory_version:'123',rows:[{id:'pm-m',code:'SYN-M',name:'Nguyên liệu kiểm thử đối chiếu',unit_id:'kg',unit_code:'kg',quantity:'10'}]});
client.setQueryData([user,'inventory','history','inv-w',date,null,0],[{id:'inv-doc',line_id:'inv-line',movement_version:'1',line_version:'1',moved_on:date,kind:'receipt',status:'posted',note:'Chứng từ nhập kiểm thử',source_batch_id:null,reverses_id:null,created_at:date,created_by:user,code:'INV-M',name:'Vật tư kiểm thử nhập kho',unit:'kg',quantity:'10',unit_cost:'3000.000000',unit_cost_source:'receipt_input',line_value:'30000.000000'}]);
client.setQueryData([user,'inventory','history','inv-w',date,'inv-m',0],[{id:'inv-doc',line_id:'inv-line',movement_version:'1',line_version:'1',moved_on:date,kind:'receipt',status:'posted',note:'Chứng từ nhập kiểm thử',source_batch_id:null,reverses_id:null,created_at:date,created_by:user,code:'INV-M',name:'Vật tư kiểm thử nhập kho',unit:'kg',quantity:'10',unit_cost:'3000.000000',unit_cost_source:'receipt_input',line_value:'30000.000000'}]);
client.setQueryData([user,'dashboard',date],{net_revenue_vnd:null,received_vnd:null,produced:null,production_hours:null,updated_at:new Date().toISOString(),completeness:'Chưa đủ dữ liệu'});
const content=['entry','sales','attendance','targets','loans','receivables','cash','payroll'].includes(path)?<EntryWorkspace module={path} userId={user} permissions={Object.fromEntries([...new Set(access.permissions.map(p=>p.module))].map(scope=>[scope,access.permissions.filter(p=>p.module===scope).map(p=>p.action)]))}/>:['inventory','stockmovements','stockhistory','reorder','entry-stock'].includes(path)?<InventoryWorkspace slug={path} userId={user} canPost canCount canCorrect canExport canImport/>:['production','entry-production','entry','requirements','counts','variance','consumption'].includes(path)?<ProductionMaterials slug={path} userId={user} permissions={{plan:true,produce:true,correct:true,count:true,classify:true,ledger:true,freeze:true,history:true}}/>:path==='materials'?<MaterialWorkspace userId={user} canCreate canEdit canApprove canCount canVerify/>:(['stores','products','employees','discounts'] as string[]).includes(path)?<CommercialWorkspace kind={path as 'stores'|'products'|'employees'|'discounts'} userId={user} permissions={Object.fromEntries([...new Set(access.permissions.map(p=>p.module))].map(scope=>[scope,access.permissions.filter(p=>p.module===scope).map(p=>p.action)]))}/>:catalogs[path]?<CatalogPage slug={path} userId={user} canCreate canEdit canApprove/>:['recipes','batches','rice','packaging','cost'].includes(path)?<RecipeWorkspace slug={path} userId={user} canCreate canEdit canReadCost/>:path==='counts'?<StockCount userId={user} canPost/>:['inventory','production','stockmovements','entry-stock','entry-production'].includes(path)?<OperationEditor kind={path==='production'||path==='entry-production'?'production':'inventory'} userId={user} canPost/>:path==='kiosk'?<Kiosk userId={user} canApprove canSell canUndo/>:path==='audit'?<ActivityLog userId={user}/>:path==='admin'?<Accounts userId={user} canManage/>:path==='orders'?<ReviewOrders userId={user} canApprove/>:path==='app'?<Dashboard userId={user}/>:reference?<BlueprintPage page={reference}/>:<section className="panel"><h1>{modules.find(([slug])=>slug===path)?.[1]}</h1><p>Workflow chưa hoàn tất.</p></section>;
createRoot(document.getElementById('root')!).render(path==='feedback'?<Providers><FeedbackFixture/></Providers>:<FeedbackProvider><QueryClientProvider client={client}><RequestActivity/>{path==='portal'?<PortalShell><PublicShop/></PortalShell>:<AppShell access={access} userLabel="Tài khoản kiểm thử">{content}</AppShell>}</QueryClientProvider></FeedbackProvider>);
