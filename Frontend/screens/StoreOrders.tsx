import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Alert,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";

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

export default function StoreOrders({ navigation }: any) {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [pickupInputs, setPickupInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchOrders();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [])
  );

  const fetchOrders = async () => {
    try {
      setLoading(true);

      const savedUser = await AsyncStorage.getItem("user");
      if (!savedUser) {
        Alert.alert("Session Error", "Please log in again.");
        return;
      }

      const user = JSON.parse(savedUser);
      const result = await api.getStoreOrders(user.id);

      if (result.success) {
        setOrders(result.orders || []);
      } else {
        Alert.alert("Error", result.message || "Failed to load orders.");
      }
    } catch (error: any) {
      console.error("Fetch Store Orders Error:", error);
      Alert.alert("Error", error.message || "Could not load store orders.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
  };

  const getStatusStyle = (status: string) => {
    switch ((status || "").toLowerCase()) {
      case "payment_pending":
      case "paying":
      case "failed":
        return { bg: "rgba(198, 40, 40, 0.12)", color: "#C62828", label: "Failed" };
      case "pending":
      case "confirmed":
        return { bg: "rgba(59, 130, 246, 0.15)", color: "#3B82F6", label: "Confirmed" };
      case "picked_up":
        return { bg: "rgba(36, 79, 66, 0.12)", color: "#244F42", label: "Picked up" };
      case "cancelled":
        return { bg: "rgba(198, 40, 40, 0.12)", color: "#C62828", label: "Cancelled" };
      default:
        return { bg: "rgba(107,114,128,0.15)", color: "#6B7280", label: status || "Unknown" };
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "Unknown time";
    return new Date(dateString).toLocaleString();
  };

  const handleConfirmPickup = async (orderId: number) => {
    const pickupCode = (pickupInputs[orderId] || "").trim();

    if (!pickupCode) {
      Alert.alert("Missing Code", "Please enter the pickup code.");
      return;
    }

    try {
      setConfirmingId(orderId);

      const result = await api.confirmPickup(orderId, pickupCode);

      if (result.success) {
        Alert.alert("Success", "Pickup confirmed.");
        setPickupInputs((prev) => ({ ...prev, [orderId]: "" }));
        await fetchOrders();
      } else {
        Alert.alert("Error", result.message || "Could not confirm pickup.");
      }
    } catch (error: any) {
      console.error("Confirm Pickup Error:", error);
      Alert.alert("Error", error.message || "Could not confirm pickup.");
    } finally {
      setConfirmingId(null);
    }
  };

  const renderOrder = ({ item }: { item: StoreOrder }) => {
    const status = getStatusStyle(item.status);

    return (
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.orderId}>Order #{item.order_id}</Text>
            <Text style={styles.metaText}>{item.item_name}</Text>
            <Text style={styles.metaText}>NPR {Number(item.selling_price)}</Text>
          </View>

          <View style={[styles.badge, { backgroundColor: status.bg }]}>
            <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.infoText}>Customer: {item.customer_name || "Unknown"}</Text>
        <Text style={styles.infoText}>Phone: {item.customer_phone || "-"}</Text>
        <Text style={styles.infoText}>Pickup Code: {item.pickup_code || "-"}</Text>
        <Text style={styles.infoText}>Fulfillment: {item.order_type === "delivery" ? "🚚 Delivery (Driver picking up)" : "🚶 Self Pickup (Customer picking up)"}</Text>
        <Text style={styles.infoText}>Ordered At: {formatDate(item.ordered_at)}</Text>

        {item.status?.toLowerCase() === "pending" || item.status?.toLowerCase() === "confirmed" ? (
          <View style={styles.confirmWrap}>
            <TextInput
              style={styles.input}
              placeholder="Enter pickup code"
              placeholderTextColor="#999"
              value={pickupInputs[item.order_id] || ""}
              onChangeText={(text) =>
                setPickupInputs((prev) => ({ ...prev, [item.order_id]: text }))
              }
            />

            <TouchableOpacity
              style={[styles.confirmBtn, confirmingId === item.order_id && { opacity: 0.7 }]}
              onPress={() => handleConfirmPickup(item.order_id)}
              disabled={confirmingId === item.order_id}
            >
              {confirmingId === item.order_id ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm Pickup</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#F5A623" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#E8E8CC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Store Orders</Text>
        <View style={{ width: 34 }} />
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.order_id.toString()}
        renderItem={renderOrder}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No customer orders yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#244F42" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#E8E8CC" },

  listContent: {
    padding: 20,
    backgroundColor: "#F5F5F5",
    flexGrow: 1,
  },
  card: {
    backgroundColor: "#E8E8CC",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderId: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#244F42",
  },
  metaText: {
    fontSize: 12,
    color: "#555",
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginVertical: 12,
  },
  infoText: {
    fontSize: 13,
    color: "#444",
    marginBottom: 4,
  },
  confirmWrap: {
    marginTop: 12,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    color: "#111",
  },
  confirmBtn: {
    marginTop: 10,
    backgroundColor: "#244F42",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  confirmBtnText: {
    color: "#fff",
    fontWeight: "bold",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#666",
    fontSize: 14,
  },
});