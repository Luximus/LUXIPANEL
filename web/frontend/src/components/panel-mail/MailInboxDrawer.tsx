// SPDX-License-Identifier: AGPL-3.0-only
import { useEffect } from 'react';
/** Mailboxes use the same persistent internal module host as every other view. */
export default function MailInboxDrawer(){
  useEffect(()=>{
    const open=(event:Event)=>{
      const detail=(event as CustomEvent).detail;
      const id=Number(detail?.id);if(!Number.isSafeInteger(id)||id<1)return;
      window.dispatchEvent(new CustomEvent('lxp:module:open',{detail:{url:`/panel/mail/${id}/inbox`,parent:'/panel/mail',title:String(detail.address||''),accounts:detail.accounts}}));
    };
    window.addEventListener('lxp:mail:open-inbox',open);
    return()=>window.removeEventListener('lxp:mail:open-inbox',open);
  },[]);
  return null;
}
