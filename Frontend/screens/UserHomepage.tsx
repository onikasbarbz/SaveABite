import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TextInput,
  Image, TouchableOpacity, Dimensions, ActivityIndicator,
  RefreshControl, StatusBar, Linking,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { api, API_BASE_URL } from '../services/api';
import { useCart } from '../context/CartContext';
import * as Location from 'expo-location';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const BANNER_WIDTH = width * 0.85;

const COLORS = {
  primary: '#244F42',
  primaryDark: '#1a3a30',
  secondary: '#C8E0C8',
  accent: '#F4A71D',
  white: '#FFFFFF',
  textMain: '#111a18',
  textSub: '#6e7e7a',
  bgGray: '#F4F6F4',
  bgCard: '#FFFFFF',
  borderGray: '#DDE8DD',
  success: '#27AB34',
};

const CATEGORIES = [
  { id: 'Bakery Item',        name: 'Bakery',      icon: 'bakery-dining',   type: 'material'   },
  { id: 'Restaurant Food',    name: 'Restaurant',  icon: 'restaurant',      type: 'material'   },
  { id: 'Fruits & Vegetables',name: 'Fruits & Veg',icon: 'leaf',            type: 'font-awesome'},
  { id: 'Grocery',            name: 'Grocery',     icon: 'shopping-basket', type: 'material'   },
  { id: 'Ready to Cook',      name: 'Ready Cook',  icon: 'chef-hat',        type: 'm-community'},
];

// Two info strips shown horizontally below search
const INFO_STRIPS = [
  { id: 'tip1', text: '🌿  Reduce food waste — rescue surplus meals at up to 70% off' },
  { id: 'tip2', text: '🤝  Supporting local businesses across Kathmandu Valley' },
  { id: 'tip3', text: '♻️  Every rescue saves CO₂ — eat well, waste less' },
  { id: 'tip4', text: '⏱  Flash listings updated daily — check back often!' },
];

const UserHomepage = () => {
  const navigation = useNavigation<any>();
  const { totalItems } = useCart();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('Store');
  const [activeNav, setActiveNav] = useState('home');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allListings, setAllListings] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [showMap, setShowMap] = useState(false);
  const [rescueLocation, setRescueLocation] = useState<any>(null);
  const [rescueAddress, setRescueAddress] = useState('Herald College, Kathmandu');
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const mapRef = useRef<MapView>(null);

  const [unreadCount, setUnreadCount] = useState(0);

  // Advertisement banners
  const [ads, setAds] = useState<any[]>([]);

  const fetchAds = async () => {
    try {
      const result = await api.getAds();
      if (result?.success && result.ads) {
        setAds(result.ads);
      }
    } catch (e) {
      // silently fail — banners are non-critical
    }
  };

  useFocusEffect(useCallback(() => { fetchAds(); }, []));

  // Fetch unread notification count whenever the screen is focused
  useFocusEffect(useCallback(() => {
    api.getNotifications().then((res: any) => {
      if (res?.success) setUnreadCount(res.unread_count ?? 0);
    }).catch(() => {});
  }, []));

  const handleMapSearch = async () => {
    if (!mapSearchQuery.trim()) return;
    try {
      const q = mapSearchQuery.toLowerCase().includes('nepal')
        ? mapSearchQuery : `${mapSearchQuery}, Nepal`;
      const result = await Location.geocodeAsync(q);
      if (result.length > 0) {
        const loc = result[0];
        mapRef.current?.animateToRegion(
          { latitude: loc.latitude, longitude: loc.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 1000
        );
        setRescueLocation({ latitude: loc.latitude, longitude: loc.longitude });
      } else {
        alert('Location not found. Try your general area then drag the pin.');
      }
    } catch (e) { alert('Error searching for location.'); }
  };

  useEffect(() => {
    AsyncStorage.getItem('user_rescue_location').then(saved => {
      if (saved) {
        const p = JSON.parse(saved);
        setRescueLocation({ latitude: p.lat, longitude: p.lng });
        setRescueAddress(p.address || 'Saved Location');
      }
    }).catch(() => {});
  }, []);

  const handleLocationSelect = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { alert('Location permission denied'); return; }
    if (!rescueLocation) {
      try {
        const loc = await Location.getCurrentPositionAsync({});
        setRescueLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {}
    }
    setShowMap(true);
  };

  const handleLocationConfirm = async (coords: any) => {
    setRescueLocation(coords);
    setShowMap(false);
    try {
      const result = await Location.reverseGeocodeAsync(coords);
      if (result.length > 0) {
        const a = result[0];
        const formatted = `${a.name || ''}, ${a.street || ''}, ${a.city || ''}`
          .replace(/^, |, $/g, '').replace(/, ,/g, ',');
        setRescueAddress(formatted || 'Custom Location');
        await AsyncStorage.setItem('user_rescue_location', JSON.stringify({
          lat: coords.latitude, lng: coords.longitude, address: formatted || 'Custom Location',
        }));
      }
    } catch {}
  };

  useFocusEffect(useCallback(() => { fetchListings(); }, []));

  const fetchListings = async () => {
    try {
      const result = await api.getActiveListings();
      if (result.success && result.listings) {
        const processed = result.listings.map((item: any) => {
          const original = parseFloat(item.original_price) || 0;
          const selling  = parseFloat(item.selling_price) || 0;
          const disc     = original > 0 ? Math.round(((original - selling) / original) * 100) : 0;
          return { ...item, discountPercent: disc };
        });
        setAllListings(processed);
      }
    } catch (e) { console.error('Fetch error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = () => { setRefreshing(true); fetchListings(); fetchAds(); };

  const getFilteredData = () => {
    const q = searchQuery.toLowerCase();
    return allListings.filter(item => {
      const isSurprise = item.is_surprise_bag === true || item.is_surprise_bag === 1 || item.is_surprise_bag === 'true';
      const matchesTab = activeTab === 'Deals' ? isSurprise : !isSurprise;
      const nameMatch  = (item.item_name ?? '').toLowerCase().includes(q);
      const storeMatch = (item.store_name ?? '').toLowerCase().includes(q);
      const catMatch   = selectedCategory ? item.category === selectedCategory : true;
      return matchesTab && (nameMatch || storeMatch) && catMatch;
    });
  };

  const currentList = getFilteredData();

  const renderIcon = (cat: any) => {
    const color = selectedCategory === cat.id ? COLORS.white : COLORS.primary;
    if (cat.type === 'material')     return <MaterialIcons name={cat.icon as any} size={26} color={color} />;
    if (cat.type === 'font-awesome') return <FontAwesome5  name={cat.icon as any} size={22} color={color} />;
    return <MaterialCommunityIcons name={cat.icon as any} size={26} color={color} />;
  };

  /* ── Section label ── */
  const SectionLabel = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <View style={styles.sectionLabelWrap}>
      <View style={styles.sectionLabelBar} />
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSub}>{subtitle}</Text>
      </View>
    </View>
  );

  /* ── Food Card ── */
  const FoodCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.foodCard}
      activeOpacity={0.88}
      onPress={() => navigation.navigate('FoodDetail', { item })}
    >
      <View style={styles.cardImageWrap}>
        <Image source={{ uri: `${API_BASE_URL}${item.image_url}` }} style={styles.cardImage} resizeMode="cover" />
        {item.discountPercent > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>{item.discountPercent}% OFF</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.item_name}</Text>
        <Text style={styles.cardCat}>{item.category}</Text>
        <Text style={styles.cardStore} numberOfLines={1}>📍 {item.store_name}</Text>
        <View style={styles.cardPriceRow}>
          <Text style={styles.cardPrice}>NPR {item.selling_price}</Text>
          {item.discountPercent > 0 && (
            <Text style={styles.cardOldPrice}>NPR {item.original_price}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  /* ── Horizontal section ── */
  const HSection = ({ title, subtitle, data }: { title: string; subtitle: string; data: any[] }) => {
    if (!data.length) return null;
    return (
      <View style={styles.section}>
        <SectionLabel title={title} subtitle={subtitle} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScrollContent}>
          {data.map(item => <FoodCard key={`item-${item.id}`} item={item} />)}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} translucent={false} />

        {/* ─── Header ─── */}
        <LinearGradient colors={[COLORS.primaryDark, COLORS.primary]} style={styles.header}>
          <TouchableOpacity style={styles.locationRow} onPress={handleLocationSelect}>
            <Ionicons name="location-sharp" size={22} color={COLORS.accent} />
            <View style={styles.locationText}>
              <Text style={styles.locationLabel}>Deliver to  <Ionicons name="chevron-down" size={10} color="rgba(255,255,255,0.5)" /></Text>
              <Text style={styles.locationValue} numberOfLines={1}>{rescueAddress}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.75}
            >
              <Ionicons name="notifications-outline" size={22} color={COLORS.white} />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ─── White body ─── */}
        <View style={styles.whiteBody}>
          {/* Search */}
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={19} color={COLORS.textSub} />
            <TextInput
              placeholder="Search food or store..."
              placeholderTextColor={COLORS.textSub}
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              multiline={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={17} color={COLORS.textSub} />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollBody}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
            >
              {/* Info strips — first fully visible, second peeks to hint scrollability */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.stripsRow}
                style={styles.stripsContainer}
              >
                {INFO_STRIPS.slice(0, 2).map(strip => (
                  <View key={strip.id} style={styles.infoStrip}>
                    <Text style={styles.infoStripText}>{strip.text}</Text>
                  </View>
                ))}
              </ScrollView>

              {/* Banners */}
              {ads.length > 0 && (
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: (width - BANNER_WIDTH) / 2 }}
                  style={{ marginTop: 18 }}
                >
                  {ads.map((ad) => (
                    <TouchableOpacity
                      key={ad.id}
                      style={styles.bannerWrap}
                      activeOpacity={ad.link_url ? 0.85 : 1}
                      onPress={() => {
                        if (ad.link_url) Linking.openURL(ad.link_url).catch(() => {});
                      }}
                    >
                      <Image
                        source={{ uri: ad.image_url.startsWith('http') ? ad.image_url : `${API_BASE_URL}${ad.image_url}` }}
                        style={styles.bannerImage}
                        resizeMode="cover"
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(26,58,48,0.72)']}
                        style={StyleSheet.absoluteFill}
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Categories */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
                {CATEGORIES.map(cat => {
                  const active = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={styles.catItem}
                      onPress={() => setSelectedCategory(active ? null : cat.id)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.catCircle, active && styles.catCircleActive]}>
                        {renderIcon(cat)}
                      </View>
                      <Text style={[styles.catLabel, active && styles.catLabelActive]}>{cat.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Toggle */}
              <View style={styles.toggleRow}>
                {['Store', 'Deals'].map(tab => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.toggleBtn, activeTab === tab && styles.toggleBtnActive]}
                    onPress={() => setActiveTab(tab)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.toggleText, activeTab === tab && styles.toggleTextActive]}>
                      {tab === 'Deals' ? 'Deals' : 'Market'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sections */}
              {activeTab === 'Store' ? (
                <>
                  <HSection
                    title="Fresh From Bakeries"
                    subtitle="Warm picks, baked fresh"
                    data={currentList.filter(i => i.category === 'Bakery Item')}
                  />
                  <HSection
                    title="Fruits & Vegetables"
                    subtitle="Farm-fresh picks"
                    data={currentList.filter(i => i.category === 'Fruits & Vegetables')}
                  />
                  <HSection
                    title="Grocery Essentials"
                    subtitle="Daily staples"
                    data={currentList.filter(i => i.category === 'Grocery')}
                  />
                  {/* Fallback when no category data */}
                  {currentList.filter(i =>
                    ['Bakery Item', 'Fruits & Vegetables', 'Grocery'].includes(i.category)
                  ).length === 0 && (
                    <HSection title="Available Now" subtitle="All current listings" data={currentList} />
                  )}
                </>
              ) : (
                <>
                  <HSection
                    title="Mega Savings"
                    subtitle="50% off or more"
                    data={currentList.filter(i => i.discountPercent >= 50)}
                  />
                  <HSection
                    title="Flash Deals"
                    subtitle="Limited quantities"
                    data={currentList.filter(i => i.discountPercent < 50)}
                  />
                </>
              )}
            </ScrollView>
          )}
        </View>

        {/* ─── Bottom Nav ─── */}
        <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {[
            { key: 'home',    icon: 'home',    label: 'Home',    screen: null          },
            { key: 'orders',  icon: 'receipt', label: 'Orders',  screen: 'Orders'      },
            { key: 'cart',    icon: 'cart',    label: 'Cart',    screen: 'Cart'        },
            { key: 'profile', icon: 'person',  label: 'Profile', screen: 'UserProfile' },
          ].map(nav => {
            const active = activeNav === nav.key;
            return (
              <TouchableOpacity
                key={nav.key}
                style={styles.navItem}
                onPress={() => { setActiveNav(nav.key); if (nav.screen) navigation.navigate(nav.screen); }}
                activeOpacity={0.75}
              >
                <View>
                  <Ionicons
                    name={(active ? nav.icon : `${nav.icon}-outline`) as any}
                    size={24}
                    color={active ? COLORS.accent : 'rgba(200,224,200,0.5)'}
                  />
                  {nav.key === 'cart' && totalItems > 0 && (
                    <View style={styles.navBadge}>
                      <Text style={styles.navBadgeText}>{totalItems}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.navLabel, active && { color: COLORS.accent }]}>{nav.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>

      {/* ─── Map Modal ─── */}
      {showMap && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', zIndex: 1000 }]}>
          <LinearGradient colors={[COLORS.primaryDark, COLORS.primary]} style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setShowMap(false)} style={styles.mapCloseBtn}>
              <Ionicons name="close" size={22} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.mapTitle}>Set Delivery Location</Text>
            <View style={{ width: 38 }} />
          </LinearGradient>

          <View style={styles.mapSearchRow}>
            <View style={styles.mapSearchBar}>
              <Ionicons name="search" size={17} color={COLORS.textSub} />
              <TextInput
                style={styles.mapSearchInput}
                placeholder="Search a location..."
                value={mapSearchQuery}
                onChangeText={setMapSearchQuery}
                onSubmitEditing={handleMapSearch}
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity onPress={handleMapSearch} style={styles.mapSearchBtn}>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={
              rescueLocation
                ? { ...rescueLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }
                : { latitude: 27.7172, longitude: 85.3240, latitudeDelta: 0.05, longitudeDelta: 0.05 }
            }
            onRegionChangeComplete={region =>
              setRescueLocation({ latitude: region.latitude, longitude: region.longitude })
            }
          />
          <View style={styles.mapPinFixed}>
            <Ionicons name="location" size={44} color="#C62828" />
          </View>

          <View style={styles.mapFooter}>
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => handleLocationConfirm(rescueLocation)}
            >
              <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.confirmGradient}>
                <Text style={styles.confirmText}>Confirm Location</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary },

  /* Header */
  header: {
    paddingTop: 20,
    paddingBottom: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    justifyContent: 'space-between',
  },
  locationRow: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  locationText: { flex: 1, marginLeft: 10 },
  locationLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },
  locationValue: { color: COLORS.white, fontSize: 13, fontWeight: '700', marginTop: 2 },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 4, right: 4,
    minWidth: 16, height: 16,
    borderRadius: 8,
    backgroundColor: '#E51904',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: '#fff', fontSize: 9, fontWeight: '800',
  },

  /* White body */
  whiteBody: {
    flex: 1,
    backgroundColor: COLORS.bgGray,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
    paddingTop: 22,
  },

  /* Search */
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: 22, borderRadius: 16,
    paddingHorizontal: 15, height: 48,
    borderWidth: 1, borderColor: COLORS.borderGray,
    shadowColor: '#244F42', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: COLORS.textMain, height: 48, padding: 0 },

  /* Info strips */
  stripsContainer: { marginTop: 14 },
  stripsRow: { paddingHorizontal: 22, gap: 10 },
  infoStrip: {
    width: width * 0.78,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: COLORS.borderGray,
    justifyContent: 'center',
  },
  infoStripText: { fontSize: 12, color: COLORS.textSub, fontWeight: '500', lineHeight: 18 },

  /* Scroll body */
  scrollBody: { paddingBottom: 110 },

  /* Banners */
  bannerWrap: {
    width: BANNER_WIDTH, height: 160,
    borderRadius: 20, overflow: 'hidden',
    marginRight: 14,
    elevation: 5,
    shadowColor: '#244F42', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 10,
  },
  bannerImage: { width: '100%', height: '100%' },
  bannerLabel: { position: 'absolute', bottom: 16, left: 16 },
  bannerLabelText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },

  /* Categories */
  catRow: { paddingLeft: 22, paddingRight: 10, paddingTop: 22, paddingBottom: 4, gap: 12 },
  catItem: { alignItems: 'center', width: 68 },
  catCircle: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center',
  },
  catCircleActive: { backgroundColor: COLORS.primary },
  catLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSub, marginTop: 6, textAlign: 'center' },
  catLabelActive: { color: COLORS.primary },

  /* Toggle */
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 22, marginTop: 20,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.secondary,
    padding: 4,
  },
  toggleBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
  toggleBtnActive: {
    backgroundColor: COLORS.white,
    borderWidth: 2.5, borderColor: COLORS.primary,
    elevation: 2,
  },
  toggleText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  toggleTextActive: { color: COLORS.primary },

  /* Sections */
  section: { marginTop: 26 },
  sectionLabelWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, marginBottom: 14, gap: 10 },
  sectionLabelBar: { width: 4, height: 36, borderRadius: 2, backgroundColor: COLORS.accent },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textMain },
  sectionSub: { fontSize: 11, color: COLORS.textSub, marginTop: 2, fontWeight: '500' },
  hScrollContent: { paddingLeft: 22, paddingRight: 12, gap: 16 },

  /* Food card */
  foodCard: {
    width: 230, borderRadius: 18,
    backgroundColor: COLORS.bgCard,
    overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.borderGray,
    shadowColor: '#244F42', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
    marginBottom: 4,
  },
  cardImageWrap: { height: 138, position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  discountBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: COLORS.accent,
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4,
  },
  discountBadgeText: { color: COLORS.primaryDark, fontSize: 10, fontWeight: '900' },
  cardBody: { padding: 13 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textMain },
  cardCat: { fontSize: 11, color: COLORS.textSub, fontWeight: '600', marginTop: 2 },
  cardStore: { fontSize: 11, color: COLORS.textSub, marginTop: 3 },
  cardPriceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10, gap: 8 },
  cardPrice: { fontSize: 16, fontWeight: '900', color: COLORS.success },
  cardOldPrice: { fontSize: 11, color: COLORS.textSub, textDecorationLine: 'line-through' },

  /* Bottom Nav */
  bottomNav: {
    position: 'absolute', bottom: 0, width: '100%',
    backgroundColor: COLORS.primary,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 10,
  },
  navItem: { alignItems: 'center', gap: 4 },
  navLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(200,224,200,0.5)' },
  navBadge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: COLORS.accent, borderRadius: 8,
    minWidth: 15, height: 15, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.primary,
  },
  navBadgeText: { color: COLORS.primaryDark, fontSize: 8, fontWeight: '900' },

  /* Map */
  mapHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 52, paddingBottom: 16, paddingHorizontal: 20,
  },
  mapCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  mapTitle: { color: COLORS.white, fontSize: 17, fontWeight: '800' },
  mapSearchRow: {
    flexDirection: 'row', padding: 12, backgroundColor: COLORS.white,
    alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderGray,
  },
  mapSearchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.bgGray, borderRadius: 12,
    paddingHorizontal: 12, height: 42,
    borderWidth: 1, borderColor: COLORS.borderGray,
  },
  mapSearchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: COLORS.textMain },
  mapSearchBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  mapPinFixed: {
    position: 'absolute', top: '50%', left: '50%',
    marginLeft: -22, marginTop: -44, elevation: 6,
  },
  mapFooter: {
    padding: 16, backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.borderGray,
  },
  confirmBtn: { borderRadius: 14, overflow: 'hidden' },
  confirmGradient: { height: 52, justifyContent: 'center', alignItems: 'center' },
  confirmText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
});

export default UserHomepage;
