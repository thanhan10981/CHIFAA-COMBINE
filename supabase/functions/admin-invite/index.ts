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
 const {data:access,error:denied}=await caller.rpc('my_access');if(denied||!access?.enabled||!access.permissions.some((p:{module:string;action:string})=>p.module==='admin'&&p.action==='manage'))return new Response('{}',{status:403,headers});
 let input:{action?:unknown;email?:unknown;full_name?:unknown};try{input=await request.json();}catch{return new Response('{}',{status:400,headers});}
 const action=input.action===undefined?'invite':input.action;if(action!=='list'&&action!=='invite')return new Response('{}',{status:400,headers});
 const admin=createClient(url,secret,{auth:{persistSession:false}});
 if(action==='list'){
  const authUsers=[];
  for(let page=1;page<=100;page++){
   const {data,error}=await admin.auth.admin.listUsers({page,perPage:100});if(error)return new Response(JSON.stringify({error:'USER_LIST_FAILED'}),{status:502,headers});
   authUsers.push(...data.users);if(data.users.length<100)break;
  }
  const rolePermissions:{role_id:string;module:string;action:string}[]=[];
  for(let page=0;page<10;page++){
   const {data,error}=await admin.from('role_permissions').select('role_id,module,action').order('role_id').order('module').order('action').range(page*1000,page*1000+999);
   if(error)return new Response(JSON.stringify({error:'USER_LIST_FAILED'}),{status:502,headers});
   rolePermissions.push(...data);if(data.length<1000)break;
  }
  const users=[];
  for(let offset=0;offset<authUsers.length;offset+=100){
   const batch=authUsers.slice(offset,offset+100),ids=batch.map(row=>row.id);
   const [{data:profiles,error:profileError},{data:assignments,error:roleError}]=await Promise.all([
    admin.from('profiles').select('id,display_name,enabled,created_at').in('id',ids),
    admin.from('user_roles').select('user_id,role_id').in('user_id',ids),
   ]);
   if(profileError||roleError)return new Response(JSON.stringify({error:'USER_LIST_FAILED'}),{status:502,headers});
   const profileById=new Map((profiles??[]).map(profile=>[profile.id,profile])),rolesById=new Map<string,string[]>();
   for(const row of assignments??[])rolesById.set(row.user_id,[...(rolesById.get(row.user_id)??[]),row.role_id]);
   for(const row of batch){
    const profile=profileById.get(row.id);
    users.push({id:row.id,email:row.email??'',display_name:profile?.display_name||String(row.user_metadata?.full_name??''),enabled:profile?.enabled??false,created_at:profile?.created_at??row.created_at,email_confirmed_at:row.email_confirmed_at,last_sign_in_at:row.last_sign_in_at,roles:rolesById.get(row.id)??[]});
   }
  }
  return new Response(JSON.stringify({users,role_permissions:rolePermissions,truncated:authUsers.length>=10000}),{status:200,headers});
 }
 if(typeof input.email!=='string'||input.email.trim().length>254||!/^\S+@\S+\.\S+$/.test(input.email.trim()))return new Response(JSON.stringify({invited:false,error:'INVALID_EMAIL'}),{status:400,headers});
 const email=input.email.trim().toLowerCase(),fullName=typeof input.full_name==='string'?input.full_name.trim():'';
 if(fullName&&fullName.length>120)return new Response(JSON.stringify({invited:false,error:'INVALID_NAME'}),{status:400,headers});
 const displayName=fullName||email.split('@')[0];
 const {data,error:failure}=await admin.auth.admin.inviteUserByEmail(email,{data:{full_name:displayName},redirectTo:new URL('/auth/callback',origin).toString()});
 if(failure)return new Response(JSON.stringify({invited:false,error:'INVITE_FAILED'}),{status:400,headers});
 const {error:auditError}=await admin.from('audit_logs').insert({actor_id:user.id,action:'INVITE',table_name:'profiles',record_id:data.user?.id??null,after_row:{email,display_name:displayName}});
 if(auditError)console.error('ADMIN_INVITE_AUDIT_FAILED',auditError.code);
 // Identity does not grant access: invited users remain disabled until Admin saves permissions.
 return new Response(JSON.stringify({invited:true,user_id:data.user?.id,audit_logged:!auditError}),{status:200,headers});
});
