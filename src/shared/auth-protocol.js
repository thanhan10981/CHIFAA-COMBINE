// Stable JSON for signatures; independent of object key order in Apps Script RPC.
function canonicalJson(value){
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJson(value[k])).join(',')+'}';
  throw new Error('VALIDATION: Invalid signed request');
}
function requestMessage(action,args){
  const payload=Object.create(null);for(const k of Object.keys(args))if(k!=='proof')payload[k]=args[k];
  return canonicalJson({action,args:payload,requestId:args.proof?.requestId,at:args.proof?.at});
}
export { canonicalJson, requestMessage };
