import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";

type Props = {
  navigation: any;
};

export default function BusinessSettings({ navigation }: Props) {
  const [user, setUser] = useState<any>(null);

  // Form Fields
  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Change Password States
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useFocusEffect(
    React.useCallback(() => {
      loadUser();
    }, [])
  );

  const loadUser = async () => {
    try {
      const freshUser = await api.getMe();
      if (freshUser.success && freshUser.user) {
        setUser(freshUser.user);
        setStoreName(freshUser.user.store_name || "");
        setPhone(freshUser.user.phone || "");
        await AsyncStorage.setItem("user", JSON.stringify(freshUser.user));
      } else {
        const userData = await AsyncStorage.getItem("user");
        if (userData) {
          const parsed = JSON.parse(userData);
          setUser(parsed);
          setStoreName(parsed.store_name || "");
          setPhone(parsed.phone || "");
        }
      }
    } catch (e) {
      const userData = await AsyncStorage.getItem("user");
      if (userData) {
        const parsed = JSON.parse(userData);
        setUser(parsed);
        setStoreName(parsed.store_name || "");
        setPhone(parsed.phone || "");
      }
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: () => navigation.replace("Login")
        }
      ]
    );
  };

  const handleSaveStoreInfo = async () => {
    if (!storeName.trim()) {
      Alert.alert("Error", "Store name is required.");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Error", "Phone number is compulsory.");
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
      Alert.alert("Invalid Phone Number", "Please enter a valid compulsory 10-digit Nepali phone number starting with 9 (e.g. 98xxxxxxxx).");
      return;
    }

    try {
      setSavingProfile(true);
      const res = await api.updateProfile({ store_name: storeName, phone });
      if (res.success) {
        Alert.alert("Success 🎉", "Store details updated successfully!");
        loadUser();
      } else {
        Alert.alert("Error", res.message || "Failed to update store details.");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update store details.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    if (!currentPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
      setPasswordError("All password fields are required.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    try {
      setSavingPassword(true);
      const res = await api.changePassword(currentPassword, newPassword);
      if (res.success) {
        Alert.alert("Success 🎉", "Your password has been changed successfully!");
        setChangePasswordModalVisible(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        setPasswordError(res.message || "Incorrect current password.");
      }
    } catch (err: any) {
      console.error("Change password error:", err);
      setPasswordError(err.message || "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const SettingItem = ({ icon, title, subtitle, onPress, isDestructive }: any) => (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, isDestructive && styles.destructiveIconBg]}>
        <Ionicons name={icon} size={20} color={isDestructive ? "#FF6B6B" : "#F5A623"} />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.settingTitle, isDestructive && styles.destructiveText]}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="rgba(232, 232, 204, 0.4)" />
    </TouchableOpacity>
  );

  const isModified = storeName !== (user?.store_name || "") || phone !== (user?.phone || "");

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#244F42" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#E8E8CC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Store Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <Text style={styles.sectionLabel}>Store Info</Text>
        <View style={styles.groupCard}>
          <View style={styles.inputContainerRow}>
            <View style={styles.iconBox}>
              <Ionicons name="business-outline" size={18} color="#F5A623" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabelInline}>Store Name</Text>
              <TextInput
                style={styles.inlineInput}
                value={storeName}
                onChangeText={setStoreName}
                placeholder="Store Name"
                placeholderTextColor="rgba(232, 232, 204, 0.4)"
              />
            </View>
          </View>

          <View style={styles.inputContainerRow}>
            <View style={styles.iconBox}>
              <Ionicons name="call-outline" size={18} color="#F5A623" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabelInline}>Phone Number</Text>
              <TextInput
                style={styles.inlineInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone Number"
                placeholderTextColor="rgba(232, 232, 204, 0.4)"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <SettingItem
            icon="location-outline"
            title="Store Location"
            subtitle={user?.store_address || "Set store location on map"}
            onPress={() => navigation.navigate("SetStoreLocation")}
          />

          {isModified && (
            <TouchableOpacity
              style={[styles.saveProfileBtn, savingProfile && { opacity: 0.7 }]}
              onPress={handleSaveStoreInfo}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator color="#244F42" size="small" />
              ) : (
                <Text style={styles.saveProfileBtnText}>Save Store Details</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionLabel}>Personal Info</Text>
        <View style={styles.groupCard}>
          <SettingItem icon="mail-outline" title="Email" subtitle={user?.email} />
        </View>

        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.groupCard}>
          <SettingItem
            icon="key-outline"
            title="Change Password"
            subtitle="Update your password securely"
            onPress={() => {
              setPasswordError("");
              setChangePasswordModalVisible(true);
            }}
          />
        </View>

        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.groupCard}>
          <SettingItem icon="document-text-outline" title="Terms & Policies" />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={22} color="#FF6B6B" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>App Version 1.0.4</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* CHANGE PASSWORD MODAL */}
      <Modal
        visible={changePasswordModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!savingPassword) setChangePasswordModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay} onStartShouldSetResponder={() => true}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Change Password</Text>

            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Current Password"
                placeholderTextColor="rgba(232, 232, 204, 0.4)"
                secureTextEntry={!showCurrentPassword}
                editable={!savingPassword}
              />
              <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={styles.eyeBtn}>
                <Ionicons name={showCurrentPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#E8E8CC" style={{ opacity: 0.7 }} />
              </TouchableOpacity>
            </View>

            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="New Password (min 8 chars)"
                placeholderTextColor="rgba(232, 232, 204, 0.4)"
                secureTextEntry={!showNewPassword}
                editable={!savingPassword}
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeBtn}>
                <Ionicons name={showNewPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#E8E8CC" style={{ opacity: 0.7 }} />
              </TouchableOpacity>
            </View>

            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                placeholder="Confirm New Password"
                placeholderTextColor="rgba(232, 232, 204, 0.4)"
                secureTextEntry={!showConfirmNewPassword}
                editable={!savingPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmNewPassword(!showConfirmNewPassword)} style={styles.eyeBtn}>
                <Ionicons name={showConfirmNewPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#E8E8CC" style={{ opacity: 0.7 }} />
              </TouchableOpacity>
            </View>

            {passwordError ? (
              <Text style={styles.passwordErrorText}>{passwordError}</Text>
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setChangePasswordModalVisible(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
                disabled={savingPassword}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={handleChangePassword}
                disabled={savingPassword}
              >
                {savingPassword ? (
                  <ActivityIndicator size="small" color="#244F42" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#244F42" },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 15 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(232, 232, 204, 0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#E8E8CC' },
  scrollContent: { paddingHorizontal: 20 },
  sectionLabel: { color: '#F5A623', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 10, marginTop: 25 },
  groupCard: { backgroundColor: 'rgba(232, 232, 204, 0.08)', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(232, 232, 204, 0.1)' },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(232, 232, 204, 0.05)' },
  iconContainer: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(245, 166, 35, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },

  destructiveIconBg: { backgroundColor: 'rgba(255, 107, 107, 0.15)' },
  destructiveText: { color: '#FF6B6B' },
  textContainer: { flex: 1 },

  settingTitle: { fontSize: 15, fontWeight: '600', color: '#E8E8CC' },
  settingSubtitle: { fontSize: 12, color: 'rgba(232, 232, 204, 0.5)', marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 40, padding: 16, borderRadius: 16, backgroundColor: 'rgba(255, 107, 107, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 107, 107, 0.2)' },
  logoutText: { color: '#FF6B6B', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },
  versionText: { textAlign: 'center', color: 'rgba(232, 232, 204, 0.3)', fontSize: 12, marginTop: 30 },

  // Modal styles for Password & Phone Changes
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContainer: { width: '100%', maxWidth: 340, backgroundColor: '#244F42', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(232, 232, 204, 0.15)', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#E8E8CC', marginBottom: 15, textAlign: 'center' },
  modalInput: { backgroundColor: 'rgba(232, 232, 204, 0.08)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: '#E8E8CC', fontSize: 16, borderWidth: 1, borderColor: 'rgba(232, 232, 204, 0.1)', marginBottom: 15 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cancelBtn: { backgroundColor: 'rgba(232, 232, 204, 0.1)' },
  cancelBtnText: { color: 'rgba(232, 232, 204, 0.7)', fontWeight: '600', fontSize: 15 },
  saveBtn: { backgroundColor: '#F5A623' },
  saveBtnText: { color: '#244F42', fontWeight: 'bold', fontSize: 15 },
  inputContainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(232, 232, 204, 0.05)',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  inputLabelInline: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F5A623',
    textTransform: 'uppercase',
  },
  inlineInput: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E8E8CC',
    padding: 0,
    marginTop: 2,
  },
  saveProfileBtn: {
    backgroundColor: '#F5A623',
    height: 48,
    margin: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveProfileBtnText: {
    color: '#244F42',
    fontWeight: 'bold',
    fontSize: 15,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232, 232, 204, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(232, 232, 204, 0.1)',
    marginBottom: 15,
    paddingHorizontal: 16,
    height: 48,
  },
  passwordInput: {
    flex: 1,
    color: '#E8E8CC',
    fontSize: 16,
    height: '100%',
    padding: 0,
  },
  eyeBtn: {
    paddingLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passwordErrorText: {
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
});