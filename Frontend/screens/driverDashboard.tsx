import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Switch,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { api } from "../services/api";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from "@react-navigation/native";

export default function DriverDashboard({ navigation }: any) {
  const [isOnline, setIsOnline] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [driverName, setDriverName] = useState("Suraj Rai");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Dynamic Driver stats
  const [deliveriesCount, setDeliveriesCount] = useState(12);
  const [earnings, setEarnings] = useState(2400);

  const fetchOrders = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await api.getDriverOrders();
      if (response.success && response.orders) {
        setOrders(response.orders);
      }
    } catch (error: any) {
      console.error("Error fetching driver orders:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch the driver's active order from the backend — source of truth
  const fetchActiveOrder = async () => {
    try {
      const res = await api.getDriverActiveOrder();
      if (res.success) {
        if (res.order) {
          setActiveOrder(res.order);
          await AsyncStorage.setItem("active_order", JSON.stringify(res.order));
        } else {
          setActiveOrder(null);
          await AsyncStorage.removeItem("active_order");
        }
      }
    } catch (e) {
      // Fall back to AsyncStorage if network fails
      try {
        const stored = await AsyncStorage.getItem("active_order");
        setActiveOrder(stored ? JSON.parse(stored) : null);
      } catch (_) {}
    }
  };

  useFocusEffect(
    useCallback(() => {
      const loadDriverProfile = async () => {
        try {
          const profileRes = await api.getMe();
          if (profileRes && profileRes.user) {
            setDriverName(profileRes.user.full_name || "Driver");
          } else {
            const userData = await AsyncStorage.getItem("user");
            if (userData) setDriverName(JSON.parse(userData).full_name || "Driver");
          }
        } catch (e) {
          const userData = await AsyncStorage.getItem("user");
          if (userData) setDriverName(JSON.parse(userData).full_name || "Driver");
        }
      };

      loadDriverProfile();
      fetchActiveOrder();
      fetchOrders();

      // Poll every 15 seconds while screen is focused
      const interval = setInterval(() => {
        fetchActiveOrder();
        fetchOrders(false);
      }, 15000);

      return () => clearInterval(interval);
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchActiveOrder();
    fetchOrders(false);
  };

  const handleAcceptOrder = (order: any) => {
    if (!isOnline) {
      Alert.alert("Offline", "Please go online to accept delivery orders.");
      return;
    }
    if (activeOrder) {
      Alert.alert("Active Delivery", "You already have an active delivery. Complete it first.");
      return;
    }

    Alert.alert(
      "Accept Order",
      `Accept order #ORD-${order.order_id}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            try {
              const res = await api.driverAcceptOrder(order.order_id);
              if (!res.success) {
                Alert.alert("Error", res.message || "Could not accept order");
                return;
              }
              // Fetch the canonical active order from backend and refresh available list
              await fetchActiveOrder();
              await fetchOrders();
              Alert.alert(
                "Order Accepted! 🎉",
                `Go to pickup location:\n${order.store_name}\n${order.store_address}`
              );
            } catch (e: any) {
              Alert.alert("Error", e.message || "Could not accept order");
            }
          }
        }
      ]
    );
  };

  const handleCompleteDelivery = () => {
    if (!activeOrder) return;

    Alert.alert(
      "Complete Delivery",
      "Confirm that you have successfully delivered this order to the customer.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              const res = await api.driverDeliverOrder(activeOrder.order_id);
              if (!res.success) {
                Alert.alert("Error", res.message || "Could not mark as delivered");
                return;
              }
              const earnedAmount = parseFloat(activeOrder.delivery_fee) || 150;
              setDeliveriesCount(prev => prev + 1);
              setEarnings(prev => prev + earnedAmount);
              await AsyncStorage.removeItem("active_order");
              setActiveOrder(null);
              await fetchOrders();
              Alert.alert("Success! 🚀", `Delivery completed. You earned NPR ${earnedAmount}!`);
            } catch (e: any) {
              Alert.alert("Error", e.message || "Could not complete delivery");
            }
          }
        }
      ]
    );
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning,";
    if (hour < 17) return "Good afternoon,";
    return "Good evening,";
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      
      {/* TOP SECTION: GREETING & TOGGLE */}
      <View style={styles.topContainer}>
        <View style={styles.headerRow}>
          <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={() => navigation.navigate("DriverProfile")}
          >
            <Text style={styles.greetingText}>{getGreeting()}</Text>
            <Text style={styles.driverName}>{driverName}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.onlineToggleCard}>
          <View>
            <Text style={styles.onlineStatusText}>{isOnline ? "You’re Online" : "You’re Offline"}</Text>
            <Text style={styles.onlineSubText}>
              {isOnline ? "Ready to accept orders" : "Go online to start earning"}
            </Text>
          </View>
          <Switch
            trackColor={{ false: "#767577", true: "#E8E8CC" }}
            thumbColor={isOnline ? "#F5A623" : "#f4f3f4"}
            onValueChange={() => setIsOnline(!isOnline)}
            value={isOnline}
          />
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        bounces={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#244F42" />
        }
      >
        {/* TODAY'S SUMMARY */}
        <Text style={styles.sectionTitle}>Today’s Summary</Text>
        <TouchableOpacity 
          style={styles.summaryRow} 
          activeOpacity={0.9}
          onPress={() => navigation.navigate("DriverProfile")}
        >
          <View style={styles.summaryCard}>
            <View style={[styles.iconBox, { backgroundColor: '#E0F2F1' }]}><Ionicons name="cube-outline" size={20} color="#244F42" /></View>
            <Text style={styles.summaryValue}>{deliveriesCount}</Text>
            <Text style={styles.summaryLabel}>Deliveries</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.iconBox, { backgroundColor: '#FFF8E1' }]}><FontAwesome5 name="wallet" size={16} color="#F5A623" /></View>
            <Text style={styles.summaryValue}>NPR {earnings}</Text>
            <Text style={styles.summaryLabel}>Earned</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={[styles.iconBox, { backgroundColor: '#E8EAF6' }]}><Ionicons name="time-outline" size={20} color="#3F51B5" /></View>
            <Text style={styles.summaryValue}>6h 30m</Text>
            <Text style={styles.summaryLabel}>Online</Text>
          </View>
        </TouchableOpacity>

        {/* ACTIVE ORDER */}
        <Text style={styles.sectionTitle}>Active Order</Text>
        {activeOrder ? (
          <View style={styles.activeOrderCard}>
            <View style={styles.orderHeader}>
              <Text style={styles.orderId}>#ORD-{activeOrder.order_id}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {activeOrder.payment_method === 'cod' && (
                  <View style={styles.codBadge}>
                    <Ionicons name="cash-outline" size={12} color="#8B6914" />
                    <Text style={styles.codBadgeText}>COD</Text>
                  </View>
                )}
                <View style={[
                  styles.statusBadge,
                  activeOrder.status === 'on_the_way' && { backgroundColor: 'rgba(59,130,246,0.15)' }
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    activeOrder.status === 'on_the_way' && { color: '#3B82F6' }
                  ]}>
                    {activeOrder.status === 'on_the_way' ? 'On the Way 🚴' : 'Accepted'}
                  </Text>
                </View>
              </View>
            </View>
            
            <View style={styles.routeRow}>
              <View style={styles.routeIcons}>
                <View style={styles.dotGreen} />
                <View style={styles.lineDashed} />
                <View style={styles.dotRed} />
              </View>
              <View style={styles.routeDetails}>
                <Text style={styles.locationLabel}>Pickup From</Text>
                <Text style={styles.locationName}>{activeOrder.store_name}</Text>
                <Text style={styles.locationSub}>{activeOrder.store_address}</Text>
                
                <View style={{ height: 15 }} />
                
                <Text style={styles.locationLabel}>Deliver to</Text>
                <Text style={styles.locationName}>{activeOrder.customer_name}</Text>
                <Text style={styles.locationSub}>{activeOrder.delivery_address}</Text>
              </View>
            </View>

            {/* Action Buttons & Contact Block */}
            <View style={{ marginTop: 20, paddingHorizontal: 5 }}>
              {/* START RIDE / ON THE WAY BUTTON */}
              {activeOrder.status === 'on_the_way' ? (
                <View style={[styles.startRideBtn, { backgroundColor: '#244F42', opacity: 1 }]}>
                  <Ionicons name="bicycle" size={22} color="#E8E8CC" />
                  <Text style={[styles.startRideBtnText, { color: '#E8E8CC' }]}>On the Way 🚴</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.startRideBtn}
                  onPress={async () => {
                    try {
                      const res = await api.driverStartRide(activeOrder.order_id);
                      if (res.success) {
                        // Update local state immediately so button changes without waiting for poll
                        const updated = { ...activeOrder, status: 'on_the_way' };
                        setActiveOrder(updated);
                        await AsyncStorage.setItem("active_order", JSON.stringify(updated));
                      }
                    } catch (e) {
                      // Still navigate even if API call fails
                    }
                    navigation.navigate("DeliveryTracking", { order: activeOrder });
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="navigate-circle" size={22} color="#244F42" />
                  <Text style={styles.startRideBtnText}>Start Ride</Text>
                </TouchableOpacity>
              )}

              {/* CALL CUSTOMER INTERACTIVE SECTION */}
              <View style={{ alignItems: "center", marginVertical: 10 }}>
                {activeOrder.customer_phone ? (
                  <TouchableOpacity 
                    style={styles.etaRow}
                    onPress={() => Linking.openURL(`tel:${activeOrder.customer_phone}`)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="call" size={18} color="#244F42" />
                    <Text style={[styles.etaText, { color: '#244F42', fontWeight: 'bold', textDecorationLine: 'underline' }]}>
                      Call Customer: {activeOrder.customer_phone}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.etaRow}>
                    <Ionicons name="call-outline" size={18} color="#666" />
                    <Text style={styles.etaText}>Contact: N/A</Text>
                  </View>
                )}
              </View>
            </View>

            <TouchableOpacity 
              style={styles.completeBtn}
              onPress={handleCompleteDelivery}
            >
              <Text style={styles.completeBtnText}>Complete Delivery</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noActiveCard}>
            <Ionicons name="information-circle-outline" size={24} color="#888" />
            <Text style={styles.noActiveText}>No active deliveries. Accept an available order below!</Text>
          </View>
        )}

        {/* AVAILABLE ORDERS */}
        <Text style={styles.sectionTitle}>Available Orders (Placed by Users)</Text>
        
        {!isOnline ? (
          <View style={styles.offlineContainer}>
            <MaterialCommunityIcons name="cloud-off-outline" size={48} color="#9CA3AF" />
            <Text style={styles.offlineText}>You are offline</Text>
            <Text style={styles.offlineSub}>Go online to see available orders</Text>
          </View>
        ) : loading ? (
          <ActivityIndicator size="large" color="#244F42" style={{ marginVertical: 30 }} />
        ) : orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="bicycle-outline" size={48} color="#CCC" />
            <Text style={styles.emptyText}>No available delivery orders right now</Text>
          </View>
        ) : (
          orders.map((item) => (
            <View key={item.order_id} style={styles.availableCard}>
              <Text style={styles.orderIdSmall}>#ORD-{item.order_id}</Text>
              
              <Text style={styles.locationLabel}>Pickup From</Text>
              <Text style={styles.storeNameText}>{item.store_name}</Text>
              <Text style={styles.locationSubText}>{item.store_address}</Text>

              <Text style={styles.locationLabel}>Deliver To</Text>
              <Text style={styles.customerNameText}>{item.customer_name}</Text>
              <Text style={styles.locationSubText}>{item.delivery_address}</Text>
              
              <View style={styles.availFooter}>
                <View style={styles.distRow}>
                  <Ionicons name="wallet-outline" size={14} color="#666" />
                  <Text style={styles.distText}>Earning: NPR {item.delivery_fee}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {item.payment_method === 'cod' && (
                    <View style={styles.codBadge}>
                      <Ionicons name="cash-outline" size={12} color="#8B6914" />
                      <Text style={styles.codBadgeText}>Cash on Delivery</Text>
                    </View>
                  )}
                  <Text style={styles.priceText}>NPR {item.selling_price}</Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.acceptBtn}
                onPress={() => handleAcceptOrder(item)}
              >
                <Text style={styles.acceptBtnText}>Accept Order</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* BOTTOM NAVIGATION FOOTER */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="home" size={26} color="#E8E8CC" />
          <Text style={[styles.navText, { color: '#E8E8CC' }]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("DriverProfile")}
        >
          <Ionicons name="person" size={26} color="#FFFFFF" />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  topContainer: { backgroundColor: "#244F42", paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 20 : 10, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingBottom: 30 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, marginTop: 15 },
  greetingText: { color: 'rgba(232, 232, 204, 0.7)', fontSize: 14 },
  driverName: { color: '#E8E8CC', fontSize: 22, fontWeight: 'bold' },
  notificationBtn: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 12 },
  notifBadge: { position: 'absolute', top: 10, right: 12, width: 8, height: 8, backgroundColor: '#F5A623', borderRadius: 4, borderWidth: 1, borderColor: '#244F42' },
  
  onlineToggleCard: { backgroundColor: 'rgba(232, 232, 204, 0.1)', borderRadius: 20, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(232, 232, 204, 0.2)' },
  onlineStatusText: { color: '#E8E8CC', fontSize: 18, fontWeight: 'bold' },
  onlineSubText: { color: 'rgba(232, 232, 204, 0.7)', fontSize: 12, marginTop: 2 },

  scrollContent: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#244F42', marginBottom: 15, marginTop: 10 },
  
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  summaryCard: { flex: 0.31, backgroundColor: '#fff', borderRadius: 16, padding: 15, alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  summaryValue: { fontSize: 15, fontWeight: 'bold', color: '#244F42' },
  summaryLabel: { fontSize: 10, color: '#999', marginTop: 2 },

  activeOrderCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 25, borderWidth: 2, borderColor: '#F5A623', elevation: 4 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  orderId: { fontSize: 14, fontWeight: 'bold', color: '#666' },
  routeRow: { flexDirection: 'row', marginBottom: 20 },
  routeIcons: { alignItems: 'center', width: 20, marginRight: 15, paddingTop: 5 },
  dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#4CAF50', borderWidth: 2, borderColor: '#C8E6C9' },
  dotRed: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F44336', borderWidth: 2, borderColor: '#FFCDD2' },
  lineDashed: { width: 2, flex: 1, backgroundColor: '#EEE', marginVertical: 4 },
  routeDetails: { flex: 1 },
  locationLabel: { fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 1 },
  locationName: { fontSize: 16, fontWeight: 'bold', color: '#244F42', marginTop: 2 },
  locationSub: { fontSize: 13, color: '#666', marginTop: 2 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 15 },
  etaRow: { flexDirection: 'row', alignItems: 'center' },
  etaText: { marginLeft: 8, fontSize: 14, color: '#666' },
  startRideBtn: {
    backgroundColor: "#F5A623",
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  startRideBtnText: {
    color: "#244F42",
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 8,
  },

  completeBtn: { backgroundColor: '#244F42', width: '100%', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 5 },
  completeBtnText: { color: '#E8E8CC', fontWeight: 'bold', fontSize: 16 },

  noActiveCard: { padding: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderRadius: 20, borderStyle: 'dashed', borderWidth: 1, borderColor: '#CCC', marginBottom: 25 },
  noActiveText: { fontSize: 14, color: '#888', textAlign: 'center', marginTop: 8 },

  emptyContainer: { padding: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderRadius: 20, marginVertical: 10 },
  emptyText: { fontSize: 14, color: '#999', marginTop: 10, textAlign: 'center' },

  availableCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 15, elevation: 2 },
  orderIdSmall: { fontSize: 12, color: '#CCC', marginBottom: 10 },
  storeNameText: { fontSize: 18, fontWeight: 'bold', color: '#244F42', marginTop: 2 },
  customerNameText: { fontSize: 18, fontWeight: 'bold', color: '#244F42', marginTop: 2 },
  locationSubText: { fontSize: 13, color: '#999', marginBottom: 15 },
  availFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  distRow: { flexDirection: 'row', alignItems: 'center' },
  distText: { fontSize: 13, color: '#666', marginLeft: 5 },
  priceText: { fontSize: 18, fontWeight: 'bold', color: '#244F42' },
  acceptBtn: { backgroundColor: '#F5A623', width: '100%', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  acceptBtnText: { color: '#244F42', fontWeight: 'bold', fontSize: 16 },

  statusBadge: { backgroundColor: 'rgba(76, 175, 80, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusBadgeText: { color: '#4CAF50', fontSize: 12, fontWeight: 'bold' },

  offlineContainer: { padding: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderRadius: 20, marginVertical: 10, borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  offlineText: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginTop: 10 },
  offlineSub: { fontSize: 13, color: '#6B7280', marginTop: 5, textAlign: 'center', marginBottom: 20 },
  goOnlineBtn: { backgroundColor: '#244F42', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 12 },
  goOnlineBtnText: { color: '#E8E8CC', fontWeight: 'bold', fontSize: 15 },

  // Consistent Bottom Navigation Footer
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', height: 85, backgroundColor: '#244F42', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 10 },
  navItem: { alignItems: "center", justifyContent: "center" },
  navText: { fontSize: 10, marginTop: 4, fontWeight: '600', color: '#FFFFFF' },

  // COD badge
  codBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(139,105,20,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  codBadgeText: { fontSize: 10, color: '#8B6914', fontWeight: '800' },
});