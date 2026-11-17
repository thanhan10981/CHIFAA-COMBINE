'use client';
import {ToastNotice} from '@/components/feedback';
export default function ErrorPage({reset}:{reset:()=>void}){return <section className="panel"><ToastNotice message="Chưa tải được trang. Kiểm tra kết nối rồi thử lại." tone="error"/><h1>Chưa tải được dữ liệu</h1><button onClick={reset} className="button primary">Thử lại</button></section>;}
