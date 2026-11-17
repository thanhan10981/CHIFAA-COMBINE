'use client';
import {createBrowserClient} from '@supabase/ssr';
import {supabaseConfig} from './config';
let client:ReturnType<typeof createBrowserClient>|undefined;
export function browserSupabase(){
  const config=supabaseConfig();if(!config)throw new Error('Chưa kết nối Supabase DEV');
  return client??=createBrowserClient(config.url,config.key);
}
