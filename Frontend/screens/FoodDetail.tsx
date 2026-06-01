import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet, View, Text, Image, ScrollView,
  TouchableOpacity, Dimensions, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { api, API_BASE_URL } from '../services/api';
import { useCart } from '../context/CartContext';

const { width } = Dimensions.get('window');

const FoodDetail = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { item } = route.params;
  const { addToCart, totalItems } = useCart();

  const [ordering, setOrdering] = useState(false);
  const [orderType, setOrderType] = useState<'pickup' | 'delivery'>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
  const [showMap, setShowMap] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState<any>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [distance, setDistance] = useState<number | null>(null); // Delivery location distance
  const [distanceToStore, setDistanceToStore] = useState<number | null>(null); // Current location distance
  const [userLocation, setUserLocation] = useState<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]); // Road points

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
        const roadDistance = json.routes[0].distance / 1000; // convert to km
        return { coords, roadDistance };
      }
    } catch (e) {
      console.log("Error fetching road route:", e);
    }
    return null;
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };
  // Fetch current location on mount to show distance to store
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
          
          const storeLat = item.store_lat || item.users?.store_lat;
          const storeLng = item.store_lng || item.users?.store_lng;
          
          if (storeLat && storeLng) {
            const routeData = await fetchRoadRoute(
              parseFloat(storeLat),
              parseFloat(storeLng),
              coords.latitude,
              coords.longitude
            );
            if (routeData) {
              setDistanceToStore(routeData.roadDistance);
            } else {
              const dist = calculateDistance(
                parseFloat(storeLat),
                parseFloat(storeLng),
                coords.latitude,
                coords.longitude
              );
              setDistanceToStore(dist);
            }
          }
        }
      } catch (e) {
        console.log("Error getting initial location", e);
      }
    };
    getInitialLocation();
  }, [item]);
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
        coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setDeliveryLocation(coords);
      } catch (e) {
        console.log("Could not get current location", e);
      }
    }

    if (coords) {
      const storeLat = item.store_lat || item.users?.store_lat;
      const storeLng = item.store_lng || item.users?.store_lng;
      if (storeLat && storeLng) {
        const routeData = await fetchRoadRoute(
          parseFloat(storeLat),
          parseFloat(storeLng),
          coords.latitude,
          coords.longitude
        );
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
    
    // Reverse geocode
    const result = await Location.reverseGeocodeAsync(coords);
    if (result.length > 0) {
      const itemLoc = result[0];
      setDeliveryAddress(`${itemLoc.name || ''}, ${itemLoc.street || ''}, ${itemLoc.city || ''}`.replace(/^, |, $/g, ''));
    }

    if (distance === null || deliveryFee === 0) {
      const storeLat = item.store_lat || item.users?.store_lat;
      const storeLng = item.store_lng || item.users?.store_lng;
      if (storeLat && storeLng) {
        const dist = calculateDistance(
          parseFloat(storeLat), 
          parseFloat(storeLng),
          coords.latitude,
          coords.longitude
        );
        setDistance(dist);
        const fee = Math.max(50, Math.round(50 + dist * 20));
        setDeliveryFee(fee);
      } else {
        setDistance(null);
        setDeliveryFee(50); // Fallback flat fee
      }
    }
  };

  const discountPercent = useMemo(() => {
    const fromApi = item.discountPercent;
    if (typeof fromApi === 'number' && !Number.isNaN(fromApi)) {
      return Math.max(0, Math.round(fromApi));
    }
    const orig = Number(item.original_price);
    const sell = Number(item.selling_price);
    if (!Number.isFinite(orig) || !Number.isFinite(sell) || orig <= 0 || sell >= orig) {
      return 0;
    }
    return Math.round((1 - sell / orig) * 100);
  }, [item.discountPercent, item.original_price, item.selling_price]);

  // Build correct image URL using the API base
  const imageUrl = item.image_url
    ? (item.image_url.startsWith('http') ? item.image_url : `${API_BASE_URL}${item.image_url}`)
    : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c';
    
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

  const handleOrder = async () => {
    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      Alert.alert(
        "Session Expired",
        "Please log in again to place an order.",
        [{ text: "Login", onPress: () => navigation.navigate('Login') }]
      );
      return;
    }

    if (orderType === 'delivery' && !deliveryLocation) {
      Alert.alert('Set Delivery Location', 'Please pick a delivery location on the map first.');
      return;
    }

    if (paymentMethod === 'cod') {
      Alert.alert(
        "Confirm Order",
        orderType === 'delivery'
          ? `Place order for "${item.item_name}" (NPR ${parseFloat(item.selling_price) + deliveryFee})? You will pay cash to the driver on delivery.`
          : `Place order for "${item.item_name}" (NPR ${item.selling_price})? You will pay cash when you pick up at the store.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Place Order", onPress: proceedWithCODOrder }
        ]
      );
      return;
    }

    // Online (Khalti) path
    Alert.alert(
      "Confirm Order",
      `Are you sure you want to order "${item.item_name}" for NPR.${item.selling_price}? You will be redirected to Khalti for payment.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Proceed to Payment", onPress: proceedWithKhaltiOrder }
      ]
    );
  };

  const proceedWithCODOrder = async () => {
    try {
      setOrdering(true);
      const result = await api.request("/api/payment/cod-cart", {
        method: "POST",
        body: JSON.stringify({
          cart_items: [{ listing_id: item.id, quantity: 1 }],
          order_type: 'delivery',
          delivery_lat: deliveryLocation?.latitude,
          delivery_lng: deliveryLocation?.longitude,
          delivery_address: deliveryAddress,
          delivery_fee: deliveryFee,
        }),
      });
      if (result.success) {
        Alert.alert(
          "Order Placed! 🎉",
          `Your order is confirmed. Pay NPR ${deliveryFee > 0 ? parseFloat(item.selling_price) + deliveryFee : item.selling_price} cash to the driver on delivery.`,
          [{ text: "View Orders", onPress: () => navigation.navigate('Orders') }]
        );
      } else {
        Alert.alert("Error", result.message || "Could not place order");
      }
    } catch (error: any) {
      console.error("COD Order Error:", error);
      Alert.alert("Error", error.message || "Something went wrong. Please try again.");
    } finally {
      setOrdering(false);
    }
  };

  const proceedWithKhaltiOrder = async () => {
    try {
      setOrdering(true);

      // Step 1: Initiate payment via backend
      const paymentData = await api.initiatePayment({
        listing_id: item.id,
        order_type: orderType,
        delivery_lat: deliveryLocation?.latitude,
        delivery_lng: deliveryLocation?.longitude,
        delivery_address: deliveryAddress,
        delivery_fee: deliveryFee,
      });

      if (!paymentData.success) {
        Alert.alert("Error", paymentData.message || "Could not start payment");
        return;
      }

      // Step 2: Use openAuthSessionAsync
      const returnUrl = Linking.createURL('/payment/verify');
      await WebBrowser.openAuthSessionAsync(
        paymentData.payment_url as string,
        returnUrl
      );

      // Step 3: Always verify with backend after browser closes.
      const verification = await api.verifyPayment(
        paymentData.pidx as string,
        paymentData.order_id as number
      );

      if (verification.success) {
        navigation.replace('PaymentVerify', {
          pidx: paymentData.pidx,
          order_id: String(paymentData.order_id),
        });
      } else if (verification.payment_status === 'Pending') {
        Alert.alert(
          "Payment Pending",
          "Your payment is still processing. Check your orders shortly.",
          [{ text: "View Orders", onPress: () => navigation.navigate('Orders') }]
        );
      } else {
        try { await api.cancelPayment(paymentData.order_id as number); } catch (_) {}
        Alert.alert("Payment Not Completed", "The payment was not completed. No charge was made.");
      }
    } catch (error: any) {
      console.error("Order Error:", error);
      if (error.message?.includes("Authentication") || error.message?.includes("log in")) {
        Alert.alert("Session Expired", "Please log in again to place an order.",
          [{ text: "Login", onPress: () => navigation.navigate('Login') }]
        );
      } else {
        Alert.alert("Error", error.message || "Something went wrong. Please try again.");
      }
    } finally {
      setOrdering(false);
    }
  };

  // Fallback: Direct order without Khalti (for testing or when Khalti is not configured)
  const handleDirectOrder = async () => {
    // Check if user is authenticated
    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      Alert.alert(
        "Session Expired",
        "Please log in again to place an order.",
        [{ text: "Login", onPress: () => navigation.navigate('Login') }]
      );
      return;
    }

    // Show confirmation dialog
    Alert.alert(
      "Confirm Order",
      `Are you sure you want to order "${item.item_name}" for NPR.${item.selling_price}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Order Now", onPress: proceedWithDirectOrder }
      ]
    );
  };

  const proceedWithDirectOrder = async () => {
    try {
      setOrdering(true);
      const result = await api.placeOrder(item.id);

      if (result.success) {
        Alert.alert(
          "Order Placed! 🎉",
          `Your pickup code is: ${result.order?.pickup_code || '----'}\n\nShow this code at the store to collect your food.`,
          [{ text: "View Orders", onPress: () => navigation.navigate('Orders') }]
        );
      } else {
        Alert.alert("Order Failed", result.message || "Something went wrong.");
      }
    } catch (error: any) {
      console.error("Direct Order Error:", error);
      if (error.message?.includes("Authentication") || error.message?.includes("log in")) {
        Alert.alert(
          "Session Expired",
          "Please log in again to place an order.",
          [{ text: "Login", onPress: () => navigation.navigate('Login') }]
        );
      } else {
        Alert.alert("Error", error.message || "Could not place order.");
      }
    } finally {
      setOrdering(false);
    }
  };

  const handleAddToCart = async () => {
    const cartItem = {
      listing_id: item.id,
      item_name: item.item_name,
      price: parseFloat(item.selling_price),
      image_url: item.image_url,
      store_id: item.users?.id || item.store_id || 0,
      store_name: item.store_name || item.users?.store_name || 'Store',
      quantity: 1,
      max_quantity: item.stock_quantity,
      store_lat: item.store_lat || item.users?.store_lat || null,
      store_lng: item.store_lng || item.users?.store_lng || null
    };
    
    const added = await addToCart(cartItem);
    if (added) {
      Alert.alert(
        "Added to Cart",
        `${item.item_name} has been added to your cart.`,
        [
          { text: "Continue Shopping", style: "cancel" },
          { text: "View Cart", onPress: () => navigation.navigate("Cart") }
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView bounces={false}>
        {/* Header Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.mainImage}
          />
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          {item.is_surprise_bag && (
            <View style={styles.surpriseBadge}>
              <MaterialCommunityIcons name="gift" size={14} color="#fff" />
              <Text style={styles.surpriseBadgeText}>Surprise Bag</Text>
            </View>
          )}
          <TouchableOpacity 
            style={[styles.cartIconContainer, { right: item?.is_surprise_bag ? 130 : 20 }]} 
            onPress={() => navigation.navigate("Cart")}
          >
            <Ionicons name="cart" size={24} color="white" />
            {totalItems > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalItems}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.contentCard}>
          <View style={styles.titleRow}>
            <Text style={styles.itemName}>{item.item_name}</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>{item.category}</Text></View>
          </View>

          <View style={styles.storeRow}>
            <Text style={styles.storeName}>📍 {item.store_name}</Text>
            {distanceToStore !== null && (
              <Text style={styles.distanceText}>
                {distanceToStore.toFixed(2)} km away
              </Text>
            )}
          </View>

          {/* Pricing */}
          <View style={styles.priceContainer}>
            <Text style={styles.sellingPrice}>NPR.{item.selling_price}</Text>
            <Text style={styles.originalPrice}>NPR.{item.original_price}</Text>
            {discountPercent > 0 && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>{discountPercent}% OFF</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Order Info */}
          <View style={styles.infoRow}>
            <View style={styles.infoBox}>
              <MaterialCommunityIcons name="clock-alert-outline" size={24} color="#244F42" />
              <Text style={styles.infoLabel}>Pickup Before</Text>
              <Text style={styles.infoValue}>{formatDeadline(item.rescue_deadline)}</Text>
            </View>
            <View style={styles.infoBox}>
              <MaterialCommunityIcons name="package-variant" size={24} color="#244F42" />
              <Text style={styles.infoLabel}>Stock Left</Text>
              <Text style={styles.infoValue}>{item.stock_quantity} units</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Delivery Option */}
          <Text style={styles.sectionTitle}>Order Type</Text>
          <View style={styles.orderTypeContainer}>
            <TouchableOpacity 
              style={[styles.typeBtn, orderType === 'pickup' && styles.activeTypeBtn]} 
              onPress={() => setOrderType('pickup')}
            >
              <Ionicons name="walk" size={20} color={orderType === 'pickup' ? '#fff' : '#244F42'} />
              <Text style={[styles.typeBtnText, orderType === 'pickup' && styles.activeTypeBtnText]}>Self Pickup</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.typeBtn, orderType === 'delivery' && styles.activeTypeBtn]} 
              onPress={() => setOrderType('delivery')}
            >
              <MaterialCommunityIcons name="bike-fast" size={20} color={orderType === 'delivery' ? '#fff' : '#244F42'} />
              <Text style={[styles.typeBtnText, orderType === 'delivery' && styles.activeTypeBtnText]}>Delivery</Text>
            </TouchableOpacity>
          </View>

          {orderType === 'delivery' && deliveryAddress ? (
            <View style={styles.deliveryInfoCard}>
              <Ionicons name="location" size={20} color="#C62828" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.deliveryAddrTitle}>Deliver to:</Text>
                <Text style={styles.deliveryAddrText} numberOfLines={1}>{deliveryAddress}</Text>
                <Text style={styles.deliveryFeeText}>
                  {distance !== null ? `Distance: ${distance.toFixed(2)} km | ` : ''}Delivery Fee: NPR.{deliveryFee}
                </Text>
              </View>
              <TouchableOpacity onPress={handleDeliverySelect}>
                <Text style={styles.changeText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : orderType === 'delivery' && (
            <TouchableOpacity style={styles.pickLocationBtn} onPress={handleDeliverySelect}>
              <Ionicons name="map-outline" size={20} color="#244F42" />
              <Text style={styles.pickLocationText}>Pick delivery location on map</Text>
            </TouchableOpacity>
          )}

          {/* Payment method — always visible for both pickup and delivery */}
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Payment Method</Text>
          <View style={styles.orderTypeContainer}>
            <TouchableOpacity
              style={[styles.typeBtn, paymentMethod === 'online' && styles.activeTypeBtn]}
              onPress={() => setPaymentMethod('online')}
            >
              <Ionicons name="card-outline" size={20} color={paymentMethod === 'online' ? '#fff' : '#244F42'} />
              <Text style={[styles.typeBtnText, paymentMethod === 'online' && styles.activeTypeBtnText]}>Online (Khalti)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, paymentMethod === 'cod' && styles.activeTypeBtn]}
              onPress={() => setPaymentMethod('cod')}
            >
              <Ionicons name="cash-outline" size={20} color={paymentMethod === 'cod' ? '#fff' : '#244F42'} />
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
          {(item.dietary_preference || item.health_note) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dietary & Health Notes</Text>
              {item.dietary_preference && item.dietary_preference !== 'None' && (
                <View style={styles.dietaryTag}>
                  <Ionicons name="leaf" size={14} color="#2E7D32" />
                  <Text style={styles.dietaryTagText}>{item.dietary_preference}</Text>
                </View>
              )}
              <Text style={styles.sectionText}>
                {item.health_note || 'No specific notes. Please check with the store regarding allergens.'}
              </Text>
            </View>
          )}

          {/* Auto-donate info */}
          {item.auto_donate && (
            <View style={styles.donateInfoBox}>
              <MaterialCommunityIcons name="heart" size={18} color="#C62828" />
              <Text style={styles.donateInfoText}>
                Unsold items will be donated to NGOs after the deadline
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action Footer */}
      <View style={styles.footer}>
        <View style={styles.footerPriceRow}>
          <Text style={styles.footerLabel}>Total</Text>
          <Text style={styles.footerPrice}>NPR.{parseFloat(item.selling_price) + (orderType === 'delivery' ? deliveryFee : 0)}</Text>
        </View>

        <View style={styles.footerButtons}>
          <TouchableOpacity
            style={styles.addToCartBtn}
            onPress={handleAddToCart}
            disabled={ordering}
          >
            <Ionicons name="cart-outline" size={20} color="#244F42" />
            <Text style={styles.addToCartText}>Add to Cart</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.orderBtn, ordering && { opacity: 0.7 }]}
            onPress={handleOrder}
            disabled={ordering}
          >
            {ordering ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.orderBtnText}>
                {paymentMethod === 'cod' ? 'Place Order (COD)' : 'Buy Now'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Map Picker Modal */}
      {showMap && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', zIndex: 1000 }]}>
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setShowMap(false)} style={styles.mapCloseBtn}>
              <Ionicons name="close" size={24} color="#244F42" />
            </TouchableOpacity>
            <Text style={styles.mapTitle}>Set Delivery Location</Text>
            <View style={{ width: 40 }} />
          </View>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={
              deliveryLocation
                ? { ...deliveryLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }
                : { latitude: 27.7172, longitude: 85.3240, latitudeDelta: 0.05, longitudeDelta: 0.05 }
            }
            onRegionChangeComplete={async (region) => {
              const newCoords = {
                latitude: region.latitude,
                longitude: region.longitude,
              };
              setDeliveryLocation(newCoords);
              
              const storeLat = item.store_lat || item.users?.store_lat;
              const storeLng = item.store_lng || item.users?.store_lng;
              if (storeLat && storeLng) {
                const routeData = await fetchRoadRoute(
                  parseFloat(storeLat),
                  parseFloat(storeLng),
                  newCoords.latitude,
                  newCoords.longitude
                );
                if (routeData) {
                  setRouteCoordinates(routeData.coords);
                  setDistance(routeData.roadDistance);
                  const fee = Math.max(50, Math.round(50 + routeData.roadDistance * 20));
                  setDeliveryFee(fee);
                } else {
                  const dist = calculateDistance(
                    parseFloat(storeLat),
                    parseFloat(storeLng),
                    newCoords.latitude,
                    newCoords.longitude
                  );
                  setRouteCoordinates([
                    { latitude: parseFloat(storeLat), longitude: parseFloat(storeLng) },
                    newCoords
                  ]);
                  setDistance(dist);
                  const fee = Math.max(50, Math.round(50 + dist * 20));
                  setDeliveryFee(fee);
                }
              }
            }}
          >
            {/* Store Location */}
            {(item.store_lat || item.users?.store_lat) && (
              <Marker
                coordinate={{
                  latitude: parseFloat(item.store_lat || item.users?.store_lat),
                  longitude: parseFloat(item.store_lng || item.users?.store_lng),
                }}
                title={item.store_name || "Store"}
                description="Store Location"
                pinColor="#244F42"
              />
            )}
            
            {/* Distance Polyline along road */}
            {routeCoordinates.length > 0 && (
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="#244F42"
                strokeWidth={4}
              />
            )}
          </MapView>
        <View style={styles.mapMarkerFixed}>
          <Ionicons name="location" size={40} color="#C62828" />
        </View>
        <View style={styles.mapFooter}>
          <TouchableOpacity 
            style={styles.confirmBtn}
            onPress={() => handleLocationConfirm(deliveryLocation)}
          >
            <Text style={styles.confirmBtnText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  imageContainer: { width: '100%', height: 300 },
  mainImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  backBtn: { position: 'absolute', top: 20, left: 20, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 25, zIndex: 10 },
  surpriseBadge: { position: 'absolute', top: 20, right: 20, backgroundColor: '#F4A71D', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, zIndex: 10 },
  surpriseBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 4 },
  cartIconContainer: { position: 'absolute', top: 20, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 25, zIndex: 10 },
  cartBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#E53935', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  cartBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  contentCard: { flex: 1, backgroundColor: 'white', marginTop: -30, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 24, fontWeight: '800', color: '#244F42', flex: 1 },
  badge: { backgroundColor: '#C8E0C8', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  badgeText: { color: '#244F42', fontSize: 12, fontWeight: '700' },
  storeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  storeName: { fontSize: 16, color: '#757575', flex: 1 },
  distanceText: { fontSize: 14, color: '#244F42', fontWeight: '700' },
  priceContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
  sellingPrice: { fontSize: 22, fontWeight: '900', color: '#27AB34' },
  originalPrice: { fontSize: 16, color: '#757575', textDecorationLine: 'line-through', marginLeft: 10 },
  discountBadge: { backgroundColor: '#F4A71D', marginLeft: 15, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  discountText: { color: 'white', fontWeight: '800', fontSize: 12 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoBox: { width: '48%', backgroundColor: '#F3F4F6', padding: 15, borderRadius: 15, alignItems: 'center' },
  infoLabel: { fontSize: 12, color: '#757575', marginTop: 5 },
  infoValue: { fontSize: 14, fontWeight: '700', color: '#244F42' },
  section: { marginTop: 25 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#244F42' },
  sectionText: { fontSize: 14, color: '#757575', marginTop: 5, lineHeight: 20 },
  dietaryTag: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start' },
  dietaryTagText: { fontSize: 13, color: '#2E7D32', fontWeight: '600', marginLeft: 6 },
  donateInfoBox: { flexDirection: 'row', alignItems: 'center', marginTop: 20, backgroundColor: '#FFF3E0', padding: 12, borderRadius: 12 },
  donateInfoText: { fontSize: 13, color: '#E65100', marginLeft: 8, flex: 1 },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#fff' },
  footerPriceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  footerLabel: { fontSize: 14, color: '#757575' },
  footerPrice: { fontSize: 20, fontWeight: '900', color: '#244F42' },
  footerButtons: { flexDirection: 'row', gap: 10 },
  addToCartBtn: { flex: 1, backgroundColor: '#E8F5E9', height: 50, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#244F42' },
  addToCartText: { color: '#244F42', fontSize: 15, fontWeight: '700', marginLeft: 6 },
  orderBtn: { flex: 1, backgroundColor: '#244F42', height: 50, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  orderBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  
  orderTypeContainer: { flexDirection: 'row', gap: 12, marginTop: 15 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#244F42' },
  activeTypeBtn: { backgroundColor: '#244F42' },
  typeBtnText: { marginLeft: 8, fontSize: 14, fontWeight: '700', color: '#244F42' },
  activeTypeBtnText: { color: '#fff' },
  
  deliveryInfoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 15, borderRadius: 15, marginTop: 15, borderWidth: 1, borderColor: '#eee' },
  deliveryAddrTitle: { fontSize: 12, color: '#757575', fontWeight: '600' },
  deliveryAddrText: { fontSize: 14, color: '#333', fontWeight: '700', marginTop: 2 },
  deliveryFeeText: { fontSize: 13, color: '#27AB34', fontWeight: '700', marginTop: 2 },
  changeText: { fontSize: 13, color: '#244F42', fontWeight: '800', textDecorationLine: 'underline' },
  
  pickLocationBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', height: 48, borderRadius: 12, marginTop: 15 },
  pickLocationText: { marginLeft: 10, fontSize: 14, fontWeight: '600', color: '#244F42' },
  
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee', paddingTop: 40 },
  mapCloseBtn: { padding: 4 },
  mapTitle: { fontSize: 18, fontWeight: 'bold', color: '#244F42' },
  mapMarkerFixed: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -20, elevation: 5 },
  mapFooter: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  confirmBtn: { backgroundColor: '#244F42', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  codNote: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', padding: 10, borderRadius: 10, marginTop: 8, gap: 6 },
  codNoteText: { flex: 1, fontSize: 12, color: '#92400E', fontWeight: '500' },
});

export default FoodDetail;