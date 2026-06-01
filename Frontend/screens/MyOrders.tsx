import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, API_BASE_URL } from '../services/api';
import { useCart } from '../context/CartContext';

const COLORS = {
  primary: '#244F42',
  accent: '#F4A71D',
  white: '#FFFFFF',
  cream: '#E8E8CC',
  textMain: '#1A1A1A',
  textSub: '#757575',
  bgLight: '#F3F4F6',
  danger: '#E51904',
  success: '#10B981',
  blue: '#3B82F6',
};

interface Order {
  order_id: number;
  status: string;
  ordered_at: string;
  pickup_code: string;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  order_type?: string;
  item_name: string;
  category: string;
  image_url: string | null;
  selling_price: number;
  original_price: number;
  store_name: string;
  store_phone?: string | null;
  is_surprise_bag?: boolean;
  driver_id?: number | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_rating?: number | null;
  payment_method?: string | null;
}

const MyOrders = ({ navigation }: any) => {
  const { totalItems } = useCart();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [ratingInProgress, setRatingInProgress] = useState<number | null>(null);

  // Filter and sort orders dynamically by status and selected calendar date (Newest First)
  const filteredAndSortedOrders = [...orders]
    .filter((o) => {
      // 1. Status Filter (Success / Failed)
      const status = (o.status || '').toLowerCase();
      const isSuccess = ['pending', 'confirmed', 'picked_up', 'completed', 'delivered', 'on_the_way'].includes(status);
      
      if (activeFilter === 'success' && !isSuccess) return false;
      if (activeFilter === 'failed' && isSuccess) return false;

      // 2. Precise Native Date Matcher
      if (selectedDate !== null) {
        const orderDateObj = new Date(o.ordered_at);
        if (orderDateObj.toDateString() !== selectedDate.toDateString()) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      // Always sort by newest first (cleanest, standard order history UX)
      return new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime();
    });

  useEffect(() => {
    fetchOrders();
  }, []);

  // Poll every 15 seconds if there are any active delivery orders
  useEffect(() => {
    const hasActiveDelivery = orders.some(
      o => o.order_type === 'delivery' && ['confirmed', 'on_the_way'].includes((o.status || '').toLowerCase())
    );
    if (!hasActiveDelivery) return;
    const interval = setInterval(() => {
      onRefresh();
    }, 15000);
    return () => clearInterval(interval);
  }, [orders]);

  const fetchOrders = async () => {
    try {
      setLoading(true);

      const userData = await AsyncStorage.getItem('user');

      if (!userData) {
        Alert.alert('Session Error', 'User not found. Please log in again.');
        return;
      }

      const parsedUser = JSON.parse(userData);
      const result = await api.getUserReservations(parsedUser.id);

      if (result.success) {
        setOrders(result.orders || []);
      } else {
        Alert.alert('Error', result.message || 'Failed to load orders.');
      }
    } catch (error: any) {
      console.error('Fetch Orders Error:', error);
      Alert.alert('Error', error.message || 'Could not load your orders.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      const userData = await AsyncStorage.getItem('user');

      if (!userData) {
        Alert.alert('Session Error', 'User not found. Please log in again.');
        return;
      }

      const parsedUser = JSON.parse(userData);
      const result = await api.getUserReservations(parsedUser.id);

      if (result.success) {
        setOrders(result.orders || []);
      }
    } catch (error: any) {
      console.error('Refresh Orders Error:', error);
      Alert.alert('Error', error.message || 'Could not refresh orders.');
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'payment_pending':
      case 'paying':
      case 'failed':
        return { label: 'Failed', color: COLORS.danger, icon: 'close-circle' as const, bg: 'rgba(229, 25, 4, 0.1)' };
      case 'cancelled':
        return { label: 'Cancelled', color: COLORS.danger, icon: 'close-circle' as const, bg: 'rgba(229, 25, 4, 0.1)' };
      case 'pending':
      case 'confirmed':
        return { label: 'Confirmed', color: COLORS.blue, icon: 'time' as const, bg: 'rgba(59, 130, 246, 0.12)' };
      case 'on_the_way':
        return { label: 'On the Way 🚴', color: '#7C3AED', icon: 'bicycle' as const, bg: 'rgba(124, 58, 237, 0.1)' };
      case 'picked_up':
      case 'completed':
        return { label: 'Completed', color: COLORS.success, icon: 'checkmark-circle' as const, bg: 'rgba(16, 185, 129, 0.12)' };
      case 'delivered':
        return { label: 'Delivered', color: COLORS.success, icon: 'checkmark-circle' as const, bg: 'rgba(16, 185, 129, 0.12)' };
      default:
        return { label: status || 'Unknown', color: COLORS.textSub, icon: 'help-circle' as const, bg: 'rgba(117, 117, 117, 0.1)' };
    }
  };

  const formatPrice = (price: number) => {
    return `NPR ${price}`;
  };

  const formatTimestamp = (dateString: string) => {
    if (!dateString) return 'Unknown time';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getImageUrl = (imageUrl: string | null) => {
    if (!imageUrl) {
      return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c';
    }

    if (imageUrl.startsWith('http')) {
      return imageUrl;
    }

    return `${API_BASE_URL}${imageUrl}`;
  };

  const handleCancelOrder = (order: Order) => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await api.cancelOrder(order.order_id);
              if (result.success) {
                Alert.alert('Cancelled', 'Your order has been cancelled.');
                fetchOrders();
              } else {
                Alert.alert('Error', result.message || 'Could not cancel order.');
              }
            } catch (error: any) {
              console.error('Cancel Order Error:', error);
              Alert.alert('Error', error.message || 'Could not cancel order.');
            }
          },
        },
      ]
    );
  };

  const handleRateDriver = (orderId: number, rating: number, driverName: string) => {
    Alert.alert(
      'Rate Your Driver',
      `Give ${driverName || 'your driver'} ${rating} star${rating === 1 ? '' : 's'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              setRatingInProgress(orderId);
              const result = await api.rateDriver(orderId, rating);
              if (result.success) {
                Alert.alert('Thanks!', 'Your rating has been submitted.');
                fetchOrders();
              } else {
                Alert.alert('Error', result.message || 'Could not submit rating.');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Could not submit rating.');
            } finally {
              setRatingInProgress(null);
            }
          },
        },
      ]
    );
  };

  const renderOrderItem = ({ item }: { item: Order }) => {
    const statusInfo = getStatusInfo(item.status);
    const isDelivery = item.order_type === 'delivery';
    const hasDriver = isDelivery && !!item.driver_id;
    const isOnTheWay = item.status?.toLowerCase() === 'on_the_way';
    const isDelivered = item.status?.toLowerCase() === 'delivered';
    const alreadyRated = !!item.driver_rating;

    return (
      <View style={styles.orderCard}>
        {/* Card Top Row: Store + Status */}
        <View style={styles.cardHeader}>
          <View style={styles.storeRow}>
            <View style={styles.storeIconCircle}>
              <Ionicons name="storefront" size={14} color={COLORS.primary} />
            </View>
            <Text style={styles.storeName} numberOfLines={1}>{item.store_name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Ionicons name={statusInfo.icon} size={12} color={statusInfo.color} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Card Body: Image + Details */}
        <View style={styles.cardBody}>
          <Image
            source={{ uri: getImageUrl(item.image_url) }}
            style={styles.itemImage}
          />

          <View style={styles.itemDetails}>
            <Text style={styles.itemName} numberOfLines={2}>{item.item_name}</Text>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.sellingPrice}>{formatPrice(item.selling_price)}</Text>
              {item.original_price > item.selling_price && (
                <Text style={styles.originalPrice}>NPR {item.original_price}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Driver info — shown for delivery orders once a driver has accepted */}
        {hasDriver && (
          <View style={styles.driverBox}>
            <View style={styles.driverBoxLeft}>
              <View style={styles.driverIconCircle}>
                <Ionicons name="bicycle" size={16} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.driverLabel}>Your Driver</Text>
                <Text style={styles.driverName}>{item.driver_name || 'Driver'}</Text>
                {item.driver_phone && (
                  <Text style={styles.driverPhone}>{item.driver_phone}</Text>
                )}
              </View>
            </View>
            {item.driver_phone && (
              <TouchableOpacity
                style={styles.callDriverBtn}
                onPress={() => Linking.openURL(`tel:${item.driver_phone}`)}
              >
                <Ionicons name="call" size={14} color={COLORS.white} />
                <Text style={styles.callDriverText}>Call</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* On the way banner */}
        {isOnTheWay && hasDriver && (
          <View style={styles.onTheWayBanner}>
            <Ionicons name="bicycle" size={18} color="#7C3AED" />
            <Text style={styles.onTheWayText}>
              {item.driver_name || 'Your driver'} is on the way to you!
            </Text>
          </View>
        )}

        {/* Rate your driver — shown after delivery, before rating */}
        {isDelivered && hasDriver && !alreadyRated && (
          <View style={styles.ratingBox}>
            <Text style={styles.ratingTitle}>Rate your driver</Text>
            <Text style={styles.ratingSubtitle}>{item.driver_name || 'Your driver'} delivered your order</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => handleRateDriver(item.order_id, star, item.driver_name || 'your driver')}
                  disabled={ratingInProgress === item.order_id}
                  activeOpacity={0.7}
                  style={styles.starBtn}
                >
                  <Ionicons
                    name="star"
                    size={32}
                    color={ratingInProgress === item.order_id ? '#ddd' : COLORS.accent}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Already rated */}
        {isDelivered && hasDriver && alreadyRated && (
          <View style={styles.ratedBox}>
            <Ionicons name="star" size={14} color={COLORS.accent} />
            <Text style={styles.ratedText}>You rated this delivery {item.driver_rating}/5</Text>
          </View>
        )}

        {/* Card Footer: Payment method + Time + Actions */}
        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            {!isDelivery && (
              <View style={styles.pickupCodeBox}>
                <Text style={styles.pickupLabel}>PICKUP CODE</Text>
                <Text style={styles.pickupCode}>
                  {item.status?.toLowerCase() === 'cancelled' ? '---' : item.pickup_code || '---'}
                </Text>
              </View>
            )}
            {isDelivery && item.payment_method === 'cod' && (
              <View style={styles.codPill}>
                <Ionicons name="cash-outline" size={12} color="#8B6914" />
                <Text style={styles.codPillText}>Cash on Delivery</Text>
              </View>
            )}
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={13} color={COLORS.textSub} />
              <Text style={styles.timestamp}>{formatTimestamp(item.ordered_at)}</Text>
            </View>
          </View>

          {/* Cancel only available for COD orders before a driver accepts */}
          {item.payment_method === 'cod' && !item.driver_id &&
            ['pending', 'confirmed'].includes(item.status?.toLowerCase() ?? '') && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => handleCancelOrder(item)}
            >
              <Ionicons name="close-circle-outline" size={16} color={COLORS.danger} />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <MaterialCommunityIcons name="package-variant" size={50} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>No orders yet</Text>
      <Text style={styles.emptySubtitle}>
        Your active and past reservations will appear here.
      </Text>
      <TouchableOpacity
        style={styles.browseButton}
        onPress={() => navigation.navigate('Home')}
      >
        <Ionicons name="search" size={18} color={COLORS.primary} />
        <Text style={styles.browseButtonText}>Browse Food Items</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading your orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.cream} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* BODY with rounded top */}
      <View style={styles.body}>
        {/* FILTER TABS */}
        <View style={styles.filterContainer}>
          {(['all', 'success', 'failed'] as const).map((filter) => {
            const isActive = activeFilter === filter;
            const label = filter === 'all' ? 'All' : filter === 'success' ? 'Success' : 'Failed';
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterTab,
                  isActive && styles.activeFilterTab,
                ]}
                onPress={() => setActiveFilter(filter)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterText,
                    isActive && styles.activeFilterText,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* DATE PICKER ROW */}
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.dateInputClickable}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <View style={styles.dateIconCircle}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
            </View>
            <Text style={[styles.dateInputText, !selectedDate && styles.placeholderText]}>
              {selectedDate
                ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Filter by date'
              }
            </Text>
          </TouchableOpacity>

          {selectedDate && (
            <TouchableOpacity onPress={() => setSelectedDate(null)} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={20} color={COLORS.textSub} />
            </TouchableOpacity>
          )}
        </View>

        {/* Conditionally Render native DatePicker Dialog */}
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate || new Date()}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (event.type === 'set' && date) {
                setSelectedDate(date);
              }
            }}
          />
        )}

        {/* ORDER COUNT */}
        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {filteredAndSortedOrders.length} {filteredAndSortedOrders.length === 1 ? 'order' : 'orders'}
          </Text>
        </View>

        {/* ORDERS LIST */}
        <FlatList
          data={filteredAndSortedOrders}
          keyExtractor={(item) => item.order_id.toString()}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={EmptyState}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
        />
      </View>

      {/* BOTTOM NAVIGATION */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}>
          <Ionicons name="home-outline" size={24} color="rgba(232,232,204,0.65)" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="receipt" size={24} color={COLORS.accent} />
          <Text style={[styles.navText, { color: COLORS.accent }]}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'Cart' }] })}>
          <View>
            <Ionicons name="cart-outline" size={24} color="rgba(232,232,204,0.65)" />
            {totalItems > 0 && (
              <View style={styles.navCartBadge}>
                <Text style={styles.navCartBadgeText}>{totalItems}</Text>
              </View>
            )}
          </View>
          <Text style={styles.navText}>Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'UserProfile' }] })}>
          <Ionicons name="person-outline" size={24} color="rgba(232,232,204,0.65)" />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default MyOrders;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.primary },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(232, 232, 204, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.cream,
  },

  // Body
  body: {
    flex: 1,
    backgroundColor: COLORS.bgLight,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },

  // Filter tabs
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    gap: 10,
  },
  filterTab: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  activeFilterTab: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSub,
  },
  activeFilterText: {
    color: COLORS.cream,
  },

  // Date row
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 6,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(36, 79, 66, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  dateInputClickable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  dateInputText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMain,
  },
  placeholderText: {
    color: '#BCBCBC',
    fontWeight: '500',
  },
  clearBtn: {
    padding: 4,
  },

  // Count row
  countRow: {
    paddingHorizontal: 22,
    paddingBottom: 6,
    paddingTop: 4,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSub,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // List
  listContainer: { paddingHorizontal: 20, paddingBottom: 110, flexGrow: 1 },

  // Order Card
  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  storeIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(36, 79, 66, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  storeName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 12,
  },

  // Card Body
  cardBody: {
    flexDirection: 'row',
  },
  itemImage: {
    width: 75,
    height: 75,
    borderRadius: 14,
    backgroundColor: COLORS.bgLight,
  },
  itemDetails: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textMain,
    lineHeight: 20,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(36, 79, 66, 0.07)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 5,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
  },
  sellingPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primary,
  },
  originalPrice: {
    fontSize: 12,
    color: COLORS.textSub,
    textDecorationLine: 'line-through',
    marginLeft: 8,
  },

  // Card Footer
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginTop: 12,
  },
  footerLeft: {},
  pickupCodeBox: {
    marginBottom: 6,
  },
  pickupLabel: {
    fontSize: 9,
    color: COLORS.textSub,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pickupCode: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timestamp: {
    fontSize: 11,
    color: COLORS.textSub,
    fontWeight: '500',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(229, 25, 4, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 5,
  },
  cancelButtonText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 13,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(36, 79, 66, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSub,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  browseButton: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  browseButtonText: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 15,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.cream,
    fontSize: 14,
    fontWeight: '600',
  },

  // Bottom Nav
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 10,
  },
  navItem: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  navText: { fontSize: 10, fontWeight: '600', color: 'rgba(232,232,204,0.65)' },
  navCartBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navCartBadgeText: { color: COLORS.primary, fontSize: 9, fontWeight: '800' },

  // Driver info box
  driverBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(36,79,66,0.06)',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(36,79,66,0.12)',
  },
  driverBoxLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  driverIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(36,79,66,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverLabel: { fontSize: 10, color: COLORS.textSub, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  driverName: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginTop: 1 },
  driverPhone: { fontSize: 12, color: COLORS.textSub, marginTop: 1 },
  callDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  callDriverText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },

  // Rating box
  ratingBox: {
    marginTop: 12,
    backgroundColor: 'rgba(244,167,29,0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(244,167,29,0.25)',
    alignItems: 'center',
  },
  ratingTitle: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginBottom: 2 },
  ratingSubtitle: { fontSize: 12, color: COLORS.textSub, marginBottom: 12 },
  starsRow: { flexDirection: 'row', gap: 6 },
  starBtn: { padding: 2 },

  // Already rated
  ratedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(244,167,29,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  ratedText: { fontSize: 12, color: COLORS.textSub, fontWeight: '600' },

  // COD pill
  codPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139,105,20,0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  codPillText: { fontSize: 11, color: '#8B6914', fontWeight: '700' },

  // On the way banner
  onTheWayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
  },
  onTheWayText: { fontSize: 13, color: '#7C3AED', fontWeight: '700', flex: 1 },
});