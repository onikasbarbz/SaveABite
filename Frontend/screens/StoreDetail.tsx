import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { API_BASE_URL } from '../services/api';
import { useCart } from '../context/CartContext';

// --- COLORS MATCHING HOMEPAGE ---
const COLORS = {
  primary: '#244F42',
  secondary: '#C8E0C8',
  accent: '#F4A71D',
  white: '#FFFFFF',
  textMain: '#000000',
  textSub: '#757575',
  bgGray: '#F3F4F6',
  borderGray: '#CACACA',
};

// --- TYPESCRIPT INTERFACE ---
interface Listing {
  id: number;
  item_name: string;
  original_price?: number;
  selling_price: string | number;
  discountPercent?: number;
  image_url?: string | null;
  profile_image?: string | null;
  cover_image?: string | null;
  category?: string;
  store_name?: string | null;
  stock_quantity?: number;
  rescue_deadline?: string | null;
  is_surprise_bag?: boolean;
  dietary_preference?: string | null;
  health_note?: string | null;
  auto_donate?: boolean;
}

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4';
const FALLBACK_PROFILE =
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5';
const FALLBACK_FOOD =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c';

const StoreDetail = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { storeId, storeName } = route.params;
  const { totalItems } = useCart();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStoreListings();
  }, [storeId]);

  const getImageUrl = (path?: string | null, fallback: string = FALLBACK_FOOD) => {
    if (!path) return fallback;
    return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  };

  const formatDeadline = (deadline?: string | null) => {
    if (!deadline) return "End of Day";
    const date = new Date(deadline);
    if (isNaN(date.getTime())) return deadline; // Fallback for legacy format
    
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const fetchStoreListings = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/listings/store-public/${storeId}`, {
        headers: {
          'ngrok-skip-browser-warning': '69420',
        },
      });

      const result = await response.json();

      if (result.success && Array.isArray(result.listings)) {
        setListings(result.listings);
      } else {
        setListings([]);
      }
    } catch (error) {
      console.error('Store Fetch Error:', error);
      Alert.alert('Error', 'Could not load store listings.');
    } finally {
      setLoading(false);
    }
  };

  const coverImage = getImageUrl(listings[0]?.cover_image, FALLBACK_COVER);
  const profileImage = getImageUrl(listings[0]?.profile_image, FALLBACK_PROFILE);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 1. Header with Cover Image */}
        <View style={styles.header}>
          <Image source={{ uri: coverImage }} style={styles.coverImg} />
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.cartBtn} 
            onPress={() => navigation.navigate('Cart')}
          >
            <Ionicons name="cart" size={24} color="white" />
            {totalItems > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalItems}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* 2. Store Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.profileImgWrapper}>
            <Image source={{ uri: profileImage }} style={styles.profileImg} />
          </View>

          <Text style={styles.title}>{storeName || listings[0]?.store_name || 'Store'}</Text>
          <Text style={styles.category}>{listings[0]?.category || 'Partner Store'}</Text>

          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={16} color={COLORS.primary} />
            <Text style={styles.locationText}>Baneshwor, Kathmandu</Text>
          </View>

          <View style={styles.badgeRow}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>OPEN NOW</Text>
            </View>
          </View>
        </View>

        {/* 3. Listings Section */}
        <View style={styles.menuSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available for Rescue</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{listings.length} Items</Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
          ) : (
            listings.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.itemCard}
                onPress={() => navigation.navigate('FoodDetail', { item })}
              >
                <Image
                  source={{ uri: getImageUrl(item.image_url, FALLBACK_FOOD) }}
                  style={styles.itemThumb}
                />

                <View style={styles.itemInfo}>
                  <View style={styles.itemTopRow}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.item_name}
                    </Text>

                    {item.discountPercent !== undefined && item.discountPercent > 0 && (
                      <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>{item.discountPercent}% OFF</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.itemCategory}>{item.category || 'Food Item'}</Text>
                  <Text style={styles.itemPrice}>NPR {item.selling_price}</Text>

                  {item.is_surprise_bag && (
                    <View style={styles.surpriseRow}>
                      <MaterialCommunityIcons name="gift" size={12} color={COLORS.accent} />
                      <Text style={styles.surpriseText}>Surprise Bag</Text>
                    </View>
                  )}

                  <Text style={styles.metaText}>
                    Stock: {item.stock_quantity ?? 0}
                  </Text>

                  <Text style={styles.metaText}>
                    Pickup: {formatDeadline(item.rescue_deadline)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.viewBtn}
                  onPress={() => navigation.navigate('FoodDetail', { item })}
                >
                  <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}

          {listings.length === 0 && !loading && (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="food-off" size={60} color={COLORS.borderGray} />
              <Text style={styles.emptyText}>No active listings for this store.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgGray },
  header: { height: 220, width: '100%' },
  coverImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  backBtn: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 10,
    borderRadius: 25,
  },
  cartBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 10,
    borderRadius: 25,
  },
  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  cartBadgeText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  infoCard: {
    backgroundColor: COLORS.white,
    marginTop: -50,
    marginHorizontal: 25,
    borderRadius: 25,
    paddingBottom: 20,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  profileImgWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 5,
    borderColor: COLORS.white,
    marginTop: -50,
    overflow: 'hidden',
    elevation: 5,
    backgroundColor: COLORS.white,
  },
  profileImg: { width: '100%', height: '100%' },
  title: { fontSize: 24, fontWeight: '900', color: COLORS.primary, marginTop: 10 },
  category: { color: COLORS.textSub, fontSize: 14, fontWeight: '600', marginBottom: 5 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  locationText: { color: COLORS.textSub, fontSize: 13, marginLeft: 4 },
  badgeRow: { flexDirection: 'row', gap: 10 },
  statusBadge: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { color: COLORS.primary, fontSize: 10, fontWeight: '900' },

  menuSection: { paddingHorizontal: 25, marginTop: 25, paddingBottom: 50 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  countBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  countText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },

  itemCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 12,
    marginBottom: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  itemThumb: { width: 75, height: 75, borderRadius: 15 },
  itemInfo: { flex: 1, marginLeft: 15 },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemName: { fontSize: 16, fontWeight: '800', color: COLORS.primary, flex: 1, marginRight: 8 },
  itemCategory: { fontSize: 12, color: COLORS.textSub, marginBottom: 5 },
  itemPrice: { color: '#27AB34', fontSize: 16, fontWeight: '900' },
  metaText: { fontSize: 11, color: COLORS.textSub, marginTop: 3 },

  surpriseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  surpriseText: {
    fontSize: 11,
    color: COLORS.accent,
    fontWeight: '700',
    marginLeft: 4,
  },

  discountBadge: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  discountText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },

  viewBtn: {
    backgroundColor: COLORS.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: COLORS.textSub, marginTop: 10, fontWeight: '600' },
});

export default StoreDetail;