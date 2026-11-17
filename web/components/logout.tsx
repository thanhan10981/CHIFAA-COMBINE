'use client';
import {ToastNotice,BusyIndicator} from '@/components/feedback';
import {useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {Icon} from './icons';
import {browserSupabase} from '@/lib/supabase/browser';
export function Logout(){const query=useQueryClient(),[busy,setBusy]=useState(false),[error,setError]=useState('');return <><BusyIndicator busy={busy} label="Đang đăng xuất…"/><button className="button icon-button logout-button" title="Đăng xuất" aria-label={busy?'Đang đăng xuất…':'Đăng xuất'} disabled={busy} onClick={async()=>{setBusy(true);const {error}=await browserSupabase().auth.signOut();if(error){setError('Không thể đăng xuất. Thử lại.');setBusy(false);return;}query.clear();if('indexedDB' in window)indexedDB.deleteDatabase('chifaa-drafts');
// A full navigation discards the private component tree and Next router cache.
// eslint-disable-next-line @next/next/no-location-assign-relative-destination
window.location.assign('/login');}}><Icon name={busy?'loader':'logout'} size={19} className={busy?'spin':undefined}/></button>{error&&<ToastNotice message={error} tone="error"/>}</>;}
