function rpcCall(action, args = {}, { timeout = 25000 } = {}) {
  return new Promise((resolve,reject)=>{
    let settled=false;
    const timer=setTimeout(()=>{settled=true;const e=new Error('Chưa nhận được xác nhận từ máy chủ. Kết quả ghi chưa rõ; thử lại cùng phiếu để kiểm tra.');e.code='TIMEOUT';reject(e);},timeout);
    if(!globalThis.google?.script?.run){clearTimeout(timer);reject(new Error('Trang này cần chạy trong Google Apps Script để kết nối Sheets.'));return;}
    google.script.run.withSuccessHandler(result=>{
      if(settled)return;settled=true;clearTimeout(timer);
      if(result?.ok)resolve(result.data);else{const e=new Error(result?.error?.message||'Không thể xử lý yêu cầu');e.code=result?.error?.code;reject(e);}
    }).withFailureHandler(error=>{if(settled)return;settled=true;clearTimeout(timer);const e=new Error(error?.message||'Mất kết nối. Kết quả ghi chưa rõ.');e.code='NETWORK';reject(e);}).rpc(action,args);
  });
}
export { rpcCall };
