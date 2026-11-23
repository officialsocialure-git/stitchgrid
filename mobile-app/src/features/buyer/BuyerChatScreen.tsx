import { ui } from '@/theme/ui';
import { AppBottomNav } from '@/components/AppBottomNav';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { apiGet, apiPost } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

const P = ui.accent;
const LOGO = 'https://stitchgrid-three.vercel.app/stitchgrid-logo-transparent.png';
type Msg = { id:string; conversationId:string; senderUserId:string; body:string; createdAt:string; sender?:{fullName?:string} };
type Conv = { id:string; buyerOrgId:string; supplierOrgId:string; buyer?:{name:string}; supplier?:{name:string}; createdAt:string; messages?:Msg[] };
const time = (s?:string) => { if(!s)return ''; const d=new Date(s); return Number.isNaN(d.getTime())?'':d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:false}); };

export default function BuyerChatScreen(){
 const router=useRouter();
 const { conversationId } = useLocalSearchParams<{ conversationId?: string }>();
 const [user,setUser]=useState<{id:string;fullName?:string}|null>(null);
 const [activeRole,setActiveRole]=useState<'BUYER'|'SUPPLIER'>('BUYER');
 const [convs,setConvs]=useState<Conv[]>([]); const [activeId,setActiveId]=useState('');
 const [messages,setMessages]=useState<Msg[]>([]); const [draft,setDraft]=useState('');
 const [loading,setLoading]=useState(true); const [refreshing,setRefreshing]=useState(false);
 const [sending,setSending]=useState(false); const [error,setError]=useState(''); const [threadError,setThreadError]=useState('');
 const [keyboardVisible,setKeyboardVisible]=useState(false);
 const list=useRef<FlatList<Msg>>(null); const stickToBottom=useRef(true);
 const active=useRef(activeId); active.current=activeId;
 const conversation=useMemo(()=>convs.find(c=>c.id===activeId)||null,[convs,activeId]);
 const name=(c:Conv)=>activeRole==='SUPPLIER'?(c.buyer?.name||'Buyer Organization'):(c.supplier?.name||'Manufacturing Partner');
 useEffect(()=>{if(typeof conversationId==='string'&&conversationId)setActiveId(conversationId);},[conversationId]);

 const loadConvs=useCallback(async(quiet=false)=>{
  if(!quiet)setLoading(true);
  try{const data=await apiGet<Conv[]>('/conversations');const rows=Array.isArray(data)?data:[];setConvs(rows);
   if(active.current&&!rows.some(c=>c.id===active.current))setActiveId('');setError('');
  }catch(e){if(!quiet)setError(e instanceof Error?e.message:'Unable to load conversations.');}
  finally{setLoading(false);setRefreshing(false);}
 },[]);
 const loadMessages=useCallback(async(id:string,quiet=false)=>{
  if(!id){setMessages([]);return;} 
  try{const data=await apiGet<Msg[]>(`/conversations/${id}/messages`);if(active.current!==id)return;
   const rows=Array.isArray(data)?data:[];setMessages(old=>{const pending=old.filter(m=>m.id.startsWith('local-')&&!rows.some(x=>x.body===m.body&&x.senderUserId===m.senderUserId));return [...rows,...pending];});
   setThreadError('');
  }catch(e){if(!quiet)setThreadError(e instanceof Error?e.message:'Unable to load messages.');}
 },[]);
 useEffect(()=>{let live=true;SecureStore.getItemAsync('sg_user').then(v=>{if(live&&v)try{setUser(JSON.parse(v));}catch{}});SecureStore.getItemAsync('sg_membership').then(v=>{if(live&&v)try{const m=JSON.parse(v);if(m.role==='SUPPLIER')setActiveRole('SUPPLIER');}catch{}});void loadConvs();return()=>{live=false;};},[loadConvs]);
 useEffect(()=>{stickToBottom.current=true;if(!activeId){setMessages([]);return;}void loadMessages(activeId);},[activeId,loadMessages]);
 useRealtimeRefresh(loadConvs, ['*']);
 useRealtimeRefresh(()=>{if(activeId) return loadMessages(activeId,true);}, ['message:new']);

 const send=async()=>{const body=draft.trim();if(!body||!activeId||sending)return;const id=activeId;const temp:Msg={id:`local-${Date.now()}`,conversationId:id,senderUserId:user?.id||'',body,createdAt:new Date().toISOString()};setDraft('');stickToBottom.current=true;setMessages(v=>[...v,temp]);setSending(true);setThreadError('');
  try{const saved=await apiPost<Msg>(`/conversations/${id}/messages`,{body});setMessages(v=>v.map(m=>m.id===temp.id?saved:m));void loadConvs(true);}
  catch(e){setMessages(v=>v.filter(m=>m.id!==temp.id));setDraft(body);setThreadError(e instanceof Error?e.message:'Message could not be sent.');}
  finally{setSending(false);}
 };
 useEffect(()=>{
  const show=Keyboard.addListener(Platform.OS==='ios'?'keyboardWillShow':'keyboardDidShow',()=>setKeyboardVisible(true));
  const hide=Keyboard.addListener(Platform.OS==='ios'?'keyboardWillHide':'keyboardDidHide',()=>setKeyboardVisible(false));
  return()=>{show.remove();hide.remove();};
 },[]);
 const renderMsg=({item}:{item:Msg})=>{const mine=!!user?.id&&item.senderUserId===user.id;return <View style={[s.msgRow,mine?s.right:s.left]}><View style={[s.bubble,mine?s.mine:s.theirs]}>{!mine&&<Text style={s.sender}>{item.sender?.fullName||'Partner'}</Text>}<Text style={[s.msgText,mine&&{color:'#fff'}]}>{item.body}</Text><Text style={[s.msgTime,mine&&{color:'#E5D5FF'}]}>{time(item.createdAt)}</Text></View></View>;};

 return <View style={s.screen}>
   <AppHeader
    role={activeRole === 'SUPPLIER' ? 'SUPPLIER' : 'BUYER'}
    activeSection="chat"
    isBack={!!conversation}
    onBack={() => setActiveId('')}
    title={conversation ? name(conversation) : undefined}
    showLogo={!conversation}
   />
  {!conversation?<View style={s.card}>
   <View style={s.inboxHead}><Text style={s.title}>Chats</Text></View>
   {loading?<View style={s.state}><ActivityIndicator color={P}/><Text style={s.muted}>Loading conversations...</Text></View>
   :error?<View style={s.state}><Text style={s.error}>{error}</Text><Pressable style={s.retry} onPress={()=>void loadConvs()}><Text style={s.retryText}>Try again</Text></Pressable></View>
   :convs.length===0?<View style={s.state}><MaterialCommunityIcons name="chat-outline" size={38} color="#A0A7B2"/><Text style={s.empty}>No active chats</Text><Text style={s.muted}>A conversation appears when you connect with a supplier through an order.</Text></View>
   :<FlatList data={convs} keyExtractor={c=>c.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void loadConvs(true);}} tintColor={P}/>} renderItem={({item})=><Pressable style={s.convRow} onPress={()=>setActiveId(item.id)}><View style={s.avatar}><Text style={s.avatarText}>{name(item).slice(0,1).toLowerCase()}</Text></View><View style={{flex:1,minWidth:0}}><View style={s.convTop}><Text numberOfLines={1} style={s.convName}>{name(item)}</Text><Text style={s.convTime}>{time(item.messages?.[0]?.createdAt)||time(item.createdAt)}</Text></View><Text numberOfLines={1} style={s.preview}>{item.messages?.[0]?.body||'Start your conversation'}</Text></View></Pressable>}/>}
  </View>:<KeyboardAvoidingView style={s.thread} behavior={Platform.OS==='ios'?'padding':undefined}>
   <FlatList ref={list} style={{flex:1}} contentContainerStyle={s.msgList} data={messages} keyExtractor={m=>m.id} renderItem={renderMsg} keyboardShouldPersistTaps="handled" scrollEventThrottle={100} onScroll={({nativeEvent})=>{const {contentOffset,contentSize,layoutMeasurement}=nativeEvent;stickToBottom.current=contentSize.height-contentOffset.y-layoutMeasurement.height<90;}} onContentSizeChange={()=>{if(stickToBottom.current)list.current?.scrollToEnd({animated:false});}} ListEmptyComponent={<View style={s.state}><MaterialCommunityIcons name="forum-outline" size={34} color="#A0A7B2"/><Text style={s.muted}>Send a message to start communicating.</Text></View>}/>
   {!!threadError&&<Text style={s.threadError}>{threadError}</Text>}
   <View style={s.composer}><TextInput accessibilityLabel="Message" value={draft} onChangeText={setDraft} placeholder="Type a message or milestone update..." placeholderTextColor={ui.muted} style={s.input} multiline maxLength={5000}/><Pressable accessibilityRole="button" accessibilityLabel="Send message" onPress={()=>void send()} disabled={!draft.trim()||sending} style={[s.send,!draft.trim()&&s.disabled]}>{sending?<ActivityIndicator color="#fff"/>:<MaterialCommunityIcons name="send" size={24} color="#fff"/>}</Pressable></View>
  </KeyboardAvoidingView>}
  {!keyboardVisible && <AppBottomNav role={activeRole} activeSection="chat" onNavigate={(section) => section === 'home' ? router.replace(activeRole === 'SUPPLIER' ? '/workspace?role=SUPPLIER' as any : '/workspace?role=BUYER' as any) : section === 'chat' ? setActiveId('') : router.replace({ pathname: activeRole === 'SUPPLIER' ? '/supplier/[section]' : '/buyer/[section]', params: { section } } as any)} />}
 </View>;
}

const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:ui.canvas},header:{minHeight:70,backgroundColor:ui.surface,borderBottomWidth:1,borderBottomColor:ui.border,paddingHorizontal:14,paddingBottom:6,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:7},menu:{width:30},logo:{height:42,flex:1},actions:{flexDirection:'row',gap:8},round:{width:43,height:43,borderRadius:23,backgroundColor:ui.accentSoft,alignItems:'center',justifyContent:'center'},
 card:{flex:1,marginHorizontal:12,marginTop:8,marginBottom:0,backgroundColor:ui.surface,borderRadius:16,borderWidth:1,borderColor:ui.border,overflow:'hidden'},inboxHead:{paddingHorizontal:16,paddingVertical:12,borderBottomWidth:1,borderBottomColor:ui.border},title:{fontSize:21,fontWeight: '700',color:ui.ink},subtitle:{fontSize:15,color:ui.muted,marginTop:3},convRow:{minHeight:76,backgroundColor:ui.surface,padding:12,flexDirection:'row',alignItems:'center',gap:13,borderBottomWidth:1,borderBottomColor:'#EDF0F5'},avatar:{width:46,height:46,borderRadius:14,backgroundColor:'#F0E2FF',alignItems:'center',justifyContent:'center'},avatarText:{fontSize:20,fontWeight: '700',color:'#6215C8'},convTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},convName:{flex:1,fontSize:16,fontWeight: '700',color:'#182334'},convTime:{fontSize: 12,color:'#667080'},preview:{fontSize:13,color:'#697586',marginTop:6},state:{flex:1,minHeight:180,alignItems:'center',justifyContent:'center',padding:24,gap:10},muted:{fontSize:13,color:ui.muted,textAlign:'center',lineHeight:19},empty:{fontSize:16,fontWeight: '700',color:'#273244'},error:{fontSize:13,color:'#B42318',textAlign:'center'},retry:{backgroundColor:ui.accentSoft,paddingHorizontal:17,paddingVertical:10,borderRadius:11},retryText:{fontSize:13,fontWeight: '700',color:P},
 thread:{flex:1,backgroundColor:ui.surfaceMuted},msgList:{paddingHorizontal:14,paddingVertical:16,gap:13,flexGrow:1},msgRow:{width:'100%',flexDirection:'row'},right:{justifyContent:'flex-end'},left:{justifyContent:'flex-start'},bubble:{maxWidth:'94%',minWidth:110,paddingHorizontal:14,paddingTop:13,paddingBottom:9,borderRadius:21},mine:{backgroundColor:ui.accent,borderBottomRightRadius:7},theirs:{backgroundColor:ui.surface,borderWidth:1,borderColor:ui.border,borderBottomLeftRadius:7},sender:{fontSize: 13,fontWeight: '700',color:'#5B13C8',marginBottom:5},msgText:{fontSize:15,lineHeight:23,color:ui.ink},msgTime:{fontSize:10,color:ui.muted,textAlign:'right',marginTop:7},threadError:{color:'#B42318',fontSize: 12,paddingHorizontal:14,paddingBottom:5},composer:{minHeight:68,backgroundColor:ui.surface,borderTopWidth:1,borderTopColor:ui.border,paddingHorizontal:12,paddingTop:8,paddingBottom:8,flexDirection:'row',alignItems:'center',gap:10},input:{flex:1,minHeight:50,maxHeight:110,borderWidth:1,borderColor:'#E4E5E9',borderRadius:12,paddingHorizontal:14,paddingVertical:11,fontSize:15,color:ui.ink,backgroundColor:ui.surface},send:{width:53,height:53,borderRadius:27,backgroundColor:ui.accent,alignItems:'center',justifyContent:'center'},disabled:{opacity:.55},
 });
