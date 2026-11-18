import {currentAccess} from '@/lib/auth/access';
import {ConnectionRequired} from '@/components/connection-required';
import {AccessBoundary} from '@/components/access-boundary';
import {PortalShop} from '@/features/orders/portal-shop';
import {serverSupabase} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
export default async function StorePortal(){const client=await serverSupabase();if(!client)return <ConnectionRequired/>;const {data:{user}}=await client.auth.getUser();if(!user)redirect('/login?next=/portal/account');const context=await currentAccess();if(!context)return <ConnectionRequired/>;return <><AccessBoundary userId={context.user.id} grants={JSON.stringify(context.access.permissions)}/><PortalShop userId={context.user.id}/></>;}
