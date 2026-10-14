import { expect, it } from 'vitest';
import { conversationMediaItems, conversationMediaPath } from './conversation-media';
it('renders the actual persisted attachment ID contract',()=>{
 expect(conversationMediaItems([{attachments:[{id:'image-123',name:'photo.png',mimeType:'image/png'}]}],'https://panel.test')).toEqual([{url:'/api/ai/attachments/image-123',name:'photo.png',mimeType:'image/png'}]);
});
it('accepts live same-panel URLs and deduplicates repeated references',()=>{
 const a={url:'https://panel.test/api/ai/attachments/x',name:'x',mimeType:'text/plain'};
 expect(conversationMediaItems([{attachments:[a,a]}],'https://panel.test')).toHaveLength(1);
});
it.each(['https://other.test/api/ai/attachments/x','https://user:pass@panel.test/api/ai/attachments/x','https://panel.test/api/ai/attachments/x#token','/private/x'])('never authenticates an attachment on another origin or path',url=>{
 expect(()=>conversationMediaPath(url,'https://panel.test')).toThrow();
 expect(conversationMediaItems([{attachments:[{url,name:'x'}]}],'https://panel.test')).toEqual([]);
});
it('ignores malformed history rather than turning it into a request',()=>{
 expect(conversationMediaItems([null,{}, {attachments:[null,{id:'../secrets',name:'x'},{id:'x'}]}],'https://panel.test')).toEqual([]);
});
