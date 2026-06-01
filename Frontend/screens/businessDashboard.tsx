import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
  ImageBackground,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { api, API_BASE_URL } from "../services/api";

type Props = { navigation: any };

interface Listing {
  id: number;
  item_name: string;
  category: string;
  original_price: number;
  selling_price: number;
  stock_quantity: number;
  is_surprise_bag?: boolean;
  dietary_preference?: string | null;
  health_note?: string | null;
  rescue_deadline?: string | null;
  auto_donate?: boolean;
  image_url?: string | null;
  is_active?: boolean;
}

interface StoreOrder {
  order_id: number;
  status: string;
  ordered_at: string;
  pickup_code: string;
  item_name: string;
  image_url?: string | null;
  selling_price: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  order_type?: string;
}

export default function BusinessDashboard({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [businessData, setBusinessData] = useState({
    id: null as number | null,
    store_name: "Loading...",
    store_location: "Kathmandu, Nepal",
    profile_image: null as string | null,
    cover_image: null as string | null,
  });
  const [listings, setListings] = useState<Listing[]>([]);
  const [recentOrders, setRecentOrders] = useState<StoreOrder[]>([]);

  // Analytics state — fetched from /api/analytics/business/:storeId
  const [analyticsOverview, setAnalyticsOverview] = useState({
    active_listings: 0,
    total_orders: 0,
    completed_orders: 0,
  });
  const [analyticsRevenue, setAnalyticsRevenue] = useState({
    total: 0,
    this_week: 0,
  });
  const [analyticsDonations, setAnalyticsDonations] = useState({
    total: 0,
    picked_up: 0,
  });

  useEffect(() => { loadDashboard(); }, []);
  useFocusEffect(useCallback(() => { loadDashboard(); }, []));

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const savedUser = await AsyncStorage.getItem("user");
      if (!savedUser) { Alert.alert("Session Error", "Please log in again."); return; }
      const user = JSON.parse(savedUser);
      setBusinessData({
        id: user.id || null,
        store_name: user.store_name || "New Store",
        store_location: user.store_address || "Kathmandu, Nepal",
        profile_image: user.profile_image || null,
        cover_image: user.cover_image || null,
      });

      const [listingResult, orderResult, analyticsResult] = await Promise.all([
        api.getMyListings(),
        api.getStoreOrders(user.id),
        api.getBusinessAnalytics(user.id),
      ]);

      setListings(listingResult.success ? listingResult.listings || [] : []);
      setRecentOrders(orderResult.success ? orderResult.orders || [] : []);

      if (analyticsResult.success && analyticsResult.analytics) {
        const a = analyticsResult.analytics;
        setAnalyticsOverview({
          active_listings: a.overview?.active_listings ?? 0,
          total_orders: a.overview?.total_orders ?? 0,
          completed_orders: a.overview?.completed_orders ?? 0,
        });
        setAnalyticsRevenue({
          total: a.revenue?.total ?? 0,
          this_week: a.revenue?.this_week ?? 0,
        });
        setAnalyticsDonations({
          total: a.donations?.total ?? 0,
          picked_up: a.donations?.picked_up ?? 0,
        });
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async (type: "profile" | "cover") => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission Denied", "We need access to your photos."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === "profile" ? [1, 1] : [16, 9],
      quality: 0.5,
    });
    if (!result.canceled) uploadBrandingImage(result.assets[0].uri, type);
  };

  const uploadBrandingImage = async (uri: string, type: "profile" | "cover") => {
    try {
      setUploading(true);
      const savedUser = await AsyncStorage.getItem("user");
      const user = JSON.parse(savedUser || "{}");
      const formData = new FormData();
      const filename = uri.split("/").pop() || "image.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const fileType = match ? `image/${match[1]}` : "image/jpeg";
      formData.append("image", { uri, name: filename, type: fileType } as any);
      formData.append("type", type);
      formData.append("userId", user.id.toString());
      const data = await api.updateBranding(formData);
      if (data.success) {
        const updatedUser = { ...user, [type === "profile" ? "profile_image" : "cover_image"]: data.path };
        await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
        setBusinessData((prev) => ({
          ...prev,
          [type === "profile" ? "profile_image" : "cover_image"]: data.path,
        }));
        Alert.alert("Success", "Branding updated!");
      } else {
        Alert.alert("Error", data.message || "Failed to update branding.");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Server connection failed");
    } finally {
      setUploading(false);
    }
  };

  const getImageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return `${API_BASE_URL}${path}`;
  };

  const activeListings = listings.filter((item) => item.is_active);

  // All summary figures come from the analytics API — not computed client-side
  // from the partial recent-orders list which only contains active/pending orders.
  const soldWeekCount   = analyticsOverview.total_orders;
  const monthlySold     = analyticsOverview.completed_orders;
  const monthlyDonated  = analyticsDonations.total;
  const monthlyRevenue  = analyticsRevenue.total;

  const formatOrderStatus = (status: string) => {
    switch ((status || "").toLowerCase()) {
      case "pending": return "Pending";
      case "confirmed": return "Confirmed";
      case "picked_up": return "Picked up";
      case "cancelled": return "Cancelled";
      default: return status || "Unknown";
    }
  };

  const getStatusStyle = (status: string) => {
    switch ((status || "").toLowerCase()) {
      case "pending":    return { bg: "rgba(245,166,35,0.15)",  text: "#8B6914" };
      case "confirmed":  return { bg: "rgba(59,130,246,0.12)",  text: "#2563EB" };
      case "picked_up":  return { bg: "rgba(36,79,66,0.12)",    text: "#244F42" };
      case "cancelled":  return { bg: "rgba(150,60,60,0.12)",   text: "#7B2626" };
      default:           return { bg: "rgba(36,79,66,0.1)",     text: "#244F42" };
    }
  };

  if (loading) {
    return (
      <View style={[styles.safeArea, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color="#F5A623" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" />

      {uploading && (
        <View style={styles.uploadOverlay}>
          <ActivityIndicator size="large" color="#F5A623" />
          <Text style={styles.uploadingText}>Updating branding…</Text>
        </View>
      )}

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <MaterialCommunityIcons name="leaf" size={16} color="#F5A623" />
          <Text style={styles.topBarBrand}>RescueEats</Text>
        </View>
        <Text style={styles.topBarTitle}>Dashboard</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Settings")} style={styles.settingsBtn}>
          <Ionicons name="settings-outline" size={22} color="rgba(232,232,204,0.8)" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >

        {/* ── Store hero ── */}
        <View style={styles.heroWrapper}>
          <TouchableOpacity onPress={() => handlePickImage("cover")} activeOpacity={0.9}>
            <ImageBackground
              source={
                businessData.cover_image
                  ? { uri: getImageUrl(businessData.cover_image)! }
                  : { uri: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5" }
              }
              style={styles.coverImage}
              imageStyle={styles.coverImageStyle}
            >
              <View style={styles.coverGradient} />
              <View style={styles.coverEditBtn}>
                <Ionicons name="camera" size={14} color="#fff" />
                <Text style={styles.coverEditText}>Edit Cover</Text>
              </View>
            </ImageBackground>
          </TouchableOpacity>

          {/* Avatar + name row */}
          <View style={styles.storeIdentity}>
            <TouchableOpacity onPress={() => handlePickImage("profile")} style={styles.avatarWrapper}>
              {businessData.profile_image ? (
                <Image source={{ uri: getImageUrl(businessData.profile_image)! }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarFallback}>
                  <FontAwesome5 name="store" size={26} color="#E8E8CC" />
                </View>
              )}
              <View style={styles.avatarEditDot}>
                <Ionicons name="pencil" size={10} color="#244F42" />
              </View>
            </TouchableOpacity>

            <View style={styles.storeInfo}>
              <Text style={styles.storeName}>{businessData.store_name}</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={12} color="rgba(232,232,204,0.55)" />
                <Text style={styles.storeLocation}>{businessData.store_location}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Stat pills ── */}
        <View style={styles.statRow}>
          <View style={styles.statPill}>
            <MaterialCommunityIcons name="tag-multiple-outline" size={20} color="#F5A623" />
            <Text style={styles.statNum}>{analyticsOverview.active_listings}</Text>
            <Text style={styles.statLab}>Active</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statPill}>
            <Ionicons name="bag-check-outline" size={20} color="#F5A623" />
            <Text style={styles.statNum}>{analyticsOverview.total_orders}</Text>
            <Text style={styles.statLab}>Orders</Text>
          </View>
        </View>

        {/* ── Monthly summary ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Monthly Summary</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Analytics")}>
            <Text style={styles.sectionLink}>Analytics →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{monthlySold}</Text>
            <Text style={styles.summaryLab}>Completed</Text>
            <View style={[styles.summaryDot, { backgroundColor: "#244F42" }]} />
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{monthlyDonated}</Text>
            <Text style={styles.summaryLab}>Donated</Text>
            <View style={[styles.summaryDot, { backgroundColor: "#8B6914" }]} />
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: "#244F42", fontSize: monthlyRevenue >= 10000 ? 13 : 15 }]}>
              {monthlyRevenue >= 1000
                ? `${(monthlyRevenue / 1000).toFixed(1)}K`
                : String(monthlyRevenue)}
            </Text>
            <Text style={styles.summaryLab}>NPR Revenue</Text>
            <View style={[styles.summaryDot, { backgroundColor: "#F5A623" }]} />
          </View>
        </View>

        {/* ── Quick actions ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <TouchableOpacity
          style={styles.addFoodBtn}
          onPress={() => navigation.navigate("businessAddList")}
          activeOpacity={0.85}
        >
          <View style={styles.addFoodIconBox}>
            <Ionicons name="add" size={22} color="#244F42" />
          </View>
          <View style={styles.addFoodText}>
            <Text style={styles.addFoodTitle}>Add Surplus Food</Text>
            <Text style={styles.addFoodSub}>Create a new rescue listing</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#244F42" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.manageBtn}
          onPress={() => navigation.navigate("ManageListings")}
          activeOpacity={0.85}
        >
          <View style={styles.manageBtnLeft}>
            <MaterialCommunityIcons name="format-list-bulleted" size={18} color="#E8E8CC" />
            <Text style={styles.manageBtnText}>Manage Listings</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(232,232,204,0.4)" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.manageBtn}
          onPress={() => navigation.navigate("StoreDonations")}
          activeOpacity={0.85}
        >
          <View style={styles.manageBtnLeft}>
            <MaterialCommunityIcons name="heart-outline" size={18} color="#E8E8CC" />
            <Text style={styles.manageBtnText}>NGO Donations & Proof</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(232,232,204,0.4)" />
        </TouchableOpacity>

        {/* ── Recent orders ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <TouchableOpacity onPress={() => navigation.navigate("StoreOrders")}>
            <Text style={styles.sectionLink}>History →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.ordersCard}>
          {recentOrders.length === 0 ? (
            <View style={styles.emptyOrders}>
              <MaterialCommunityIcons name="receipt-text-outline" size={32} color="rgba(36,79,66,0.3)" />
              <Text style={styles.emptyOrdersText}>No orders yet</Text>
              <Text style={styles.emptyOrdersSub}>Orders will appear here once customers start buying</Text>
            </View>
          ) : (
            recentOrders.slice(0, 5).map((item, index) => {
              const badge = getStatusStyle(item.status);
              return (
                <View
                  key={item.order_id}
                  style={[styles.orderRow, index === Math.min(recentOrders.length, 5) - 1 && { borderBottomWidth: 0 }]}
                >
                  <View style={styles.orderIconBox}>
                    <Text style={styles.orderIdText}>#{item.order_id}</Text>
                  </View>

                  <View style={styles.orderMid}>
                    <Text style={styles.orderItemName} numberOfLines={1}>{item.item_name}</Text>
                    <Text style={styles.orderMeta}>
                      NPR {Number(item.selling_price)}
                      {item.customer_name ? ` · ${item.customer_name}` : ""}
                    </Text>
                    <View style={styles.orderTypeRow}>
                      <Text style={styles.orderTypePill}>
                        {item.order_type === "delivery" ? "🚚 Driver pickup" : "🚶 Self pickup"}
                      </Text>
                      {!!item.pickup_code && (
                        <Text style={styles.orderCode}>Code: {item.pickup_code}</Text>
                      )}
                    </View>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusText, { color: badge.text }]}>
                      {formatOrderStatus(item.status)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#244F42" },

  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
    zIndex: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  uploadingText: { color: "#E8E8CC", marginTop: 12, fontSize: 14, fontWeight: "500" },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 5, width: 100 },
  topBarBrand: { fontSize: 13, fontWeight: "700", color: "#F5A623", letterSpacing: 0.3 },
  topBarTitle: { fontSize: 16, fontWeight: "800", color: "#E8E8CC", letterSpacing: 0.2 },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },

  scroll: { paddingBottom: 20 },

  // Hero
  heroWrapper: { marginHorizontal: 16, marginBottom: 16 },
  coverImage: { height: 150, width: "100%", justifyContent: "flex-end" },
  coverImageStyle: { borderRadius: 20 },
  coverGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  coverEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    margin: 10,
    alignSelf: "flex-end",
  },
  coverEditText: { fontSize: 11, color: "#fff", fontWeight: "600" },

  storeIdentity: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: -38,
    paddingHorizontal: 12,
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#244F42",
    backgroundColor: "#1a3a31",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  avatarImg: { width: "100%", height: "100%", borderRadius: 40 },
  avatarFallback: { justifyContent: "center", alignItems: "center" },
  avatarEditDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "#F5A623",
    padding: 5,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#244F42",
  },
  storeInfo: { marginLeft: 12, marginBottom: 6, flex: 1 },
  storeName: { fontSize: 20, fontWeight: "800", color: "#E8E8CC", letterSpacing: -0.2 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  storeLocation: { fontSize: 11, color: "rgba(232,232,204,0.5)" },

  // Stats
  statRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    backgroundColor: "#E8E8CC",
    borderRadius: 18,
    paddingVertical: 16,
    marginBottom: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  statPill: { flex: 1, alignItems: "center", gap: 4 },
  statDivider: { width: 1, backgroundColor: "rgba(36,79,66,0.12)" },
  statNum: { fontSize: 22, fontWeight: "800", color: "#244F42" },
  statLab: { fontSize: 10, fontWeight: "700", color: "#888", textTransform: "uppercase", letterSpacing: 0.4 },

  // Section headers
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#E8E8CC", letterSpacing: 0.2 },
  sectionLink: { fontSize: 12, color: "#F5A623", fontWeight: "700" },

  // Monthly summary card
  summaryCard: {
    flexDirection: "row",
    marginHorizontal: 16,
    backgroundColor: "#E8E8CC",
    borderRadius: 18,
    padding: 18,
    marginBottom: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 3 },
  summaryDivider: { width: 1, backgroundColor: "rgba(36,79,66,0.1)" },
  summaryVal: { fontSize: 20, fontWeight: "800", color: "#244F42" },
  summaryLab: { fontSize: 10, color: "#888", fontWeight: "600", textAlign: "center" },
  summaryDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },

  // Actions
  addFoodBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5A623",
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    marginBottom: 10,
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  addFoodIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(36,79,66,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  addFoodText: { flex: 1 },
  addFoodTitle: { fontSize: 15, fontWeight: "800", color: "#244F42" },
  addFoodSub: { fontSize: 11, color: "rgba(36,79,66,0.65)", marginTop: 1 },

  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(232,232,204,0.1)",
    marginHorizontal: 16,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(232,232,204,0.12)",
    marginBottom: 22,
  },
  manageBtnLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  manageBtnText: { fontSize: 14, fontWeight: "600", color: "#E8E8CC" },

  // Orders
  ordersCard: {
    backgroundColor: "#E8E8CC",
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  emptyOrders: { alignItems: "center", paddingVertical: 32, gap: 6 },
  emptyOrdersText: { fontSize: 14, fontWeight: "700", color: "#244F42" },
  emptyOrdersSub: { fontSize: 11, color: "#aaa", textAlign: "center", paddingHorizontal: 30 },

  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(36,79,66,0.07)",
    gap: 10,
  },
  orderIconBox: {
    width: 44,
    height: 44,
    backgroundColor: "#244F42",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  orderIdText: { fontSize: 10, fontWeight: "800", color: "#E8E8CC" },
  orderMid: { flex: 1 },
  orderItemName: { fontSize: 13, fontWeight: "700", color: "#244F42" },
  orderMeta: { fontSize: 11, color: "#666", marginTop: 1 },
  orderTypeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  orderTypePill: { fontSize: 10, color: "#777" },
  orderCode: {
    fontSize: 10,
    color: "#244F42",
    fontWeight: "700",
    backgroundColor: "rgba(36,79,66,0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.2 },
});
