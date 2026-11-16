// Text-only UI notifications. No business data, credentials or persistence.
const noticeTimers=new Map();
function dismissNotice(card){clearTimeout(noticeTimers.get(card));noticeTimers.delete(card);card.remove();const host=document.getElementById('toast');if(host&&!host.children.length){try{host.hidePopover?.();}catch(_){/* Older browsers use the fixed container. */}host.hidden=true;}}
function clearToasts(){for(const card of [...(document.getElementById('toast')?.children||[])])dismissNotice(card);}
function toast(message,type='success'){
  const host=document.getElementById('toast');if(!host)return;
  // A popover outside an open modal is visible but inert. Keep it inside the
  // active dialog so its close button and hover/focus controls remain usable.
  const parent=document.querySelector('dialog[open]')||document.body;
  if(host.parentElement!==parent){try{host.hidePopover?.();}catch(_){/* May already be closed. */}parent.append(host);}
  const types={success:['✓','Thành công'],error:['!','Có lỗi'],warning:['!','Cần chú ý'],info:['i','Thông báo']};
  if(!Object.hasOwn(types,type))type='info';
  const text=String(message?.message||message||'');if(!text)return;
  let card=[...host.children].find(n=>n.dataset.message===text&&n.dataset.type===type);
  if(!card){
    card=document.createElement('div');card.className='toast-card toast-'+type;card.dataset.message=text;card.dataset.type=type;
    card.setAttribute('role',type==='error'?'alert':'status');card.setAttribute('aria-atomic','true');
    const icon=document.createElement('span');icon.className='toast-icon';icon.textContent=types[type][0];icon.setAttribute('aria-hidden','true');
    const content=document.createElement('div');content.className='toast-content';const title=document.createElement('strong'),body=document.createElement('p');title.textContent=types[type][1];body.textContent=text;content.append(title,body);
    const close=document.createElement('button');close.type='button';close.className='toast-close';close.textContent='×';close.setAttribute('aria-label','Đóng thông báo');close.onclick=()=>dismissNotice(card);
    card.append(icon,content,close);host.append(card);while(host.children.length>4)dismissNotice(host.firstElementChild);
  }
  host.hidden=false;host.setAttribute('popover','manual');try{if(!host.matches(':popover-open'))host.showPopover?.();}catch(_){/* Fixed fallback when popovers are unsupported. */}
  const arm=()=>{clearTimeout(noticeTimers.get(card));noticeTimers.set(card,setTimeout(()=>dismissNotice(card),type==='error'||type==='warning'?10000:5000));};
  const pause=()=>clearTimeout(noticeTimers.get(card));card.onmouseenter=pause;card.onmouseleave=arm;card.onfocusin=pause;card.onfocusout=arm;arm();return card;
}
function notifyError(error){return toast(error,['TIMEOUT','NETWORK'].includes(error?.code)?'warning':'error');}
export {toast,notifyError,clearToasts};
