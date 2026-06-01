import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
  Linking,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import MapView, { Marker, Polyline } from "react-native-maps";
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from "expo-location";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ---------------------------------------------------------------------------
// Routing helpers — defined outside the component so they are never recreated
// ---------------------------------------------------------------------------

/** Fetches a single OSRM driving leg. Returns the route object or null. */
async function fetchLeg(
  lng1: number, lat1: number,
  lng2: number, lat2: number
): Promise<any | null> {
  const coords = `${lng1},${lat1};${lng2},${lat2}`;
  const params = `?overview=full&geometries=geojson`;

  // Attempt 1: OpenStreetMap Germany
  try {
    const url = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coords}${params}`;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
      clearTimeout(tid);
    } catch (e) {
      clearTimeout(tid);
      throw e;
    }
    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.routes?.length > 0) return data.routes[0];
    }
  } catch (e) {
    console.warn("OSM Germany routing failed, trying OSRM demo server...", e);
  }

  // Attempt 2: OSRM Project Demo Server
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}${params}`;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
      clearTimeout(tid);
    } catch (e) {
      clearTimeout(tid);
      throw e;
    }
    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.routes?.length > 0) return data.routes[0];
    }
  } catch (e) {
    console.error("All routing servers failed:", e);
  }

  return null;
}

/** Converts a GeoJSON route object into react-native-maps LatLng array. */
function decodeRoute(route: any): { latitude: number; longitude: number }[] {
  return route.geometry.coordinates.map((coord: number[]) => ({
    latitude: coord[1],
    longitude: coord[0],
  }));
}

// ---------------------------------------------------------------------------

export default function DeliveryTracking({ route, navigation }: any) {
  const { order } = route.params || {};
  const mapRef = useRef<MapView>(null);

  const handleLocateMe = () => {
    mapRef.current?.animateToRegion({
      latitude: driverLoc.latitude,
      longitude: driverLoc.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 1000);
  };

  // Driver's real-time GPS position (default near Lalitpur until GPS resolves)
  const [driverLoc, setDriverLoc] = useState({
    latitude: 27.6560,
    longitude: 85.3400,
  });

  // Memoize store and destination coords so object identity stays stable across renders,
  // preventing the fetchRoutes useEffect from firing on every render cycle.
  const storeLoc = useMemo(() => order
    ? {
        latitude: typeof order.store_lat === 'number' ? order.store_lat : (parseFloat(order.store_lat) || 27.7120),
        longitude: typeof order.store_lng === 'number' ? order.store_lng : (parseFloat(order.store_lng) || 85.3120)
      }
    : { latitude: 27.7120, longitude: 85.3120 },
  [order?.store_lat, order?.store_lng]);

  const destinationLoc = useMemo(() => order
    ? {
        latitude: typeof order.delivery_lat === 'number' ? order.delivery_lat : (parseFloat(order.delivery_lat) || 27.7170),
        longitude: typeof order.delivery_lng === 'number' ? order.delivery_lng : (parseFloat(order.delivery_lng) || 85.3240)
      }
    : { latitude: 27.7170, longitude: 85.3240 },
  [order?.delivery_lat, order?.delivery_lng]);

  // --- STATE FOR FREE ROUTING ---
  const [roadCoords, setRoadCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [distance, setDistance] = useState("2.3");
  const [duration, setDuration] = useState("8");
  const [loadingRoute, setLoadingRoute] = useState(true);

  // Ref so async route fetches that complete after unmount don't call setState.
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // --- OSRM FREE ROUTING FETCH ---
  // Builds the full driver → store → customer path so the driver sees the
  // complete route ahead from their current GPS position.
  const fetchRoutes = useCallback(async (
    currentDriverLoc: { latitude: number; longitude: number }
  ) => {
    if (!isMounted.current) return;
    try {
      setLoadingRoute(true);

      console.log(`[ROUTE] fetchRoutes called`);
      console.log(`[ROUTE] driverLoc  → lat=${currentDriverLoc.latitude}, lng=${currentDriverLoc.longitude}`);
      console.log(`[ROUTE] storeLoc   → lat=${storeLoc.latitude}, lng=${storeLoc.longitude}`);
      console.log(`[ROUTE] destLoc    → lat=${destinationLoc.latitude}, lng=${destinationLoc.longitude}`);

      // Fetch both legs in parallel for speed.
      const [legToStore, legToCustomer] = await Promise.all([
        fetchLeg(
          currentDriverLoc.longitude, currentDriverLoc.latitude,
          storeLoc.longitude, storeLoc.latitude
        ),
        fetchLeg(
          storeLoc.longitude, storeLoc.latitude,
          destinationLoc.longitude, destinationLoc.latitude
        ),
      ]);

      if (!isMounted.current) return;

      console.log(`[ROUTE] legToStore result: ${legToStore ? 'OK' : 'null (fallback)'}`);
      console.log(`[ROUTE] legToCustomer result: ${legToCustomer ? 'OK' : 'null (fallback)'}`);

      let rCoords: { latitude: number; longitude: number }[] = [];
      let dist = 0;
      let dur = 0;

      if (legToStore) {
        rCoords = [...rCoords, ...decodeRoute(legToStore)];
        dist += legToStore.distance;
        dur += legToStore.duration;
      } else {
        rCoords = [...rCoords, currentDriverLoc, storeLoc];
        dist += 1500;
        dur += 300;
      }

      if (legToCustomer) {
        const customerCoords = decodeRoute(legToCustomer);
        rCoords = [...rCoords, ...customerCoords.slice(1)];
        dist += legToCustomer.distance;
        dur += legToCustomer.duration;
      } else {
        rCoords = [...rCoords, destinationLoc];
        dist += 1500;
        dur += 300;
      }

      if (rCoords.length < 2) {
        rCoords = [currentDriverLoc, storeLoc, destinationLoc];
      }

      console.log(`[ROUTE] Final roadCoords length: ${rCoords.length}`);
      console.log(`[ROUTE] First point: lat=${rCoords[0]?.latitude}, lng=${rCoords[0]?.longitude}`);
      console.log(`[ROUTE] Last point:  lat=${rCoords[rCoords.length - 1]?.latitude}, lng=${rCoords[rCoords.length - 1]?.longitude}`);

      setRoadCoords(rCoords);
      setDistance((dist / 1000).toFixed(1));
      setDuration(Math.ceil(dur / 60).toString());

    } catch (error) {
      console.error("Routing error:", error);
      if (isMounted.current) {
        // Hard fallback: straight line through all three points
        setRoadCoords([currentDriverLoc, storeLoc, destinationLoc]);
      }
    } finally {
      if (isMounted.current) setLoadingRoute(false);
    }
  }, [storeLoc, destinationLoc]);

  // Mark ride as started when this screen opens
  useEffect(() => {
    if (order?.order_id) {
      api.driverStartRide(order.order_id).catch(() => {});
    }
  }, []);

  // Fetch real-time GPS location of the driver's device on mount, then kick off
  // route fetching with the resolved position so the polyline starts from the
  // driver's actual location rather than the default placeholder coordinates.
  useEffect(() => {
    const getDriverLiveLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const resolvedLoc = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          console.log(`[GPS] Resolved driver location: lat=${resolvedLoc.latitude}, lng=${resolvedLoc.longitude}`);
          setDriverLoc(resolvedLoc);
          // Fetch route from the real GPS position now that we have it.
          fetchRoutes(resolvedLoc);
        } else {
          Alert.alert(
            "Location Permission Denied",
            "Please enable location services in your device settings to show your real-time driver position."
          );
          console.log(`[GPS] Permission denied — using placeholder coords`);
          // Still draw the route using the default placeholder position.
          fetchRoutes({ latitude: 27.6560, longitude: 85.3400 });
        }
      } catch (error) {
        console.warn("Could not retrieve real-time GPS coordinates:", error);
        console.log(`[GPS] GPS error — using placeholder coords`);
        // Fall back to placeholder position so the map is never empty.
        fetchRoutes({ latitude: 27.6560, longitude: 85.3400 });
      }
    };

    getDriverLiveLocation();
  }, [fetchRoutes]);

  // --- BOTTOM SHEET ANIMATION ---
  const MIN_HEIGHT = SCREEN_HEIGHT * 0.55;
  const MAX_HEIGHT = 80;
  const pan = useRef(new Animated.Value(MIN_HEIGHT)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset((pan as any)._value);
        pan.setValue(0);
      },
      onPanResponderMove: Animated.event([null, { dy: pan }], { useNativeDriver: false }),
      onPanResponderRelease: (e, gesture) => {
        pan.flattenOffset();
        const finalY = (pan as any)._value;
        if (finalY < SCREEN_HEIGHT * 0.4) {
          Animated.spring(pan, { toValue: MAX_HEIGHT, useNativeDriver: false, bounciness: 0 }).start();
        } else {
          Animated.spring(pan, { toValue: MIN_HEIGHT, useNativeDriver: false, bounciness: 0 }).start();
        }
      },
    })
  ).current;

  const openExternalMaps = (lat: number, lng: number, label: string) => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lng}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });
    if (url) Linking.openURL(url);
  };

  // Find camera framing boundaries specifically for the delivery route (Store & Customer) to ensure perfect zoom visibility
  const minLat = Math.min(storeLoc.latitude, destinationLoc.latitude);
  const maxLat = Math.max(storeLoc.latitude, destinationLoc.latitude);
  const minLng = Math.min(storeLoc.longitude, destinationLoc.longitude);
  const maxLng = Math.max(storeLoc.longitude, destinationLoc.longitude);

  console.log(`[RENDER] roadCoords.length=${roadCoords.length}, loadingRoute=${loadingRoute}`);

  return (
    <View style={styles.container}>
      <SafeAreaView style={StyleSheet.absoluteFill} edges={['top']}>
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={{
              latitude: (minLat + maxLat) / 2,
              longitude: (minLng + maxLng) / 2,
              latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.02),
              longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.02),
            }}
          >
            {/* SOLID ROAD ROUTE POLYLINE FROM DRIVER → STORE → CUSTOMER */}
            {roadCoords.length > 1 && (
              <Polyline
                coordinates={roadCoords}
                strokeColor="#244F42"
                strokeWidth={6}
              />
            )}

            {/* 1. DRIVER MARKER */}
            <Marker coordinate={driverLoc} title="You (Driver)">
              <View style={styles.driverMarker}><Ionicons name="bicycle" size={18} color="white" /></View>
            </Marker>

            {/* 2. PICKUP STORE MARKER */}
            <Marker coordinate={storeLoc} title={order?.store_name || "Pickup Store"}>
              <View style={styles.storeMarker}><Ionicons name="storefront" size={18} color="white" /></View>
            </Marker>

            {/* 3. CUSTOMER DELIVERY MARKER */}
            <Marker coordinate={destinationLoc} title={order?.customer_name || "Customer"}>
              <View style={styles.customerMarker}><Ionicons name="person" size={18} color="white" /></View>
            </Marker>
          </MapView>
          
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#244F42" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.locateButton} onPress={handleLocateMe} activeOpacity={0.8}>
            <Ionicons name="locate" size={24} color="#244F42" />
          </TouchableOpacity>

          {loadingRoute && (
            <View style={styles.mapLoader}>
              <ActivityIndicator color="#244F42" />
            </View>
          )}
        </View>
      </SafeAreaView>

      <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: pan }] }]}>
        <View style={styles.dragHandleContainer} {...panResponder.panHandlers}>
          <View style={styles.dragHandle} />
        </View>
        
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          bounces={false} 
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
        >
          {/* ETA CARD WITH DYNAMIC DATA */}
          <View style={styles.etaCard}>
            <View style={styles.etaInfo}>
              <Text style={styles.etaLabel}>Total Active Route</Text>
              <Text style={styles.etaValue}>{duration} mins</Text>
              <Text style={styles.timeText}><Ionicons name="navigate-outline" size={12} /> Combined Two-Leg Paths</Text>
            </View>
            <View style={styles.distInfo}>
              <Text style={styles.etaLabel}>Total Distance</Text>
              <Text style={styles.etaValue}>{distance} km</Text>
            </View>
          </View>

          {/* DELIVERY DETAILS */}
          <View style={styles.whiteSectionCard}>
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 15}}>
                <MaterialCommunityIcons name="truck-delivery-outline" size={20} color="#244F42" />
                <Text style={styles.sectionTitleHeader}>Delivery details</Text>
            </View>
            
            <View style={styles.locRow}>
               <View style={styles.dotGreenOuter}><View style={styles.dotGreenInner} /></View>
               <View style={styles.textStack}>
                  <Text style={styles.locLabel}>PICKUP FROM (RESTAURANT)</Text>
                  <Text style={styles.locName}>{order?.store_name || "Himalayan Java Coffee"}</Text>
                  <Text style={styles.locSubText}>{order?.store_address || "Tridevi Marg, Thamel"}</Text>
                  <View style={styles.statusPill}><Text style={styles.statusText}>Ready for Pickup</Text></View>
               </View>
            </View>
            
            <View style={styles.lineConnector} />
            
            <View style={styles.locRow}>
               <View style={styles.dotRedOuter}><Ionicons name="location" size={14} color="#F44336" /></View>
               <View style={styles.textStack}>
                  <Text style={styles.locLabel}>DELIVER TO (CUSTOMER)</Text>
                  <Text style={styles.locName}>{order?.customer_name || "Rajesh Sharma"}</Text>
                  <Text style={styles.locSubText}>{order?.delivery_address || "Naxal, Kathmandu"}</Text>
                  <Text style={styles.phoneText}><Ionicons name="call-outline" size={12} /> {order?.customer_phone || "+977 98xxxxxxxx"}</Text>
               </View>
            </View>
          </View>

          {/* ORDER ITEMS */}
          <Text style={styles.sectionTitle}>Order Items</Text>
          <View style={styles.itemCard}>
            <View style={styles.itemMainRow}>
              <View style={styles.itemImagePlaceholder}>
                <Ionicons name="fast-food-outline" size={24} color="#244F42" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.itemName}>{order?.item_name || "Coffee & Bakery Bag"}</Text>
                <Text style={styles.itemSub}>Deliver Earning: NPR {order?.delivery_fee || 150}</Text>
              </View>
              <Text style={styles.itemPrice}>NPR {order?.selling_price || 250}</Text>
            </View>
            <View style={styles.paymentBanner}>
               <MaterialCommunityIcons name="wallet-outline" size={16} color="#B45309" />
               <Text style={styles.paymentText}>Earning credited upon completion</Text>
            </View>
          </View>

          {/* TURN BY TURN NAVIGATION */}
          <Text style={styles.sectionTitle}>Turn-by-Turn Navigation</Text>
          <View style={styles.navCard}>
            <TouchableOpacity style={styles.navRow} onPress={() => openExternalMaps(storeLoc.latitude, storeLoc.longitude, order?.store_name || "Store")}>
              <View style={styles.blueIconBg}><Ionicons name="navigate" size={16} color="#4A90E2" /></View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.navMain}>Go to Pickup Location</Text>
                <Text style={styles.navSub}>{order?.store_address || "Click to open maps"}</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.navRow, { borderBottomWidth: 0 }]} onPress={() => openExternalMaps(destinationLoc.latitude, destinationLoc.longitude, "Delivery Address")}>
              <View style={styles.grayIconBg}>
                <MaterialCommunityIcons name="arrow-right-top" size={18} color="#6B7280" />
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.navMain}>Deliver to Customer Address</Text>
                <Text style={styles.navSub}>{order?.delivery_address || "Click to open maps"}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ACTION BUTTONS */}
          <TouchableOpacity 
            style={styles.callButton} 
            onPress={() => Linking.openURL(`tel:${order?.customer_phone || "+9779800000000"}`)}
          >
            <Ionicons name="call" size={20} color="#244F42" />
            <Text style={styles.callButtonText}>Call Customer</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.deliverButton} 
            onPress={async () => {
              try {
                if (order?.order_id) {
                  const res = await api.driverDeliverOrder(order.order_id);
                  if (!res.success) {
                    Alert.alert("Error", res.message || "Could not mark as delivered");
                    return;
                  }
                }
                // Clear local cache before going back so dashboard re-fetches correctly
                await AsyncStorage.removeItem("active_order");
                Alert.alert("Success! 🎉", "Delivery completed successfully.", [
                  { text: "OK", onPress: () => navigation.goBack() }
                ]);
              } catch (e: any) {
                Alert.alert("Error", e.message || "Could not complete delivery");
              }
            }}
          >
            <MaterialCommunityIcons name="package-variant-closed" size={20} color="#E8E8CC" />
            <Text style={styles.deliverButtonText}>Mark as Delivered</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.reportButton} onPress={() => Alert.alert("Issue Reported", "Support will contact you shortly.")}>
            <Text style={styles.reportText}>Report Issue</Text>
          </TouchableOpacity>
          
          <View style={{ height: 100 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  mapContainer: { flex: 1 },
  mapLoader: { position: 'absolute', top: 70, right: 20, backgroundColor: '#fff', padding: 8, borderRadius: 20, elevation: 5 },
  backButton: { position: 'absolute', top: 10, left: 20, backgroundColor: '#fff', padding: 10, borderRadius: 25, elevation: 5, zIndex: 10 },
  locateButton: {
    position: 'absolute',
    bottom: SCREEN_HEIGHT * 0.46,
    right: 20,
    backgroundColor: '#fff',
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 10,
  },
  driverMarker: { backgroundColor: '#3F51B5', padding: 6, borderRadius: 20, borderWidth: 2, borderColor: '#fff' },
  storeMarker: { backgroundColor: '#244F42', padding: 6, borderRadius: 20, borderWidth: 2, borderColor: '#fff' },
  customerMarker: { backgroundColor: '#F44336', padding: 6, borderRadius: 20, borderWidth: 2, borderColor: '#fff' },
  
  bottomSheet: { 
    position: 'absolute', left: 0, right: 0, bottom: 0, height: SCREEN_HEIGHT, 
    backgroundColor: '#F8F9FA', borderTopLeftRadius: 30, borderTopRightRadius: 30,
    elevation: 25, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10,
  },
  dragHandleContainer: { width: '100%', height: 35, alignItems: 'center', justifyContent: 'center' },
  dragHandle: { width: 40, height: 5, backgroundColor: '#00000015', borderRadius: 3 },
  scrollContent: { paddingHorizontal: 20 },

  etaCard: { backgroundColor: '#D1E3D7', borderRadius: 20, padding: 20, flexDirection: 'row', marginBottom: 20 },
  etaInfo: { flex: 1, borderRightWidth: 1, borderRightColor: '#244F4215' },
  distInfo: { paddingLeft: 20, justifyContent: 'center' },
  etaLabel: { fontSize: 13, color: '#244F42', opacity: 0.7 },
  etaValue: { fontSize: 24, fontWeight: 'bold', color: '#244F42' },
  timeText: { fontSize: 13, color: '#244F42', marginTop: 8, fontWeight: '500' },

  whiteSectionCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, elevation: 1, marginBottom: 15 },
  sectionTitleHeader: { fontSize: 16, fontWeight: 'bold', color: '#244F42', marginLeft: 10 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#374151', marginVertical: 12, marginLeft: 5 },
  
  locRow: { flexDirection: 'row', alignItems: 'flex-start' },
  textStack: { marginLeft: 15, flex: 1 },
  dotGreenOuter: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  dotGreenInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#059669' },
  dotRedOuter: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  lineConnector: { width: 1, height: 30, backgroundColor: '#E5E7EB', marginLeft: 11, marginVertical: 4 },
  
  locLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: 'bold' },
  locName: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  locSubText: { fontSize: 13, color: '#6B7280' },
  statusPill: { backgroundColor: '#D1FAE5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 8, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, color: '#059669', fontWeight: 'bold' },
  phoneText: { fontSize: 14, color: '#244F42', marginTop: 5, fontWeight: '500' },

  itemCard: { backgroundColor: '#fff', borderRadius: 20, padding: 15, elevation: 1 },
  itemMainRow: { flexDirection: 'row', alignItems: 'center' },
  itemImagePlaceholder: { width: 50, height: 50, backgroundColor: '#F3F4F6', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 15, fontWeight: 'bold', color: '#111827' },
  itemSub: { fontSize: 12, color: '#9CA3AF' },
  itemPrice: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  paymentBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', marginTop: 15, padding: 10, borderRadius: 10 },
  paymentText: { fontSize: 12, color: '#92400E', marginLeft: 8, fontWeight: '500' },

  navCard: { backgroundColor: '#fff', borderRadius: 20, padding: 15, elevation: 1 },
  navRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  blueIconBg: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  grayIconBg: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  navMain: { fontSize: 14, color: '#374151', fontWeight: '500' },
  navSub: { fontSize: 12, color: '#9CA3AF' },

  callButton: { backgroundColor: '#F5A623', height: 55, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  callButtonText: { color: '#244F42', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  deliverButton: { backgroundColor: '#244F42', height: 55, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  deliverButtonText: { color: '#E8E8CC', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  reportButton: { height: 60, justifyContent: 'center', alignItems: 'center', marginTop: 15, borderRadius: 15, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  reportText: { color: '#6B7280', fontSize: 15, fontWeight: '500' }
});