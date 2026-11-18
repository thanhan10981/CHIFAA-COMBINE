import Link from 'next/link';import type {ReactNode} from 'react';
import {PortalShell} from '@/components/portal-shell';
export const dynamic='force-dynamic';
export default function PortalLayout({children}:{children:ReactNode}){return <PortalShell accountAction={<Link className="button" href="/portal/account">Đơn điểm bán</Link>}>{children}</PortalShell>;}
