// Mobile chrome for the internal Terminal module only. Move original nodes so
// xterm sessions, tab listeners and the React settings callback stay intact.
const mobile = matchMedia('(max-width:1024px)');
const viewport = window.visualViewport;
let state = null;
let pending = false;
let swapping = false;
const hostObserver = new MutationObserver(schedule);
const keysObserver = new ResizeObserver(schedule);
let observedHost = null;

function move(node, target, homes) {
  const anchor = document.createComment('terminal-mobile-home');
  node.before(anchor);
  homes.set(node, anchor);
  target.append(node);
}
function setOpen(open, restoreFocus = true) {
  if (!state) return;
  state.open = open;
  state.layer.dataset.open = String(open);
  state.rail.inert = !open;
  state.layer.setAttribute('aria-hidden', String(!open));
  state.trigger.setAttribute('aria-expanded', String(open));
  if (open) {
    requestAnimationFrame(() => {
      if (state?.open) (state.row.querySelector('[role="tab"][aria-selected="true"]') || state.close).focus({preventScroll:true});
    });
  } else if (restoreFocus) state.trigger.focus({preventScroll:true});
}
function restore() {
  if (!state) return;
  const old = state;
  state = null;
  keysObserver.disconnect();
  for (const [node, anchor] of old.homes) if (anchor.isConnected) anchor.replaceWith(node);
  old.row.classList.remove('lxp-terminal-tabs-controls');
  old.tabs.setAttribute('aria-orientation', old.orientation || 'horizontal');
  if (!old.orientation) old.tabs.removeAttribute('aria-orientation');
  old.newLabel.remove();
  for (const [name,value] of old.settingsAttrs) value === null ? old.settings.removeAttribute(name) : old.settings.setAttribute(name,value);
  old.host.removeAttribute('data-terminal-mobile-tabs');
  old.host.style.removeProperty('--lxp-terminal-viewport-inset');
  old.host.style.removeProperty('--lxp-terminal-visible-height');
  old.host.style.removeProperty('--lxp-terminal-keys-height');
  old.dock.remove();
  old.layer.remove();
}
function mount(host, tabs, row, settings) {
  const dock = document.createElement('div');
  dock.className = 'lxp-terminal-mobile-actions';
  const trigger = document.createElement('button');
  trigger.id = 'terminal-mobile-tabs-toggle';
  trigger.type = 'button';
  trigger.className = 'lxp-terminal-tabs-trigger';
  trigger.setAttribute('aria-label', tabs.getAttribute('aria-label') || host.querySelector('h2').textContent);
  trigger.title = trigger.getAttribute('aria-label');
  trigger.setAttribute('aria-controls','terminal-mobile-tabs-rail');
  trigger.setAttribute('aria-expanded','false');
  trigger.innerHTML = '<i class="ti ti-folders" aria-hidden="true"></i>';
  const layer = document.createElement('div');
  layer.className = 'lxp-terminal-tabs-layer';
  layer.dataset.open = 'false';
  layer.setAttribute('aria-hidden','true');
  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'lxp-terminal-tabs-backdrop';
  backdrop.tabIndex = -1;
  const closeLabel = host.querySelector('.lxp-workspace-quick-close').getAttribute('aria-label');
  backdrop.setAttribute('aria-label', closeLabel);
  const rail = document.createElement('aside');
  rail.id = 'terminal-mobile-tabs-rail';
  rail.className = 'lxp-terminal-tabs-rail';
  rail.setAttribute('role','dialog');
  rail.setAttribute('aria-modal','true');
  rail.setAttribute('aria-labelledby','terminal-mobile-tabs-title');
  rail.inert = true;
  const header = document.createElement('header');
  header.className = 'lxp-terminal-tabs-header';
  const icon = document.createElement('i');
  icon.className = 'ti ti-folders';
  icon.setAttribute('aria-hidden','true');
  const title = document.createElement('h2');
  title.id = 'terminal-mobile-tabs-title';
  title.textContent = trigger.getAttribute('aria-label');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'lxp-terminal-tabs-close';
  close.setAttribute('aria-label', closeLabel);
  close.innerHTML = '<i class="ti ti-x" aria-hidden="true"></i>';
  header.append(icon,title,close);
  const body = document.createElement('div');
  body.className = 'lxp-terminal-tabs-body';
  rail.append(header,body);
  layer.append(backdrop,rail);
  dock.append(trigger);
  host.append(dock,layer);
  const homes = new Map();
  const settingsAttrs = new Map(['aria-label','title'].map(name=>[name,settings.getAttribute(name)]));
  const orientation = tabs.getAttribute('aria-orientation');
  tabs.setAttribute('aria-orientation','vertical');
  row.classList.add('lxp-terminal-tabs-controls');
  const newButton = row.querySelector('#btn-new-tab');
  const newLabel = document.createElement('span');
  newLabel.className = 'lxp-terminal-new-tab-label';
  newLabel.textContent = newButton.getAttribute('aria-label') || newButton.title;
  newButton.append(newLabel);
  move(row,body,homes);
  move(settings,dock,homes);
  state = {host,tabs,row,settings,homes,dock,trigger,layer,rail,close,newLabel,orientation,settingsAttrs,open:false};
  host.setAttribute('data-terminal-mobile-tabs','');
  trigger.addEventListener('click',()=>setOpen(!state?.open));
  close.addEventListener('click',()=>setOpen(false));
  backdrop.addEventListener('click',()=>setOpen(false));
  dock.addEventListener('click',event=>{if(event.target.closest('#workspace-quick-settings'))setOpen(false,false);});
  layer.addEventListener('click',event=>{
    const target = event.target;
    if (target.closest('[data-action]')) return;
    if (target.closest('[role="tab"],#btn-new-tab')) setOpen(false);
  });
  layer.addEventListener('keydown',event=>{
    const target = event.target.closest('[role="tab"]');
    if (!target || event.target !== target) return;
    if (['Enter',' '].includes(event.key)) { setOpen(false); return; }
    const items = [...tabs.querySelectorAll('[role="tab"]')];
    let index = items.indexOf(target);
    if (event.key==='ArrowDown') index=(index+1)%items.length;
    else if (event.key==='ArrowUp') index=(index+items.length-1)%items.length;
    else if (event.key==='Home') index=0;
    else if (event.key==='End') index=items.length-1;
    else return;
    event.preventDefault();
    items[index]?.focus({preventScroll:true});
  });
  const keys = host.querySelector('#lxp-terminal-mobilekeys')?.parentElement;
  if (keys) keysObserver.observe(keys);
}
function syncViewport() {
  if (!state) return;
  const valid = viewport && Math.abs(viewport.scale-1)<.05;
  const bottom = valid ? viewport.height+viewport.offsetTop : innerHeight;
  const inset = Math.max(0,innerHeight-bottom);
  const keys = state.host.querySelector('#lxp-terminal-mobilekeys')?.parentElement;
  const height = keys && getComputedStyle(keys).display!=='none' ? keys.getBoundingClientRect().height : 0;
  state.dock.toggleAttribute('data-compact',(valid?viewport.height:innerHeight)-height<184);
  const values = {'--lxp-terminal-viewport-inset':`${Math.round(inset)}px`,'--lxp-terminal-visible-height':`${Math.round(valid?viewport.height:innerHeight)}px`,'--lxp-terminal-keys-height':`${Math.round(height)}px`};
  for (const [key,value] of Object.entries(values)) if(state.host.style.getPropertyValue(key)!==value)state.host.style.setProperty(key,value);
}
function arrange() {
  if (swapping) return;
  const host = document.getElementById('workspace-quick-drawer');
  if (host!==observedHost) {
    hostObserver.disconnect();
    observedHost=host;
    if(host)hostObserver.observe(host,{attributes:true,attributeFilter:['data-open','data-module']});
  }
  const active = mobile.matches && host?.dataset.open==='true' && host.dataset.module==='terminal';
  if (!active) {restore();return;}
  const tabs = host.querySelector('#tabs-container');
  const row = state?.host===host ? state.row : tabs?.parentElement;
  const settings = host.querySelector('#workspace-quick-settings');
  if (!tabs || !row || !settings || !row.querySelector('#btn-new-tab')) return;
  if (state && (state.host!==host || state.tabs!==tabs)) restore();
  if (!state) mount(host,tabs,row,settings);
  const label = settings.textContent.trim();
  if (label) {settings.setAttribute('aria-label',label);settings.title=label;}
  syncViewport();
}
function schedule() {
  if (pending || swapping) return;
  pending=true;
  requestAnimationFrame(()=>{pending=false;arrange();});
}
document.addEventListener('keydown',event=>{
  if (!state?.open || document.querySelector('dialog:modal')) return;
  if(event.key==='Escape') {
    event.preventDefault();event.stopImmediatePropagation();setOpen(false);return;
  }
  if(event.key!=='Tab')return;
  const focusable=[...state.rail.querySelectorAll('button,[tabindex]')].filter(node=>node.tabIndex>=0&&!node.disabled&&node.getClientRects().length);
  const first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
},true);
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
mobile.addEventListener('change',schedule);
viewport?.addEventListener('resize',schedule);
viewport?.addEventListener('scroll',schedule);
window.addEventListener('resize',schedule);
document.addEventListener('astro:before-swap',()=>{swapping=true;restore();});
document.addEventListener('astro:after-swap',()=>{swapping=false;arrange();});
document.addEventListener('astro:page-load',arrange);
arrange();
