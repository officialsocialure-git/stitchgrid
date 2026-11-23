import { ui } from '@/theme/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { apiGet, apiPatch, apiRequest } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';

const PURPLE = ui.accent;
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

  const markAllRead = () => {
    if (!items.some(item => !item.readAt)) return;
    Alert.alert('Mark all as read?', 'All notifications will be marked as read.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark All Read', onPress: async () => {
        try {
          await apiPatch('/notifications/read-all', {});
          const readAt = new Date().toISOString();
          setItems(current => current.map(item => ({ ...item, readAt: item.readAt || readAt })));
        } catch (e) {
          Alert.alert('Unable to update', e instanceof Error ? e.message : 'Please try again.');
        }
      } },
    ]);
  };

  const clearAll = () => {
    if (!items.length) return;
    Alert.alert('Clear all notifications?', 'All your notifications will be permanently deleted. This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete All', style: 'destructive', onPress: async () => {
        try {
          await apiRequest('/notifications', { method: 'DELETE' });
          setItems([]);
        } catch (e) {
          Alert.alert('Unable to delete', e instanceof Error ? e.message : 'Please try again.');
        }
      } },
    ]);
  };

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
      } else {
        Alert.alert(item.title || 'Notification', item.body || 'No additional details available.');
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
              width: 48,
              height: 48,
              borderRadius: 19,
              backgroundColor: '#F5F0FF',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#ECE5F9',
            }}
            accessibilityLabel="Refresh notifications"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="refresh" size={20} color={ui.accent} />
          </Pressable>
        }
      />
      <FlatList
        data={loading || error ? [] : items}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={PURPLE} />}
        ListHeaderComponent={<>
          <Text style={styles.heading}>Your Updates</Text>
          <Text style={styles.subheading}>Order, sample and supplier activity from STITCHGRID.</Text>
          {items.length > 0 && <View style={styles.managementRow}>
            <Pressable onPress={markAllRead} disabled={!items.some(item => !item.readAt)} style={[styles.manageButton, !items.some(item => !item.readAt) && styles.manageButtonDisabled]}>
              <MaterialCommunityIcons name="check-all" size={16} color={ui.accent} />
              <Text style={styles.markReadText}>Mark All Read</Text>
            </Pressable>
            <Pressable onPress={clearAll} style={styles.clearButton}>
              <MaterialCommunityIcons name="delete-outline" size={16} color="#B42318" />
              <Text style={styles.clearText}>Clear All</Text>
            </Pressable>
          </View>}
        </>}
        ListEmptyComponent={
          loading ? <View style={styles.state}><ActivityIndicator color={PURPLE} /><Text style={styles.muted}>Loading notifications...</Text></View>
          : error ? <View style={styles.state}><Text style={styles.error}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Try Again</Text></Pressable></View>
          : <View style={styles.state}><MaterialCommunityIcons name="bell-sleep-outline" size={36} color={ui.muted} /><Text style={styles.emptyTitle}>You're all caught up</Text><Text style={styles.muted}>New updates will appear here.</Text></View>
        }
        renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.body}`} onPress={() => void openNotification(item)} style={[styles.card, !item.readAt && styles.unread]}>
          <View style={styles.icon}><MaterialCommunityIcons name="bell-outline" size={22} color={PURPLE} /></View>
          <View style={{ flex: 1 }}>
            <View style={styles.row}><Text style={styles.title}>{item.title}</Text>{!item.readAt && <View style={styles.dot} />}</View>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.date}>{dateLabel(item.createdAt)}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={21} color={ui.muted} />
        </Pressable>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:ui.canvas},
  header:{minHeight:64,backgroundColor:ui.surface,borderBottomWidth:1,borderBottomColor:'#E9EAF0',paddingHorizontal:15,paddingBottom:7,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  back:{width:38,height:40,alignItems:'flex-start',justifyContent:'center'},
  refresh:{width:38,height:40,alignItems:'flex-end',justifyContent:'center'},
  headerTitle:{fontSize:17,fontWeight: '700',color:ui.ink},
  content:{padding:17,gap:12,width:'100%',maxWidth:840,alignSelf:'center'},
  heading:{fontSize:22,fontWeight: '700',color:ui.ink},
  subheading:{fontSize:14,color:ui.muted,lineHeight:21,marginBottom:8},
  managementRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:4,marginBottom:4},
  manageButton:{flexDirection:'row',alignItems:'center',gap:6,paddingVertical:9,paddingHorizontal:12,borderRadius:10,backgroundColor:'#F2ECFF'},
  manageButtonDisabled:{opacity:0.45},
  markReadText:{fontSize:12,fontWeight:'700',color:ui.accent},
  clearButton:{flexDirection:'row',alignItems:'center',gap:6,paddingVertical:9,paddingHorizontal:12,borderRadius:10,backgroundColor:'#FFF1F0'},
  clearText:{fontSize:12,fontWeight:'700',color:'#B42318'},
  card:{backgroundColor:ui.surface,borderWidth:1,borderColor:'#E5E8EE',borderRadius:16,padding:14,flexDirection:'row',alignItems:'flex-start',gap:11},
  unread:{backgroundColor:'#F8F5FF',borderColor:'#DCCFF7'},
  icon:{width:40,height:40,borderRadius:13,backgroundColor:ui.accentSoft,alignItems:'center',justifyContent:'center'},
  row:{flexDirection:'row',alignItems:'center',gap:8},
  title:{fontSize:14,fontWeight: '700',color:'#202A37',flex:1},
  dot:{width:8,height:8,borderRadius:4,backgroundColor:PURPLE},
  body:{fontSize:13,color:'#667281',lineHeight:19,marginTop:4},
  date:{fontSize: 12,color:ui.muted,marginTop:7},
  state:{backgroundColor:ui.surface,borderRadius:17,padding:24,alignItems:'center',gap:10,marginTop:8},
  emptyTitle:{fontSize:16,fontWeight: '700',color:'#273244'},
  muted:{fontSize:13,color:ui.muted},
  error:{fontSize:13,color:'#B42318',textAlign:'center'},
  retry:{backgroundColor:ui.accentSoft,paddingHorizontal:17,paddingVertical:10,borderRadius:11},
  retryText:{fontSize:13,fontWeight: '700',color:PURPLE},
});
