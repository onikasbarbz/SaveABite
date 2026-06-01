import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useCart } from '../context/CartContext';
import { api, API_BASE_URL } from '../services/api';

const CartScreen = () => {
  const navigation = useNavigation<any>();
  const { items, removeFromCart, updateQuantity, totalItems, totalPrice, storeId, clearCart } = useCart();
  const insets = useSafeAreaInsets();
  const [ordering, setOrdering] = useState(false);
  const [orderType, setOrderType] = useState<'pickup' | 'delivery'>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [showMap, setShowMap] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState<any>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [distance, setDistance] = useState<number | null>(null);
  const [distanceToStore, setDistanceToStore] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);

  const fetchRoadRoute = async (startLat: number, startLng: number, endLat: number, endLng: number) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const json = await response.json();
      if (json.code === 'Ok' && json.routes && json.routes.length > 0) {
        const coords = json.routes[0].geometry.coordinates.map((point: any) => ({
          latitude: point[1],
          longitude: point[0]
        }));
        const roadDistance = json.routes[0].distance / 1000;
        return { coords, roadDistance };
      }
    } catch (e) {
      console.log("Error fetching road route:", e);
    }
    return null;
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    const getInitialLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          const coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setUserLocation(coords);
          if (items.length > 0) {
            const storeLat = items[0].store_lat;
            const storeLng = items[0].store_lng;
            if (storeLat && storeLng) {
              const routeData = await fetchRoadRoute(parseFloat(storeLat), parseFloat(storeLng), coords.latitude, coords.longitude);
              if (routeData) {
                setDistanceToStore(routeData.roadDistance);
              } else {
                const dist = calculateDistance(parseFloat(storeLat), parseFloat(storeLng), coords.latitude, coords.longitude);
                setDistanceToStore(dist);
              }
            }
          }
        }
      } catch (e) {
        console.log("Error getting initial location", e);
      }
    };
    getInitialLocation();
  }, [items]);

  const handleDeliverySelect = async () => {
    setOrderType('delivery');
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location access is required for delivery.');
      return;
    }
    let coords = deliveryLocation;
    if (!coords) {
      try {
        const loc = await Location.getCurrentPositionAsync({});
        coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setDeliveryLocation(coords);
      } catch (e) {
        console.log("Could not get current location", e);
      }
    }
    if (coords && items.length > 0) {
      const storeLat = items[0].store_lat;
      const storeLng = items[0].store_lng;
      if (storeLat && storeLng) {
        const routeData = await fetchRoadRoute(parseFloat(storeLat), parseFloat(storeLng), coords.latitude, coords.longitude);
        if (routeData) {
          setRouteCoordinates(routeData.coords);
          setDistance(routeData.roadDistance);
          const fee = Math.max(50, Math.round(50 + routeData.roadDistance * 20));
          setDeliveryFee(fee);
        }
      }
    }
    setShowMap(true);
  };

  const handleLocationConfirm = async (coords: any) => {
    setDeliveryLocation(coords);
    setShowMap(false);
    const result = await Location.reverseGeocodeAsync(coords);
    if (result.length > 0) {
      const addr = result[0];
      setDeliveryAddress(`${addr.name || ''}, ${addr.street || ''}, ${addr.city || ''}`.replace(/^, |, $/g, ''));
    }
    if (distance === null || deliveryFee === 0) {
      if (items.length > 0) {
        const storeLat = items[0].store_lat;
        const storeLng = items[0].store_lng;
        if (storeLat && storeLng) {
          const dist = calculateDistance(parseFloat(storeLat), parseFloat(storeLng), coords.latitude, coords.longitude);
          setDistance(dist);
          const fee = Math.max(50, Math.round(50 + dist * 20));
          setDeliveryFee(fee);
        } else {
          setDistance(null);
          setDeliveryFee(50);
        }
      } else {
        setDeliveryFee(50);
      }
    }
  };

  const handleCheckout = async () => {
    if (items.length === 0) return;

    if (orderType === 'delivery' && !deliveryLocation) {
      Alert.alert('Set Delivery Location', 'Please pick a delivery location on the map first.');
      return;
    }

    // ── COD path ──────────────────────────────────────────────────
    if (paymentMethod === 'cod') {
      try {
        setOrdering(true);
        const cart_items = items.map(i => ({ listing_id: i.listing_id, quantity: i.quantity }));
        const result = await api.request("/api/payment/cod-cart", {
          method: "POST",
          body: JSON.stringify({
            cart_items,
            order_type: orderType,
            delivery_lat: deliveryLocation?.latitude,
            delivery_lng: deliveryLocation?.longitude,
            delivery_address: deliveryAddress,
            delivery_fee: orderType === 'delivery' ? deliveryFee : 0,
          }),
        });
        if (result.success) {
          clearCart();
          Alert.alert(
            'Order Placed!',
            orderType === 'delivery'
              ? 'Pay cash to the driver on delivery.'
              : 'Pay cash when you pick up at the store.',
            [{ text: 'View Orders', onPress: () => navigation.replace('Orders') }]
          );
        } else {
          Alert.alert('Error', result.message || 'Could not place order');
        }
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Something went wrong.');
      } finally {
        setOrdering(false);
      }
      return;
    }

    // ── Online (Khalti) path ───────────────────────────────────────
    try {
      setOrdering(true);
      const cart_items = items.map(i => ({ listing_id: i.listing_id, quantity: i.quantity }));
      const paymentData = await api.request("/api/payment/initiate-cart", {
        method: "POST",
        body: JSON.stringify({
          cart_items,
          order_type: orderType,
          delivery_lat: deliveryLocation?.latitude,
          delivery_lng: deliveryLocation?.longitude,
          delivery_address: deliveryAddress,
          delivery_fee: orderType === 'delivery' ? deliveryFee : 0,
        })
      });
      if (!paymentData.success) {
        Alert.alert("Error", paymentData.message || "Could not start payment");
        return;
      }
      const returnUrl = Linking.createURL('/payment/verify');
      await WebBrowser.openAuthSessionAsync(paymentData.payment_url as string, returnUrl);
      const verification = await api.request("/api/payment/verify-cart", {
        method: "POST",
        body: JSON.stringify({ pidx: paymentData.pidx, order_id: paymentData.order_id })
      });
      if (verification.success) {
        clearCart();
        navigation.replace('Orders');
      } else if (verification.payment_status === 'Pending') {
        clearCart();
        Alert.alert("Payment Pending", "Your payment is still processing. Check your orders shortly.",
          [{ text: "View Orders", onPress: () => navigation.navigate('Orders') }]);
      } else {
        try { await api.request("/api/payment/cancel-cart", { method: "POST", body: JSON.stringify({ order_id: paymentData.order_id }) }); } catch (_) {}
        Alert.alert("Payment Not Completed", "The payment was not completed. No charge was made.");
      }
    } catch (error: any) {
      console.error("Cart Checkout Error:", error);
      Alert.alert("Error", error.message || "Something went wrong.");
    } finally {
      setOrdering(false);
    }
  };

  // ── EMPTY STATE ──
  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#E8E8CC" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Cart</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.body}>
          <View style={styles.emptyContent}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="cart-outline" size={50} color="#244F42" />
            </View>
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptySubtitle}>Add items from stores to get started</Text>
            <TouchableOpacity style={styles.browseBtn} onPress={() => navigation.navigate("Home")}>
              <Ionicons name="search" size={18} color="#244F42" />
              <Text style={styles.browseBtnText}>Browse Food</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* BOTTOM NAVIGATION FOR EMPTY STATE */}
        <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
            <Ionicons name="home-outline" size={24} color="rgba(232,232,204,0.65)" />
            <Text style={styles.navText}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Orders')}>
            <Ionicons name="receipt-outline" size={24} color="rgba(232,232,204,0.65)" />
            <Text style={styles.navText}>Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <View>
              <Ionicons name="cart" size={24} color="#F4A71D" />
            </View>
            <Text style={[styles.navText, { color: "#F4A71D" }]}>Cart</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('UserProfile')}>
            <Ionicons name="person-outline" size={24} color="rgba(232,232,204,0.65)" />
            <Text style={styles.navText}>Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── CART ITEM RENDERER ──
  const renderItem = ({ item }: { item: any }) => {
    const imageUrl = item.image_url
      ? (item.image_url.startsWith('http') ? item.image_url : `${API_BASE_URL}${item.image_url}`)
      : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c';
    return (
      <View style={styles.cartItem}>
        <Image source={{ uri: imageUrl }} style={styles.itemImage} />
        <View style={styles.itemDetails}>
          <Text style={styles.itemName} numberOfLines={1}>{item.item_name}</Text>
          <Text style={styles.itemPrice}>NPR {item.price}</Text>
          <View style={styles.quantityRow}>
            <TouchableOpacity onPress={() => updateQuantity(item.listing_id, item.quantity - 1)} style={styles.qtyBtn}>
              <Ionicons name="remove" size={18} color="#244F42" />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{item.quantity}</Text>
            <TouchableOpacity onPress={() => updateQuantity(item.listing_id, item.quantity + 1)} style={styles.qtyBtn}>
              <Ionicons name="add" size={18} color="#244F42" />
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity onPress={() => removeFromCart(item.listing_id)} style={styles.removeBtn}>
          <Ionicons name="trash-outline" size={20} color="#C62828" />
        </TouchableOpacity>
      </View>
    );
  };

  // ── MAIN RENDER ──
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#E8E8CC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Cart</Text>
        <TouchableOpacity onPress={clearCart} style={styles.backBtn}>
          <Ionicons name="trash" size={20} color="#FF6B6B" />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* Store banner */}
        <View style={styles.storeBanner}>
          <View style={styles.storeIconCircle}>
            <Ionicons name="storefront" size={16} color="#244F42" />
          </View>
          <Text style={styles.storeNameText} numberOfLines={1}>{items[0]?.store_name}</Text>
          {distanceToStore !== null && (
            <View style={styles.distancePill}>
              <Ionicons name="navigate-outline" size={12} color="#244F42" />
              <Text style={styles.distanceText}>{distanceToStore.toFixed(1)} km</Text>
            </View>
          )}
        </View>

        <View style={styles.countRow}>
          <Text style={styles.countText}>{totalItems} {totalItems === 1 ? 'item' : 'items'} in cart</Text>
        </View>

        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={item => item.listing_id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.sectionLabel}>ORDER TYPE</Text>
          <View style={styles.orderTypeContainer}>
            <TouchableOpacity style={[styles.typeBtn, orderType === 'pickup' && styles.activeTypeBtn]} onPress={() => setOrderType('pickup')}>
              <Ionicons name="walk" size={18} color={orderType === 'pickup' ? '#fff' : '#244F42'} />
              <Text style={[styles.typeBtnText, orderType === 'pickup' && styles.activeTypeBtnText]}>Pickup</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeBtn, orderType === 'delivery' && styles.activeTypeBtn]} onPress={handleDeliverySelect}>
              <Ionicons name="bicycle" size={18} color={orderType === 'delivery' ? '#fff' : '#244F42'} />
              <Text style={[styles.typeBtnText, orderType === 'delivery' && styles.activeTypeBtnText]}>Delivery</Text>
            </TouchableOpacity>
          </View>

          {orderType === 'delivery' && deliveryAddress ? (
            <View style={styles.deliveryInfoCard}>
              <Ionicons name="location" size={18} color="#C62828" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.deliveryAddrText} numberOfLines={1}>{deliveryAddress}</Text>
                <Text style={styles.deliveryFeeText}>{distance !== null ? `${distance.toFixed(1)} km · ` : ''}Fee: NPR {deliveryFee}</Text>
              </View>
              <TouchableOpacity onPress={handleDeliverySelect}><Text style={styles.changeText}>Change</Text></TouchableOpacity>
            </View>
          ) : orderType === 'delivery' && (
            <TouchableOpacity style={styles.pickLocationBtn} onPress={handleDeliverySelect}>
              <Ionicons name="map-outline" size={18} color="#244F42" />
              <Text style={styles.pickLocationText}>Pick location on map</Text>
            </TouchableOpacity>
          )}

          {/* Payment method — always visible for both pickup and delivery */}
          <Text style={[styles.sectionLabel, { marginTop: 10 }]}>PAYMENT METHOD</Text>
          <View style={styles.orderTypeContainer}>
            <TouchableOpacity
              style={[styles.typeBtn, paymentMethod === 'online' && styles.activeTypeBtn]}
              onPress={() => setPaymentMethod('online')}
            >
              <Ionicons name="card-outline" size={18} color={paymentMethod === 'online' ? '#fff' : '#244F42'} />
              <Text style={[styles.typeBtnText, paymentMethod === 'online' && styles.activeTypeBtnText]}>Online (Khalti)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, paymentMethod === 'cod' && styles.activeTypeBtn]}
              onPress={() => setPaymentMethod('cod')}
            >
              <Ionicons name="cash-outline" size={18} color={paymentMethod === 'cod' ? '#fff' : '#244F42'} />
              <Text style={[styles.typeBtnText, paymentMethod === 'cod' && styles.activeTypeBtnText]}>Cash on Delivery</Text>
            </TouchableOpacity>
          </View>
          {paymentMethod === 'cod' && (
            <View style={styles.codNote}>
              <Ionicons name="information-circle-outline" size={15} color="#8B6914" />
              <Text style={styles.codNoteText}>
                {orderType === 'delivery'
                  ? 'Pay cash to the driver when your order arrives.'
                  : 'Pay cash when you pick up your order at the store.'}
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>NPR {totalPrice}</Text>
          </View>
          {orderType === 'delivery' && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={styles.summaryValue}>NPR {deliveryFee}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>NPR {totalPrice + (orderType === 'delivery' ? deliveryFee : 0)}</Text>
          </View>

          <TouchableOpacity style={[styles.checkoutBtn, ordering && { opacity: 0.7 }]} onPress={handleCheckout} disabled={ordering}>
            {ordering ? (
              <ActivityIndicator color="#244F42" size="small" />
            ) : (
              <>
                <Ionicons
                  name={paymentMethod === 'cod' ? 'cash-outline' : 'shield-checkmark'}
                  size={20}
                  color="#244F42"
                />
                <Text style={styles.checkoutBtnText}>
                  {paymentMethod === 'cod' ? 'Place Order (Cash on Delivery)' : 'Checkout with Khalti'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Map Picker Modal */}
      {showMap && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', zIndex: 1000 }]}>
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setShowMap(false)} style={styles.mapCloseBtn}><Ionicons name="close" size={24} color="#244F42" /></TouchableOpacity>
            <Text style={styles.mapTitle}>Set Delivery Location</Text>
            <View style={{ width: 40 }} />
          </View>
          <MapView
            style={{ flex: 1 }}
            initialRegion={deliveryLocation ? { ...deliveryLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 } : { latitude: 27.7172, longitude: 85.3240, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
            onRegionChangeComplete={async (region) => {
              const newCoords = { latitude: region.latitude, longitude: region.longitude };
              setDeliveryLocation(newCoords);
              if (items.length > 0) {
                const sLat = items[0].store_lat;
                const sLng = items[0].store_lng;
                if (sLat && sLng) {
                  const routeData = await fetchRoadRoute(parseFloat(sLat), parseFloat(sLng), newCoords.latitude, newCoords.longitude);
                  if (routeData) {
                    setRouteCoordinates(routeData.coords);
                    setDistance(routeData.roadDistance);
                    setDeliveryFee(Math.max(50, Math.round(50 + routeData.roadDistance * 20)));
                  } else {
                    const dist = calculateDistance(parseFloat(sLat), parseFloat(sLng), newCoords.latitude, newCoords.longitude);
                    setRouteCoordinates([{ latitude: parseFloat(sLat), longitude: parseFloat(sLng) }, newCoords]);
                    setDistance(dist);
                    setDeliveryFee(Math.max(50, Math.round(50 + dist * 20)));
                  }
                }
              }
            }}
          >
            {items.length > 0 && items[0].store_lat && (
              <Marker coordinate={{ latitude: parseFloat(items[0].store_lat), longitude: parseFloat(items[0].store_lng!) }} title={items[0].store_name || "Store"} description="Store Location" pinColor="#244F42" />
            )}
            {routeCoordinates.length > 0 && <Polyline coordinates={routeCoordinates} strokeColor="#244F42" strokeWidth={4} />}
          </MapView>
          <View style={styles.mapMarkerFixed}><Ionicons name="location" size={40} color="#C62828" /></View>
          <View style={styles.mapFooter}>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => handleLocationConfirm(deliveryLocation)}>
              <Text style={styles.confirmBtnText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* BOTTOM NAVIGATION */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}>
          <Ionicons name="home-outline" size={24} color="rgba(232,232,204,0.65)" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'Orders' }] })}>
          <Ionicons name="receipt-outline" size={24} color="rgba(232,232,204,0.65)" />
          <Text style={styles.navText}>Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <View>
            <Ionicons name="cart" size={24} color="#F4A71D" />
            {totalItems > 0 && (
              <View style={styles.navCartBadge}>
                <Text style={styles.navCartBadgeText}>{totalItems}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.navText, { color: "#F4A71D" }]}>Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'UserProfile' }] })}>
          <Ionicons name="person-outline" size={24} color="rgba(232,232,204,0.65)" />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#244F42' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(232,232,204,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#E8E8CC' },
  body: { flex: 1, backgroundColor: '#F3F4F6', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },

  storeBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 20, marginTop: 20, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  storeIconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(36,79,66,0.08)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  storeNameText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#244F42' },
  distancePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(36,79,66,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  distanceText: { fontSize: 11, fontWeight: '700', color: '#244F42' },

  countRow: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 4 },
  countText: { fontSize: 12, fontWeight: '600', color: '#757575', textTransform: 'uppercase', letterSpacing: 0.5 },

  listContent: { paddingHorizontal: 20, paddingBottom: 10 },
  cartItem: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  itemImage: { width: 68, height: 68, borderRadius: 14, backgroundColor: '#F3F4F6' },
  itemDetails: { flex: 1, marginLeft: 14 },
  itemName: { fontSize: 15, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  itemPrice: { fontSize: 16, color: '#244F42', fontWeight: '900', marginBottom: 6 },
  quantityRow: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: { width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(36,79,66,0.08)', justifyContent: 'center', alignItems: 'center' },
  qtyText: { marginHorizontal: 14, fontSize: 16, fontWeight: '800', color: '#244F42' },
  removeBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(198,40,40,0.08)', justifyContent: 'center', alignItems: 'center' },

  footer: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 110, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 8 },
  sectionLabel: { fontSize: 10, fontWeight: '800', color: '#757575', letterSpacing: 1, marginBottom: 8 },
  orderTypeContainer: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: '#244F42', gap: 6 },
  activeTypeBtn: { backgroundColor: '#244F42' },
  typeBtnText: { fontSize: 13, fontWeight: '700', color: '#244F42' },
  activeTypeBtnText: { color: '#fff' },

  deliveryInfoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 12, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  deliveryAddrText: { fontSize: 13, color: '#333', fontWeight: '700' },
  deliveryFeeText: { fontSize: 12, color: '#27AB34', fontWeight: '700', marginTop: 2 },
  changeText: { fontSize: 12, color: '#244F42', fontWeight: '800', textDecorationLine: 'underline' },
  pickLocationBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(36,79,66,0.06)', height: 42, borderRadius: 12, marginBottom: 12, gap: 8 },
  pickLocationText: { fontSize: 13, fontWeight: '700', color: '#244F42' },

  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontSize: 14, color: '#757575' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#333' },
  totalLabel: { fontSize: 16, fontWeight: '800', color: '#244F42' },
  totalValue: { fontSize: 18, fontWeight: '900', color: '#244F42' },
  checkoutBtn: { backgroundColor: '#F4A71D', height: 52, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12, gap: 8, shadowColor: '#F4A71D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  checkoutBtnText: { color: '#244F42', fontSize: 16, fontWeight: '800' },

  emptyContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(36,79,66,0.08)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
  emptySubtitle: { fontSize: 14, color: '#757575', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  browseBtn: { marginTop: 24, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4A71D', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, gap: 8 },
  browseBtnText: { color: '#244F42', fontWeight: '800', fontSize: 15 },

  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee', paddingTop: 40 },
  mapCloseBtn: { padding: 4 },
  mapTitle: { fontSize: 18, fontWeight: 'bold', color: '#244F42' },
  mapMarkerFixed: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -20, elevation: 5 },
  mapFooter: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  confirmBtn: { backgroundColor: '#244F42', height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Bottom Nav
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: '#244F42',
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
  navCartBadge: { position: 'absolute', top: -4, right: -8, backgroundColor: '#F4A71D', borderRadius: 8, minWidth: 15, height: 15, justifyContent: 'center', alignItems: 'center' },
  navCartBadgeText: { color: '#244F42', fontSize: 9, fontWeight: '800' },

  // COD note
  codNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139,105,20,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(139,105,20,0.2)',
  },
  codNoteText: { fontSize: 12, color: '#8B6914', fontWeight: '600', flex: 1 },
});

export default CartScreen;
