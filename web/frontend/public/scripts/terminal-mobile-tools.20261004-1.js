// Mobile chrome for the internal Terminal module only. Move original nodes so
// xterm sessions, tab listeners and the React settings callback stay intact.
const mobile = matchMedia('(max-width:1024px)');
const viewport = window.visualViewport;
let state = null;
let pending = false;
let swapping = false;
const hostObserver = new MutationObserver(schedule);
const keysObserver = new ResizeObserver(schedule);
const toolsObserver = new MutationObserver(schedule);
let observedHost = null;

function move(node, target, homes) {
  const anchor = document.createComment('terminal-mobile-home');
  node.before(anchor);
  homes.set(node, anchor);
  target.append(node);
}
function setOpen(open, restoreFocus = true) {
  if (!state) return;
  if (open) setToolOpen(null,false);
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
function setToolOpen(type, restoreFocus = true) {
  if (!state) return;
  const previous = state.toolOpen;
  if (type) {
    if (state.open) setOpen(false,false);
    document.activeElement?.blur();
    state.toolTabs[type].click();
  }
  state.toolOpen = type;
  state.toolsLayer.dataset.open = String(Boolean(type));
  state.toolsLayer.setAttribute('aria-hidden',String(!type));
  state.toolsRail.inert = !type;
  state.toolsRail.setAttribute('aria-label',type ? state.toolTriggers[type].title : state.toolTriggers.snippets.title);
  for (const [name,button] of Object.entries(state.toolTriggers)) button.setAttribute('aria-expanded',String(type===name));
  if (type) requestAnimationFrame(()=>state?.toolOpen && state.toolTabs[state.toolOpen].focus({preventScroll:true}));
  else if (restoreFocus && previous) state.toolTriggers[previous].focus({preventScroll:true});
}
function restore() {
  if (!state) return;
  const old = state;
  state = null;
  keysObserver.disconnect();
  toolsObserver.disconnect();
  for (const [node, anchor] of old.homes) if (anchor.isConnected) anchor.replaceWith(node);
  old.row.classList.remove('lxp-terminal-tabs-controls');
  old.tabs.setAttribute('aria-orientation', old.orientation || 'horizontal');
  if (!old.orientation) old.tabs.removeAttribute('aria-orientation');
  old.newLabel.remove();
  old.toolsAside.classList.remove('lxp-terminal-tools-content');
  old.toolsAside.inert = matchMedia('(max-width:767px)').matches && old.toolsAside.dataset.mobileOpen!=='true';
  for (const [name,value] of old.settingsAttrs) value === null ? old.settings.removeAttribute(name) : old.settings.setAttribute(name,value);
  old.host.removeAttribute('data-terminal-mobile-tabs');
  old.host.style.removeProperty('--lxp-terminal-viewport-inset');
  old.host.style.removeProperty('--lxp-terminal-visible-height');
  old.host.style.removeProperty('--lxp-terminal-keys-height');
  old.dock.remove();
  old.layer.remove();
  old.toolsLayer.remove();
}
function mount(host, tabs, row, settings, toolsAside) {
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
  // Keep every control inside the owning module scope and React event root.
  const scope = toolsAside.closest('[data-internal-module]') || host;
  scope.append(dock,layer);
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
  const toolsLayer = document.createElement('div');
  toolsLayer.className = 'lxp-terminal-tabs-layer lxp-terminal-tools-layer';
  toolsLayer.dataset.open = 'false';
  toolsLayer.setAttribute('aria-hidden','true');
  const toolsBackdrop = backdrop.cloneNode(true);
  const toolsRail = document.createElement('div');
  toolsRail.id = 'terminal-mobile-tools-rail';
  toolsRail.className = 'lxp-terminal-tabs-rail lxp-terminal-tools-rail';
  toolsRail.setAttribute('role','dialog');
  toolsRail.setAttribute('aria-modal','true');
  toolsRail.inert = true;
  toolsLayer.append(toolsBackdrop,toolsRail);
  scope.append(toolsLayer);
  const nativeHeader = toolsAside.firstElementChild;
  const toolTabs = {}, toolTriggers = {};
  for (const [type,iconName] of [['snippets','ti-code'],['history','ti-history']]) {
    const nativeTab = nativeHeader.querySelector(`i.${iconName}`).closest('button');
    const button = document.createElement('button');
    button.id = `terminal-mobile-${type}-toggle`;
    button.type = 'button';
    button.className = `lxp-terminal-${type}-trigger`;
    button.title = nativeTab.textContent.trim();
    button.setAttribute('aria-label',button.title);
    button.setAttribute('aria-controls',toolsRail.id);
    button.setAttribute('aria-expanded','false');
    button.innerHTML = `<i class="ti ${iconName}" aria-hidden="true"></i>`;
    dock.append(button);
    toolTabs[type] = nativeTab;
    toolTriggers[type] = button;
    button.addEventListener('click',()=>setToolOpen(state?.toolOpen===type?null:type));
  }
  toolsRail.setAttribute('aria-label',toolTriggers.snippets.title);
  toolsAside.classList.add('lxp-terminal-tools-content');
  move(toolsAside,toolsRail,homes);
  state = {host,tabs,row,settings,homes,dock,trigger,layer,rail,close,newLabel,orientation,settingsAttrs,open:false,toolsAside,toolsLayer,toolsRail,toolTabs,toolTriggers,toolOpen:null};
  toolsObserver.observe(toolsAside,{attributes:true,attributeFilter:['inert','data-mobile-open']});
  toolsAside.inert = false;
  toolsBackdrop.addEventListener('click',()=>setToolOpen(null));
  // Legacy snippet cards expose existing window callbacks. The module scope
  // strips inline onclick attributes; forward only these named numeric actions.
  toolsRail.addEventListener('click',event=>{
    const actionNode = event.target.closest('#snippet-list [onclick],#snippet-list [data-lxp-handler-click]');
    if(!actionNode)return;
    const expression = actionNode.getAttribute('onclick') || actionNode.getAttribute('data-lxp-handler-click');
    const action = expression?.match(/^(?:event\.stopPropagation\(\);\s*)?(runSnippet|editSnippet|deleteSnippet)\((\d+)\)\s*;?$/);
    if(!action || typeof window[action[1]]!=='function')return;
    event.preventDefault();event.stopImmediatePropagation();
    window[action[1]](Number(action[2]));
  },true);
  const nativeClose = nativeHeader.querySelector('i.ti-x').closest('button');
  // Bind on the ephemeral wrapper, so reopening never accumulates listeners.
  toolsRail.addEventListener('click',event=>{
    if(nativeClose.contains(event.target)){setToolOpen(null);return;}
    for(const [type,button] of Object.entries(toolTabs))if(button.contains(event.target)){
      state.toolOpen=type;
      toolsRail.setAttribute('aria-label',toolTriggers[type].title);
      for(const [name,trigger] of Object.entries(toolTriggers))trigger.setAttribute('aria-expanded',String(name===type));
    }
  });
  host.setAttribute('data-terminal-mobile-tabs','');
  trigger.addEventListener('click',()=>setOpen(!state?.open));
  close.addEventListener('click',()=>setOpen(false));
  backdrop.addEventListener('click',()=>setOpen(false));
  dock.addEventListener('click',event=>{if(event.target.closest('#workspace-quick-settings')){setOpen(false,false);setToolOpen(null,false);}});
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
  state.dock.toggleAttribute('data-compact',(valid?viewport.height:innerHeight)-height<286);
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
  const toolsAside = state?.host===host ? state.toolsAside : host.querySelector('[data-floating-terminal-panel="snippets"]')?.closest('aside');
  if (!tabs || !row || !settings || !toolsAside || !row.querySelector('#btn-new-tab')) return;
  if (state && (state.host!==host || state.tabs!==tabs)) restore();
  if (!state) mount(host,tabs,row,settings,toolsAside);
  if(state.toolsAside.inert)state.toolsAside.inert=false;
  for(const [type,button] of Object.entries(state.toolTriggers)){
    const label=state.toolTabs[type].textContent.trim();
    if(label && button.title!==label){button.title=label;button.setAttribute('aria-label',label);}
  }
  if(state.toolOpen)state.toolsRail.setAttribute('aria-label',state.toolTriggers[state.toolOpen].title);
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
  if ((!state?.open && !state?.toolOpen) || document.querySelector('dialog:modal')) return;
  if(event.key==='Escape') {
    event.preventDefault();event.stopImmediatePropagation();
    if(state.toolOpen)setToolOpen(null);else setOpen(false);return;
  }
  if(event.key!=='Tab')return;
  const activeRail = state.toolOpen ? state.toolsRail : state.rail;
  const focusable=[...activeRail.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(node=>node.tabIndex>=0&&!node.disabled&&node.getClientRects().length);
  const first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
},true);
window.addEventListener('lxp-terminal:inject-command',()=>{if(state?.toolOpen)setToolOpen(null,false);});
window.addEventListener('lxp-terminal:history-action',event=>{if(state?.toolOpen && event.detail?.action==='open')setToolOpen(null,false);});
const bodyObserver = new MutationObserver(schedule);
function observeBody() {
  bodyObserver.disconnect();
  bodyObserver.observe(document.body,{childList:true,subtree:true});
}
observeBody();
mobile.addEventListener('change',schedule);
viewport?.addEventListener('resize',schedule);
viewport?.addEventListener('scroll',schedule);
window.addEventListener('resize',schedule);
document.addEventListener('astro:before-swap',()=>{swapping=true;restore();});
document.addEventListener('astro:after-swap',()=>{swapping=false;observeBody();arrange();});
document.addEventListener('astro:page-load',()=>{observeBody();arrange();});
arrange();
