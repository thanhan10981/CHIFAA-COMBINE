'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useIsFetching,useIsMutating} from '@tanstack/react-query';
import {Icon} from './icons';

type Tone='success'|'error'|'info';
type Toast={id:number;message:string;tone:Tone};
type Notify=(message:string,tone?:Tone)=>void;
const FeedbackContext=createContext<Notify>(()=>{});
export const useNotify=()=>useContext(FeedbackContext);

export function ActionDialog({title,children,onClose,busy=false}:{title:string;children:ReactNode;onClose:()=>void;busy?:boolean}){
 const container=useRef<HTMLElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;container.current?.querySelector<HTMLElement>('textarea,input,button')?.focus();return()=>previous?.focus();},[]);
 return <div className="modal-backdrop"><section ref={container} role="dialog" aria-modal="true" aria-label={title} className="panel modal chifaa-action-dialog" onKeyDown={event=>{if(event.key==='Escape'&&!busy){event.stopPropagation();onClose();}if(event.key==='Tab'){const elements=Array.from(container.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]')??[]);const first=elements[0],last=elements.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}}}><header><h2>{title}</h2><button type="button" className="button" aria-label="Đóng hộp thoại" disabled={busy} onClick={onClose}><Icon name="close" size={18}/></button></header>{children}</section></div>;
}

function ToastItem({toast,onClose}:{toast:Toast;onClose:(id:number)=>void}){
 const [paused,setPaused]=useState(false);
 useEffect(()=>{if(paused||toast.tone==='error')return;const timer=setTimeout(()=>onClose(toast.id),6000);return()=>clearTimeout(timer);},[paused,toast,onClose]);
 return <div className={'chifaa-toast tone-'+toast.tone} role={toast.tone==='error'?'alert':'status'} onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false);}}><span className="chifaa-toast-icon"><Icon name={toast.tone==='success'?'success':toast.tone==='error'?'warning':'info'} size={21}/></span><div><strong>{toast.tone==='success'?'Hoàn tất':toast.tone==='error'?'Cần kiểm tra':'Thông báo'}</strong><p>{toast.message}</p></div><button type="button" onClick={()=>onClose(toast.id)} aria-label="Đóng thông báo"><Icon name="close" size={16}/></button></div>;
}
export function FeedbackProvider({children}:{children:ReactNode}){
 const [toasts,setToasts]=useState<Toast[]>([]),sequence=useRef(0),recent=useRef(new Map<string,number>());
 const notify=useCallback<Notify>((message,tone='info')=>{if(!message.trim())return;const key=tone+message,now=Date.now();if(now-(recent.current.get(key)??0)<1800)return;recent.current.set(key,now);for(const [key,at] of recent.current)if(now-at>10000)recent.current.delete(key);setToasts(items=>[...items.filter(item=>item.message!==message),{id:++sequence.current,message,tone}].slice(-6));},[]);
 const close=useCallback((id:number)=>setToasts(items=>items.filter(item=>item.id!==id)),[]);
 return <FeedbackContext.Provider value={notify}>{children}<div className="chifaa-toast-stack" aria-label="Thông báo hệ thống">{toasts.map(toast=><ToastItem toast={toast} key={toast.id} onClose={close}/>)}</div></FeedbackContext.Provider>;
}
// Declarative bridge for existing workflows; messages no longer change page layout.
export function ToastNotice({message,tone='info',eventKey}:{message?:string|null;tone?:Tone;eventKey?:number}){const notify=useNotify();useEffect(()=>{if(message)notify(message,tone);},[message,tone,eventKey,notify]);return null;}
export function LoadingState({label='Đang tải dữ liệu…',compact=false}:{label?:string;compact?:boolean}){return <div className={'chifaa-loading'+(compact?' compact':'')} role="status" aria-live="polite" aria-busy="true"><div className="chifaa-loading-orbit"><Icon name="loader" size={24}/><span/></div><span>{label}</span>{!compact&&<div className="chifaa-skeleton-lines" aria-hidden="true"><i/><i/><i/></div>}</div>;}
export function RequestActivity(){const fetching=useIsFetching(),mutating=useIsMutating();return <BusyIndicator busy={fetching+mutating>0} label={mutating?'Đang ghi nhận…':'Đang cập nhật dữ liệu…'}/>;}
export function BusyIndicator({busy,label='Đang xử lý…'}:{busy:boolean;label?:string}){const [visible,setVisible]=useState(false);useEffect(()=>{const timer=setTimeout(()=>setVisible(busy),busy?180:220);return()=>clearTimeout(timer);},[busy]);if(!visible||typeof document==='undefined')return null;return createPortal(<div className="chifaa-request-activity" role="status" aria-live="polite"><div className="chifaa-request-track"/><span><Icon name="loader" size={16}/>{label}</span></div>,document.body);}
