import http from 'node:http';
import {timingSafeEqual}from'node:crypto';
import {OAuth2Client}from'google-auth-library';
const client=new OAuth2Client();
const audience=process.env.GOOGLE_CLIENT_ID,secret=process.env.VERIFIER_SHARED_SECRET;
if(!audience||!secret||secret.length<32)throw new Error('Set GOOGLE_CLIENT_ID and a VERIFIER_SHARED_SECRET of at least 32 characters in the runtime environment.');
const equal=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);};
http.createServer(async(req,res)=>{
  const reply=(code,body)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
  if(req.method!=='POST'||req.url!=='/verify'||!equal(req.headers['x-chifaa-key'],secret)){reply(403,{error:'Forbidden'});return;}
  try{
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>15000){reply(413,{error:'Too large'});return;}chunks.push(chunk);}
    const {idToken}=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(typeof idToken!=='string')throw new Error('Invalid token');
    const ticket=await client.verifyIdToken({idToken,audience});const claims=ticket.getPayload();
    reply(200,{aud:claims.aud,iss:claims.iss,exp:claims.exp,email_verified:claims.email_verified,email:claims.email,hd:claims.hd,sub:claims.sub,nonce:claims.nonce});
  }catch(_){reply(401,{error:'Invalid Google identity'});}
}).listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('Chifaa identity verifier ready.'));
