'use client';
import Link from 'next/link';
import Image from 'next/image';
import {usePathname} from 'next/navigation';
import {useState,type ReactNode} from 'react';
import {ChevronDown,Menu,X,ArrowUpRight,Settings,RefreshCw} from 'lucide-react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {browserSupabase} from '@/lib/supabase/browser';
import type {Access} from '@/lib/auth/access';
import {modules} from '@/lib/navigation';
import {referenceNavigation,referenceRoutes} from '@/features/design/routes';
import {Logout} from './logout';

export function AppShell({children,access,userLabel='Nội bộ'}:{children:ReactNode;access:Access|null;userLabel?:string}) {
 const pathname=usePathname(),queryClient=useQueryClient();
 const [mobile,setMobile]=useState(false),[closed,setClosed]=useState<Record<string,boolean>>({}),[refreshing,setRefreshing]=useState(false);
 const canView=(module:string)=>!!access?.enabled&&access.permissions.some(p=>p.module===module&&p.action==='view');
 const materialCount=useQuery({queryKey:[access?.user_id,'catalog','materials','count'],enabled:canView('materials'),queryFn:async()=>{const {count,error}=await browserSupabase().from('materials').select('id',{head:true,count:'exact'}).eq('archived',false);if(error)throw new Error('Chưa tải được số mã vật tư.');return count;}});
 const all=[...referenceNavigation.top,...referenceNavigation.groups.flatMap(g=>g.items)];
 const current=all.find(item=>pathname===('/app'+(referenceRoutes[item.id].slug?'/'+referenceRoutes[item.id].slug:'')));
 const extra=modules.filter(([slug,,module])=>!Object.values(referenceRoutes).some(route=>route.slug===slug)&&canView(module));
 const label=current?.label??modules.find(([slug])=>pathname==='/app/'+slug)?.[1]??'Không gian làm việc';
 const itemLink=(item:{id:string;label:string;icon:string})=>{
  const route=referenceRoutes[item.id];if(!route||!canView(route.module))return null;
  const href='/app'+(route.slug?'/'+route.slug:''),active=pathname===href;
  return <Link href={href} key={item.id} className={'navitem'+(active?' active':'')} aria-current={active?'page':undefined} onClick={()=>setMobile(false)}><span className="nav-icon" dangerouslySetInnerHTML={{__html:item.icon}}/><span className="nav-label">{item.label}</span>{item.id==='catalog'&&materialCount.data!=null&&<small>{materialCount.data}</small>}</Link>;
 };
 return <div className="workspace">
  {mobile&&<button className="reference-backdrop" aria-label="Đóng thanh điều hướng" onClick={()=>setMobile(false)}/>}
  <aside className={'sidebar'+(mobile?' open':'')} id="workspace-sidebar" aria-label="Thanh điều hướng CHIFAA">
   <Link href="/app" className="logo" onClick={()=>setMobile(false)}><Image className="brand-photo" src="/logo-chifaa.png" width={54} height={54} alt="Logo CHIFAA chính thức" priority/><div><h1>CHIFAA <span>COMBINE</span></h1><small>QUẢN LÝ VẬN HÀNH F&amp;B</small></div></Link>
   <nav aria-label="Phân hệ" className="reference-navigation"><div className="menu-title">KHÔNG GIAN LÀM VIỆC</div>{referenceNavigation.top.map(itemLink)}<div className="menu-title">PHÂN HỆ CHIFAA</div>
    {referenceNavigation.groups.map(group=>{
     if(!group.items.some(item=>canView(referenceRoutes[item.id].module)))return null;
     const open=!closed[group.id];
     return <div className="reference-nav-section" key={group.id}><button type="button" className={'navgroup'+(open?' is-open':'')} aria-expanded={open} aria-controls={'children-'+group.id} onClick={()=>setClosed({...closed,[group.id]:open})}><span className="navgroup-left"><span className="navgroup-icon" dangerouslySetInnerHTML={{__html:group.icon}}/><span className="navgroup-label">{group.label}</span></span><span className="nav-chevron"><ChevronDown/></span></button><div className={'nav-children'+(open?'':' collapsed')} id={'children-'+group.id} hidden={!open}>{group.items.map(itemLink)}</div></div>;
    })}
    {!!extra.length&&<><div className="menu-title">QUẢN TRỊ & TIỆN ÍCH</div>{extra.map(([slug,title])=><Link href={'/app/'+slug} key={slug} onClick={()=>setMobile(false)} className={'navitem'+(pathname==='/app/'+slug?' active':'')} aria-current={pathname==='/app/'+slug?'page':undefined}><span className="nav-icon"><Settings size={16}/></span><span className="nav-label">{title}</span></Link>)}</>}
   </nav>
   <div className="side-bottom"><span className="dot"/>{access?'Đã xác thực tài khoản':'Chưa xác thực'}<br/><strong>CHIFAA COMBINE</strong><span className="preview-footer-note">{userLabel}</span></div>
  </aside>
  <div className="main"><header className="topbar"><div className="reference-breadcrumb"><button className="reference-menu-toggle" aria-label={mobile?'Đóng menu':'Mở menu'} aria-expanded={mobile} aria-controls="workspace-sidebar" onClick={()=>setMobile(!mobile)}>{mobile?<X size={20}/>:<Menu size={20}/>}</button><span className="crumb">CHIFAA COMBINE / <strong>{label}</strong></span></div><div className="top-actions"><button className="button reference-refresh" disabled={refreshing} onClick={async()=>{setRefreshing(true);try{await queryClient.invalidateQueries();}finally{setRefreshing(false);}}}><RefreshCw size={15} className={refreshing?'spin':''}/><span>{refreshing?'Đang cập nhật…':'Làm mới'}</span></button><Link className="reference-portal" href="/portal">Cổng đặt hàng <ArrowUpRight size={14}/></Link><span className="avatar" title={userLabel}>{userLabel.slice(0,2).toUpperCase()}</span>{access&&<Logout/>}</div></header><main className="content" id="main-content">{children}</main></div>
 </div>;
}
