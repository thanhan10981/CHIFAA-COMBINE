import Link from 'next/link';import type {ReactNode} from 'react';
import {PortalShell} from '@/components/portal-shell';
import {currentAccess} from '@/lib/auth/access';import {Logout} from '@/components/logout';import {AccessBoundary} from '@/components/access-boundary';
export const dynamic='force-dynamic';
export default async function PortalLayout({children}:{children:ReactNode}){const context=await currentAccess();return <PortalShell accountAction={context?<Logout/>:<Link href="/login?next=/portal">Đăng nhập</Link>}>{context&&<AccessBoundary userId={context.user.id} grants={JSON.stringify(context.access.permissions)}/>} {children}</PortalShell>;}
