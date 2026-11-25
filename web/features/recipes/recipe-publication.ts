export const uncertainRecipeResponse=(code?:string)=>!code||['502','503','504'].includes(code);

export function publicationFailure(message:string){
 const missingUnit=message.match(/UNIT_NEEDS_VERIFICATION\|material=([^|]+)\|from=([^|]+)\|to=([^|]+)/);
 const validationDate=message.match(/\|date=(\d{4}-\d{2}-\d{2})/)?.[1],formulaFrom=message.match(/\|formula_from=(\d{4}-\d{2}-\d{2})/)?.[1];
 const dateLabel=(date:string)=>date.split('-').reverse().join('/');
 if(missingUnit){
  if(validationDate&&formulaFrom&&formulaFrom>validationDate)return `Vật tư ${missingUnit[1]} có quy đổi công thức từ ${dateLabel(formulaFrom)}, nhưng công thức hoặc công thức con đang được kiểm tra tại ${dateLabel(validationDate)}. Tạo phiên bản công thức con bắt đầu áp dụng từ ngày đã có quy đổi, chọn lại phiên bản đó trong công thức món rồi công bố. Mở mã công thức con trong bảng để kiểm tra.`;
  return `Vật tư ${missingUnit[1]} chưa có quy đổi công thức đã xác minh từ ${missingUnit[2]} sang ${missingUnit[3]}${validationDate?' tại ngày '+dateLabel(validationDate):''}. Lưu xác minh quy đổi công thức trong Quy cách của Danh mục vật tư cho ngày áp dụng tương ứng, rồi kiểm tra và công bố lại.`;
 }
 if(message.includes('UNIT_NEEDS_VERIFICATION'))return 'Một vật tư trong công thức hoặc công thức con chưa có quy đổi công thức đã xác minh tại ngày hiệu lực. Lưu xác minh trong Quy cách của Danh mục vật tư rồi kiểm tra và công bố lại.';
 if(message.includes('PUBLISH_CHILD_FIRST'))return 'Cần công bố các công thức con trước. Nếu đã cài chức năng tự công bố, hãy kiểm tra trạng thái công thức con.';
 if(message.includes('CHILD_RECIPE_NOT_EFFECTIVE'))return 'Ngày bắt đầu áp dụng của công thức con phải trước hoặc cùng ngày với công thức món.';
 if(message.includes('CHILD_OUTPUT_UNIT_MISMATCH'))return 'Đơn vị của thành phần công thức con phải khớp đơn vị sản lượng của công thức con.';
 if(message.includes('RECIPE_CYCLE'))return 'Công thức đang có liên kết vòng lặp. Hãy kiểm tra lại các công thức con.';
 if(message.includes('RECIPE_NEEDS_REVIEW'))return 'Công thức có thành phần hoặc định lượng cần đối chiếu trước khi công bố.';
 if(message.includes('VERSION_CONFLICT'))return 'Công thức vừa thay đổi. Tải lại dữ liệu rồi kiểm tra và công bố lại.';
 if(message.includes('FORBIDDEN'))return 'Tài khoản hiện tại không có quyền duyệt công thức.';
 return message;
}
