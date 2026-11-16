import {SCHEMA,ROUTES,ACTIONS} from '../shared/schema.js';
import {routeReadModules,pageActionOptions,linkedWriteActions} from '../shared/access.js';
import {NAV_SECTIONS} from './navigation.js';
const permissionLabels={read:'Xem',create:'Thêm',update:'Sửa',delete:'Xóa',approve:'Duyệt / đảo',export:'Xuất'};
function permissionNode(tag,text,className){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(className)n.className=className;return n;}
function createPermissionPicker(){
  const root=permissionNode('div',null,'permission-picker'),note=permissionNode('p',null,'permission-note'),sources=permissionNode('p',null,'permission-sources');
  const pages=new Set(),linkedPages=new Set(),linkedControls=new Map(),grants=new Map(),rows=new Map(),groupChecks=[];let admin=false;
  const sections=[['workspace','KHÔNG GIAN LÀM VIỆC','dashboard',['dashboard','opsdashboard','strategy']],...NAV_SECTIONS];
  root.append(note);
  function selectedModule(module){return [...pages].some(id=>ROUTES.find(r=>r[0]===id)?.[2]===module);}
  function cleanGrants(){for(const module of grants.keys())if(!selectedModule(module))grants.delete(module);}
  function update(){
    for(const id of linkedPages)if(!pages.has(id))linkedPages.delete(id);
    for(const [id,input]of linkedControls){input.checked=admin||linkedPages.has(id);input.disabled=admin||!pages.has(id);}
    for(const [id,controls]of rows){
      const target=ROUTES.find(r=>r[0]===id)[2],system=['admin','health'].includes(id);
      for(const [action,input]of controls){
        input.checked=admin||(!system&&pages.has(id)&&(action==='read'||grants.get(target)?.has(action)));
        input.disabled=admin||system||(action!=='read'&&!pages.has(id));
      }
    }
    for(const {input,ids}of groupChecks){const count=ids.filter(id=>pages.has(id)).length;input.checked=admin||(ids.length>0&&count===ids.length);input.indeterminate=!admin&&count>0&&count<ids.length;input.disabled=admin||!ids.length;}
    note.textContent=admin?'Admin có toàn quyền, bao gồm cấp tài khoản và nhật ký hệ thống.':'Tick Xem để hiện mục trên sidebar. Chọn thêm quyền thao tác nếu cần. Các mục dùng chung một bảng có chung quyền thao tác.';
    const modules=new Set([...pages].flatMap(routeReadModules));
    sources.textContent=admin?'Toàn bộ phân hệ được cấp cho Admin.':'Dữ liệu được phép đọc: '+([...modules].map(m=>SCHEMA[m].title).join(' · ')||'Chưa chọn phân hệ nào.');
    if(!admin&&linkedPages.size)sources.textContent+=' · Quyền ghi phiếu liên kết (không tự cấp đọc sổ): '+[...new Set([...linkedPages].flatMap(id=>Object.entries(linkedWriteActions(id)).map(([m,actions])=>SCHEMA[m].title+' ['+actions.map(a=>permissionLabels[a]).join(', ')+']')))].join(' · ');
  }
  for(const [key,title,,ids]of sections){
    const section=permissionNode('fieldset',null,'permission-group'),legend=permissionNode('legend'),groupLabel=permissionNode('label',null,'permission-group-label'),toggle=permissionNode('input');toggle.type='checkbox';toggle.dataset.permissionGroup=key;
    groupLabel.append(toggle,permissionNode('span',title));legend.append(groupLabel);section.append(legend);
    const selectable=ids.filter(id=>!['admin','health'].includes(id));groupChecks.push({input:toggle,ids:selectable});
    toggle.addEventListener('change',()=>{for(const id of selectable){if(toggle.checked)pages.add(id);else pages.delete(id);}cleanGrants();update();});
    for(const id of ids){
      const route=ROUTES.find(r=>r[0]===id);if(!route)continue;
      const row=permissionNode('div',null,'permission-row'),name=permissionNode('div',route[1],'permission-name'),controls=new Map(),actions=permissionNode('div',null,'permission-actions');
      rows.set(id,controls);row.dataset.permissionRoute=id;row.append(name,actions);
      for(const action of pageActionOptions(id)){
        const label=permissionNode('label',null,'permission-choice'),input=permissionNode('input');input.type='checkbox';input.dataset.page=id;input.dataset.action=action;input.setAttribute('aria-label',route[1]+' · '+permissionLabels[action]);
        controls.set(action,input);label.append(input,permissionNode('span',permissionLabels[action]));actions.append(label);
        input.addEventListener('change',()=>{
          if(action==='read'){if(input.checked)pages.add(id);else pages.delete(id);cleanGrants();}
          else{const module=route[2];if(!grants.has(module))grants.set(module,new Set());if(input.checked)grants.get(module).add(action);else grants.get(module).delete(action);}
          update();
        });
      }
      if(['admin','health'].includes(id))name.append(permissionNode('small','Chỉ Admin'));
      if(Object.keys(linkedWriteActions(id)).length){const label=permissionNode('label',null,'permission-choice'),input=permissionNode('input');input.type='checkbox';input.dataset.page=id;input.dataset.action='linked';input.setAttribute('aria-label',route[1]+' · Phiếu liên kết');linkedControls.set(id,input);label.append(input,permissionNode('span','Phiếu liên kết'));actions.append(label);input.addEventListener('change',()=>{if(input.checked)linkedPages.add(id);else linkedPages.delete(id);update();});}
      section.append(row);
    }
    root.append(section);
  }
  root.append(sources);
  function load(permissions={}){
    permissions=permissions||{};
    pages.clear();grants.clear();linkedPages.clear();
    const explicit=Array.isArray(permissions._routes)?permissions._routes:null;
    for(const [id,,target]of ROUTES){
      if(['admin','health'].includes(id))continue;
      if(explicit?explicit.includes(id):SCHEMA[target]?permissions[target]?.includes('read'):routeReadModules(id).length>0&&routeReadModules(id).every(m=>permissions[m]?.includes('read')))pages.add(id);
    }
    for(const module of Object.keys(SCHEMA)){const regular=new Set(ROUTES.filter(r=>r[2]===module&&pages.has(r[0])).flatMap(r=>pageActionOptions(r[0])));grants.set(module,new Set((permissions[module]||[]).filter(a=>a!=='read'&&regular.has(a))));}
    for(const id of pages){const policy=Object.entries(linkedWriteActions(id));if(policy.length&&policy.every(([m,actions])=>actions.every(a=>permissions[m]?.includes(a))))linkedPages.add(id);}
    cleanGrants();update();
  }
  function value(){
    if(admin)return {};
    const result={_routes:ROUTES.filter(([id])=>pages.has(id)).map(r=>r[0])};
    for(const id of pages){
      for(const module of routeReadModules(id)){result[module]||=[];if(!result[module].includes('read'))result[module].push('read');}
      const target=ROUTES.find(r=>r[0]===id)[2];
      if(SCHEMA[target])for(const action of grants.get(target)||[])if(!result[target].includes(action))result[target].push(action);
      if(linkedPages.has(id))for(const [module,actions]of Object.entries(linkedWriteActions(id))){result[module]||=[];for(const action of actions)if(!result[module].includes(action))result[module].push(action);}
    }
    return result;
  }
  update();return {root,load,value,setRole:role=>{admin=role==='admin';update();}};
}
export {createPermissionPicker};
