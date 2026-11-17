'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <section className="panel"><h1>Chưa tải được dữ liệu</h1><p>Không có thay đổi nào được xác nhận. Kiểm tra kết nối rồi thử lại.</p><button onClick={reset} className="button primary">Thử lại</button></section>;}
