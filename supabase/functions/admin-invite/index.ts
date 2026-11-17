import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
// Supabase validates JWTs at the gateway as well; the function rechecks the
// caller and live database permissions before using a server-only secret.
Deno.serve(async(request:Request)=>{
 const origin=request.headers.get('origin')??'',allowed=(Deno.env.get('APP_ORIGINS')??'').split(',').map(s=>s.trim()).filter(Boolean);
 if(!allowed.includes(origin))return new Response('Forbidden origin',{status:403});
 const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Content-Type':'application/json'};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return new Response('{}',{status:405,headers});
 const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_ANON_KEY')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,authorization=request.headers.get('authorization')??'';
 const caller=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const {data:{user},error}=await caller.auth.getUser();if(error||!user)return new Response('{}',{status:401,headers});
 const {data:access,error:denied}=await caller.rpc('my_access');if(denied||!access.enabled||!access.permissions.some((p:{module:string;action:string})=>p.module==='admin'&&p.action==='manage'))return new Response('{}',{status:403,headers});
 let input:{email?:unknown};try{input=await request.json();}catch{return new Response('{}',{status:400,headers});}
 if(typeof input.email!=='string'||input.email.length>254||!/^\S+@\S+\.\S+$/.test(input.email))return new Response('{}',{status:400,headers});
 const admin=createClient(url,secret,{auth:{persistSession:false}}),{error:failure}=await admin.auth.admin.inviteUserByEmail(input.email,{redirectTo:new URL('/auth/callback',origin).toString()});
 // No automatic role escalation: invitees remain disabled until Admin grants access.
 return new Response(JSON.stringify({invited:!failure}),{status:failure?400:200,headers});
});
