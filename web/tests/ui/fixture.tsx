// This offline visual fixture is bundled into ignored output/, never a Next route.
import {createRoot} from 'react-dom/client';
import {FeedbackProvider,RequestActivity} from '@/components/feedback';
import {Providers} from '@/components/providers';
import {FeedbackFixture} from './feedback-fixture';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {AppShell} from '@/components/app-shell';
import {PortalShell} from '@/components/portal-shell';
import {PortalShop} from '@/features/orders/portal-shop';
import {Logout} from '@/components/logout';
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
const path=window.location.pathname.split('/').pop()??'',reference=referencePageForSlug(path==='app'?'':path);
const role=new URLSearchParams(window.location.search).get('role');
const access={user_id:user,enabled:true,permissions:role==='staff'?[{module:'materials',action:'view'}]:[...new Set(['dashboard',...modules.map(([, ,module])=>module)])].flatMap(module=>['view','create','edit','approve','manage'].map(action=>({module,action})))};
const rows=Array.from({length:6},(_,index)=>({id:'material-'+index,version:1,code:'MAT-'+(index+1),name:'Nguyên liệu kiểm thử '+(index+1),category:'ingredient',purchase_unit_id:'kg',usage_unit_id:'kg',minimum_quantity:index===0?0:null,price_status:'needs_verification'}));
client.setQueryData([user,'catalog','materials',0,''],{rows,total:rows.length});
for(const slug of Object.keys(catalogs))if(slug!=='materials')client.setQueryData([user,'catalog',slug,0,''],{rows:[],total:0});
client.setQueryData([user,'catalog','materials','count'],rows.length);
client.setQueryData([user,'account-roles'],role==='staff'?['accountant']:['admin']);
client.setQueryData([user,'activity-log',0,''],{rows:[],total:0});
client.setQueryData([user,'admin','profiles'],[]);
client.setQueryData([user,'orders',0],[]);
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
const commercialRows={stores:[{id:'store-fixture',version:'1',code:'SYN-S',name:'Điểm bán kiểm thử',address:'Địa chỉ kiểm thử',contact:'',active:true,policy_id:'policy-fixture',common_rate:'0.15',enabled:true,effective_from:'0001-01-01',items:[{product_id:'product-fixture',eligible:true,override_rate:null},{product_id:'whole-fixture',eligible:false,override_rate:null}]}],products:[{id:'product-fixture',version:'1',code:'SYN-P',name:'Món kiểm thử',sale_unit:'Phần',price_vnd:'15000',legacy_cost:'5000',published:false,archived:false}],employees:[{id:'employee-fixture',version:'1',code:'SYN-E',name:'Nhân viên kiểm thử',phone:'',note:'Chưa có bộ phận',department_id:null,department_name:null,hourly_vnd:'25000',monthly_allowance_vnd:'300000',active:true}]} ;
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
client.setQueryData([user,'material-cost-basis','material-1',date],{usage_cost_vnd:'16',purchase_cost_vnd:'4000',usage_unit:'g',purchase_unit:'chai',official_ready:true});
client.setQueryData([user,'material-catalog',date,'','',0],{metrics:{total:6,kg:6,categories:1,unpriced:1},total:'6',rows:rows.map((row,index)=>({...row,version:'1',unit_code:'kg',usage_unit_code:'kg',price_amount:index===5?null:'16000.000000',price_verification:index===5?'needs_verification':'verified',basis_unit_id:'kg',price_date:date,source_unit_label:'kg',specification:'1 kg = 1.000 g',reference_quantity:null,stock_quantity:null,stock_reference:null,price_unit_code:'kg',price_resolved:index===1,conversions:[]}))});
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
client.setQueryData([user,'inventory','warehouses'],[]);
client.setQueryData([user,'dashboard',date],{net_revenue_vnd:null,received_vnd:null,produced:null,production_hours:null,updated_at:new Date().toISOString(),completeness:'Chưa đủ dữ liệu'});
const content=['production','entry-production','entry','requirements','counts','variance','consumption'].includes(path)?<ProductionMaterials slug={path} userId={user} permissions={{plan:true,produce:true,correct:true,count:true,classify:true,ledger:true,freeze:true,history:true}}/>:path==='materials'?<MaterialWorkspace userId={user} canCreate canEdit canApprove canCount canVerify/>:(['stores','products','employees','discounts'] as string[]).includes(path)?<CommercialWorkspace kind={path as 'stores'|'products'|'employees'|'discounts'} userId={user} permissions={Object.fromEntries([...new Set(access.permissions.map(p=>p.module))].map(scope=>[scope,access.permissions.filter(p=>p.module===scope).map(p=>p.action)]))}/>:catalogs[path]?<CatalogPage slug={path} userId={user} canCreate canEdit canApprove/>:['recipes','batches','rice','packaging','cost'].includes(path)?<RecipeWorkspace slug={path} userId={user} canCreate canEdit canApprove canReadCost/>:path==='counts'?<StockCount userId={user} canPost/>:['inventory','production','stockmovements','entry-stock','entry-production'].includes(path)?<OperationEditor kind={path==='production'||path==='entry-production'?'production':'inventory'} userId={user} canPost/>:path==='kiosk'?<Kiosk userId={user} canApprove canSell canUndo/>:path==='audit'?<ActivityLog userId={user}/>:path==='admin'?<Accounts userId={user} canManage/>:path==='orders'?<ReviewOrders userId={user} canApprove/>:path==='app'?<Dashboard userId={user}/>:reference?<BlueprintPage page={reference}/>:<section className="panel"><h1>{modules.find(([slug])=>slug===path)?.[1]}</h1><p>Workflow chưa hoàn tất.</p></section>;
createRoot(document.getElementById('root')!).render(path==='feedback'?<Providers><FeedbackFixture/></Providers>:<FeedbackProvider><QueryClientProvider client={client}><RequestActivity/>{path==='portal'?<PortalShell accountAction={<Logout/>}><PortalShop userId={user}/></PortalShell>:<AppShell access={access} userLabel="Tài khoản kiểm thử">{content}</AppShell>}</QueryClientProvider></FeedbackProvider>);
