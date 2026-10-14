import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestRendererJSON } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ request: vi.fn(), conversationId: 'chat-1' as string | null }));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', Image: 'Image', ActivityIndicator: 'Spinner',
  FlatList: ({ data, renderItem, ListEmptyComponent, ListFooterComponent }: any) =>
    React.createElement('View', {}, data.length ? data.map((item: any) => <React.Fragment key={item.url}>{renderItem({ item })}</React.Fragment>) : ListEmptyComponent, ListFooterComponent),
}));
vi.mock('../ui/FormSheet', () => ({ FormSheet: ({ visible, children }: any) => visible ? React.createElement('View', {}, children) : null }));
vi.mock('../../api/serverApi', () => ({
  callServerApi: mocks.request, downloadServerFile: vi.fn(), unwrap: (response: any) => response.data,
  getDirect: () => ({ baseUrl: 'https://panel.test', jwt: 'test-session' }),
}));
vi.mock('../../features/assistant/hooks', () => ({ useAssistantSession: () => ({ conversationId: mocks.conversationId }) }));
vi.mock('../../features/assistant/chat-controller', () => ({ chatController: { pickFile: vi.fn(), addAttachments: vi.fn() } }));
vi.mock('expo-file-system/legacy', () => ({}));
vi.mock('expo-sharing', () => ({}));
vi.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ theme: 'dark' }) }));
vi.mock('../../theme/panel-palette', () => ({ getActivePalette: () => null }));

import { NativeConversationMedia } from './NativeConversationMedia';
import { nativeChatControls } from '../../i18n/native-chat-controls';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer | undefined;
beforeEach(() => { mocks.conversationId = 'chat-1'; mocks.request.mockResolvedValue({ ok: true, data: { items: [] } }); });
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; vi.clearAllMocks(); });

// react-test-renderer accepts raw strings in a View, while the native renderer
// rejects them. Check the actual rendered tree, including whitespace and zeros.
function invalidNativeText(nodes: ReactTestRendererJSON | ReactTestRendererJSON[] | null): string[] {
  const errors: string[] = [];
  function visit(node: ReactTestRendererJSON) {
    for (const child of node.children ?? []) {
      if (typeof child === 'object') visit(child);
      else if (node.type !== 'Text') errors.push(`${node.type}: ${JSON.stringify(child)}`);
    }
  }
  for (const node of Array.isArray(nodes) ? nodes : nodes ? [nodes] : []) visit(node);
  return errors;
}

it.each(['new', 'empty', 'loading', 'error', 'attachments'])('opens Multimedia without raw text outside Text (%s)', async (state) => {
  if (state === 'new') mocks.conversationId = null;
  if (state === 'loading') mocks.request.mockReturnValueOnce(new Promise(() => {}));
  if (state === 'error') mocks.request.mockResolvedValueOnce({ ok: false });
  if (state === 'attachments') mocks.request.mockResolvedValueOnce({ ok: true, data: { items: [{ attachments: [
    { id: 'photo', name: 'photo.png', mimeType: 'image/png' },
    { id: 'document', name: 'document.pdf', mimeType: 'application/pdf' },
  ] }] } });
  const props = { panelId: 'panel', token: 'token', language: 'es', onClose: vi.fn() };
  await act(async () => { tree = create(<NativeConversationMedia {...props} visible={false} />); });
  await act(async () => { tree!.update(<NativeConversationMedia {...props} visible />); });
  expect(invalidNativeText(tree!.toJSON())).toEqual([]);
  if (state === 'new' || state === 'empty') expect(JSON.stringify(tree!.toJSON())).toContain(nativeChatControls('es').media.emptyConversation);
  if (state === 'loading') expect(tree!.root.findAllByType('Spinner' as any)).toHaveLength(1);
  if (state === 'error') expect(tree!.root.findAllByType('Text' as any).some((node) => node.props.accessibilityRole === 'alert')).toBe(true);
  if (state === 'attachments') {
    const thumbnail = tree!.root.findByType('Image' as any);
    await act(async () => thumbnail.parent!.props.onPress());
    expect(tree!.root.findAllByType('Image' as any)).toHaveLength(2);
    expect(invalidNativeText(tree!.toJSON())).toEqual([]);
  }
});
