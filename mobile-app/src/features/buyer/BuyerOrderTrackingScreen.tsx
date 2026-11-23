import { ui } from '@/theme/ui';
import { AppBottomNav } from '@/components/AppBottomNav';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, Image, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { apiGet, apiPatch, apiPost } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

const PURPLE = ui.accent;
const LOGO_URI = 'https://stitchgrid-three.vercel.app/stitchgrid-logo-transparent.png';

type Milestone = {
  id: string;
  title: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | string;
  dueDate?: string | null;
  completedAt?: string | null;
};
type Order = {
  id: string;
  poNumber: string;
  status: string;
  buyerOrgId: string;
  supplierOrgId: string;
  expectedDate?: string | null;
  items?: { id: string; name: string; quantity: number }[];
  supplier?: { id: string; name: string; city?: string | null };
  buyer?: { id: string; name: string; city?: string | null };
  milestones?: Milestone[];
};
type Membership = { organizationId?: string; organization?: { id?: string }; role?: string };

const dateLabel = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STAGE_SEQUENCE = [
  'Material Sourcing & Yarn Booking',
  'Sample Approval & Strike-off',
  'Bulk Cutting & Line Loading',
  'Stitching & Assembly',
  'Washing, Ironing & Finishing',
  'AQL 2.5 Quality Audit',
  'Dispatch & Shipment Handover',
];

const stageStatus = (status: string) => {
  if (status === 'COMPLETED') return { label: 'COMPLETED', background: '#E8F8F0', foreground: '#087653' };
  if (status === 'IN_PROGRESS') return { label: 'IN PROGRESS', background: '#EFE7FF', foreground: PURPLE };
  if (status === 'BLOCKED') return { label: 'BLOCKED', background: '#FDECEC', foreground: '#B42318' };
  return { label: 'PENDING', background: '#E3ECFC', foreground: '#52627A' };
};

export default function BuyerOrderTrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const orderId = typeof params.orderId === 'string' ? params.orderId : '';
  const [order, setOrder] = useState<Order | null>(null);
  const [isSupplier, setIsSupplier] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [bottomHeight, setBottomHeight] = useState(0);
  const [updatingMilestoneId, setUpdatingMilestoneId] = useState<string | null>(null);
  const [requestingReport, setRequestingReport] = useState(false);

  const loadTracking = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const raw = await SecureStore.getItemAsync('sg_membership');
      const membership = raw ? JSON.parse(raw) as Membership : null;
      const orgId = membership?.organizationId || membership?.organization?.id;
      if (!orgId) throw new Error('Organization membership was not found. Please sign in again.');
      const supplierMode = membership?.role === 'SUPPLIER';
      setIsSupplier(supplierMode);
      const orders = await apiGet<Order[]>('/purchase-orders');
      const visibleOrders = (Array.isArray(orders) ? orders : []).filter(item => supplierMode ? item.supplierOrgId === orgId : item.buyerOrgId === orgId);
      const selected = orderId
        ? visibleOrders.find(item => item.id === orderId)
        : visibleOrders[0];
      if (orderId && !selected) throw new Error('This purchase order is not available in your workspace.');
      setOrder(selected || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load production tracking.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadTracking();
    // Match the Web App production tracker refresh interval.
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void loadTracking(true);
    }, 20000);
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') void loadTracking(true);
    });
    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [loadTracking]);

  useRealtimeRefresh(loadTracking, ['*']);

  const navigate = (section: string) => {
    setDrawerOpen(false);
    if (section === 'home') router.replace(`/workspace?role=${isSupplier ? 'SUPPLIER' : 'BUYER'}` as any);
    else if (isSupplier) router.replace({ pathname: '/supplier/[section]', params: { section } } as any);
    else router.replace({ pathname: '/buyer/[section]', params: { section } } as any);
  };

  const updateMilestone = (milestone: Milestone, nextStatus: 'IN_PROGRESS' | 'COMPLETED') => {
    const action = nextStatus === 'IN_PROGRESS' ? 'start' : 'mark as completed';
    Alert.alert('Confirm milestone update', `Are you sure you want to ${action}: ${milestone.title}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        try {
          setUpdatingMilestoneId(milestone.id);
          await apiPatch(`/milestones/${milestone.id}`, { status: nextStatus });
          await loadTracking(true);
        } catch (e) {
          Alert.alert('Milestone update failed', e instanceof Error ? e.message : 'Please try again.');
        } finally {
          setUpdatingMilestoneId(null);
        }
      }},
    ]);
  };

  const requestLineReport = () => {
    if (!order || requestingReport) return;
    Alert.alert('Request Line Photo / QC Report', 'Send a request to the Buyer in the order chat?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send Request', onPress: async () => {
        try {
          setRequestingReport(true);
          const conversation = await apiPost<{ id: string }>('/conversations', {
            buyerOrgId: order.buyerOrgId,
            supplierOrgId: order.supplierOrgId,
          });
          await apiPost(`/conversations/${conversation.id}/messages`, {
            body: `Request for PO ${order.poNumber}: Please share the latest production line photos and QC report.`,
          });
          Alert.alert('Request sent', 'Your request was sent in the order chat.');
          navigate('chat');
        } catch (e) {
          Alert.alert('Request failed', e instanceof Error ? e.message : 'Please try again.');
        } finally {
          setRequestingReport(false);
        }
      }},
    ]);
  };

  const productDescription = order?.items?.length
    ? order.items.map(item => `${Number(item.quantity || 0).toLocaleString('en-IN')} pcs ${item.name}`).join(', ')
    : 'Garment production order';
  const orderedMilestones = [...(order?.milestones || [])].sort((a, b) => {
    const aIndex = STAGE_SEQUENCE.indexOf(a.title);
    const bIndex = STAGE_SEQUENCE.indexOf(b.title);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return (
    <View style={styles.screen}>
      <AppHeader
        role={isSupplier ? 'SUPPLIER' : 'BUYER'}
        activeSection="tracking"
        onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadTracking(true); }} tintColor={PURPLE} />}
      >
        {loading ? (
          <View style={styles.stateCard}><ActivityIndicator color={PURPLE} size="large" /><Text style={styles.stateText}>Loading production milestones...</Text></View>
        ) : error ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="cloud-alert-outline" size={26} color="#8B929C" />
            <Text style={styles.stateTitle}>Couldn't load order tracking</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadTracking()}><Text style={styles.retryText}>Try Again</Text></Pressable>
          </View>
        ) : !order ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="factory" size={34} color="#A0A6B0" />
            <Text style={styles.stateTitle}>No production order found</Text>
            <Text style={styles.stateText}>Once a supplier quotation is accepted and a purchase order is issued, its production timeline will appear here.</Text>
            <Pressable style={styles.retryButton} onPress={() => navigate('orders')}><Text style={styles.retryText}>View My Orders</Text></Pressable>
          </View>
        ) : (
          <>
            <View style={styles.pageHeading}>
              <View style={styles.metaRow}>
                <Text style={styles.poNumber}>{order.poNumber}</Text>
                <View style={styles.liveBadge}><Text style={styles.liveText}>LIVE PRODUCTION LINE</Text></View>
              </View>
              <Text style={styles.pageTitle}>{isSupplier ? 'Factory Floor Milestone Tracker' : 'Order Tracking'}</Text>
              <Text style={styles.subtitle}>{order.supplier?.name || 'Supplier'} • {productDescription}</Text>
              {isSupplier && <Pressable style={styles.requestButton} disabled={requestingReport} onPress={requestLineReport}>{requestingReport ? <ActivityIndicator color={PURPLE} /> : <MaterialCommunityIcons name="camera-outline" size={21} color="#17202D" />}<Text style={styles.requestButtonText}>{requestingReport ? 'Sending Request...' : 'Request Line Photo / QC Report'}</Text></Pressable>}
            </View>

            <View style={styles.timelineCard}>
              {orderedMilestones.length ? (
                <View style={styles.timeline}>
                  {orderedMilestones.map((milestone, index) => {
                    const visual = stageStatus(milestone.status);
                    const isLast = index === orderedMilestones.length - 1;
                    const detailDate = milestone.completedAt
                      ? `Completed ${dateLabel(milestone.completedAt)}`
                      : milestone.dueDate ? `Due: ${dateLabel(milestone.dueDate)}` : `Stage ${index + 1}`;
                    return (
                      <View key={milestone.id} style={styles.timelineRow}>
                        <View style={styles.markerColumn}>
                          <View style={[
                            styles.marker,
                            milestone.status === 'COMPLETED' && styles.markerCompleted,
                            milestone.status === 'IN_PROGRESS' && styles.markerActive,
                            milestone.status === 'BLOCKED' && styles.markerBlocked,
                          ]}>
                            {milestone.status === 'COMPLETED'
                              ? <MaterialCommunityIcons name="check" size={16} color="#fff" />
                              : <Text style={styles.markerNumber}>{index + 1}</Text>}
                          </View>
                          {!isLast && <View style={[styles.connector, milestone.status === 'COMPLETED' && styles.connectorCompleted]} />}
                        </View>
                        <View style={[
                          styles.stageCard,
                          milestone.status === 'IN_PROGRESS' && styles.stageCardActive,
                          milestone.status === 'COMPLETED' && styles.stageCardCompleted,
                          milestone.status === 'BLOCKED' && styles.stageCardBlocked,
                        ]}>
                          <Text style={styles.stageTitle}>{milestone.title}</Text>
                          <View style={styles.stageMetaRow}>
                            <View style={[styles.statusBadge, { backgroundColor: visual.background }]}>
                              <Text style={[styles.statusText, { color: visual.foreground }]}>{visual.label}</Text>
                            </View>
                            <Text style={styles.stageDate}>{detailDate}</Text>
                          </View>
                          <Text style={styles.stageDescription}>
                            {milestone.status === 'COMPLETED'
                              ? 'This garment manufacturing milestone has been completed and verified.'
                              : milestone.status === 'IN_PROGRESS'
                                ? 'The supplier is currently working on this manufacturing milestone.'
                                : milestone.status === 'BLOCKED'
                                  ? 'This milestone is blocked. Please contact your supplier for an update.'
                                  : `Garment manufacturing milestone verification for stage ${index + 1}.`}
                          </Text>
                          {isSupplier && milestone.status !== 'COMPLETED' && (
                            <View style={styles.milestoneActionRow}>
                              {updatingMilestoneId === milestone.id ? <ActivityIndicator color={PURPLE} /> : (
                                <Pressable
                                  style={[styles.milestoneActionButton, milestone.status === 'IN_PROGRESS' && styles.milestoneCompleteButton]}
                                  onPress={() => updateMilestone(milestone, milestone.status === 'IN_PROGRESS' ? 'COMPLETED' : 'IN_PROGRESS')}
                                >
                                  <MaterialCommunityIcons name={milestone.status === 'IN_PROGRESS' ? 'check' : 'play'} size={20} color={milestone.status === 'IN_PROGRESS' ? '#FFFFFF' : '#17202D'} />
                                  <Text style={[styles.milestoneActionText, milestone.status === 'IN_PROGRESS' && styles.milestoneCompleteText]}>{milestone.status === 'IN_PROGRESS' ? 'Mark Milestone Completed' : 'Start This Stage'}</Text>
                                </Pressable>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyMilestones}>
                  <MaterialCommunityIcons name="timeline-clock-outline" size={30} color="#929BA8" />
                  <Text style={styles.stateTitle}>No production milestones active</Text>
                  <Text style={styles.stateText}>Milestones will appear here when they are created for this purchase order.</Text>
                </View>
              )}
            </View>
            <View style={styles.syncHint}><MaterialCommunityIcons name="sync" size={13} color="#7B8491" /><Text style={styles.syncHintText}>Updates automatically every 20 seconds • Pull down to refresh</Text></View>
          </>
        )}
      </ScrollView>

      <AppBottomNav role={isSupplier ? 'SUPPLIER' : 'BUYER'} activeSection="tracking" onNavigate={navigate} onLayout={event => setBottomHeight(event.nativeEvent.layout.height)} />


    </View>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:ui.canvas},
  header:{minHeight:64,backgroundColor:ui.surface,borderBottomWidth:1,borderBottomColor:'#E9EAF0',paddingHorizontal:14,paddingBottom:7,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  headerIcon:{width:40,height:42,alignItems:'center',justifyContent:'center'},
  logo:{width:158,height:40,flex:1,marginHorizontal:5},
  headerActions:{flexDirection:'row',alignItems:'center',gap:8},
  headerCircle:{width:38,height:38,borderRadius:19,backgroundColor:ui.accentSoft,alignItems:'center',justifyContent:'center'},
  content:{padding:16,paddingBottom:24,gap:16,width:'100%',maxWidth:840,alignSelf:'center'},
  pageHeading:{paddingBottom:18,borderBottomWidth:1,borderBottomColor:'#E3E6EC',gap:5},
  metaRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:9},
  poNumber:{fontSize:13,fontWeight: '700',color:'#5314B8'},
  liveBadge:{backgroundColor:'#EFE5FF',borderWidth:1,borderColor:'#D8C3F7',borderRadius:20,paddingHorizontal:11,paddingVertical:5},
  liveText:{fontSize: 12,fontWeight: '700',letterSpacing:.3,color:'#5314B8'},
  pageTitle:{fontSize:22,fontWeight: '700',color:ui.ink,lineHeight:36},
  subtitle:{fontSize:14,color:ui.muted,lineHeight:22},
  requestButton:{alignSelf:'flex-start',minHeight:45,borderWidth:1,borderColor:'#D6DAE1',borderRadius:12,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:9,marginTop:12,backgroundColor:ui.surface},
  requestButtonText:{fontSize:13,fontWeight: '700',color:ui.ink},
  milestoneActionRow:{borderTopWidth:1,borderTopColor:'#DDE3EF',marginTop:12,paddingTop:10,alignItems:'flex-end'},
  milestoneActionButton:{minHeight:43,borderWidth:1,borderColor:'#CAD1DD',borderRadius:11,paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:ui.surface},
  milestoneCompleteButton:{backgroundColor:PURPLE,borderColor:PURPLE},
  milestoneActionText:{fontSize:13,fontWeight: '700',color:ui.ink},
  milestoneCompleteText:{color:ui.surface},
  timelineCard:{backgroundColor:ui.surface,borderRadius:23,borderWidth:1,borderColor:'#E6E8EE',paddingHorizontal:14,paddingVertical:20,elevation: 0},
  timeline:{gap:0},
  timelineRow:{flexDirection:'row',alignItems:'stretch'},
  markerColumn:{width:31,alignItems:'center'},
  marker:{width:29,height:29,borderRadius:15,backgroundColor:'#DDE9FA',borderWidth:1,borderColor:'#C9D9F0',alignItems:'center',justifyContent:'center',zIndex:2},
  markerCompleted:{backgroundColor:'#16A36A',borderColor:'#16A36A'},
  markerActive:{backgroundColor:PURPLE,borderColor:PURPLE},
  markerBlocked:{backgroundColor:'#D92D20',borderColor:'#D92D20'},
  markerNumber:{fontSize:13,fontWeight: '700',color:'#52627A'},
  connector:{width:3,flex:1,minHeight:20,backgroundColor:'#D5E4F8',marginTop:-1},
  connectorCompleted:{backgroundColor:'#79D5AC'},
  stageCard:{flex:1,backgroundColor:'#EFF3FF',borderWidth:1,borderColor:'#D5E0F3',borderRadius:16,padding:14,marginBottom:17,minHeight:126},
  stageCardActive:{backgroundColor:'#F5F0FF',borderColor:'#B99BEF',borderWidth:1.5},
  stageCardCompleted:{backgroundColor:'#F0FBF5',borderColor:'#BDEBD2'},
  stageCardBlocked:{backgroundColor:'#FFF5F4',borderColor:'#F2C6C2'},
  stageTitle:{fontSize:15,fontWeight: '700',color:ui.ink,lineHeight:21,marginBottom:8},
  stageMetaRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:9,marginBottom:8},
  statusBadge:{paddingHorizontal:10,paddingVertical:5,borderRadius:18},
  statusText:{fontSize: 12,fontWeight: '700'},
  stageDate:{fontSize: 13,color:ui.muted,letterSpacing:.5},
  stageDescription:{fontSize:13,color:'#626D7B',lineHeight:20},
  stateCard:{backgroundColor:ui.surface,borderRadius:16,borderWidth:1,borderColor:ui.border,padding:24,alignItems:'center',gap:10,marginTop:10},
  stateTitle:{fontSize:16,fontWeight: '700',color:ui.ink,textAlign:'center'},
  stateText:{fontSize:13,color:'#737B87',textAlign:'center',lineHeight:19},
  retryButton:{backgroundColor:ui.accentSoft,paddingHorizontal:18,paddingVertical:10,borderRadius:11,marginTop:3},
  retryText:{fontSize:13,fontWeight: '700',color:PURPLE},
  emptyMilestones:{alignItems:'center',paddingVertical:22,gap:10},
  syncHint:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},
  syncHintText:{fontSize: 12,color:ui.muted,textAlign:'center'},
  bottomNav:{minHeight:75,backgroundColor:ui.surface,borderTopWidth:1,borderTopColor:'#E6E8ED',paddingTop:7,paddingHorizontal:5,flexDirection:'row',alignItems:'center',justifyContent:'space-around'},
  navItem:{minWidth:57,minHeight:58,borderRadius:16,alignItems:'center',justifyContent:'center',paddingHorizontal:6,paddingVertical:4,gap:2},
  navItemActive:{backgroundColor:ui.accentSoft},
  navLabel:{fontSize:10,color:ui.muted,fontWeight:'600'},
  navLabelActive:{color:PURPLE,fontWeight: '700'},
  drawerLayer:{position:'absolute',left:0,right:0,zIndex:30,flexDirection:'row'},
  drawer:{width:'68%',maxWidth:320,backgroundColor:ui.surface,paddingTop:18,paddingHorizontal:14,elevation: 0,shadowColor:'#000',shadowOpacity: 0,shadowRadius:12,shadowOffset:{width:3,height:0}},
  drawerBackdrop:{flex:1,backgroundColor:'rgba(13,10,22,.38)'},
  drawerItem:{minHeight:49,borderRadius:12,marginBottom:3,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:14},
  drawerItemActive:{backgroundColor:PURPLE},
  drawerText:{fontSize:15,fontWeight:'600',color:'#4B515B'},
  drawerTextActive:{color:ui.surface,fontWeight: '700'},
});
