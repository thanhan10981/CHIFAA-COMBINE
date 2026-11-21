'use client';

import {FormEvent,useRef,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {browserSupabase} from '@/lib/supabase/browser';
import {BusyIndicator,LoadingState} from '@/components/feedback';
import {Icon} from '@/components/icons';
import {modules} from '@/lib/navigation';

const actions=[['view','Xem'],['create','Thêm'],['edit','Sửa'],['approve','Duyệt'],['export','Xuất'],['manage','Quản lý']] as const;
const roleOptions=[['admin','Quản trị'],['accountant','Kế toán'],['manager','Quản lý'],['production','Sản xuất'],['warehouse','Kho'],['sales','Bán hàng'],['customer','Khách hàng']] as const;
type Account={id:string;display_name:string;enabled:boolean;created_at:string;roles:string[]};
type RolePermission={role_id:string;module:string;action:string};
type AccountsData={users:Account[];rolePermissions:RolePermission[]};
type Permission={module:string;action:string;allowed:boolean};
type SaveRequest={p_user:string;p_enabled:boolean;p_roles:string[];p_overrides:Permission[];p_key:string};
type InviteInput={full_name:string;email:string};
type InviteResult={invited:boolean;user_id?:string;audit_logged?:boolean};

const moduleRows=[...new Map<string,string>([...modules.map(([,label,module])=>[module,label] as const),['dashboard','Tổng quan'],['prices','Giá & chiết khấu'],['payments','Thu tiền'],['documents','Chứng từ'],['expenses','Chi phí'],['assets','Tài sản']]).entries()];
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLocaleLowerCase('vi');
const initials=(name:string)=>name.trim().split(/\s+/).slice(-2).map(part=>part[0]?.toLocaleUpperCase('vi')??'').join('')||'NV';
const roleLabel=(role:string)=>roleOptions.find(([id])=>id===role)?.[1]??role;

export function Accounts({userId,canManage}:{userId:string;canManage:boolean}){
 const queryClient=useQueryClient();
 const [selected,setSelected]=useState(''),[search,setSearch]=useState(''),[enabled,setEnabled]=useState(false),[grants,setGrants]=useState<Record<string,boolean>>({}),[roles,setRoles]=useState<string[]>([]),[pending,setPending]=useState<SaveRequest|null>(null),[message,setMessage]=useState(''),[messageTone,setMessageTone]=useState<'success'|'error'>('success'),[inviteOpen,setInviteOpen]=useState(false),[inviteName,setInviteName]=useState(''),[inviteEmail,setInviteEmail]=useState(''),[selectionError,setSelectionError]=useState(''),[loading,setLoading]=useState(false);
 const selectionGeneration=useRef(0);
 const accounts=useQuery({queryKey:[userId,'admin','profiles'],enabled:canManage,queryFn:async()=>{
  const client=browserSupabase();
  // Profiles and permission data are readable through Admin RLS. Keep this
  // database path primary so an unavailable Auth Edge Function cannot hide users.
  const [profilesResult,rolesResult,permissionsResult]=await Promise.all([
   client.from('profiles').select('id,display_name,enabled,created_at').order('display_name').limit(1000),
   client.from('user_roles').select('user_id,role_id').limit(5000),
   client.from('role_permissions').select('role_id,module,action').limit(5000),
  ]);
  if(profilesResult.error||rolesResult.error||permissionsResult.error)throw new Error('Không tải được hồ sơ tài khoản và quyền từ database. Kiểm tra quyền Admin và kết nối.');
  const roleByUser=new Map<string,string[]>();
  for(const row of (rolesResult.data??[]) as {user_id:string;role_id:string}[])roleByUser.set(row.user_id,[...(roleByUser.get(row.user_id)??[]),row.role_id]);
  const users=((profilesResult.data??[]) as {id:string;display_name:string;enabled:boolean;created_at:string}[]).map(profile=>{
   return {id:profile.id,display_name:profile.display_name,enabled:profile.enabled,created_at:profile.created_at,roles:roleByUser.get(profile.id)??[]};
  });
  return {users:users.sort((a,b)=>(a.display_name||a.id).localeCompare(b.display_name||b.id,'vi')),rolePermissions:(permissionsResult.data??[]) as RolePermission[]} satisfies AccountsData;
 }});
 const save=useMutation({retry:false,mutationFn:async()=>{
  if(!selected)throw new Error('Chọn tài khoản trước khi lưu quyền.');
  const request=pending??{p_user:selected,p_enabled:enabled,p_roles:roles,p_overrides:Object.entries(grants).map(([key,allowed])=>{const [module,action]=key.split(':');return {module,action,allowed};}),p_key:crypto.randomUUID()};
  setPending(request);
  const {error}=await browserSupabase().rpc('admin_assign_user',request);
  if(error){if(error.code==='P0001'||error.code.startsWith('23'))setPending(null);throw new Error(error.message.includes('LAST_ADMIN_REQUIRED')?'Không thể khóa hoặc gỡ quyền Admin cuối cùng.':'Chưa lưu được phân quyền. Kiểm tra lại quyền quản trị và kết nối.');}
 },onSuccess:()=>{setPending(null);setMessage('Đã lưu trạng thái và quyền tại database.');setMessageTone('success');void queryClient.invalidateQueries({queryKey:[userId,'admin','profiles']});},onError:error=>{setMessage(error.message);setMessageTone('error');}});
 const invite=useMutation({retry:false,mutationFn:async(input:InviteInput)=>{
  const {data,error}=await browserSupabase().functions.invoke('admin-invite',{body:{action:'invite',email:input.email,full_name:input.full_name}});
  if(error)throw new Error('Chưa gửi được lời mời. Kiểm tra email, Edge Function và danh sách tài khoản trước khi thử lại.');
  const result=data as InviteResult|null;
  if(!result?.invited)throw new Error('Supabase Auth chưa nhận lời mời. Email có thể đã được đăng ký.');
  return result;
 },onSuccess:async result=>{
  setInviteOpen(false);setInviteName('');setInviteEmail('');
  setMessage(result.audit_logged===false?'Đã gửi lời mời nhưng nhật ký chưa xác nhận ghi nhận. Hãy kiểm tra nhật ký hệ thống.':'Đã gửi lời mời. Tài khoản mới sẽ xuất hiện bên trái để bạn mở và cấp quyền.');
  setMessageTone(result.audit_logged===false?'error':'success');
  await queryClient.invalidateQueries({queryKey:[userId,'admin','profiles']});
 },onError:error=>{setMessage(error.message);setMessageTone('error');}});

 async function choose(id:string){
  if(save.isPending||pending)return;
  const generation=++selectionGeneration.current;
  setSelected(id);setGrants({});setRoles([]);setSelectionError('');setMessage('');
  const account=accounts.data?.users.find(row=>row.id===id);setEnabled(account?.enabled??false);
  if(!id)return;
  setLoading(true);
  try{
   const client=browserSupabase(),[overrides,existingRoles]=await Promise.all([client.from('user_permissions').select('module,action,allowed').eq('user_id',id),client.from('user_roles').select('role_id').eq('user_id',id)]);
   if(generation!==selectionGeneration.current)return;
   if(overrides.error||existingRoles.error)throw new Error('Không tải được quyền hiện tại. Chưa mở phần chỉnh sửa.');
   setGrants(Object.fromEntries((overrides.data??[]).map((permission:{module:string;action:string;allowed:boolean})=>[permission.module+':'+permission.action,permission.allowed])));
   setRoles((existingRoles.data??[]).map((row:{role_id:string})=>row.role_id));
  }catch(error){if(generation===selectionGeneration.current)setSelectionError(error instanceof Error?error.message:'Không tải được quyền hiện tại.');}
  finally{if(generation===selectionGeneration.current)setLoading(false);}
 }

 const users=accounts.data?.users??[];
 const filtered=users.filter(account=>normalize([account.display_name,account.id].join(' ')).includes(normalize(search)));
 const activeCount=users.filter(account=>account.enabled).length;
 const disabledCount=users.filter(account=>!account.enabled).length;
 const selectedAccount=users.find(account=>account.id===selected);
 const inherited=new Set((accounts.data?.rolePermissions??[]).filter(permission=>roles.includes(permission.role_id)).map(permission=>permission.module+':'+permission.action));
 const effectiveCount=moduleRows.reduce((sum,[module])=>sum+actions.reduce((count,[action])=>count+((grants[module+':'+action]??(inherited.has(module+':'+action)||roles.includes('admin')))?1:0),0),0);

 function submitInvite(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!canManage||invite.isPending)return;invite.mutate({full_name:inviteName.trim(),email:inviteEmail.trim().toLowerCase()});}

 return <section className="accounts-page">
  <BusyIndicator busy={save.isPending||invite.isPending} label={invite.isPending?'Đang gửi lời mời…':'Đang lưu phân quyền…'}/>
  <div className="page-heading accounts-heading"><div><p className="eyebrow">CHIFAA / QUẢN TRỊ</p><h1>Tài khoản & phân quyền</h1><p>Quản lý tài khoản nhân viên và quyền truy cập theo từng phân hệ.</p></div><button className="button primary" disabled={!canManage} onClick={()=>{setInviteOpen(true);setMessage('');}}><Icon name="plus" size={17}/> Mời nhân viên</button></div>
  {message&&<div className={'accounts-notice '+messageTone} role={messageTone==='error'?'alert':'status'}><Icon name={messageTone==='error'?'warning':'success'} size={18}/><span>{message}</span><button type="button" aria-label="Đóng thông báo" onClick={()=>setMessage('')}><Icon name="close" size={16}/></button></div>}
  {!canManage&&<div className="panel accounts-denied"><Icon name="lock" size={24}/><div><strong>Chỉ quản trị viên mới có thể xem danh sách tài khoản</strong><p>Liên hệ Admin để được cấp quyền quản lý tài khoản.</p></div></div>}
  {canManage&&<>
   <div className="accounts-metrics"><article className="panel"><span><Icon name="people" size={19}/>Tài khoản trong database</span><strong>{accounts.data?.users.length??'—'}</strong><small>Đọc từ hồ sơ profiles</small></article><article className="panel"><span><Icon name="success" size={19}/>Đã bật quyền</span><strong>{accounts.isPending?'—':activeCount}</strong><small>profiles.enabled = true</small></article><article className="panel"><span><Icon name="clock" size={19}/>Chưa bật quyền</span><strong>{accounts.isPending?'—':disabledCount}</strong><small>profiles.enabled = false</small></article></div>
   <div className="accounts-layout">
    <aside className="panel accounts-directory" aria-label="Danh sách tài khoản">
     <header><div><h2>Tài khoản nhân viên</h2><p>{accounts.isError?'Chưa tải được danh sách tài khoản':`${users.length} tài khoản trong hệ thống`}</p></div><span className="accounts-count">{accounts.isError?'—':filtered.length}</span></header>
     <label className="accounts-search"><Icon name="search" size={18}/><span className="sr-only">Tìm theo tên hoặc mã tài khoản</span><input aria-label="Tìm theo tên hoặc mã tài khoản" placeholder="Tìm tên hoặc mã tài khoản…" value={search} onChange={event=>setSearch(event.target.value)}/></label>
     {accounts.isPending?<LoadingState compact label="Đang tải danh sách tài khoản…"/>:accounts.isError?<div className="accounts-load-error" role="alert"><Icon name="warning" size={20}/><p>{accounts.error.message}</p><button className="button" onClick={()=>void accounts.refetch()}>Thử tải lại</button></div>:filtered.length===0?<div className="accounts-empty"><Icon name={search?'search':'people'} size={26}/><strong>{search?'Không tìm thấy tài khoản':'Chưa có tài khoản nào'}</strong><p>{search?'Thử tìm tên hoặc mã tài khoản khác.':'Mời nhân viên bằng nút ở góc trên.'}</p></div>:<div className="accounts-list" role="list">{filtered.map(account=>{
      const name=account.display_name||'Tài khoản chưa đặt tên';
      const status=account.enabled?'Đã bật quyền':'Chưa bật quyền';
      const tone=account.enabled?'active':'disabled';
      return <button type="button" className={'account-item'+(selected===account.id?' selected':'')} key={account.id} aria-current={selected===account.id?'true':undefined} onClick={()=>void choose(account.id)}>
       <span className="account-avatar">{initials(name)}</span><span className="account-item-copy"><strong>{name}</strong><small>Mã tài khoản · {account.id.slice(0,8)}</small><span className="account-item-roles">{account.roles.slice(0,2).map(role=><i key={role}>{roleLabel(role)}</i>)}{account.roles.length>2&&<i>+{account.roles.length-2}</i>}{!account.roles.length&&<i>Chưa cấp vai trò</i>}</span><span className={'account-status '+tone}><i/>{status}</span></span><Icon className="account-chevron" name="chevron" size={16}/>
      </button>;
     })}</div>}
    </aside>
    <section className="panel account-details" aria-label="Chi tiết và phân quyền tài khoản">
     {!selected?<div className="account-details-empty"><span><Icon name="shield" size={28}/></span><h2>Chọn một tài khoản</h2><p>Quyền hiện tại sẽ hiện tại đây. Bạn có thể chỉnh vai trò, từng quyền và trạng thái tài khoản.</p></div>:<>
      <header className="account-detail-heading"><span className="account-avatar large">{initials(selectedAccount?.display_name||'NV')}</span><div><p className="eyebrow">CHI TIẾT TÀI KHOẢN</p><h2>{selectedAccount?.display_name||'Tài khoản nhân viên'}</h2><p>Hồ sơ trong database · Tạo {selectedAccount?new Date(selectedAccount.created_at).toLocaleDateString('vi-VN'):'—'}</p></div><span className={'account-status '+(selectedAccount?.enabled?'active':'disabled')}><i/>{selectedAccount?.enabled?'Đã bật quyền':'Chưa bật quyền'}</span></header>
      <div className="account-detail-summary"><span><Icon name="info" size={17}/><span>Quyền riêng ưu tiên hơn vai trò. Bỏ một quyền sẽ từ chối quyền đó, kể cả với Admin.</span></span><b>{effectiveCount}/{moduleRows.length*actions.length}<small> quyền hiệu lực</small></b></div>
      {selectionError&&<div className="accounts-load-error inline" role="alert"><Icon name="warning" size={18}/>{selectionError}</div>}
      <fieldset disabled={!canManage||!!pending||save.isPending||loading||!!selectionError} className="account-editor">
       <div className="account-controls"><label className="account-enabled"><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/><span><strong>Kích hoạt tài khoản</strong><small>Cho phép đăng nhập vào ứng dụng nội bộ</small></span></label><div className="account-role-list" aria-label="Vai trò">{roleOptions.map(([role,label])=><label className={'account-role-chip'+(roles.includes(role)?' checked':'')} key={role}><input type="checkbox" checked={roles.includes(role)} onChange={event=>setRoles(current=>event.target.checked?[...current,role]:current.filter(value=>value!==role))}/>{label}</label>)}</div></div>
       <div className="account-permissions-heading"><div><h3>Quyền theo phân hệ</h3><p>Bật đúng hành động nhân viên được phép thực hiện.</p></div><span><Icon name="lock" size={15}/> Database xác thực mọi thao tác</span></div>
       <div className="table-wrap account-permissions-wrap"><table className="account-permissions"><thead><tr><th scope="col">Phân hệ</th>{actions.map(([action,label])=><th scope="col" key={action}>{label}</th>)}</tr></thead><tbody>{moduleRows.map(([module,label])=><tr key={module}><th scope="row">{label}</th>{actions.map(([action,actionLabel])=>{const key=module+':'+action;return <td key={action}><label className="account-permission-cell"><input aria-label={label+' '+actionLabel} type="checkbox" checked={grants[key]??(inherited.has(key)||roles.includes('admin'))} onChange={event=>setGrants(current=>({...current,[key]:event.target.checked}))}/><span className="sr-only">{label} · {actionLabel}</span></label></td>;})}</tr>)}</tbody></table></div>
      </fieldset>
      <footer className="account-savebar"><span>Vai trò, quyền và trạng thái bật/tắt được đọc và lưu trực tiếp trong database.</span><button className="button primary" disabled={!canManage||loading||!!selectionError||save.isPending} onClick={()=>save.mutate()}><Icon name="check" size={16}/>{save.isPending?'Đang lưu…':pending?'Kiểm tra lại lần lưu':'Lưu phân quyền'}</button></footer>
     </>}
    </section>
   </div>
  </>}
  {inviteOpen&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!invite.isPending)setInviteOpen(false);}}><section className="modal panel account-invite-modal" role="dialog" aria-modal="true" aria-labelledby="account-invite-title">
   <header><span className="account-invite-icon"><Icon name="people" size={22}/></span><button type="button" className="button icon-button" aria-label="Đóng hộp thoại" disabled={invite.isPending} onClick={()=>setInviteOpen(false)}><Icon name="close" size={18}/></button></header>
   <p className="eyebrow">QUẢN TRỊ TÀI KHOẢN</p><h2 id="account-invite-title">Mời nhân viên mới</h2><p className="account-invite-description">Nhân viên nhận email để hoàn tất đăng ký. Tài khoản sẽ chưa được cấp quyền cho tới khi bạn bật và lưu phân quyền.</p>
   <form onSubmit={submitInvite} className="account-invite-form"><label>Tên nhân viên<input autoFocus required minLength={2} maxLength={120} autoComplete="name" placeholder="Ví dụ: Nguyễn Văn An" value={inviteName} onChange={event=>setInviteName(event.target.value)}/></label><label>Email đăng nhập<input required type="email" maxLength={254} autoComplete="email" placeholder="nhanvien@example.com" value={inviteEmail} onChange={event=>setInviteEmail(event.target.value)}/></label>{invite.isError&&<p className="account-invite-error" role="alert">{invite.error.message}</p>}<div className="account-invite-actions"><button type="button" className="button" disabled={invite.isPending} onClick={()=>setInviteOpen(false)}>Hủy</button><button className="button primary" disabled={invite.isPending||!canManage}><Icon name="arrow" size={16}/>{invite.isPending?'Đang gửi…':'Gửi lời mời'}</button></div></form>
  </section></div>}
 </section>;
}
