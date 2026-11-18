import Image from 'next/image';
import {ToastNotice} from '@/components/feedback';
import {GoogleSubmit} from './submit';

const capabilities=[['Theo dõi vận hành','Sản xuất, nguyên liệu và tồn kho'],['Kiểm soát kinh doanh','Điểm bán, doanh thu và công nợ'],['Quản lý có trách nhiệm','Phân quyền và nhật ký hoạt động']];

export function LoginView({connected,reason,target,action}:{connected:boolean;reason?:string;target:'/portal'|'/app'|'/portal/account';action:(form:FormData)=>void|Promise<void>}) {
 return <main id="main-content" className="access-screen">
  <section className="access-brand" aria-labelledby="access-story-title">
   <div className="access-brandmark"><Image src="/logo-chifaa.png" width={80} height={80} alt="Chifaa" priority/><div><strong>CHIFAA <span>COMBINE</span></strong><small>HỆ THỐNG QUẢN TRỊ VẬN HÀNH</small></div></div>
   <div className="access-story"><p className="access-eyebrow">MỘT KHÔNG GIAN LÀM VIỆC</p><h1 id="access-story-title">Vận hành nhất quán.<br/>Quyết định rõ ràng.</h1><p className="access-description">Kết nối sản xuất, kinh doanh và tài chính trong cùng một hệ thống.</p>
    <ol className="access-capabilities">{capabilities.map(([title,description],index)=><li key={title}><span className="access-number">0{index+1}</span><div><strong>{title}</strong><p>{description}</p></div></li>)}</ol>
   </div>
   <footer className="access-brandfooter"><span>CHIFAA COMBINE</span><span>Không gian làm việc nội bộ</span></footer>
  </section>
  <section className="access-panel" aria-labelledby="access-title">
   <div className="access-card"><p className="access-card-eyebrow">TRUY CẬP HỆ THỐNG</p><h2 id="access-title">Đăng nhập CHIFAA</h2><p className="access-welcome">Chào bạn trở lại. Sử dụng tài khoản Google được cấp quyền để tiếp tục công việc.</p>
    <div className="access-divider"><span>TÀI KHOẢN LÀM VIỆC</span></div>
    <form action={action}><input type="hidden" name="target" value={target}/><GoogleSubmit connected={connected}/></form>
    <p className="access-help">Bấm đăng nhập để tiếp tục tới Google. CHIFAA sẽ đón bạn trở lại sau khi xác nhận.</p>
    {!connected&&<ToastNotice message="Chưa kết nối Supabase DEV. Cần cấu hình môi trường trước khi đăng nhập." tone="error"/>}
    {reason&&<ToastNotice message={reason==='access'?'Tài khoản chưa được cấp quyền hoặc đã bị khóa.':'Chưa hoàn tất đăng nhập. Kiểm tra cấu hình và thử lại.'} tone="error"/>}
    <div className="access-security"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/></svg><div><strong>Quyền truy cập theo tài khoản</strong><p>Chỉ hiển thị dữ liệu trong phạm vi được cấp. Quyền truy cập được kiểm tra cho từng thao tác.</p></div></div>
   </div>
   <footer className="access-panel-footer">CHIFAA COMBINE <span>·</span> Quản trị vận hành</footer>
  </section>
 </main>;
}
