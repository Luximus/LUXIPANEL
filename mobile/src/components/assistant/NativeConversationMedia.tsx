import { localizeServerError } from "../../lib/server-error-localization";
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, View } from 'react-native';
import { PanelText as Text } from '../ui/PanelText';
import { FormSheet } from '../ui/FormSheet';
import { callServerApi, downloadServerFile, getDirect, unwrap } from '../../api/serverApi';
import { useAssistantSession } from '../../features/assistant/hooks';
import { chatController } from '../../features/assistant/chat-controller';
import { MAX_ATTACHMENT_BASE64 } from '../../features/assistant/attachment-limits';
import { conversationMediaItems, conversationMediaPath, type ConversationMediaItem as Media } from '../../features/assistant/conversation-media';
import { nativeChatControls } from '../../i18n/native-chat-controls';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../hooks/useTheme';
import { getThemeTokens } from '../../theme/colors';
export { conversationMediaPath } from '../../features/assistant/conversation-media';
const PAGE_SIZE = 100;
export function NativeConversationMedia({panelId,token,language,visible,onClose}: {panelId:string;token:string;language:string;visible:boolean;onClose:()=>void}) {
  const session = useAssistantSession(panelId), colors = getThemeTokens(useTheme().theme === 'dark');
  const labels = nativeChatControls(language), t = labels.media;
  const [items,setItems] = useState<Media[]>([]), [error,setError] = useState(''), [busy,setBusy] = useState(false);
  const [tab,setTab] = useState<'all'|'images'|'docs'>('all'), [preview,setPreview] = useState<Media|null>(null), [hasMore,setHasMore] = useState(false);
  const sequence = useRef(0), offset = useRef(0), loading = useRef(false);
  const load = async (stamp:number, older=false) => {
    const target = getDirect(panelId), conversationId = session.conversationId;
    if (!target || !conversationId || loading.current) return;
    loading.current = true; setBusy(true); setError('');
    try {
      const response = await callServerApi(panelId,token,'GET',`/api/ai/conversations/${encodeURIComponent(conversationId)}/messages?limit=${PAGE_SIZE}&offset=${older ? offset.current : 0}`);
      if (sequence.current !== stamp) return;
      if (!response.ok) throw new Error(t.attachFailed);
      const payload = unwrap<{items?:unknown[];messages?:unknown[];hasMore?:boolean}>(response);
      const rows = Array.isArray(payload) ? payload : payload?.items ?? payload?.messages ?? [];
      const page = conversationMediaItems(rows,target.baseUrl);
      setItems(previous => older ? [...new Map([...previous,...page].map(item=>[item.url,item])).values()] : page);
      offset.current = (older ? offset.current : 0) + rows.length;
      setHasMore(!Array.isArray(payload) && !!payload?.hasMore && rows.length > 0);
    } catch { if (sequence.current === stamp) setError(t.attachFailed); }
    finally { if (sequence.current === stamp) { loading.current = false; setBusy(false); } }
  };
  useEffect(() => {
    const stamp = ++sequence.current; loading.current=false; offset.current=0;
    setItems([]); setPreview(null); setHasMore(false); setError(''); setBusy(false);
    if (visible) void load(stamp);
    return () => { ++sequence.current; };
  }, [visible,panelId,session.conversationId]);
  const source = (item:Media) => {
    const target = getDirect(panelId);
    if (!target) return undefined;
    return {uri:target.baseUrl+conversationMediaPath(item.url,target.baseUrl),headers:{Cookie:`luxipanel_session=${target.jwt}`,Authorization:`Bearer ${target.jwt}`,...(target.bridgeSessionId ? {'X-Bridge-Session-Id':target.bridgeSessionId} : {})}};
  };
  const useFile = async (item:Media, attach=false) => {
    const target=getDirect(panelId), stamp=sequence.current;
    if (!target || busy) return;
    const current=()=>sequence.current===stamp && getDirect(panelId)?.baseUrl===target.baseUrl && getDirect(panelId)?.bridgeSessionId===target.bridgeSessionId;
    setBusy(true); setError('');
    try {
      const blob=await downloadServerFile(panelId,token,conversationMediaPath(item.url,target.baseUrl));
      if (!current()) return;
      if (attach && Math.ceil(blob.size/3)*4 > MAX_ATTACHMENT_BASE64) throw new Error(t.attachFailed);
      const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=()=>reject(new Error(t.attachFailed));reader.readAsDataURL(blob);});
      if (!current()) return;
      if (attach) {
        if (!chatController.addAttachments(panelId,[{name:item.name,mime:item.mimeType,dataBase64:base64}])) throw new Error(t.attachFailed);
        onClose(); return;
      }
      const uri=FileSystem.cacheDirectory+`luxipanel-media-${Date.now()}-${item.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      await FileSystem.writeAsStringAsync(uri,base64,{encoding:FileSystem.EncodingType.Base64});
      try { if (current()) await Sharing.shareAsync(uri,{mimeType:item.mimeType}); }
      finally { await FileSystem.deleteAsync(uri,{idempotent:true}).catch(()=>{}); }
    } catch { if (current()) setError(t.attachFailed); }
    finally { if (current()) setBusy(false); }
  };
  const button=(label:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={{padding:10,minHeight:44,opacity:disabled?.5:1}}><Text style={{color:colors.brand}}>{label}</Text></Pressable>;
  const images=items.filter(item=>item.mimeType.startsWith('image/'));
  const filtered=items.filter(item=>tab==='all'||(tab==='images' ? item.mimeType.startsWith('image/') : !item.mimeType.startsWith('image/')));
  const previewIndex=preview ? images.findIndex(item=>item.url===preview.url) : -1;
  return <>
    <FormSheet visible={visible} onClose={onClose} title={t.mediaTitle} language={language} scrollable={false} fillHeight>
      <View style={{flexDirection:'row',gap:6}}>{(['all','images','docs'] as const).map(value=><React.Fragment key={value}>{button(value==='docs'?t.documents:t[value],()=>setTab(value),tab===value)}</React.Fragment>)}</View>
      {button(t.uploadToChat,()=>{void chatController.pickFile(panelId);onClose();},busy)}
      {busy && <ActivityIndicator color={colors.brand} />}
      {!!error && <Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(error)}</Text>}
      <FlatList data={filtered} keyExtractor={item=>item.url} style={{flex:1}} ListEmptyComponent={!busy?<Text style={{color:colors.textMuted,padding:12}}>{t.emptyConversation}</Text>:null} renderItem={({item})=><View style={{padding:12,borderBottomWidth:1,borderColor:colors.border}}>
        <Pressable onPress={()=>item.mimeType.startsWith('image/')?setPreview(item):void useFile(item)} style={{flexDirection:'row',alignItems:'center',gap:10}}>
          {item.mimeType.startsWith('image/')&&<Image source={source(item)} resizeMethod="resize" style={{width:64,height:64,borderRadius:8}}/>}
          <Text style={{color:colors.textPrimary,flex:1}}>{item.name}</Text>
        </Pressable>
        <View style={{flexDirection:'row',flexWrap:'wrap'}}>{button(t.download,()=>void useFile(item),busy)}{button(t.attachToChat,()=>void useFile(item,true),busy)}</View>
      </View>} ListFooterComponent={hasMore?button(labels.older,()=>void load(sequence.current,true),busy):null}/>
    </FormSheet>
    <FormSheet visible={visible&&!!preview} onClose={()=>setPreview(null)} title={preview?.name} language={language} fillHeight>
      {preview&&<Image source={source(preview)} resizeMode="contain" resizeMethod="resize" style={{width:'100%',height:320}}/>}
      <View style={{flexDirection:'row',justifyContent:'space-between'}}>{button(t.previous,()=>setPreview(images[previewIndex-1]),previewIndex<=0)}{button(t.next,()=>setPreview(images[previewIndex+1]),previewIndex<0||previewIndex>=images.length-1)}</View>
      {preview&&button(t.download,()=>void useFile(preview),busy)}{preview&&button(t.attachToChat,()=>void useFile(preview,true),busy)}
      {!!error&&<Text style={{color:colors.danger}}>{localizeServerError(error)}</Text>}
    </FormSheet>
  </>;
}
