import Link from 'next/link';
import Image from 'next/image';
import {LayoutDashboard,ChevronRight,ArrowUpRight,PanelLeft} from 'lucide-react';
import type {ReactNode} from 'react';
import type {Access} from '@/lib/auth/access';
import {modules} from '@/lib/navigation';
import {Logout} from './logout';
export function AppShell({children,access}:{children:ReactNode;access:Access|null}){
 const visible=modules.filter(([, ,m])=>access?.permissions.some(p=>p.module===m&&p.action==='view'));
 return <div className="workspace"><aside className="sidebar"><Link href="/app" className="brand"><Image src="/logo-chifaa.png" width={64} height={76} alt="Chifaa" priority/><span><b>CHIFAA</b><strong>COMBINE</strong><small>KHÔNG GIAN VẬN HÀNH</small></span></Link><nav aria-label="Phân hệ"><p className="nav-caption">KHÔNG GIAN LÀM VIỆC</p><Link className="nav-home" href="/app"><LayoutDashboard size={18}/> Tổng quan điều hành</Link><p className="nav-caption">PHÂN HỆ CHIFAA</p>{visible.map(([path,label])=><Link key={path} href={'/app/'+path}><span>{label}</span><ChevronRight size={15}/></Link>)}{!access&&<p className="nav-note">Các phân hệ hiển thị sau khi xác thực và kiểm tra quyền.</p>}</nav><footer><span className="dot"/>{access?'Đã xác thực':'Chưa kết nối'}<small>CHIFAA COMBINE</small></footer></aside><div className="main"><header className="topbar"><span><PanelLeft size={19}/> Không gian làm việc <ChevronRight size={14}/> <b>Nội bộ</b></span><div><Link href="/portal">Cổng đặt hàng <ArrowUpRight size={15}/></Link>{access&&<Logout/>}</div></header><main id="main-content">{children}</main></div></div>;
}
