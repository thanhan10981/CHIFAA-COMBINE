import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import {Providers} from '@/components/providers';
import {Pwa} from '@/components/pwa';
import './globals.css';
export const metadata:Metadata={
 title:'CHIFAA COMBINE',
 description:'Không gian vận hành CHIFAA',
 icons:{
  icon:[{url:'/logo-chifaa.png',type:'image/png',sizes:'1254x1254'}],
  apple:[{url:'/logo-chifaa.png',type:'image/png',sizes:'1254x1254'}],
 },
};
export default function Layout({children}:{children:ReactNode}){return <html lang="vi"><body><a className="skip-link" href="#main-content">Đến nội dung</a><Providers>{children}<Pwa/></Providers></body></html>;}
