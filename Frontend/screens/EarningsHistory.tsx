import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const EARNINGS_DATA = [
  { id: 1, day: "Today", date: "Feb 5", amount: "NPR 1,200", deliveries: 5, status: "Transferred" },
  { id: 2, day: "Yesterday", date: "Feb 4", amount: "NPR 950", deliveries: 4, status: "Transferred" },
  { id: 3, day: "Monday", date: "Feb 3", amount: "NPR 1,800", deliveries: 8, status: "Transferred" },
  { id: 4, day: "Sunday", date: "Feb 2", amount: "NPR 2,100", deliveries: 10, status: "Transferred" },
];

export default function EarningsHistory({ navigation, route }: any) {
  // Get the goal from Profile screen, or use 1500 as default
  const dailyGoal = route.params?.sharedGoal || "1500";
  const currentEarnings = 1200;
  
  // Calculate Progress Logic
  const goalInt = parseInt(dailyGoal);
  const remaining = Math.max(goalInt - currentEarnings, 0);
  const progressPercent = Math.min((currentEarnings / goalInt) * 100, 100);

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#244F42" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings Summary</Text>
        <TouchableOpacity style={styles.calendarBtn}>
          <Ionicons name="calendar-outline" size={22} color="#244F42" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* TOTAL BALANCE CARD */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Earned This Month</Text>
          <Text style={styles.balanceAmount}>NPR 28,400</Text>
          <View style={styles.growthBadge}>
            <Ionicons name="trending-up" size={14} color="#059669" />
            <Text style={styles.growthText}>+12% from last month</Text>
          </View>
        </View>

        {/* DAILY GOAL PROGRESS - Now using the sharedGoal */}
        <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <Text style={styles.goalTitle}>Daily Goal</Text>
            <Text style={styles.goalValue}>NPR {currentEarnings} / {dailyGoal}</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.goalSubText}>
            {remaining > 0 
              ? `NPR ${remaining} more to reach your daily target!` 
              : "Daily goal achieved! Excellent work."}
          </Text>
        </View>

        {/* RECENT TRANSACTIONS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity><Text style={styles.filterText}>Filter</Text></TouchableOpacity>
        </View>

        {EARNINGS_DATA.map((item) => (
          <View key={item.id} style={styles.transactionItem}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="wallet-giftcard" size={20} color="#244F42" />
            </View>
            <View style={styles.transDetails}>
              <Text style={styles.transDay}>{item.day}, {item.date}</Text>
              <Text style={styles.transSub}>{item.deliveries} Deliveries • {item.status}</Text>
            </View>
            <Text style={styles.transAmount}>{item.amount}</Text>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 20, 
    paddingVertical: 15,
    backgroundColor: '#fff'
  },
  backBtn: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#244F42' },
  calendarBtn: { padding: 5 },
  scrollContent: { padding: 20 },

  // Balance Card
  balanceCard: { 
    backgroundColor: '#244F42', 
    borderRadius: 24, 
    padding: 25, 
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#244F42',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    marginBottom: 20
  },
  balanceLabel: { color: '#ffffff90', fontSize: 14, marginBottom: 8 },
  balanceAmount: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  growthBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#D1FAE5', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 20, 
    marginTop: 15 
  },
  growthText: { color: '#059669', fontSize: 12, fontWeight: '600', marginLeft: 4 },

  // Progress Goal
  goalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 25, elevation: 2 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  goalTitle: { fontSize: 15, fontWeight: 'bold', color: '#111827' },
  goalValue: { fontSize: 14, color: '#6B7280' },
  progressBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#F5A623', borderRadius: 4 },
  goalSubText: { fontSize: 12, color: '#9CA3AF', marginTop: 10 },

  // Transaction List
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  filterText: { color: '#244F42', fontWeight: '600' },
  transactionItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    padding: 15, 
    borderRadius: 16, 
    marginBottom: 12,
    elevation: 1
  },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#D1E3D7', alignItems: 'center', justifyContent: 'center' },
  transDetails: { flex: 1, marginLeft: 15 },
  transDay: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  transSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  transAmount: { fontSize: 15, fontWeight: 'bold', color: '#059669' },
});