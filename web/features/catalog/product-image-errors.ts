type SupabaseFailure={message?:unknown;error?:unknown;status?:unknown;statusCode?:unknown;code?:unknown};

function fields(value:unknown):SupabaseFailure{
 if(value instanceof Error){const failure=value as Error&SupabaseFailure;return {message:failure.message,error:failure.error,status:failure.status,statusCode:failure.statusCode,code:failure.code};}
 return value&&typeof value==='object'?value as SupabaseFailure:{};
}

export function productImageFailure(value:unknown,phase:'upload'|'save'){
 const failure=fields(value),message=String(failure.message??failure.error??'').trim(),code=String(failure.code??'').trim();
 const status=String(failure.statusCode??failure.status??'').trim();
 const detail=message.replace(/\s+/g,' ').slice(0,180);
 const normalized=`${message} ${code}`.toLowerCase();

 if(phase==='upload'){
  if(/bucket.{0,30}(not found|does not exist)|bucket_not_found/i.test(normalized))
   return 'Chưa tìm thấy bucket product-images trên Supabase đang kết nối. Kiểm tra migration 059 đã được cài trên đúng project chưa.';
  if(['401','403'].includes(status)||/row.level security|permission denied|unauthorized|not authorized|forbidden/i.test(normalized))
   return 'Supabase Storage từ chối quyền tải ảnh. Kiểm tra tài khoản có quyền Sửa danh mục món (products.edit) và policy product_images_edit trên project này.';
  if(status==='413'||/payload too large|file size limit|maximum.*size/i.test(normalized))
   return 'Ảnh vượt giới hạn tải lên 5 MB. Hãy chọn ảnh nhỏ hơn.';
  if(/mime|content.type|media type|file type/i.test(normalized))
   return 'Supabase Storage không chấp nhận định dạng ảnh này. Chọn JPG, PNG hoặc WebP.';
  if(/failed to fetch|network|fetcherror/i.test(normalized))
   return 'Không kết nối được Supabase Storage. Kiểm tra mạng rồi thử lại.';
  return `Tải ảnh lên chưa thành công${status?` (HTTP ${status})`:''}${detail?`: ${detail}`:'. Supabase Storage không trả chi tiết lỗi.'}`;
 }

 if(/VERSION_CONFLICT/i.test(message))return 'Món vừa được cập nhật. Tải lại danh mục trước khi lưu ảnh.';
 if(/FORBIDDEN|permission denied/i.test(normalized))
  return 'Tài khoản không có quyền Sửa danh mục món (products.edit) để lưu ảnh.';
 if(code==='PGRST202'||/save_product_image.{0,80}(not found|does not exist)|function.{0,80}not found/i.test(normalized))
  return 'Chưa tìm thấy RPC save_product_image. Kiểm tra migration 059 đã được cài trên đúng project chưa.';
 if(/INVALID_PRODUCT_IMAGE/i.test(message))
  return 'Ảnh đã tải lên nhưng chưa gắn được vào món. Kiểm tra bucket product-images và migration 059 rồi thử lưu lại.';
 return `Ảnh đã tải lên nhưng chưa lưu được vào món${status?` (HTTP ${status})`:''}${detail?`: ${detail}`:'. Kiểm tra quyền và migration 059.'}`;
}
