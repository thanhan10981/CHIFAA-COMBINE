import Link from 'next/link';
import Image from 'next/image';
import type {ReactNode} from 'react';
export function PortalShell({children,accountAction}:{children:ReactNode;accountAction:ReactNode}){return <div className="portal"><header className="topbar"><Link href="/portal" className="portal-brand"><Image src="/logo-chifaa.png" width={36} height={44} alt="Chifaa"/><b>CHIFAA · Đặt hàng</b></Link>{accountAction}</header><main id="main-content">{children}</main></div>;}
