import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  Image,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { api, API_BASE_URL } from "../services/api";

interface Listing {
  id: number;
  store_id: number;
  item_name: string;
  category: string;
  original_price: number;
  selling_price: number;
  is_surprise_bag: boolean;
  dietary_preference?: string | null;
  health_note?: string | null;
  rescue_deadline?: string | null;
  auto_donate?: boolean;
  image_url?: string | null;
  created_at?: string;
  stock_quantity: number;
  is_active: boolean;
  store_name?: string | null;
  profile_image?: string | null;
  cover_image?: string | null;
}

export default function ManageListings({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<"Active" | "Ended">("Active");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchListings = async () => {
    try {
      const userData = await AsyncStorage.getItem("user");

      if (!userData) {
        Alert.alert("Session Error", "User not found. Please log in again.");
        return;
      }

      const parsedUser = JSON.parse(userData);
      const storeId = parsedUser.id;

      const result = await api.getMyListings();

      if (result.success) {
        setListings(result.listings || []);
      } else {
        Alert.alert("Error", result.message || "Failed to load listings.");
      }
    } catch (error: any) {
      console.error("Fetch Listings Error:", error);
      Alert.alert("Error", error.message || "Could not load listings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchListings();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchListings();
  };

  const getImageUrl = (imageUrl?: string | null) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("http")) return imageUrl;
    return `${API_BASE_URL}${imageUrl}`;
  };

  const formatDeadline = (deadline?: string | null) => {
    if (!deadline) return "End of day";
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

  const handleDelete = (listingId: number, itemName: string) => {
    Alert.alert(
      "Delete Listing",
      `Are you sure you want to delete "${itemName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingId(listingId);
              const result = await api.deleteListing(listingId);

              if (result.success) {
                setListings((prev) => prev.filter((item) => item.id !== listingId));
                Alert.alert("Deleted", "Listing deleted successfully.");
              } else {
                Alert.alert("Error", result.message || "Failed to delete listing.");
              }
            } catch (error: any) {
              console.error("Delete Listing Error:", error);
              Alert.alert("Error", error.message || "Could not delete listing.");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (item: Listing) => {
    try {
      const result = await api.updateListing(item.id, {
        is_active: !item.is_active,
      });

      if (result.success) {
        setListings((prev) =>
          prev.map((listing) =>
            listing.id === item.id
              ? { ...listing, is_active: !listing.is_active }
              : listing
          )
        );
      } else {
        Alert.alert("Error", result.message || "Failed to update listing.");
      }
    } catch (error: any) {
      console.error("Toggle Listing Error:", error);
      Alert.alert("Error", error.message || "Could not update listing.");
    }
  };

  const activeListings = listings.filter((item) => item.is_active);
  const endedListings = listings.filter((item) => !item.is_active);
  const filteredListings = activeTab === "Active" ? activeListings : endedListings;

  const getTypeText = (item: Listing) => {
    return item.is_surprise_bag ? "Surplus / Surprise Bag" : "Regular";
  };

  const renderListing = ({ item }: { item: Listing }) => {
    const imageUrl = getImageUrl(item.image_url);

    return (
      <View style={styles.listingCard}>
        <View style={styles.cardTop}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.listingImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <FontAwesome5
                name={item.category?.toLowerCase().includes("bakery") ? "bread-slice" : "utensils"}
                size={24}
                color="#244F42"
              />
            </View>
          )}

          <View style={styles.mainInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.item_name || "Unnamed Item"}
              </Text>
              <View
                style={[
                  styles.activeBadge,
                  !item.is_active && { backgroundColor: "#f3f4f6" },
                ]}
              >
                <Text
                  style={[
                    styles.activeText,
                    !item.is_active && { color: "#6b7280" },
                  ]}
                >
                  {item.is_active ? "Active" : "Ended"}
                </Text>
              </View>
            </View>

            <Text style={styles.itemMeta}>
              NPR {Number(item.selling_price)} • {item.stock_quantity ?? 0} available
            </Text>
            <Text style={styles.itemMeta}>
              Type: {getTypeText(item)}
            </Text>
            <Text style={styles.itemMeta}>
              Category: {item.category || "General"}
            </Text>
            <Text style={styles.itemMeta}>
              Pickup: {formatDeadline(item.rescue_deadline)}
            </Text>

            {item.dietary_preference && item.dietary_preference !== "None" && (
              <View style={styles.dietaryTag}>
                <FontAwesome5 name="leaf" size={10} color="#2E7D32" />
                <Text style={styles.dietaryText}>{item.dietary_preference}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Original</Text>
            <Text style={styles.statValue}>NPR {Number(item.original_price)}</Text>
          </View>
          <View style={[styles.statItem, styles.sideBorder]}>
            <Text style={styles.statLabel}>Offer</Text>
            <Text style={styles.statValue}>NPR {Number(item.selling_price)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Stock</Text>
            <Text style={styles.statValue}>{item.stock_quantity ?? 0}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate("EditListing", { listing: item })}
          >
            <Text style={styles.editBtnText}>Edit Listing</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.editBtn, { marginHorizontal: 10 }]}
            onPress={() => handleToggleStatus(item)}
          >
            <Text style={styles.editBtnText}>
              {item.is_active ? "Mark Ended" : "Activate"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item.id, item.item_name || "this item")}
            disabled={deletingId === item.id}
          >
            {deletingId === item.id ? (
              <ActivityIndicator size="small" color="#C62828" />
            ) : (
              <Ionicons name="trash-outline" size={18} color="#C62828" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const EmptyState = () => (
    <View style={styles.emptyWrap}>
      <Ionicons name="restaurant-outline" size={56} color="#94a3b8" />
      <Text style={styles.emptyTitle}>
        No {activeTab.toLowerCase()} listings
      </Text>
      <Text style={styles.emptyText}>
        {activeTab === "Active"
          ? "Create a new food listing to start selling."
          : "Ended or inactive listings will appear here."}
      </Text>

      {activeTab === "Active" && (
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate("BusinessAddList")}
        >
          <Text style={styles.addBtnText}>Add New Listing</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#E8E8CC" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Manage listings</Text>
          <Text style={styles.headerSubtitle}>Your food items from database</Text>
        </View>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "Active" && styles.activeTab]}
          onPress={() => setActiveTab("Active")}
        >
          <Text style={[styles.tabText, activeTab === "Active" && styles.activeTabText]}>
            Active ({activeListings.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "Ended" && styles.activeTab]}
          onPress={() => setActiveTab("Ended")}
        >
          <Text style={[styles.tabText, activeTab === "Ended" && styles.activeTabText]}>
            Ended ({endedListings.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#244F42" />
          <Text style={styles.loaderText}>Loading listings...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredListings}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderListing}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={EmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#244F42" },
  header: { 
    paddingHorizontal: 20, 
    paddingBottom: 20, 
    flexDirection: "row", 
    alignItems: "center",
    paddingTop: Platform.OS === 'ios' ? 10 : 35,
  },
  backBtn: { marginRight: 15 },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#E8E8CC" },
  headerSubtitle: { fontSize: 13, color: "rgba(232, 232, 204, 0.7)" },

  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: { borderBottomColor: "#244F42" },
  tabText: { fontSize: 14, fontWeight: "600", color: "#999" },
  activeTabText: { color: "#244F42" },

  scrollContent: {
    padding: 20,
    backgroundColor: "#F5F5F5",
    flexGrow: 1,
  },

  loaderWrap: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    marginTop: 10,
    fontSize: 14,
    color: "#555",
  },

  listingCard: {
    backgroundColor: "#E8E8CC",
    borderRadius: 16,
    padding: 15,
    marginBottom: 20,
    elevation: 3,
  },
  cardTop: { flexDirection: "row", alignItems: "center" },
  imagePlaceholder: {
    width: 70,
    height: 70,
    backgroundColor: "rgba(36, 79, 66, 0.1)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(36, 79, 66, 0.1)",
  },
  listingImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  mainInfo: { flex: 1, marginLeft: 15 },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#244F42",
    flex: 1,
    marginRight: 8,
  },
  activeBadge: {
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  activeText: { fontSize: 10, color: "#244F42", fontWeight: "bold" },
  itemMeta: { fontSize: 12, color: "#666", marginTop: 2 },
  dietaryTag: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  dietaryText: {
    fontSize: 10,
    color: "#2E7D32",
    fontWeight: "bold",
    marginLeft: 4,
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginVertical: 12,
  },

  statsBar: { flexDirection: "row", justifyContent: "space-around" },
  statItem: { alignItems: "center", flex: 1 },
  sideBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  statLabel: { fontSize: 11, color: "#777" },
  statValue: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#244F42",
    marginTop: 2,
  },

  actionRow: { flexDirection: "row", justifyContent: "space-between" },
  editBtn: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#244F42",
  },
  deleteBtn: {
    width: 45,
    backgroundColor: "rgba(198, 40, 40, 0.1)",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyWrap: {
    flex: 1,
    minHeight: 350,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#244F42",
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
  },
  addBtn: {
    marginTop: 18,
    backgroundColor: "#244F42",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
});