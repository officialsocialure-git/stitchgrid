import { ui } from '@/theme/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppHeader } from '@/components/AppHeader';
import { AppBottomNav } from '@/components/AppBottomNav';
import { apiGet, API_BASE_URL } from '@/services/api';
import { useRouter } from 'expo-router';

type TrendyCollection = {
  id: string;
  imageUrl: string;
  organization: { id: string; name: string; city?: string | null };
};
type TrendyResponse = { items?: TrendyCollection[]; page: number; limit: number; total: number; hasMore: boolean };

function imageUri(path: string) {
  return path.startsWith('http') ? path : `${API_BASE_URL.replace('/api', '')}${path.startsWith('/') ? '' : '/'}${path}`;
}

export default function TrendyCollectionsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<TrendyCollection[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [seed] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const loadPage = useCallback(async (nextPage: number, append: boolean) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const result = await apiGet<TrendyResponse>(`/trendy-collections?page=${nextPage}&limit=24&seed=${encodeURIComponent(seed)}`);
      const nextItems = Array.isArray(result?.items) ? result.items : [];
      setItems(current => append ? [...current, ...nextItems] : nextItems);
      setPage(nextPage);
      setHasMore(Boolean(result?.hasMore));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load trendy collections.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [seed]);

  useEffect(() => { void loadPage(1, false); }, [loadPage]);

  return (
    <View style={s.screen}>
      <AppHeader role="BUYER" title="Trendy Collection" activeSection="home" showLogo showCart />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.heading}>
          <View style={s.headingTitle}>
            <Text style={s.title}>Explore Trendy Collections</Text>
            <MaterialCommunityIcons name="crown" size={20} color={ui.accent} />
          </View>
          <Text style={s.subtitle}>Discover featured collections from verified STITCHGRID suppliers.</Text>
        </View>
        {loading ? (
          <View style={s.state}><ActivityIndicator color={ui.accent} /><Text style={s.stateText}>Loading collections...</Text></View>
        ) : error ? (
          <View style={s.state}>
            <MaterialCommunityIcons name="cloud-alert-outline" size={30} color={ui.muted} />
            <Text style={s.stateText}>{error}</Text>
            <Pressable style={s.retry} onPress={() => void loadPage(1, false)}><Text style={s.retryText}>Retry</Text></Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={s.state}>
            <MaterialCommunityIcons name="crown-outline" size={30} color={ui.muted} />
            <Text style={s.stateText}>No approved collections available yet.</Text>
          </View>
        ) : (
          <>
            <View style={s.grid}>
              {items.map(item => (
                <Pressable key={item.id} style={s.card} onPress={() => router.push({ pathname: '/buyer/supplier-preview/[organizationId]', params: { organizationId: item.organization.id, collectionImageUrl: item.imageUrl } } as any)}>
                  <Image source={{ uri: imageUri(item.imageUrl) }} style={s.image} resizeMode="cover" />
                  <Text style={s.name} numberOfLines={1}>{item.organization.name}</Text>
                  {!!item.organization.city && <Text style={s.city} numberOfLines={1}>{item.organization.city}</Text>}
                </Pressable>
              ))}
            </View>
            {hasMore && (
              <Pressable style={s.loadMore} disabled={loadingMore} onPress={() => void loadPage(page + 1, true)}>
                {loadingMore ? <ActivityIndicator color={ui.accent} /> : <Text style={s.loadMoreText}>Load More Collections</Text>}
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
      <AppBottomNav role="BUYER" activeSection="home" onNavigate={section => {
        if (section === 'home') router.replace('/workspace?role=BUYER' as any);
        else router.push({ pathname: '/buyer/[section]', params: { section } } as any);
      }} />
    </View>
  );
}

const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:ui.canvas},
  content:{padding:16,paddingBottom:28,gap:16,maxWidth:840,width:'100%',alignSelf:'center'},
  heading:{gap:5},
  headingTitle:{flexDirection:'row',alignItems:'center',gap:7},
  title:{fontSize:19,fontWeight:'900',color:ui.ink},
  subtitle:{fontSize:12,lineHeight:18,color:ui.muted},
  grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:13},
  card:{width:'48.5%',backgroundColor:ui.surface,borderRadius:14,borderWidth:1,borderColor:'#E8E6EF',padding:7,gap:5},
  image:{width:'100%',aspectRatio:0.9,borderRadius:10,backgroundColor:'#F1ECFB'},
  name:{fontSize:12,fontWeight:'800',color:ui.ink},
  city:{fontSize:10,color:ui.muted},
  state:{minHeight:170,alignItems:'center',justifyContent:'center',gap:10,padding:20,backgroundColor:ui.surface,borderRadius:14},
  stateText:{fontSize:13,color:ui.muted,textAlign:'center'},
  retry:{backgroundColor:ui.accentSoft,paddingHorizontal:18,paddingVertical:9,borderRadius:10},
  retryText:{fontSize:12,fontWeight:'800',color:ui.accent},
  loadMore:{minHeight:46,borderRadius:12,borderWidth:1,borderColor:ui.accent,alignItems:'center',justifyContent:'center'},
  loadMoreText:{fontSize:13,fontWeight:'800',color:ui.accent},
});
