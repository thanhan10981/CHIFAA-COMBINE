import 'server-only';
import {cache} from 'react';
import {redirect} from 'next/navigation';
import {serverSupabase} from '../supabase/server';
export type Permission={module:string;action:string};
export type Access={user_id:string;enabled:boolean;permissions:Permission[]};
export const allowed=(access:Access,module:string,action='view')=>access.enabled&&access.permissions.some(p=>p.module===module&&p.action===action);
export const currentAccess=cache(async()=>{
  const client=await serverSupabase();if(!client)return null;
  const {data:{user},error}=await client.auth.getUser();if(error||!user)redirect('/login');
  const {data,error:failure}=await client.rpc('my_access');if(failure)throw new Error('Không đọc được quyền từ database. Kiểm tra migrations.');
  const access=data as Access;if(!access.enabled)redirect('/login?reason=access');return {client,access,user};
});
