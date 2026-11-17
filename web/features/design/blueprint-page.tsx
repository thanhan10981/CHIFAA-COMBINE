import blueprints from './blueprints.json';
import {replaceDecorativeIcons} from '@/components/icons';
export function BlueprintPage({page}:{page:string}) {
 const markup=blueprints[page as keyof typeof blueprints];
 if(!markup)return null;
 return <><p className="reference-status">Phân hệ đang hoàn thiện · Chưa mở thao tác ghi dữ liệu.</p><div dangerouslySetInnerHTML={{__html:replaceDecorativeIcons(markup)}}/></>;
}
