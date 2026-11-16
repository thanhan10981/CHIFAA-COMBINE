import {SCHEMA,ROUTES,ACTIONS} from './schema.js';
// Page visibility is explicit for newly configured accounts. Data authorization
// remains module/action based and is always enforced by the server.
function routeReadModules(id){
  const target=ROUTES.find(r=>r[0]===id)?.[2];
  const reports={inventory:['materials','stock'],cost:['materials','recipes','stock','dishes'],demand:['materials','recipes','production','orders','stores','dishes'],variance:['materials','counts','stock','production','recipes','dishes'],payroll:['attendance','employees'],report:['sales','production','attendance','cash','recipes','materials','stock','stores','dishes']};
  if(reports[target])return reports[target];
  if(!SCHEMA[target])return [];
  const refs=Object.values(SCHEMA[target].fields).filter(f=>f.ref).map(f=>f.ref);
  if(target==='recipes')refs.push('materials');
  if(target==='sales')refs.push('discounts');
  return [...new Set([target,...refs])];
}
function pageActionOptions(id){
  const target=ROUTES.find(r=>r[0]===id)?.[2],schema=SCHEMA[target];
  if(!schema)return ['read'];
  return ACTIONS.filter(a=>!(['update','delete'].includes(a)&&schema.immutable)&&(a!=='approve'||schema.immutable||target==='orders'));
}
function canAccessPage(user,permissions,id){
  const route=ROUTES.find(r=>r[0]===id);if(!route)return false;
  if(user?.role==='admin')return true;
  if(['admin','health'].includes(id))return false;
  if(Array.isArray(permissions?._routes)&&!permissions._routes.includes(id))return false;
  return !SCHEMA[route[2]]||permissions?.[route[2]]?.includes('read')===true;
}
function linkedWriteActions(id){
  if(['production','entry-production','audit','entry-stock'].includes(id))return {stock:['create','approve']};
  if(id==='entry-payroll')return {attendance:['approve'],cash:['create']};
  if(id==='entry-loans')return {loans:['approve'],cash:['create']};
  if(id==='entry-debts')return {cash:['create']};
  return {};
}
export {routeReadModules,pageActionOptions,canAccessPage,linkedWriteActions};
