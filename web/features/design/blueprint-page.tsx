import blueprints from './blueprints.json';
import {replaceDecorativeIcons} from '@/components/icons';
import {OperationsDashboard} from '@/features/dashboard/operations-dashboard';
import {StrategyDashboard} from '@/features/dashboard/strategy-dashboard';
export function BlueprintPage({page,userId}:{page:string;userId?:string}) {
 if(page==='opsdashboard')return <OperationsDashboard userId={userId??'dashboard'}/>;
 if(page==='strategy')return <StrategyDashboard userId={userId??'strategy'}/>;
 const markup=blueprints[page as keyof typeof blueprints];
 if(!markup)return null;
 return <><p className="reference-status">Phân hệ đang hoàn thiện · Chưa mở thao tác ghi dữ liệu.</p><div dangerouslySetInnerHTML={{__html:replaceDecorativeIcons(markup)}}/></>;
}
