'use client';
import {useFormStatus} from 'react-dom';
import {BusyIndicator} from '@/components/feedback';

export function GoogleSubmit({connected}:{connected:boolean}) {
 const {pending}=useFormStatus();
 return <><BusyIndicator busy={pending} label="Đang chuyển tới Google…"/><button className="access-google" type="submit" disabled={!connected||pending} aria-busy={pending}>
  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.2H24v7.9h11c-.5 2.5-1.9 4.6-4.1 6v5h6.6c3.9-3.6 6.1-8.7 6.1-14.7Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.6-5c-1.8 1.2-4.1 1.9-6.9 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.7a12 12 0 0 1 0-7.4v-5.2H5.8a20 20 0 0 0 0 17.8l6.8-5.2Z"/><path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.8-5.8A19.2 19.2 0 0 0 24 4 20 20 0 0 0 5.8 15.1l6.8 5.2C14.2 15.5 18.7 11.9 24 11.9Z"/></svg>
  {pending?'Đang chuyển tới Google…':'Đăng nhập bằng Google'}
 </button></>;
}
