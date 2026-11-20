import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { apiGet, apiPatch } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';

const PURPLE = '#5314E8';
type NotificationItem = { id: string; title: string; body: string; readAt?: string | null; createdAt: string };

export default function BuyerNotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState('BUYER');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const data = await apiGet<NotificationItem[]>('/notifications');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync('sg_membership').then(raw => {
      if (!active || !raw) return;
      const membership = JSON.parse(raw);
      if (membership?.role) setRole(membership.role);
    }).catch(() => {});
    void load();
    const timer = setInterval(() => void load(true), 25000);
    return () => { active = false; clearInterval(timer); };
  }, [load]);

  const openNotification = async (item: NotificationItem) => {
    try {
      if (!item.readAt) {
        await apiPatch(`/notifications/${item.id}/read`, {});
        setItems(current => current.map(value => value.id === item.id ? { ...value, readAt: new Date().toISOString() } : value));
      }
      if (/sample/i.test(item.title)) {
        router.replace({ pathname: role === 'SUPPLIER' ? '/supplier/[section]' : '/buyer/[section]', params: { section: 'samples' } } as any);
      } else if (/order|milestone|production/i.test(item.title)) {
        router.replace({ pathname: role === 'SUPPLIER' ? '/supplier/[section]' : '/buyer/[section]', params: { section: 'orders' } } as any);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to mark notification as read.');
    }
  };

  const dateLabel = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        isBack
        title="Notifications"
        showLogo={false}
        rightAction={
          <Pressable
            onPress={() => void load()}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: '#F5F0FF',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#ECE5F9',
            }}
            accessibilityLabel="Refresh notifications"
          >
            <MaterialCommunityIcons name="refresh" size={20} color="#5B13EC" />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={PURPLE} />}>
        <Text style={styles.heading}>Your Updates</Text>
        <Text style={styles.subheading}>Order, sample and supplier activity from STITCHGRID.</Text>
        {loading ? <View style={styles.state}><ActivityIndicator color={PURPLE} /><Text style={styles.muted}>Loading notifications...</Text></View>
          : error ? <View style={styles.state}><Text style={styles.error}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Try Again</Text></Pressable></View>
          : items.length === 0 ? <View style={styles.state}><MaterialCommunityIcons name="bell-sleep-outline" size={36} color="#9AA3AF" /><Text style={styles.emptyTitle}>You're all caught up</Text><Text style={styles.muted}>New updates will appear here.</Text></View>
          : items.map(item => <Pressable key={item.id} onPress={() => void openNotification(item)} style={[styles.card, !item.readAt && styles.unread]}>
            <View style={styles.icon}><MaterialCommunityIcons name="bell-outline" size={22} color={PURPLE} /></View>
            <View style={{ flex: 1 }}>
              <View style={styles.row}><Text style={styles.title}>{item.title}</Text>{!item.readAt && <View style={styles.dot} />}</View>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.date}>{dateLabel(item.createdAt)}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={21} color="#9AA3AF" />
          </Pressable>)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F7F8FC'},
  header:{minHeight:64,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#E9EAF0',paddingHorizontal:15,paddingBottom:7,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  back:{width:38,height:40,alignItems:'flex-start',justifyContent:'center'},
  refresh:{width:38,height:40,alignItems:'flex-end',justifyContent:'center'},
  headerTitle:{fontSize:17,fontWeight:'900',color:'#202633'},
  content:{padding:17,gap:12},
  heading:{fontSize:22,fontWeight:'900',color:'#17202D'},
  subheading:{fontSize:14,color:'#68727F',lineHeight:21,marginBottom:8},
  card:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E5E8EE',borderRadius:17,padding:14,flexDirection:'row',alignItems:'flex-start',gap:11},
  unread:{backgroundColor:'#F8F5FF',borderColor:'#DCCFF7'},
  icon:{width:40,height:40,borderRadius:13,backgroundColor:'#F0E9FF',alignItems:'center',justifyContent:'center'},
  row:{flexDirection:'row',alignItems:'center',gap:8},
  title:{fontSize:14,fontWeight:'900',color:'#202A37',flex:1},
  dot:{width:8,height:8,borderRadius:4,backgroundColor:PURPLE},
  body:{fontSize:13,color:'#667281',lineHeight:19,marginTop:4},
  date:{fontSize:11,color:'#929BA6',marginTop:7},
  state:{backgroundColor:'#fff',borderRadius:17,padding:24,alignItems:'center',gap:10,marginTop:8},
  emptyTitle:{fontSize:16,fontWeight:'900',color:'#273244'},
  muted:{fontSize:13,color:'#7B8491'},
  error:{fontSize:13,color:'#B42318',textAlign:'center'},
  retry:{backgroundColor:'#F0E9FF',paddingHorizontal:17,paddingVertical:10,borderRadius:11},
  retryText:{fontSize:13,fontWeight:'800',color:PURPLE},
});
