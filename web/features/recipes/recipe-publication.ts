export const uncertainRecipeResponse=(code?:string)=>!code||['502','503','504'].includes(code);
export type RecipePublicationRequest={p_version:string;p_expected_version:string;p_effective_from:string;p_key:string};
export type RecipePublicationResult={version_id:string;recipe_id:string;status:'published';effective_from:string;prepared_from_version_id?:string};

export function publicationFailure(message:string,code?:string){
 if(code==='PGRST202'||message.includes('publish_recipe_at')&&(message.includes('schema cache')||message.includes('does not exist')))return 'Chức năng công bố theo ngày chưa được cập nhật trên máy chủ. Cần áp dụng bản cập nhật 090 rồi tải lại trang. Bản nháp đã lưu được giữ để công bố lại.';
 const missingUnit=message.match(/UNIT_NEEDS_VERIFICATION\|material=([^|]+)\|from=([^|]+)\|to=([^|]+)/);
 const validationDate=message.match(/\|date=(\d{4}-\d{2}-\d{2})/)?.[1],formulaFrom=message.match(/\|formula_from=(\d{4}-\d{2}-\d{2})/)?.[1];
 const dateLabel=(date:string)=>date.split('-').reverse().join('/');
 if(missingUnit){
  if(validationDate&&formulaFrom&&formulaFrom>validationDate)return `Vật tư ${missingUnit[1]} có quy đổi công thức từ ${dateLabel(formulaFrom)}, nhưng ngày công bố đang chọn là ${dateLabel(validationDate)}. Chọn ngày công bố từ ${dateLabel(formulaFrom)} trở đi rồi kiểm tra và công bố lại. Hệ thống sẽ tạo phiên bản mới cho các bản nháp cũ cần chuyển ngày.`;
  return `Vật tư ${missingUnit[1]} chưa có quy đổi công thức đã xác minh từ ${missingUnit[2]} sang ${missingUnit[3]}${validationDate?' tại ngày '+dateLabel(validationDate):''}. Lưu xác minh quy đổi công thức trong Quy cách của Danh mục vật tư cho ngày áp dụng tương ứng, rồi kiểm tra và công bố lại.`;
 }
 if(message.includes('UNIT_NEEDS_VERIFICATION'))return 'Một vật tư trong công thức hoặc công thức con chưa có quy đổi công thức đã xác minh tại ngày hiệu lực. Lưu xác minh trong Quy cách của Danh mục vật tư rồi kiểm tra và công bố lại.';
 if(message.includes('PUBLISH_CHILD_FIRST'))return 'Cần công bố các công thức con trước. Nếu đã cài chức năng tự công bố, hãy kiểm tra trạng thái công thức con.';
 if(message.includes('CHILD_RECIPE_NOT_EFFECTIVE'))return 'Ngày bắt đầu áp dụng của công thức con phải trước hoặc cùng ngày với công thức món.';
 if(message.includes('RECIPE_PUBLICATION_DATE_BEFORE_SOURCE'))return 'Ngày công bố phải từ ngày bắt đầu áp dụng của bản nháp và các công thức con đã chọn trở đi. Chọn lại ngày rồi kiểm tra và công bố.';
 if(message.includes('INVALID_EFFECTIVE_DATE')||message.includes('INVALID_DATE'))return 'Chọn ngày bắt đầu áp dụng hợp lệ để công bố công thức.';
 if(message.includes('RECIPE_ARCHIVED'))return 'Công thức đã ngừng sử dụng. Khôi phục công thức trước khi kiểm tra và công bố.';
 if(message.includes('CHILD_OUTPUT_UNIT_MISMATCH'))return 'Đơn vị của thành phần công thức con phải khớp đơn vị sản lượng của công thức con.';
 if(message.includes('RECIPE_CYCLE'))return 'Công thức đang có liên kết vòng lặp. Hãy kiểm tra lại các công thức con.';
 if(message.includes('RECIPE_NEEDS_REVIEW'))return 'Công thức có thành phần hoặc định lượng cần đối chiếu trước khi công bố.';
 if(message.includes('VERSION_CONFLICT'))return 'Công thức vừa thay đổi. Tải lại dữ liệu rồi kiểm tra và công bố lại.';
 if(message.includes('FORBIDDEN'))return 'Tài khoản hiện tại không có quyền duyệt công thức.';
 if(message.includes('PRODUCT_LINK_PERMISSION_REQUIRED'))return 'Cần quyền xem Danh mục món bán để giữ đúng liên kết và tỷ lệ quy đổi khi công bố công thức.';
 if(message.includes('PRODUCT_RECIPE_RATIO_REQUIRED'))return 'Đơn vị sản lượng của công thức đã thay đổi. Cần thiết lập tỷ lệ quy đổi món bán phù hợp với đơn vị mới trong Danh mục món bán trước khi công bố.';
 return message;
}
