import crypto from 'node:crypto';
import {requestMessage} from '../src/shared/auth-protocol.js';
export function signed(g,action,args,proof={}){
  const value={...args,proof:{requestId:crypto.randomUUID(),at:Date.now(),...proof}};
  const key=JSON.parse(g.cache.get(g.ctx.sessionKey_(args.token))||'null')?.signingKey;
  value.proof.signature=crypto.createHmac('sha256',key||'no-key').update(requestMessage(action,value)).digest('hex');
  return value;
}
export function send(g,action,args={}){return g.ctx.rpc(action,args.token?signed(g,action,args):args);}
