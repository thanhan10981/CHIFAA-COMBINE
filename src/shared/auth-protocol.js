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
  const message=canonicalJson({action,args:payload,requestId:args.proof?.requestId,at:args.proof?.at});
  // V2 signs ASCII bytes, not a Unicode string whose encoding is chosen by a
  // host service. Bind the protocol version to prevent cross-version reuse.
  if(args.proof?.version===2)return 'CHIFAA-RPC-v2\n'+message.replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  if(args.proof?.version!=null)throw new Error('AUTH: Phiên bản chữ ký không được hỗ trợ');
  return message;
}
export { canonicalJson, requestMessage };
