'use server';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {serverSupabase} from '@/lib/supabase/server';
export async function login(form:FormData){
 const target=form.get('target')==='/portal'?'/portal':'/app',client=await serverSupabase();if(!client)redirect('/login?reason=config');
 const configured=process.env.NEXT_PUBLIC_APP_URL;if(!configured)redirect('/login?reason=config');
 const origin=(await headers()).get('origin');if(origin!==new URL(configured).origin)throw new Error('Invalid request origin');
 const callback=new URL('/auth/callback',configured);callback.searchParams.set('next',target);
 const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:callback.toString()}});if(error||!data.url)redirect('/login?reason=oauth');redirect(data.url);
}
