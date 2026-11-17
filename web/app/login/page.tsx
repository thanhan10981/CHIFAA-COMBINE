import {supabaseConfig} from '@/lib/supabase/config';
import {LoginView} from './view';
import {login} from './actions';

export default async function Login({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const params=await searchParams;
 return <LoginView connected={!!supabaseConfig()} reason={params.reason} target={params.next==='/portal'?'/portal':'/app'} action={login}/>;
}