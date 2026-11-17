// Isolated interactions only, bundled into ignored output; no Next route or cloud API.
import {useState} from 'react';
import {useMutation,useQuery} from '@tanstack/react-query';
import {ActionDialog,LoadingState,ToastNotice,useNotify} from '@/components/feedback';
const delay=(milliseconds:number)=>new Promise(resolve=>setTimeout(resolve,milliseconds));
export function FeedbackFixture(){
 const notify=useNotify(),[dialog,setDialog]=useState(false);
 const read=useQuery({queryKey:['feedback-read'],enabled:false,retry:false,queryFn:async()=>{await delay(1500);return 'Dữ liệu kiểm tra';}});
 const fail=useQuery({queryKey:['feedback-error'],enabled:false,retry:false,queryFn:async()=>{await delay(300);throw new Error('Không thể tải dữ liệu kiểm tra.');}});
 const save=useMutation({mutationFn:async(milliseconds:number)=>{await delay(milliseconds);},onSuccess:()=>notify('Đã lưu kiểm tra.','success')});
 const reject=useMutation({mutationFn:async()=>{await delay(300);throw new Error('Chưa xác nhận lưu kiểm tra.');}});
 return <section style={{padding:40}}><h1>Feedback verification</h1><button onClick={()=>void read.refetch()}>Read</button><button onClick={()=>{void read.refetch();save.mutate(3000);}}>Overlap</button><button onClick={()=>void fail.refetch()}>Read error</button><button onClick={()=>reject.mutate()}>Write error</button><button onClick={()=>{notify('Đã lưu kiểm tra.','success');notify('Đã lưu kiểm tra.','success');}}>Duplicate success</button><button onClick={()=>setDialog(true)}>Open modal</button>{read.isFetching&&<LoadingState/>}{read.data&&<p>{read.data}</p>}{fail.isError&&<ToastNotice message={fail.error.message} tone="error"/>}{dialog&&<ActionDialog title="Kiểm tra hộp thoại" onClose={()=>setDialog(false)}><button onClick={()=>notify('Thông báo trong hộp thoại.','error')}>Modal notification</button></ActionDialog>}</section>;
}
