import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock("react-native-gesture-handler", () => ({ GestureHandlerRootView: "GestureRoot", ScrollView: "ScrollView" }));
vi.mock('react-native', () => ({ View: 'View', Modal: 'Modal' }));
import { ModuleUiContext, useModuleUi } from '../../components/ui/ModuleUi';
import { NativeOverlayHost } from './NativeOverlayHost';
import { NativeModuleContext, ScopedNativeModal, dismissNativeModuleDialog } from './native-module-context';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer | undefined;
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; });
function Draft() { const [value, change] = useState(''); return React.createElement('draft', { value, change }); }
function Screen({ visible = true }: { visible?: boolean }) {
  const [shown, setShown] = useState(true);
  return <NativeModuleContext.Provider value={{key:'history',visible}}><NativeOverlayHost>
    <ViewMarker><ScopedNativeModal visible={shown} onRequestClose={() => setShown(false)}><Draft/></ScopedNativeModal></ViewMarker>
  </NativeOverlayHost></NativeModuleContext.Provider>;
}
const ViewMarker = ({children}: {children: React.ReactNode}) => React.createElement('small-card', {}, children);
it('hoists nested dialogs outside their card and keeps drafts while the owner is hidden', async () => {
  await act(async () => { tree = create(<Screen/>); });
  expect(tree!.root.findByType('small-card' as any).findAllByType('draft' as any)).toHaveLength(0);
  await act(async () => tree!.root.findByType('draft' as any).props.change('unsaved'));
  await act(async () => tree!.update(<Screen visible={false}/>));
  expect(tree!.root.findByType('View' as any).props.pointerEvents).toBe('none');
  expect(dismissNativeModuleDialog('history')).toBe(false);
  await act(async () => tree!.update(<Screen/>));
  expect(tree!.root.findByType('draft' as any).props.value).toBe('unsaved');
  await act(async () => { expect(dismissNativeModuleDialog('history')).toBe(true); });
  expect(tree!.root.findByType('View' as any).props.pointerEvents).toBe('none');
});
it('puts a previously mounted confirmation above a drawer opened later', async () => {
  const confirmClose=vi.fn(), drawerClose=vi.fn();
  const render=(drawer:boolean,confirm:boolean)=><NativeModuleContext.Provider value={{key:'layer-order',visible:true}}><NativeOverlayHost>
    <ScopedNativeModal visible={confirm} onRequestClose={confirmClose}><ConfirmMarker /></ScopedNativeModal>
    {drawer && <ScopedNativeModal visible onRequestClose={drawerClose}><DrawerMarker /></ScopedNativeModal>}
  </NativeOverlayHost></NativeModuleContext.Provider>;
  await act(async()=>{tree=create(render(false,false));});
  await act(async()=>tree!.update(render(true,false)));
  await act(async()=>tree!.update(render(true,true)));
  const z=(type:any)=>{let node=tree!.root.findByType(type);while(node.parent){node=node.parent;if((node.type as unknown)==='View')return node.props.style[0].zIndex;}return 0;};
  expect(z(ConfirmMarker)).toBeGreaterThan(z(DrawerMarker));
  await act(async()=>{expect(dismissNativeModuleDialog('layer-order')).toBe(true);});
  expect(confirmClose).toHaveBeenCalledOnce();expect(drawerClose).not.toHaveBeenCalled();
});
const ConfirmMarker=()=>React.createElement('confirm-content');
const DrawerMarker=()=>React.createElement('drawer-content');

it('keeps module density in hoisted forms without changing controls outside the module', async () => {
  const Density = ({ id }: { id: string }) => React.createElement('density', { id, compact: useModuleUi() });
  await act(async () => { tree = create(<NativeOverlayHost>
    <Density id="account" />
    <NativeModuleContext.Provider value={{key:'module-density',visible:true}}>
      <ModuleUiContext.Provider value={true}>
        <ScopedNativeModal visible><Density id="form" /><ScopedNativeModal visible layer="confirmation"><Density id="confirmation" /></ScopedNativeModal></ScopedNativeModal>
      </ModuleUiContext.Provider>
    </NativeModuleContext.Provider>
  </NativeOverlayHost>); });
  const value = (id: string) => tree!.root.findAllByType('density' as any).find(node => node.props.id === id)!.props.compact;
  expect(value('account')).toBe(false);
  expect(value('form')).toBe(true);
  expect(value('confirmation')).toBe(true);
});
