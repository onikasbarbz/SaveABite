import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";

interface AnalyticsData {
  overview: {
    total_listings: number;
    active_listings: number;
    total_orders: number;
    orders_today: number;
    orders_this_week: number;
    completed_orders: number;
    pending_orders: number;
  };
  revenue: {
    total: number;
    this_week: number;
  };
  donations: {
    total: number;
    picked_up: number;
  };
  top_items: Array<{
    listing_id: number;
    item_name: string;
    category: string;
    selling_price: number;
    total_sold: number;
  }>;
  surplus_trend: Array<{
    date: string;
    day: string;
    listings_created: number;
    orders: number;
  }>;
  category_breakdown: Array<{
    category: string;
    count: number;
  }>;
}

export default function AnalyticsDashboard({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAnalytics();
    }, [])
  );

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const savedUser = await AsyncStorage.getItem("user");
      if (!savedUser) return;

      const user = JSON.parse(savedUser);
      const result = await api.getBusinessAnalytics(user.id);

      if (result.success && result.analytics) {
        setAnalytics(result.analytics);
      }
    } catch (error: any) {
      console.error("Analytics Fetch Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const formatRevenue = (amount: number) => {
    if (amount >= 1000) {
      return `NPR ${(amount / 1000).toFixed(1)}K`;
    }
    return `NPR ${amount}`;
  };

  // Get max bar height for scaling
  const getMaxTrendValue = () => {
    if (!analytics?.surplus_trend) return 1;
    const max = Math.max(...analytics.surplus_trend.map((t) => Math.max(t.orders, t.listings_created)));
    return max || 1;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#F5A623" />
          <Text style={{ color: "#E8E8CC", marginTop: 12 }}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const overview = analytics?.overview;
  const revenue = analytics?.revenue;
  const donations = analytics?.donations;
  const topItems = analytics?.top_items || [];
  const surplusTrend = analytics?.surplus_trend || [];
  const categoryBreakdown = analytics?.category_breakdown || [];
  const maxTrendVal = getMaxTrendValue();

  // Calculate completion rate
  const completionRate =
    overview && overview.total_orders > 0
      ? Math.round((overview.completed_orders / overview.total_orders) * 100)
      : 0;

  // Category colors
  const catColors = ["#244F42", "#F5A623", "#3B82F6", "#E51904", "#8B5CF6", "#10B981"];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#E8E8CC" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSubtitle}>Your performance overview</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        overScrollMode="never"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#244F42" />}
      >
        {/* TOP STATS CARDS */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <View style={styles.iconCircle}>
              <Ionicons name="bag-handle" size={20} color="#244F42" />
            </View>
            <Text style={styles.statValue}>{overview?.total_orders || 0}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
            <Text style={styles.trendText}>
              {overview?.orders_this_week || 0} this week
            </Text>
          </View>
          <View style={styles.statBox}>
            <View style={styles.iconCircle}>
              <FontAwesome5 name="money-bill-wave" size={16} color="#244F42" />
            </View>
            <Text style={styles.statValue}>{formatRevenue(revenue?.total || 0)}</Text>
            <Text style={styles.statLabel}>Total Revenue</Text>
            <Text style={styles.trendText}>
              {formatRevenue(revenue?.this_week || 0)} this week
            </Text>
          </View>
        </View>

        {/* MONTHLY FOOD SUMMARY */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Monthly Food Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, { backgroundColor: "rgba(36, 79, 66, 0.1)" }]}>
                <Ionicons name="bag-check" size={22} color="#244F42" />
              </View>
              <Text style={styles.summaryValue}>{overview?.completed_orders || 0}</Text>
              <Text style={styles.summaryLabel}>Completed</Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, { backgroundColor: "rgba(245, 166, 35, 0.1)" }]}>
                <Ionicons name="time" size={22} color="#F5A623" />
              </View>
              <Text style={styles.summaryValue}>{overview?.pending_orders || 0}</Text>
              <Text style={styles.summaryLabel}>Pending</Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, { backgroundColor: "rgba(229, 25, 4, 0.1)" }]}>
                <MaterialCommunityIcons name="heart" size={22} color="#E51904" />
              </View>
              <Text style={styles.summaryValue}>{donations?.total || 0}</Text>
              <Text style={styles.summaryLabel}>Donated</Text>
            </View>
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, { backgroundColor: "rgba(16, 185, 129, 0.1)" }]}>
                <MaterialCommunityIcons name="label-outline" size={22} color="#10B981" />
              </View>
              <Text style={styles.summaryValue}>{overview?.active_listings || 0}</Text>
              <Text style={styles.summaryLabel}>Active</Text>
            </View>
          </View>
        </View>

        {/* SALES TREND (7-day bar chart from real data) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>7-Day Sales Trend</Text>
          <View style={styles.chartContainer}>
            {surplusTrend.map((day, i) => {
              const ordersHeight = Math.max(4, (day.orders / maxTrendVal) * 85);
              const listingsHeight = Math.max(4, (day.listings_created / maxTrendVal) * 85);
              return (
                <View key={i} style={styles.chartColumn}>
                  <View style={styles.barsContainer}>
                    <View style={[styles.bar, styles.listingsBar, { height: listingsHeight }]} />
                    <View style={[styles.bar, styles.ordersBar, { height: ordersHeight }]} />
                  </View>
                  <Text style={styles.chartDayLabel}>{day.day}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: "#244F42" }]} />
              <Text style={styles.legendText}>Surplus Listed</Text>
            </View>
            <View style={[styles.legendItem, { marginLeft: 15 }]}>
              <View style={[styles.dot, { backgroundColor: "#F5A623" }]} />
              <Text style={styles.legendText}>Orders Placed</Text>
            </View>
          </View>
        </View>

        {/* ORDER COMPLETION RATE */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Order Completion</Text>
            <Text style={styles.percentageText}>{completionRate}%</Text>
          </View>
          <Text style={styles.subLabel}>
            {overview?.completed_orders || 0} of {overview?.total_orders || 0} orders completed
          </Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${completionRate}%` }]} />
          </View>
          <Text style={styles.footerText}>
            {overview?.orders_today || 0} orders today • {overview?.orders_this_week || 0} this week
          </Text>
        </View>

        {/* DONATION STATS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Donation Impact</Text>
          <View style={styles.impactRow}>
            <Text style={styles.impactLabel}>Total Donations</Text>
            <Text style={styles.impactValue}>{donations?.total || 0}</Text>
          </View>
          <View style={styles.impactRow}>
            <Text style={styles.impactLabel}>Picked Up by NGOs</Text>
            <Text style={styles.impactValue}>{donations?.picked_up || 0}</Text>
          </View>
          <View style={[styles.impactRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.impactLabel}>Awaiting Pickup</Text>
            <Text style={styles.impactValue}>
              {(donations?.total || 0) - (donations?.picked_up || 0)}
            </Text>
          </View>
        </View>

        {/* CATEGORY BREAKDOWN */}
        {categoryBreakdown.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Category Breakdown</Text>
            {categoryBreakdown.map((cat, i) => {
              const total = categoryBreakdown.reduce((s, c) => s + c.count, 0);
              const pct = total > 0 ? Math.round((cat.count / total) * 100) : 0;
              const color = catColors[i % catColors.length];
              return (
                <View key={cat.category} style={styles.categoryRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                    <View style={[styles.catDot, { backgroundColor: color }]} />
                    <Text style={styles.catName}>{cat.category}</Text>
                  </View>
                  <Text style={styles.catCount}>{cat.count} items</Text>
                  <Text style={[styles.catPct, { color }]}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* TOP PERFORMING ITEMS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top Performing Items</Text>
          {topItems.length === 0 ? (
            <Text style={styles.emptyText}>No completed orders yet.</Text>
          ) : (
            topItems.map((item, index) => (
              <View key={item.listing_id} style={[styles.itemRow, index > 0 && { marginTop: 15 }]}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.itemName}>{item.item_name}</Text>
                  <Text style={styles.itemSub}>
                    {item.total_sold} sold • {item.category} • NPR {Number(item.selling_price)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#244F42" },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: 20, 
    paddingBottom: 15,
    paddingTop: Platform.OS === 'ios' ? 10 : 35,
  },
  backBtn: { marginRight: 15 },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#E8E8CC" },
  headerSubtitle: { fontSize: 13, color: "rgba(232, 232, 204, 0.7)" },

  scrollContent: { padding: 20, backgroundColor: "#F5F5F5", borderTopLeftRadius: 20, borderTopRightRadius: 20 },

  statsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  statBox: { flex: 0.48, backgroundColor: "#E8E8CC", padding: 15, borderRadius: 16, elevation: 2 },
  iconCircle: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: "rgba(36, 79, 66, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  statValue: { fontSize: 18, fontWeight: "bold", color: "#244F42" },
  statLabel: { fontSize: 12, color: "#666", marginVertical: 2 },
  trendText: { fontSize: 10, color: "#2E7D32", fontWeight: "bold" },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 18, marginBottom: 20, elevation: 1 },
  cardTitle: { fontSize: 15, fontWeight: "bold", color: "#244F42", marginBottom: 15 },

  // Monthly summary grid
  summaryGrid: { flexDirection: "row", justifyContent: "space-between" },
  summaryItem: { alignItems: "center", flex: 1 },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryValue: { fontSize: 18, fontWeight: "bold", color: "#244F42" },
  summaryLabel: { fontSize: 10, color: "#666", marginTop: 2, fontWeight: "600" },

  // Chart
  chartContainer: {
    height: 130,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    marginBottom: 15,
    paddingTop: 20,
  },
  chartColumn: { alignItems: "center", flex: 1 },
  chartBarValue: { fontSize: 9, color: "#666", fontWeight: "bold", marginBottom: 4 },
  barsContainer: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  bar: { width: 8, borderRadius: 4 },
  listingsBar: { backgroundColor: "#244F42" },
  ordersBar: { backgroundColor: "#F5A623" },
  chartDayLabel: { fontSize: 10, color: "#888", marginTop: 6, fontWeight: "600" },
  chartLegend: { flexDirection: "row", justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", marginHorizontal: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  legendText: { fontSize: 11, color: "#666" },

  // Impact
  impactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  impactLabel: { fontSize: 13, color: "#666" },
  impactValue: { fontSize: 13, fontWeight: "bold", color: "#244F42" },

  // Completion rate
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  percentageText: { fontSize: 18, fontWeight: "bold", color: "#244F42" },
  subLabel: { fontSize: 12, color: "#777", marginBottom: 10 },
  progressBarBg: { height: 10, backgroundColor: "#f0f0f0", borderRadius: 5, marginBottom: 8 },
  progressBarFill: { height: "100%", backgroundColor: "#F5A623", borderRadius: 5 },
  footerText: { fontSize: 11, color: "#999", textAlign: "center" },

  // Category breakdown
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  catName: { fontSize: 13, color: "#444", fontWeight: "600" },
  catCount: { fontSize: 12, color: "#888", marginRight: 10 },
  catPct: { fontSize: 13, fontWeight: "bold", width: 40, textAlign: "right" },

  // Top items
  itemRow: { flexDirection: "row", alignItems: "center" },
  rankBadge: {
    width: 36,
    height: 36,
    backgroundColor: "#E8E8CC",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: { fontSize: 13, fontWeight: "bold", color: "#244F42" },
  itemName: { fontSize: 13, fontWeight: "bold", color: "#244F42" },
  itemSub: { fontSize: 11, color: "#777", marginTop: 2 },

  emptyText: { fontSize: 13, color: "#999", fontStyle: "italic" },
});