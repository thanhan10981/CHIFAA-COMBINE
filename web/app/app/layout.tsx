import type {ReactNode} from 'react';
import {currentAccess} from '@/lib/auth/access';
import {AppShell} from '@/components/app-shell';
import {AccessBoundary} from '@/components/access-boundary';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:ReactNode}){const context=await currentAccess();return <AppShell access={context?.access??null}>{context&&<AccessBoundary userId={context.user.id} grants={JSON.stringify(context.access.permissions)}/>} {children}</AppShell>;}
