import blueprints from './blueprints.json';
export function BlueprintPage({page}:{page:string}) {
 const markup=blueprints[page as keyof typeof blueprints];
 if(!markup)return null;
 return <><div className="reference-status" role="status">Phân hệ đang hoàn thiện. Các thao tác chưa sẵn sàng được tạm khóa; chưa có dữ liệu nào được ghi nhận từ màn hình này.</div><div dangerouslySetInnerHTML={{__html:markup}}/></>;
}
