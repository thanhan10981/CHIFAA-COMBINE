import {currentAccess} from '@/lib/auth/access';import {ConnectionRequired} from '@/components/connection-required';import {PortalShop} from '@/features/orders/portal-shop';
export default async function Portal(){const context=await currentAccess();if(!context)return <ConnectionRequired/>;return <PortalShop userId={context.user.id}/>;}
