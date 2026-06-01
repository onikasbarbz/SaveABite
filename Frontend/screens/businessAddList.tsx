import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ScrollView,
  StatusBar,
  BackHandler,
  Alert,
  Switch,
  Image,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../services/api";
import DateTimePicker from "@react-native-community/datetimepicker";

export default function BusinessAddList({ navigation }: any) {
  const [itemName, setItemName] = useState("");
  const [originalPrice, setOriginalPrice] = useState("700");
  const [sellingPrice, setSellingPrice] = useState("250");
  const [quantity, setQuantity] = useState("1");
  const [selectedCategory, setSelectedCategory] = useState("Bakery Item");
  const [healthNote, setHealthNote] = useState("");
  const [rescueEnabled, setRescueEnabled] = useState(false);
  const [rescueDeadline, setRescueDeadline] = useState<Date>(() => {
    const d = new Date(); d.setHours(20, 0, 0, 0); return d;
  });
  const [ngoEnabled, setNgoEnabled] = useState(false);
  const [ngoExpiry, setNgoExpiry] = useState<Date>(() => {
    const d = new Date(); d.setHours(22, 0, 0, 0); return d;
  });
  const [showRescuePicker, setShowRescuePicker] = useState(false);
  const [showNgoPicker, setShowNgoPicker] = useState(false);
  const [isSurpriseBag, setIsSurpriseBag] = useState(false);
  const [dietary, setDietary] = useState<string | null>(null);
  const [autoDonate, setAutoDonate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const categories = ["Bakery Item", "Restaurant Food", "Fruits & Vegetables", "Grocery", "Ready to Cook"];
  const categoryIcons: Record<string, string> = {
    "Bakery Item": "bread-slice",
    "Restaurant Food": "silverware-fork-knife",
    "Fruits & Vegetables": "carrot",
    "Grocery": "cart",
    "Ready to Cook": "pot-steam",
  };

  const dietaryOptions = [
    { label: "Veg", icon: "leaf", color: "#2E7D32" },
    { label: "Non-Veg", icon: "drumstick-bite", color: "#C62828" },
    { label: "Halal", icon: "star-and-crescent", color: "#8B6914" },
    { label: "Egg-less", icon: "egg-off", color: "#F5A623" },
  ];

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const handleGoBack = () => navigation.navigate("BusinessDashboard");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await AsyncStorage.getItem("user");
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setCurrentUserId(parsedUser.id.toString());
        }
      } catch (e) {
        console.error("Failed to load user from storage");
      }
    };
    fetchUser();
    const backAction = () => { handleGoBack(); return true; };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "We need camera roll permissions to upload food photos.");
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const discount = originalPrice && sellingPrice
    ? Math.round(((Number(originalPrice) - Number(sellingPrice)) / Number(originalPrice)) * 100)
    : 0;

  const handlePublish = async () => {
    if (!itemName.trim()) { Alert.alert("Missing Info", "Please enter the item name."); return; }
    if (!image) { Alert.alert("Missing Photo", "Please upload a photo of the food item."); return; }
    if (!currentUserId) { Alert.alert("Session Error", "Store ID not found. Please log out and log back in."); return; }
    setLoading(true);
    try {
      const formData = new FormData();
      // @ts-ignore
      formData.append("image", { uri: image, name: "food_upload.jpg", type: "image/jpeg" });
      formData.append("item_name", itemName);
      formData.append("store_id", currentUserId);
      formData.append("category", selectedCategory);
      formData.append("original_price", originalPrice);
      formData.append("selling_price", sellingPrice);
      formData.append("stock_quantity", quantity);
      formData.append("is_surprise_bag", String(isSurpriseBag));
      formData.append("dietary_preference", dietary || "");
      formData.append("health_note", healthNote);
      if (rescueEnabled) formData.append("rescue_deadline", rescueDeadline.toISOString());
      if (ngoEnabled)    formData.append("ngo_expiry",      ngoExpiry.toISOString());
      formData.append("auto_donate", String(autoDonate));
      const result = await api.addListing(formData);
      if (result.success) { Alert.alert("Success", "Listing is live!"); handleGoBack(); }
      else Alert.alert("Error", result.error || "Failed to publish.");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Check if your backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const SectionLabel = ({ number, label }: { number: string; label: string }) => (
    <View style={styles.sectionLabelRow}>
      <View style={styles.sectionNumber}>
        <Text style={styles.sectionNumberText}>{number}</Text>
      </View>
      <Text style={styles.sectionLabelText}>{label}</Text>
    </View>
  );

  const TimePicker = ({
    label, subLabel, accent, value, onPress,
  }: {
    label: string; subLabel: string; accent: string;
    value: Date; onPress: () => void;
  }) => (
    <View style={styles.timeSection}>
      <View style={styles.timeLabelRow}>
        <MaterialCommunityIcons
          name={accent === "#244F42" ? "clock-outline" : "hands-pray"}
          size={16}
          color={accent}
        />
        <Text style={[styles.timeSectionLabel, { color: accent }]}>{label}</Text>
        <Text style={styles.timeSectionSub}>{subLabel}</Text>
      </View>
      <TouchableOpacity
        style={[styles.timePickerBtn, { borderColor: accent + "50" }]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <Ionicons name="time-outline" size={20} color={accent} />
        <Text style={[styles.timePickerBtnText, { color: accent }]}>
          {formatTime(value)}
        </Text>
        <Ionicons name="chevron-down" size={16} color={accent + "80"} />
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
    >
      <View style={styles.outerContainer}>
        <StatusBar barStyle="light-content" />
        <SafeAreaView style={styles.safeArea}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>New Listing</Text>
              <Text style={styles.headerSub}>Rescue food · Save the planet</Text>
            </View>
            <View style={styles.headerBadge}>
              <MaterialCommunityIcons name="leaf" size={16} color="#F5A623" />
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── 1. Photo ── */}
            <SectionLabel number="01" label="Food Photo" />
            <TouchableOpacity style={styles.photoBox} onPress={pickImage} activeOpacity={0.85}>
              {image ? (
                <>
                  <Image source={{ uri: image }} style={styles.photoFill} />
                  <View style={styles.photoEditBadge}>
                    <Ionicons name="camera" size={14} color="#fff" />
                    <Text style={styles.photoEditText}>Change</Text>
                  </View>
                </>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <View style={styles.photoIconRing}>
                    <Ionicons name="camera-outline" size={30} color="#244F42" />
                  </View>
                  <Text style={styles.photoTapText}>Tap to add a photo</Text>
                  <Text style={styles.photoHintText}>Best at 4:3 ratio</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* ── 2. Item Details ── */}
            <SectionLabel number="02" label="Item Details" />
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Item Name & Unit</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Apples (1kg) or Cake (1pc)"
                placeholderTextColor="#aaa"
                value={itemName}
                onChangeText={setItemName}
              />
              <Text style={styles.hint}>Include weight/unit — e.g. 500g, 1kg, 2pcs</Text>

              <View style={styles.divider} />

              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, selectedCategory === cat && styles.catChipActive]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <MaterialCommunityIcons
                      name={categoryIcons[cat] as any}
                      size={14}
                      color={selectedCategory === cat ? "#fff" : "#244F42"}
                    />
                    <Text style={[styles.catChipText, selectedCategory === cat && styles.catChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* ── 3. Pricing ── */}
            <SectionLabel number="03" label="Pricing (NPR)" />
            <View style={styles.card}>
              <View style={styles.priceRow}>
                <View style={styles.priceBlock}>
                  <Text style={styles.fieldLabel}>Original</Text>
                  <View style={styles.priceInput}>
                    <Text style={styles.priceCurrency}>Rs.</Text>
                    <TextInput
                      style={styles.priceValue}
                      value={originalPrice}
                      onChangeText={setOriginalPrice}
                      keyboardType="numeric"
                      placeholderTextColor="#aaa"
                    />
                  </View>
                </View>

                <View style={styles.priceArrow}>
                  <Ionicons name="arrow-forward" size={18} color="#244F42" />
                </View>

                <View style={styles.priceBlock}>
                  <Text style={styles.fieldLabel}>Offer Price</Text>
                  <View style={[styles.priceInput, styles.priceInputAccent]}>
                    <Text style={[styles.priceCurrency, { color: "#244F42" }]}>Rs.</Text>
                    <TextInput
                      style={[styles.priceValue, { color: "#244F42", fontWeight: "800" }]}
                      value={sellingPrice}
                      onChangeText={setSellingPrice}
                      keyboardType="numeric"
                      placeholderTextColor="#aaa"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.savingsBanner}>
                <MaterialCommunityIcons name="tag-outline" size={16} color="#fff" />
                <Text style={styles.savingsText}>Customer saves {discount}% on this item</Text>
              </View>
            </View>

            {/* ── 4. Stock ── */}
            <SectionLabel number="04" label="Stock Available" />
            <View style={[styles.card, styles.stockCard]}>
              <TouchableOpacity
                style={styles.qtyCircle}
                onPress={() => setQuantity(Math.max(1, parseInt(quantity) - 1).toString())}
              >
                <Ionicons name="remove" size={22} color="#244F42" />
              </TouchableOpacity>
              <View style={styles.qtyCenter}>
                <TextInput
                  style={styles.qtyNum}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                />
                <Text style={styles.qtyLabel}>items available</Text>
              </View>
              <TouchableOpacity
                style={styles.qtyCircle}
                onPress={() => setQuantity((parseInt(quantity) + 1).toString())}
              >
                <Ionicons name="add" size={22} color="#244F42" />
              </TouchableOpacity>
            </View>

            {/* ── 5. Strategy ── */}
            <SectionLabel number="05" label="Listing Strategy" />
            <View style={styles.card}>

              {/* Surprise bag toggle */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleIcon}>
                  <MaterialCommunityIcons name="gift-outline" size={20} color="#F5A623" />
                </View>
                <View style={styles.toggleText}>
                  <Text style={styles.toggleTitle}>Surprise Bag / Deal</Text>
                  <Text style={styles.toggleSub}>Hide items — customers pay for total value</Text>
                </View>
                <Switch
                  value={isSurpriseBag}
                  onValueChange={setIsSurpriseBag}
                  trackColor={{ false: "#ddd", true: "#F5A623" }}
                  thumbColor={isSurpriseBag ? "#fff" : "#f4f3f4"}
                />
              </View>

              {isSurpriseBag && (
                <View style={styles.surprisePanel}>
                  <Text style={styles.surprisePanelLabel}>Dietary Preference *</Text>
                  <View style={styles.dietaryGrid}>
                    {dietaryOptions.map((item) => {
                      const active = dietary === item.label;
                      return (
                        <TouchableOpacity
                          key={item.label}
                          style={[styles.dietaryCard, active && { borderColor: item.color, backgroundColor: item.color + "12" }]}
                          onPress={() => setDietary(item.label)}
                        >
                          <FontAwesome5
                            name={item.icon}
                            size={16}
                            color={active ? item.color : "#aaa"}
                          />
                          <Text style={[styles.dietaryCardLabel, active && { color: item.color, fontWeight: "700" }]}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.fieldLabel}>Health / Religious Notes</Text>
                  <TextInput
                    style={[styles.input, { height: 72, textAlignVertical: "top" }]}
                    placeholder="e.g. No Buffalo, No MSG, Gluten Free..."
                    placeholderTextColor="#aaa"
                    value={healthNote}
                    onChangeText={setHealthNote}
                    multiline
                  />
                </View>
              )}

              <View style={styles.divider} />

              {/* Rescue deadline */}
              <View style={styles.timeSection}>
                <View style={styles.timeLabelRow}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#244F42" />
                  <Text style={[styles.timeSectionLabel, { color: "#244F42" }]}>Rescue Deadline</Text>
                  <Text style={styles.timeSectionSub}>Today at...</Text>
                  <Switch
                    value={rescueEnabled}
                    onValueChange={setRescueEnabled}
                    trackColor={{ false: "#ddd", true: "#244F42" }}
                    thumbColor={rescueEnabled ? "#E8E8CC" : "#f4f3f4"}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                </View>
                {rescueEnabled && (
                  <TouchableOpacity
                    style={[styles.timePickerBtn, { borderColor: "#244F4250" }]}
                    onPress={() => setShowRescuePicker(true)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="time-outline" size={20} color="#244F42" />
                    <Text style={[styles.timePickerBtnText, { color: "#244F42" }]}>
                      {formatTime(rescueDeadline)}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#244F4280" />
                  </TouchableOpacity>
                )}
                {!rescueEnabled && (
                  <Text style={styles.deadlineOffHint}>No deadline — listing stays active until manually closed</Text>
                )}
              </View>

              <View style={styles.divider} />

              {/* NGO expiry */}
              <View style={styles.timeSection}>
                <View style={styles.timeLabelRow}>
                  <MaterialCommunityIcons name="hands-pray" size={16} color="#8B6914" />
                  <Text style={[styles.timeSectionLabel, { color: "#8B6914" }]}>NGO Expiry</Text>
                  <Text style={styles.timeSectionSub}>Donation window</Text>
                  <Switch
                    value={ngoEnabled}
                    onValueChange={setNgoEnabled}
                    trackColor={{ false: "#ddd", true: "#8B6914" }}
                    thumbColor={ngoEnabled ? "#E8E8CC" : "#f4f3f4"}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                </View>
                {ngoEnabled && (
                  <TouchableOpacity
                    style={[styles.timePickerBtn, { borderColor: "#8B691450" }]}
                    onPress={() => setShowNgoPicker(true)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="time-outline" size={20} color="#8B6914" />
                    <Text style={[styles.timePickerBtnText, { color: "#8B6914" }]}>
                      {formatTime(ngoExpiry)}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#8B691480" />
                  </TouchableOpacity>
                )}
                {!ngoEnabled && (
                  <Text style={styles.deadlineOffHint}>No expiry — NGOs can claim this donation at any time</Text>
                )}
              </View>

              <View style={styles.divider} />

              {/* Auto-donate toggle */}
              <View style={styles.toggleRow}>
                <View style={[styles.toggleIcon, { backgroundColor: "#244F4215" }]}>
                  <MaterialCommunityIcons name="hand-heart-outline" size={20} color="#244F42" />
                </View>
                <View style={styles.toggleText}>
                  <Text style={styles.toggleTitle}>Auto-Donate to NGO</Text>
                  <Text style={styles.toggleSub}>Trigger rescue if unsold by deadline</Text>
                </View>
                <Switch
                  value={autoDonate}
                  onValueChange={setAutoDonate}
                  trackColor={{ false: "#ddd", true: "#244F42" }}
                  thumbColor={autoDonate ? "#E8E8CC" : "#f4f3f4"}
                />
              </View>
            </View>

            {/* ── Publish ── */}
            <TouchableOpacity
              style={[styles.publishBtn, loading && { opacity: 0.7 }]}
              onPress={handlePublish}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#244F42" />
              ) : (
                <>
                  <MaterialCommunityIcons name="rocket-launch-outline" size={20} color="#244F42" />
                  <Text style={styles.publishBtnText}>Publish Listing</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={handleGoBack}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <View style={{ height: 50 }} />
          </ScrollView>

          {/* Native time pickers */}
          {showRescuePicker && (
            <DateTimePicker
              value={rescueDeadline}
              mode="time"
              is24Hour={false}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_, date) => {
                setShowRescuePicker(false);
                if (date) setRescueDeadline(date);
              }}
            />
          )}
          {showNgoPicker && (
            <DateTimePicker
              value={ngoExpiry}
              mode="time"
              is24Hour={false}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_, date) => {
                setShowNgoPicker(false);
                if (date) setNgoExpiry(date);
              }}
            />
          )}
        </SafeAreaView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: "#244F42" },
  safeArea: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: Platform.OS === "ios" ? 10 : 36,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: { flex: 1, marginLeft: 14 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 1, letterSpacing: 0.2 },
  headerBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(245,166,35,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(245,166,35,0.3)",
  },

  scroll: { paddingHorizontal: 16, paddingBottom: 20 },

  // Section label
  sectionLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, marginTop: 18 },
  sectionNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F5A623",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  sectionNumberText: { fontSize: 11, fontWeight: "800", color: "#244F42" },
  sectionLabelText: { fontSize: 15, fontWeight: "700", color: "#E8E8CC", letterSpacing: 0.1 },

  // Photo
  photoBox: {
    height: 200,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#E8E8CC",
    marginBottom: 4,
  },
  photoFill: { width: "100%", height: "100%" },
  photoEditBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  photoEditText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  photoPlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  photoIconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(36,79,66,0.1)",
    borderWidth: 1.5,
    borderColor: "#244F42",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  photoTapText: { fontSize: 14, fontWeight: "600", color: "#244F42" },
  photoHintText: { fontSize: 11, color: "#aaa", marginTop: 3 },

  // Card
  card: {
    backgroundColor: "#E8E8CC",
    borderRadius: 20,
    padding: 18,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  divider: { height: 1, backgroundColor: "rgba(36,79,66,0.1)", marginVertical: 14 },

  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#244F42", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 },
  hint: { fontSize: 10, color: "#888", marginTop: 5, fontStyle: "italic" },

  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: "#1a1a1a",
    borderWidth: 1.5,
    borderColor: "rgba(36,79,66,0.15)",
  },

  // Category
  catScroll: { marginTop: 2 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: "rgba(36,79,66,0.2)",
  },
  catChipActive: { backgroundColor: "#244F42", borderColor: "#244F42" },
  catChipText: { fontSize: 12, color: "#244F42", fontWeight: "600" },
  catChipTextActive: { color: "#fff" },

  // Pricing
  priceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  priceBlock: { flex: 1 },
  priceArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(36,79,66,0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 18,
  },
  priceInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "rgba(36,79,66,0.15)",
  },
  priceInputAccent: {
    borderColor: "#244F42",
    backgroundColor: "rgba(36,79,66,0.06)",
  },
  priceCurrency: { fontSize: 12, fontWeight: "700", color: "#aaa", marginRight: 4 },
  priceValue: { fontSize: 18, fontWeight: "700", color: "#333", flex: 1 },
  savingsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#244F42",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 14,
  },
  savingsText: { fontSize: 12, color: "#E8E8CC", fontWeight: "600" },

  // Stock
  stockCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 20 },
  qtyCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#244F42",
    justifyContent: "center",
    alignItems: "center",
  },
  qtyCenter: { alignItems: "center" },
  qtyNum: { fontSize: 32, fontWeight: "800", color: "#244F42", textAlign: "center", minWidth: 60 },
  qtyLabel: { fontSize: 11, color: "#888", fontWeight: "500" },

  // Toggles
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(245,166,35,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  toggleText: { flex: 1 },
  toggleTitle: { fontSize: 14, fontWeight: "700", color: "#244F42" },
  toggleSub: { fontSize: 11, color: "#888", marginTop: 2, lineHeight: 15 },

  // Surprise panel
  surprisePanel: {
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(245,166,35,0.2)",
  },
  surprisePanelLabel: { fontSize: 11, fontWeight: "800", color: "#8B6914", letterSpacing: 0.5, marginBottom: 12 },
  dietaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  dietaryCard: {
    width: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 11,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#ddd",
  },
  dietaryCardLabel: { fontSize: 12, color: "#666", fontWeight: "500" },

  // Time
  timeSection: { gap: 8 },
  timeLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  timeSectionLabel: { fontSize: 13, fontWeight: "700", color: "#244F42", flex: 1 },
  timeSectionSub: { fontSize: 11, color: "#aaa" },
  timePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  timePickerBtnText: { flex: 1, fontSize: 18, fontWeight: "800" },
  deadlineOffHint: { fontSize: 11, color: "#888", fontStyle: "italic", marginTop: 4 },

  // Publish
  publishBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#F5A623",
    borderRadius: 18,
    paddingVertical: 18,
    marginTop: 22,
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  publishBtnText: { fontSize: 16, fontWeight: "800", color: "#244F42", letterSpacing: 0.3 },
  cancelBtn: { alignItems: "center", paddingVertical: 14 },
  cancelBtnText: { fontSize: 13, color: "rgba(232,232,204,0.5)", textDecorationLine: "underline" },
});
