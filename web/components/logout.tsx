'use client';
import {useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {browserSupabase} from '@/lib/supabase/browser';
export function Logout(){const query=useQueryClient(),[busy,setBusy]=useState(false),[error,setError]=useState('');return <><button className="button" disabled={busy} onClick={async()=>{setBusy(true);const {error}=await browserSupabase().auth.signOut();if(error){setError('Không thể đăng xuất. Thử lại.');setBusy(false);return;}query.clear();if('indexedDB' in window)indexedDB.deleteDatabase('chifaa-drafts');
// A full navigation discards the private component tree and Next router cache.
// eslint-disable-next-line @next/next/no-location-assign-relative-destination
window.location.assign('/login');}}>{busy?'Đang đăng xuất…':'Đăng xuất'}</button>{error&&<span role="alert">{error}</span>}</>;}
