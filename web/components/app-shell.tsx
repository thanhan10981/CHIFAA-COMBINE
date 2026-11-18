'use client';
import Link from 'next/link';
import Image from 'next/image';
import {usePathname} from 'next/navigation';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ChevronDown,Menu,X,RefreshCw,Icon,navigationIcon} from '@/components/icons';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {browserSupabase} from '@/lib/supabase/browser';
import type {Access} from '@/lib/auth/access';
import {modules} from '@/lib/navigation';
import {workspaceNavigation,referenceRoutes,navigationParents,contextNavigation} from '@/features/design/routes';
import {Logout} from './logout';
import {accountRoleLabel} from '@/lib/auth/role-label';
import {PublicOrderLinks} from '@/features/orders/public-order-links';

export function AppShell({children,access,userLabel='Nội bộ'}:{children:ReactNode;access:Access|null;userLabel?:string}) {
 const pathname=usePathname(),queryClient=useQueryClient();
 const [mobile,setMobile]=useState(false),[closed,setClosed]=useState<Record<string,{closed:boolean;path:string}>>({}),[refreshing,setRefreshing]=useState(false);
 const [sidebarHidden,setSidebarHidden]=useState(false);
 const menuButton=useRef<HTMLButtonElement>(null),sidebar=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(!mobile)return;
  const media=window.matchMedia('(max-width:1023px)'),previousOverflow=document.body.style.overflow,trigger=menuButton.current;
  if(media.matches)document.body.style.overflow='hidden';
  sidebar.current?.querySelector<HTMLElement>('a,button')?.focus();
  const closeOnResize=()=>{if(!media.matches)setMobile(false);};
  const keydown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();setMobile(false);}
   if(event.key==='Tab'){
    const items=Array.from(sidebar.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)')??[]).filter(item=>item.getClientRects().length>0),first=items[0],last=items.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };
  media.addEventListener('change',closeOnResize);document.addEventListener('keydown',keydown);
  return()=>{document.body.style.overflow=previousOverflow;media.removeEventListener('change',closeOnResize);document.removeEventListener('keydown',keydown);trigger?.focus({preventScroll:true});};
 },[mobile]);
 const canView=(module:string)=>!!access?.enabled&&access.permissions.some(p=>p.module===module&&p.action==='view');
 const roles=useQuery({queryKey:[access?.user_id,'account-roles'],enabled:!!access?.enabled,queryFn:async()=>{const {data,error}=await browserSupabase().from('user_roles').select('role_id').eq('user_id',access!.user_id);if(error)throw new Error('Chưa tải được vai trò tài khoản.');return (data as {role_id:string}[]).map(row=>row.role_id);}});
 const roleLabel=!access?'Nội bộ':roles.data?accountRoleLabel(roles.data):roles.isError?'Chưa tải vai trò':'Đang tải vai trò…';
 const materialCount=useQuery({queryKey:[access?.user_id,'catalog','materials','count'],enabled:canView('materials'),queryFn:async()=>{const {count,error}=await browserSupabase().from('materials').select('id',{head:true,count:'exact'}).eq('archived',false);if(error)throw new Error('Chưa tải được số mã vật tư.');return count;}});
 const all=[...workspaceNavigation.top,...workspaceNavigation.groups.flatMap(g=>g.items)];
 const current=all.find(item=>pathname===('/app'+(referenceRoutes[item.id].slug?'/'+referenceRoutes[item.id].slug:'')));
 const slug=pathname.split('/')[2]??'',activeSlug=navigationParents[slug]??slug;
 const context=(contextNavigation.find(group=>group.includes(slug))??[]).flatMap(path=>{const definition=modules.find(([key])=>key===path);return definition&&canView(definition[2])?[definition]:[];});
 const label=current?.label??modules.find(([slug])=>pathname==='/app/'+slug)?.[1]??'Không gian làm việc';
 const itemLink=(item:{id:string;label:string;icon:string})=>{
  const route=referenceRoutes[item.id];if(!route||!canView(route.module))return null;
  const href='/app'+(route.slug?'/'+route.slug:''),active=activeSlug===route.slug;
  return <Link href={href} key={item.id} className={'navitem'+(active?' active':'')} aria-current={active?'page':undefined} onClick={()=>setMobile(false)}><span className="nav-icon"><Icon name={navigationIcon(item.id)}/></span><span className="nav-label">{item.label}</span>{item.id==='catalog'&&materialCount.data!=null&&<small>{materialCount.data}</small>}</Link>;
 };
 return <div className={'workspace'+(sidebarHidden?' sidebar-hidden':'')}>
  <button type="button" className="sidebar-edge-toggle" aria-label={sidebarHidden?'Mở thanh điều hướng':'Thu gọn thanh điều hướng'} title={sidebarHidden?'Mở thanh điều hướng':'Thu gọn thanh điều hướng'} aria-expanded={!sidebarHidden} aria-controls="workspace-sidebar" onClick={()=>setSidebarHidden(!sidebarHidden)}><ChevronDown size={18}/></button>
  {mobile&&<button className="reference-backdrop" aria-label="Đóng thanh điều hướng" onClick={()=>setMobile(false)}/>}
  <aside ref={sidebar} className={'sidebar'+(mobile?' open':'')} id="workspace-sidebar" aria-label="Thanh điều hướng CHIFAA">
   <Link href="/app" className="logo" onClick={()=>setMobile(false)}><Image className="brand-photo" src="/logo-chifaa.png" width={54} height={54} alt="Logo CHIFAA chính thức" priority/><div><h1>CHIFAA <span>COMBINE</span></h1><small>QUẢN LÝ VẬN HÀNH F&amp;B</small></div></Link>
   <nav aria-label="Phân hệ" className="reference-navigation"><div className="menu-title">KHÔNG GIAN LÀM VIỆC</div>{workspaceNavigation.top.map(itemLink)}<div className="menu-title">PHÂN HỆ CHIFAA</div>
    {workspaceNavigation.groups.map(group=>{
     if(!group.items.some(item=>canView(referenceRoutes[item.id].module)))return null;
     const active=group.items.some(item=>referenceRoutes[item.id].slug===activeSlug),manual=closed[group.id];
     const open=manual?(!manual.closed||(active&&manual.path!==pathname)):active;
     return <div className="reference-nav-section" key={group.id}><button type="button" className={'navgroup'+(open?' is-open':'')} aria-label={group.label} aria-expanded={open} aria-controls={'children-'+group.id} onClick={()=>setClosed({...closed,[group.id]:{closed:open,path:pathname}})}><span className="navgroup-left"><span className="navgroup-icon"><Icon name={navigationIcon(group.id)}/></span><span className="navgroup-label">{group.label.charAt(0)+group.label.slice(1).toLocaleLowerCase('vi-VN')}</span></span><span className="nav-chevron"><ChevronDown/></span></button><div className={'nav-children'+(open?'':' collapsed')} id={'children-'+group.id} hidden={!open}>{group.items.map(itemLink)}</div></div>;
    })}
   </nav>
   <button type="button" className="sidebar-close" onClick={()=>setMobile(false)}><X size={17}/>Đóng thanh menu</button>
   <div className="side-bottom"><span className="sidebar-account-icon"><Icon name="people" size={17}/></span><div className="sidebar-account-copy"><strong title={userLabel}>{userLabel}</strong><span className="sidebar-account-state"><span className="dot"/>{access?'Đã xác thực tài khoản':'Chưa xác thực'}</span></div></div>
  </aside>
  <div className="main"><header className="topbar"><div className="reference-breadcrumb"><button ref={menuButton} className="reference-menu-toggle" aria-label={mobile?'Đóng menu':'Mở menu'} aria-expanded={mobile} aria-controls="workspace-sidebar" onClick={()=>setMobile(!mobile)}>{mobile?<X size={20}/>:<Menu size={20}/>}</button><span className="crumb">CHIFAA COMBINE / <strong>{label}</strong></span></div><div className="top-actions"><button aria-label="Làm mới dữ liệu" title="Làm mới dữ liệu" className="button icon-button reference-refresh" disabled={refreshing} onClick={async()=>{setRefreshing(true);try{await queryClient.invalidateQueries();}finally{setRefreshing(false);}}}><RefreshCw size={18} className={refreshing?'spin':''}/></button><PublicOrderLinks userId={access?.user_id??'anonymous'} canCreate={!!access?.enabled&&access.permissions.some(p=>p.module==='orders'&&p.action==='create')&&access.permissions.some(p=>p.module==='stores'&&p.action==='view')}/><span className="account-role" title={roleLabel} aria-label={'Vai trò: '+roleLabel}><span>{roleLabel}</span></span>{access&&<Logout/>}</div></header><main className="content" id="main-content">{context.length>1&&<nav className="context-tabs" aria-label="Chức năng trong phân hệ">{context.map(([path,title])=><Link href={'/app/'+path} key={path} aria-current={slug===path?'page':undefined}>{title}</Link>)}</nav>}{children}</main></div>
 </div>;
}
