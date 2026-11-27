import { ui } from '@/theme/ui';
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppHeader } from '@/components/AppHeader';
import { AppBottomNav } from '@/components/AppBottomNav';
import { useRouter } from 'expo-router';
import { POPULAR_CATEGORIES } from './popularCategories';

export default function PopularCategoriesScreen() {
  const router = useRouter();
  return (
    <View style={s.screen}>
      <AppHeader role="BUYER" title="Popular Categories" activeSection="home" showLogo showCart />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.heading}>
          <Text style={s.title}>Explore Clothing Categories</Text>
          <Text style={s.subtitle}>Browse garment categories available across the STITCHGRID supplier network.</Text>
        </View>
        <View style={s.grid}>
          {POPULAR_CATEGORIES.map(item => (
            <Pressable key={item.id} style={s.card} onPress={() => router.push({ pathname: '/buyer/products', params: { category: item.label } } as any)}>
              <View style={s.artwork}>
                {item.image ? <Image source={item.image} style={s.artworkImage} resizeMode="contain" /> : <MaterialCommunityIcons name={item.icon as any} size={35} color={ui.accent} />}
              </View>
              <Text style={s.label} numberOfLines={2}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
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
  content:{padding:16,paddingBottom:28,gap:17,maxWidth:840,width:'100%',alignSelf:'center'},
  heading:{gap:5},
  title:{fontSize:19,fontWeight:'900',color:ui.ink},
  subtitle:{fontSize:12,lineHeight:18,color:ui.muted},
  grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',columnGap:0,rowGap:15},
  card:{width:'31.8%',minHeight:166,backgroundColor:ui.surface,borderRadius:15,borderWidth:1,borderColor:'#E8E6EF',padding:9,alignItems:'center',justifyContent:'center',gap:13},
  artwork:{width:'100%',height:122,borderRadius:11,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',overflow:'hidden'},
  artworkImage:{width:'120%',height:'120%'},

  label:{fontSize:13,fontWeight:'800',color:ui.ink,textAlign:'center',minHeight:30,marginTop:2},
});
