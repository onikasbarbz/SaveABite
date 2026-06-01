import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { api, UserRole } from "../services/api";

type Props = NativeStackScreenProps<any, "Register">;

export default function RegisterScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("consumer");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (text.length > 0 && !EMAIL_REGEX.test(text)) {
      setEmailError("Please enter a valid email address (e.g., example@gmail.com)");
    } else {
      setEmailError("");
    }
  };

  const handlePhoneChange = (text: string) => {
    setPhone(text);
    if (text.length === 0) { setPhoneError(""); return; }
    const clean = text.replace(/[\s\-+]/g, "");
    let local = clean;
    if (clean.startsWith("977")) local = clean.slice(3);
    if (!/^9\d{0,9}$/.test(local)) {
      setPhoneError("Phone must be a 10-digit Nepali number starting with 9 (e.g. 9812345678)");
    } else if (local.length === 10 && /^9\d{9}$/.test(local)) {
      setPhoneError("");
    } else if (local.length > 0 && local.length < 10) {
      setPhoneError("Phone must be a 10-digit Nepali number starting with 9 (e.g. 9812345678)");
    } else {
      setPhoneError("");
    }
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (text.length > 0 && text.length < 8) {
      setPasswordError("Password must be at least 8 characters");
    } else {
      setPasswordError("");
    }
  };

  // Location States
  const [showMap, setShowMap] = useState(false);
  const [storeLocation, setStoreLocation] = useState<any>(null);
  const [storeAddress, setStoreAddress] = useState("");

  const handleLocationSelect = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location access is required to set store location.');
      return;
    }
    setShowMap(true);
  };

  const handleConfirmLocation = async (coords: any) => {
    setStoreLocation(coords);
    setShowMap(false);

    const result = await Location.reverseGeocodeAsync(coords);
    if (result.length > 0) {
      const item = result[0];
      setStoreAddress(`${item.name || ''}, ${item.street || ''}, ${item.city || ''}`.replace(/^, |, $/g, ''));
    }
  };

  const handleRegister = async () => {
    // 1. Validation
    if (!fullName || !email || !phone || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      setEmailError("Please enter a valid email address (e.g., example@gmail.com)");
      return;
    }

    const cleanPhone = phone.replace(/[\s-+]/g, "");
    let localPhone = cleanPhone;
    if (cleanPhone.startsWith("977")) {
      localPhone = cleanPhone.slice(3);
    } else if (cleanPhone.startsWith("+977")) {
      localPhone = cleanPhone.slice(4);
    }
    if (!/^9\d{9}$/.test(localPhone)) {
      setPhoneError("Phone must be a 10-digit Nepali number starting with 9 (e.g. 9812345678)");
      return;
    }

    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }

    if (role === "business") {
      if (!storeName) {
        Alert.alert("Error", "Please enter your Store Name");
        return;
      }
      if (!storeLocation) {
        Alert.alert("Error", "Please set your Store Location on the map");
        return;
      }
    }

    if (!agreedToTerms) {
      Alert.alert("Error", "You must agree to the Terms and Privacy Policy");
      return;
    }

    setLoading(true);

    try {
      // 2. API Call (Hits /api/auth/signup via your api.ts)
      const response = await api.register({
        fullName,
        storeName: role === "business" ? storeName : null,
        storeLat: role === "business" ? storeLocation.latitude : null,
        storeLng: role === "business" ? storeLocation.longitude : null,
        storeAddress: role === "business" ? storeAddress : null,
        email,
        phone,
        password,
        role: role,
      });

      if (response.success) {
        const displayRole = role.charAt(0).toUpperCase() + role.slice(1);
        Alert.alert("Success", `Registered as ${displayRole} successfully!`, [
          { text: "Login Now", onPress: () => navigation.navigate("Login") }
        ]);
      }
    } catch (error: any) {
      console.error("Registration Error:", error.message);
      // Handles the HTML error if the route is wrong
      if (error.message.includes("HTML")) {
        Alert.alert("Server Error", "Endpoint not found. Check if your api.ts uses /api/auth/signup");
      } else {
        Alert.alert("Registration Failed", error.message || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient colors={["#244F42", "#244F42"]} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} bounces={false}>
          <View style={styles.container}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.title}>Join Our Community.</Text>

            {/* ROLE SELECTOR */}
            <Text style={styles.roleLabel}>I want to join as a:</Text>
            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[styles.roleTab, role === 'consumer' && styles.activeRoleTab]}
                onPress={() => setRole('consumer')}
              >
                <Ionicons name="person" size={18} color={role === 'consumer' ? "#244F42" : "#fff"} />
                <Text style={[styles.roleTabText, role === 'consumer' && styles.activeRoleText]}>User</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleTab, role === 'business' && styles.activeRoleTab]}
                onPress={() => setRole('business')}
              >
                <MaterialCommunityIcons name="storefront" size={18} color={role === 'business' ? "#244F42" : "#fff"} />
                <Text style={[styles.roleTabText, role === 'business' && styles.activeRoleText]}>Store</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleTab, role === 'driver' && styles.activeRoleTab]}
                onPress={() => setRole('driver')}
              >
                <MaterialCommunityIcons name="moped" size={18} color={role === 'driver' ? "#244F42" : "#fff"} />
                <Text style={[styles.roleTabText, role === 'driver' && styles.activeRoleText]}>Driver</Text>
              </TouchableOpacity>
            </View>

            {/* INPUTS */}
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#fff" style={styles.inputIcon} />
              <TextInput
                placeholder={role === "business" ? "Owner Full Name" : "Full Name"}
                placeholderTextColor="#BFBFBF"
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            {role === "business" && (
              <>
                <View style={styles.inputContainer}>
                  <MaterialCommunityIcons name="storefront-outline" size={20} color="#fff" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Store Name (e.g., German Bakery)"
                    placeholderTextColor="#BFBFBF"
                    style={styles.input}
                    value={storeName}
                    onChangeText={setStoreName}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.inputContainer, storeLocation && styles.successBorder]}
                  onPress={handleLocationSelect}
                >
                  <Ionicons
                    name={storeLocation ? "location" : "location-outline"}
                    size={20}
                    color={storeLocation ? "#F5A623" : "#fff"}
                    style={styles.inputIcon}
                  />
                  <Text style={[styles.input, { color: storeLocation ? "#fff" : "#BFBFBF" }]} numberOfLines={1}>
                    {storeLocation ? storeAddress : "Set Store Location on Map"}
                  </Text>
                  {storeLocation && <Ionicons name="checkmark-circle" size={18} color="#27AB34" />}
                </TouchableOpacity>
              </>
            )}

            <View style={[styles.inputContainer, emailError ? styles.errorBorder : null]}>
              <Ionicons name="mail-outline" size={20} color="#fff" style={styles.inputIcon} />
              <TextInput placeholder="Email Address" placeholderTextColor="#BFBFBF" style={styles.input} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={handleEmailChange} />
            </View>
            {emailError ? (
              <Text style={styles.errorText}>{emailError}</Text>
            ) : null}

            <View style={[styles.inputContainer, phoneError ? styles.errorBorder : null]}>
              <Ionicons name="call-outline" size={20} color="#fff" style={styles.inputIcon} />
              <TextInput placeholder="Phone Number" placeholderTextColor="#BFBFBF" style={styles.input} keyboardType="phone-pad" value={phone} onChangeText={handlePhoneChange} />
            </View>
            {phoneError ? (
              <Text style={styles.errorText}>{phoneError}</Text>
            ) : null}

            <View style={[styles.inputContainer, passwordError ? styles.errorBorder : null]}>
              <Ionicons name="lock-closed-outline" size={20} color="#fff" style={styles.inputIcon} />
              <TextInput placeholder="Password" placeholderTextColor="#BFBFBF" style={styles.input} secureTextEntry value={password} onChangeText={handlePasswordChange} />
            </View>
            {passwordError ? (
              <Text style={styles.errorText}>{passwordError}</Text>
            ) : null}

            <TouchableOpacity style={styles.termsRow} onPress={() => setAgreedToTerms(!agreedToTerms)} activeOpacity={0.7}>
              <Ionicons name={agreedToTerms ? "checkbox" : "square-outline"} size={22} color={agreedToTerms ? "#F4A71D" : "#fff"} />
              <Text style={styles.termsText}>
                I agree to the{" "}
                <Text
                  style={styles.termsLink}
                  onPress={() => setTermsModalVisible(true)}
                >
                  Terms and Conditions
                </Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.registerBtn, (!agreedToTerms || loading) && styles.disabledBtn]}
              onPress={handleRegister}
              disabled={!agreedToTerms || loading}
            >
              {loading ? <ActivityIndicator color="#244F42" /> : <Text style={styles.registerBtnText}>REGISTER</Text>}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                <Text style={styles.loginLinkText}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>

      <MapModal
        visible={showMap}
        onClose={() => setShowMap(false)}
        onConfirm={handleConfirmLocation}
      />

      <TermsModal
        visible={termsModalVisible}
        onClose={() => setTermsModalVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const TERMS_POINTS = [
  "Use the platform only for legitimate food rescue purposes",
  "Not misuse or resell donated food for profit",
  "Provide accurate information during registration",
  "Respect restaurant and NGO partners on the platform",
  "Not engage in fraudulent orders or fake donations",
  "Accept that violations may result in account suspension",
];

const TermsModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
          {/* Header accent bar */}
          <View style={styles.modalAccentBar} />

          <Text style={styles.modalTitle}>SaveABite Terms and Conditions</Text>
          <Text style={styles.modalSubtitle}>By registering you agree to:</Text>

          <View style={styles.modalPointsList}>
            {TERMS_POINTS.map((point, i) => (
              <View key={i} style={styles.modalPointRow}>
                <View style={styles.modalBullet} />
                <Text style={styles.modalPointText}>{point}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.modalClosingLine}>
            SaveABite reserves the right to suspend accounts that violate these terms.
          </Text>
        </ScrollView>

        <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose} activeOpacity={0.85}>
          <Text style={styles.modalCloseBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const MapModal = ({ visible, onClose, onConfirm }: any) => {
  const [region, setRegion] = useState<any>({
    latitude: 27.7172,
    longitude: 85.3240,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [marker, setMarker] = useState<any>(null);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.mapHeader}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#244F42" />
        </TouchableOpacity>
        <Text style={styles.mapTitle}>Set Store Location</Text>
        <View style={{ width: 40 }} />
      </View>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={region}
        onRegionChangeComplete={(r) => setMarker({ latitude: r.latitude, longitude: r.longitude })}
      >
        {marker && <Marker coordinate={marker} />}
      </MapView>
      <View style={styles.markerFixed}>
        <Ionicons name="location" size={40} color="#C62828" />
      </View>
      <View style={styles.mapFooter}>
        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={() => onConfirm(marker)}
        >
          <Text style={styles.confirmBtnText}>Confirm Location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scrollContainer: { flexGrow: 1, paddingVertical: 40 },
  container: { flex: 1, paddingHorizontal: 30, justifyContent: "center" },
  backBtn: { marginBottom: 15, width: 40 },
  title: { color: "#fff", fontSize: 28, fontWeight: "bold", marginBottom: 20 },
  roleLabel: { color: '#fff', fontSize: 14, marginBottom: 10, opacity: 0.8 },
  roleContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 15, padding: 5, marginBottom: 25 },
  roleTab: { flex: 1, flexDirection: 'row', height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 12, gap: 5 },
  activeRoleTab: { backgroundColor: '#F5A623' },
  roleTabText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  activeRoleText: { color: '#244F42' },
  inputContainer: { flexDirection: "row", alignItems: "center", borderColor: "rgba(255,255,255,0.3)", borderWidth: 1, borderRadius: 25, height: 50, paddingHorizontal: 15, marginBottom: 15 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: "#fff", fontSize: 16 },
  successBorder: { borderColor: '#F5A623' },
  errorBorder: { borderColor: '#FF6B6B', marginBottom: 4 },
  errorText: { color: '#FF6B6B', fontSize: 12, marginBottom: 11, marginLeft: 15 },
  termsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 25, marginTop: 5 },
  termsText: { color: "#fff", fontSize: 13, marginLeft: 10 },
  termsLink: { color: "#F4A71D", fontWeight: "bold", textDecorationLine: "underline" },
  boldText: { fontWeight: "bold", textDecorationLine: "underline" },
  registerBtn: { backgroundColor: "#F5A623", height: 50, borderRadius: 25, justifyContent: "center", alignItems: "center", marginTop: 5 },
  registerBtnText: { color: "#244F42", fontWeight: "bold", fontSize: 16 },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 25 },
  footerText: { color: "#fff", fontSize: 14 },
  loginLinkText: { color: "#F5A623", fontWeight: "bold", fontSize: 14 },
  disabledBtn: { opacity: 0.6 },

  // Map Styles
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#eee' },
  closeBtn: { padding: 4 },
  mapTitle: { fontSize: 18, fontWeight: 'bold', color: '#244F42' },
  markerFixed: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -40 },
  mapFooter: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  confirmBtn: { backgroundColor: '#244F42', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  // Terms Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '80%', paddingBottom: 30 },
  modalScroll: { paddingHorizontal: 24, paddingBottom: 8 },
  modalAccentBar: { width: 40, height: 4, backgroundColor: '#244F42', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#244F42', marginBottom: 6 },
  modalSubtitle: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 18 },
  modalPointsList: { gap: 12, marginBottom: 22 },
  modalPointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  modalBullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F4A71D', marginTop: 6, flexShrink: 0 },
  modalPointText: { flex: 1, fontSize: 14, color: '#333', lineHeight: 21 },
  modalClosingLine: { fontSize: 13, color: '#666', fontStyle: 'italic', lineHeight: 20, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 16, marginBottom: 4 },
  modalCloseBtn: { marginHorizontal: 24, marginTop: 16, backgroundColor: '#244F42', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  modalCloseBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});