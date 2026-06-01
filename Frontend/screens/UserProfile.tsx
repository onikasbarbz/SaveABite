import React, { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView,
  TouchableOpacity, StatusBar, Alert,
  ActivityIndicator, Platform, Image,
  Modal, TextInput, KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, API_BASE_URL } from '../services/api';
import { useCart } from '../context/CartContext';
import * as ImagePicker from 'expo-image-picker';

const C = {
  forest:    '#244F42',
  forestDim: '#1a3a31',
  cream:     '#E8E8CC',
  amber:     '#F5A623',
  amberDim:  '#8B6914',
  white:     '#FFFFFF',
  bg:        '#F0F0E4',
  text:      '#1A1A1A',
  sub:       '#757575',
  danger:    '#7B2626',
  dangerBg:  '#FEF2F2',
  pending:   '#2563EB',
  reviewing: '#0284C7',
  purple:    '#6B46C1',
};

export default function UserProfile() {
  const navigation = useNavigation<any>();
  const { totalItems } = useCart();
  const insets = useSafeAreaInsets();
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('+977 98xxxxxxxx');
  const [userProfileImage, setUserProfileImage] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState('Kathmandu, Nepal');
  const [ngoStatus, setNgoStatus] = useState<'none' | 'pending' | 'reviewing' | 'rejected' | 'verified'>('none');
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState('consumer');
  const [documentUri, setDocumentUri] = useState<string | null>(null);
  const [impactStats, setImpactStats] = useState({ bags_saved: 0, kg_rescued: 0, co2_reduced: 0 });

  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editProfileImageUri, setEditProfileImageUri] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const handleChangePassword = async () => {
    setPasswordError('');
    if (!currentPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
      setPasswordError("All password fields are required."); return;
    }
    if (newPassword.length < 8) { setPasswordError("New password must be at least 8 characters."); return; }
    if (newPassword !== confirmNewPassword) { setPasswordError("New passwords do not match."); return; }
    try {
      setSavingPassword(true);
      const res = await api.changePassword(currentPassword, newPassword);
      if (res.success) {
        Alert.alert("Success 🎉", "Your password has been changed successfully!");
        setChangePasswordModalVisible(false);
        setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
      } else {
        setPasswordError(res.message || "Incorrect current password.");
      }
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  useFocusEffect(useCallback(() => {
    const loadUser = async () => {
      try {
        const userData = await AsyncStorage.getItem("user");
        if (userData) {
          const user = JSON.parse(userData);
          setCurrentUserId(user.id);
          setUserName(user.full_name || user.name || 'User');
          setUserEmail(user.email || '');
          setUserPhone(user.phone || '+977 98xxxxxxxx');
          setUserProfileImage(user.profile_image ? `${API_BASE_URL}${user.profile_image.startsWith('/') ? '' : '/'}${user.profile_image}` : null);
          try {
            const savedLoc = await AsyncStorage.getItem('user_rescue_location');
            if (savedLoc) { const parsed = JSON.parse(savedLoc); if (parsed.address) setUserLocation(parsed.address); }
          } catch (e) {}
          try {
            const impactRes = await api.getUserImpact(user.id);
            if (impactRes.success && impactRes.stats) setImpactStats(impactRes.stats);
          } catch (e) {}
          const data = await api.getNgoStatus(user.id);
          if (data.success) {
            setNgoStatus(data.status);
            setRejectionReason(data.rejection_reason);
            setRegistrationData(data.registration);
            if (data.role === 'ngo' && user.role !== 'ngo') { await api.refreshToken(); setUserRole('ngo'); }
            else setUserRole(data.role || user.role || 'consumer');
            const uri = data.registration?.document_image
              ? `${API_BASE_URL}${data.registration.document_image.startsWith('/') ? '' : '/'}${data.registration.document_image}`
              : (data.registration?.users?.identity_document
                ? `${API_BASE_URL}${data.registration.users.identity_document.startsWith('/') ? '' : '/'}${data.registration.users.identity_document}`
                : (user.identity_document ? `${API_BASE_URL}${user.identity_document.startsWith('/') ? '' : '/'}${user.identity_document}` : null));
            setDocumentUri(uri);
          } else {
            setNgoStatus('none');
            setUserRole(user.role || 'consumer');
          }
        }
      } catch (e) {
        setNgoStatus('none');
      }
    };
    loadUser();
  }, []));

  const openEditModal = () => {
    setEditName(userName);
    setEditPhone(userPhone === '+977 98xxxxxxxx' ? '' : userPhone);
    setEditProfileImageUri(userProfileImage);
    setEditProfileModalVisible(true);
  };

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (!result.canceled && result.assets?.length > 0) setEditProfileImageUri(result.assets[0].uri);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) { Alert.alert("Error", "Name cannot be empty."); return; }
    if (!editPhone.trim()) { Alert.alert("Error", "Phone number is required."); return; }
    const cleanPhone = editPhone.replace(/[\s\-+]/g, "");
    let localPhone = cleanPhone;
    if (cleanPhone.startsWith("977")) localPhone = cleanPhone.slice(3);
    else if (cleanPhone.startsWith("+977")) localPhone = cleanPhone.slice(4);
    if (!/^9\d{9}$/.test(localPhone)) {
      Alert.alert("Invalid Phone", "Please enter a valid 10-digit Nepali number."); return;
    }
    setSavingProfile(true);
    try {
      const updateRes = await api.updateProfile({ full_name: editName, phone: editPhone });
      if (!updateRes.success) throw new Error(updateRes.message || "Failed to update profile.");
      if (editProfileImageUri && editProfileImageUri !== userProfileImage && currentUserId) {
        const formData = new FormData();
        formData.append("userId", String(currentUserId));
        formData.append("type", "profile");
        const uriParts = editProfileImageUri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        formData.append("image", { uri: editProfileImageUri, name: `profile-${currentUserId}.${fileType}`, type: `image/${fileType}` } as any);
        const imgRes = await api.updateBranding(formData);
        if (!imgRes.success) throw new Error("Profile saved, but image upload failed.");
      }
      Alert.alert("Success", "Profile updated successfully!");
      setEditProfileModalVisible(false);
      const freshUser = await api.getMe();
      if (freshUser.success && freshUser.user) {
        const u = freshUser.user;
        setUserName(u.full_name || u.name || 'User');
        setUserPhone(u.phone || '+977 98xxxxxxxx');
        setUserProfileImage(u.profile_image ? `${API_BASE_URL}${u.profile_image.startsWith('/') ? '' : '/'}${u.profile_image}` : null);
        const saved = await AsyncStorage.getItem("user");
        if (saved) await AsyncStorage.setItem("user", JSON.stringify({ ...JSON.parse(saved), ...u }));
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: async () => { await AsyncStorage.clear(); navigation.navigate('Login'); } }
    ]);
  };

  const ngoConfig: Record<string, { color: string; bg: string; icon: string; title: string; sub: string; tappable?: boolean }> = {
    none:      { color: C.amber,     bg: '#FFFBF0', icon: 'home-heart',          title: 'Are you an NGO?',        sub: 'Register to accept food donations',          tappable: true },
    pending:   { color: C.pending,   bg: '#EFF6FF', icon: 'clock-outline',        title: 'Pending Review',         sub: 'Admin is verifying your details' },
    reviewing: { color: C.reviewing, bg: '#F0F9FF', icon: 'eye-outline',          title: 'Being Reviewed',         sub: 'An admin is checking your documents' },
    rejected:  { color: C.danger,    bg: C.dangerBg,icon: 'alert-circle-outline', title: 'Application Rejected',   sub: rejectionReason || 'Tap to fix & resubmit', tappable: true },
    verified:  { color: C.forest,    bg: '#F0FDF4', icon: 'check-decagram',       title: 'Verified NGO Partner',   sub: 'NGO Dashboard is active' },
  };

  const ngo = ngoConfig[ngoStatus];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* ── Header hero ── */}
      <View style={styles.hero}>

        {/* Avatar */}
        <TouchableOpacity style={styles.avatarRing} onPress={openEditModal} activeOpacity={0.85}>
          {userProfileImage ? (
            <Image source={{ uri: userProfileImage }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="person" size={42} color="rgba(232,232,204,0.6)" />
            </View>
          )}
          <View style={styles.avatarEditDot}>
            <Ionicons name="pencil" size={11} color={C.forest} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={openEditModal} activeOpacity={0.8} style={styles.heroNameRow}>
          <Text style={styles.heroName}>{userName}</Text>
          <Ionicons name="pencil" size={14} color="rgba(232,232,204,0.5)" style={{ marginLeft: 6, marginTop: 2 }} />
        </TouchableOpacity>
        <Text style={styles.heroSub}>Member since 2026</Text>

        {/* Decorative dots */}
        <View style={styles.heroDot1} />
        <View style={styles.heroDot2} />
      </View>

      {/* ── Impact card — floats over hero ── */}
      <View style={styles.impactFloat}>
        <View style={styles.impactCard}>
          <View style={styles.impactHeader}>
            <MaterialCommunityIcons name="leaf" size={16} color={C.amber} />
            <Text style={styles.impactTitle}>Your Impact</Text>
          </View>
          <View style={styles.impactRow}>
            <ImpactStat value={String(impactStats.bags_saved)} label="Rescued" icon="bag-check-outline" />
            <View style={styles.impactDivider} />
            <ImpactStat value={`${impactStats.kg_rescued}kg`} label="Food Saved" icon="scale-outline" />
            <View style={styles.impactDivider} />
            <ImpactStat value={`${impactStats.co2_reduced}kg`} label="CO₂ Saved" icon="cloud-outline" />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── NGO status banner ── */}
        <TouchableOpacity
          style={[styles.ngoBanner, { backgroundColor: ngo.bg, borderColor: ngo.color + '40' }]}
          onPress={ngo.tappable ? () => navigation.navigate(ngoStatus === 'rejected' ? 'NGORegistration' : 'NGORegistration', { userId: currentUserId, existingData: registrationData }) : undefined}
          activeOpacity={ngo.tappable ? 0.75 : 1}
        >
          <View style={[styles.ngoIconBox, { backgroundColor: ngo.color + '15' }]}>
            <MaterialCommunityIcons name={ngo.icon as any} size={22} color={ngo.color} />
          </View>
          <View style={styles.ngoText}>
            <Text style={[styles.ngoTitle, { color: ngo.color }]}>{ngo.title}</Text>
            <Text style={styles.ngoSub} numberOfLines={2}>{ngo.sub}</Text>
            {ngoStatus === 'rejected' && (
              <Text style={[styles.ngoSub, { fontWeight: '700', color: ngo.color, marginTop: 3 }]}>Tap to fix & resubmit →</Text>
            )}
          </View>
          {ngo.tappable && <Ionicons name="chevron-forward" size={18} color={ngo.color} />}
        </TouchableOpacity>

        {/* Admin panel */}
        {userRole === 'admin' && (
          <>
            <TouchableOpacity
              style={[styles.ngoBanner, { backgroundColor: '#FAF5FF', borderColor: C.purple + '40' }]}
              onPress={() => navigation.navigate('AdminNGOVerify')}
            >
              <View style={[styles.ngoIconBox, { backgroundColor: C.purple + '12' }]}>
                <MaterialCommunityIcons name="shield-check" size={22} color={C.purple} />
              </View>
              <View style={styles.ngoText}>
                <Text style={[styles.ngoTitle, { color: C.purple }]}>Admin Panel</Text>
                <Text style={styles.ngoSub}>Review pending NGO applications</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.purple} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.ngoBanner, { backgroundColor: '#FFFBF0', borderColor: C.amber + '40' }]}
              onPress={() => navigation.navigate('AdminCertificates')}
            >
              <View style={[styles.ngoIconBox, { backgroundColor: C.amber + '12' }]}>
                <MaterialCommunityIcons name="certificate-outline" size={22} color={C.amber} />
              </View>
              <View style={styles.ngoText}>
                <Text style={[styles.ngoTitle, { color: C.amber }]}>Certificate Requests</Text>
                <Text style={styles.ngoSub}>Upload certificates for verified donations</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.amber} />
            </TouchableOpacity>
          </>
        )}

        {/* Verification document */}
        {ngoStatus !== 'none' && documentUri && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="file-document-outline" size={18} color={C.forest} />
              <Text style={styles.cardTitle}>Verification Document</Text>
            </View>
            <View style={styles.docPreview}>
              <Image
                source={{ uri: documentUri, headers: { 'ngrok-skip-browser-warning': '69420' } }}
                style={styles.docImg}
              />
              <View style={styles.docBadge}>
                <Ionicons
                  name={ngoStatus === 'verified' ? "checkmark-circle" : ngoStatus === 'rejected' ? "close-circle" : "time-outline"}
                  size={16}
                  color={ngoStatus === 'verified' ? "#4CAF50" : ngoStatus === 'rejected' ? C.danger : C.pending}
                />
                <Text style={styles.docBadgeText}>
                  {ngoStatus === 'verified' ? "Verified" : ngoStatus === 'rejected' ? "Rejected" : "In Review"}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Personal info */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-outline" size={18} color={C.forest} />
            <Text style={styles.cardTitle}>Personal Info</Text>
          </View>
          <InfoRow icon="call-outline" label="Phone" value={userPhone} />
          <InfoRow icon="mail-outline" label="Email" value={userEmail} />
          <InfoRow icon="location-outline" label="Location" value={userLocation} isLast />
        </View>

        {/* Settings */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="settings-outline" size={18} color={C.forest} />
            <Text style={styles.cardTitle}>Settings</Text>
          </View>
          <SettingsRow
            icon="key-outline"
            label="Change Password"
            isLast
            onPress={() => { setPasswordError(''); setChangePasswordModalVisible(true); }}
          />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={C.danger} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Bottom nav ── */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <NavItem
          icon="home"
          label="Home"
          onPress={() => {
            let homeScreen = 'Home';
            if (ngoStatus === 'verified') homeScreen = 'NGOHomepage';
            else if (userRole === 'driver') homeScreen = 'DriverDashboard';
            else if (userRole === 'business') homeScreen = 'BusinessDashboard';
            navigation.reset({ index: 0, routes: [{ name: homeScreen }] });
          }}
        />
        {userRole !== 'ngo' && (
          <NavItem
            icon="receipt"
            label="Orders"
            onPress={() => navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'Orders' }] })}
          />
        )}
        {userRole !== 'ngo' && (
          <NavItem
            icon="cart"
            label="Cart"
            badge={totalItems}
            onPress={() => navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'Cart' }] })}
          />
        )}
        <NavItem icon="person" label="Profile" active />
      </View>

      {/* ── Change Password Modal ── */}
      <Modal visible={changePasswordModalVisible} transparent animationType="slide"
        onRequestClose={() => { if (!savingPassword) setChangePasswordModalVisible(false); }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalBg}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalHeading}>Change Password</Text>
              <Text style={styles.modalHint}>Choose a strong password with at least 8 characters.</Text>

              <PasswordField
                placeholder="Current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                show={showCurrentPassword}
                toggleShow={() => setShowCurrentPassword(v => !v)}
                disabled={savingPassword}
              />
              <PasswordField
                placeholder="New password (min 8 chars)"
                value={newPassword}
                onChangeText={setNewPassword}
                show={showNewPassword}
                toggleShow={() => setShowNewPassword(v => !v)}
                disabled={savingPassword}
              />
              <PasswordField
                placeholder="Confirm new password"
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                show={showConfirmPassword}
                toggleShow={() => setShowConfirmPassword(v => !v)}
                disabled={savingPassword}
              />

              {!!passwordError && <Text style={styles.errorText}>{passwordError}</Text>}

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => { setChangePasswordModalVisible(false); setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword(''); }}
                  disabled={savingPassword}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSaveBtn} onPress={handleChangePassword} disabled={savingPassword}>
                  {savingPassword ? <ActivityIndicator size="small" color={C.forest} /> : <Text style={styles.modalSaveText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit Profile Modal ── */}
      <Modal visible={editProfileModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { paddingBottom: 30 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTopRow}>
              <Text style={styles.modalHeading}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditProfileModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="rgba(232,232,204,0.6)" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={styles.editAvatarBtn} onPress={handlePickImage} activeOpacity={0.8}>
                {editProfileImageUri ? (
                  <Image source={{ uri: editProfileImageUri }} style={styles.editAvatarImg} />
                ) : (
                  <View style={styles.editAvatarFallback}>
                    <Ionicons name="camera" size={32} color="rgba(232,232,204,0.4)" />
                  </View>
                )}
                <View style={styles.editAvatarDot}>
                  <Ionicons name="pencil" size={13} color={C.forest} />
                </View>
              </TouchableOpacity>
              <Text style={styles.editAvatarHint}>Tap to change photo</Text>

              <Text style={styles.modalFieldLabel}>Full Name</Text>
              <View style={styles.modalInput}>
                <Ionicons name="person-outline" size={18} color="rgba(232,232,204,0.4)" />
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="Enter your name"
                  placeholderTextColor="rgba(232,232,204,0.3)"
                  value={editName}
                  onChangeText={setEditName}
                  autoCapitalize="words"
                />
              </View>

              <Text style={styles.modalFieldLabel}>Phone Number</Text>
              <View style={styles.modalInput}>
                <Ionicons name="call-outline" size={18} color="rgba(232,232,204,0.4)" />
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="98xxxxxxxx"
                  placeholderTextColor="rgba(232,232,204,0.3)"
                  value={editPhone}
                  onChangeText={setEditPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.modalSaveBtn, { marginTop: 8 }, savingProfile && { opacity: 0.7 }]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? <ActivityIndicator color={C.forest} /> : <Text style={styles.modalSaveText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

const ImpactStat = ({ value, label, icon }: { value: string; label: string; icon: string }) => (
  <View style={styles.impactStat}>
    <Ionicons name={icon as any} size={16} color={C.amber} style={{ marginBottom: 4 }} />
    <Text style={styles.impactVal}>{value}</Text>
    <Text style={styles.impactLab}>{label}</Text>
  </View>
);

const InfoRow = ({ icon, label, value, isLast }: { icon: string; label: string; value: string; isLast?: boolean }) => (
  <View style={[styles.infoRow, isLast && { borderBottomWidth: 0, marginBottom: 0 }]}>
    <View style={styles.infoIconBox}>
      <Ionicons name={icon as any} size={16} color={C.forest} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const SettingsRow = ({ icon, label, onPress, isLast }: { icon: string; label: string; onPress: () => void; isLast?: boolean }) => (
  <TouchableOpacity
    style={[styles.settingsRow, isLast && { borderBottomWidth: 0 }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.infoIconBox}>
      <Ionicons name={icon as any} size={16} color={C.forest} />
    </View>
    <Text style={styles.settingsLabel}>{label}</Text>
    <Ionicons name="chevron-forward" size={16} color="rgba(36,79,66,0.35)" />
  </TouchableOpacity>
);

const NavItem = ({ icon, label, active, onPress, badge }: { icon: string; label: string; active?: boolean; onPress?: () => void; badge?: number }) => (
  <TouchableOpacity style={styles.navItem} onPress={onPress}>
    <View>
      <Ionicons name={active ? icon : `${icon}-outline` as any} size={24} color={active ? C.amber : 'rgba(232,232,204,0.65)'} />
      {!!badge && badge > 0 && (
        <View style={styles.navBadge}><Text style={styles.navBadgeText}>{badge}</Text></View>
      )}
    </View>
    <Text style={[styles.navLabel, active && { color: C.amber }]}>{label}</Text>
  </TouchableOpacity>
);

const PasswordField = ({ placeholder, value, onChangeText, show, toggleShow, disabled }: any) => (
  <View style={styles.pwField}>
    <TextInput
      style={styles.pwInput}
      placeholder={placeholder}
      placeholderTextColor="rgba(232,232,204,0.3)"
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={!show}
      editable={!disabled}
    />
    <TouchableOpacity onPress={toggleShow} style={styles.pwEye}>
      <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={18} color="rgba(232,232,204,0.45)" />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Hero
  hero: {
    backgroundColor: C.forest,
    paddingTop: 10,
    paddingBottom: 60,
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroSettings: {
    position: 'absolute',
    top: 14,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroDot1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(232,232,204,0.04)',
    bottom: -30,
    left: -30,
  },
  heroDot2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245,166,35,0.06)',
    top: 10,
    right: 30,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: 'rgba(245,166,35,0.5)',
    backgroundColor: '#1a3a31',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 48 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarEditDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.amber,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: C.forest,
  },
  heroNameRow: { flexDirection: 'row', alignItems: 'center' },
  heroName: { fontSize: 22, fontWeight: '800', color: C.cream, letterSpacing: -0.3 },
  heroSub: { fontSize: 12, color: 'rgba(232,232,204,0.45)', marginTop: 4 },

  // Impact card
  impactFloat: { paddingHorizontal: 16, marginTop: -36, zIndex: 10, marginBottom: 6 },
  impactCard: {
    backgroundColor: C.white,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  impactHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  impactTitle: { fontSize: 13, fontWeight: '700', color: C.text, letterSpacing: 0.2 },
  impactRow: { flexDirection: 'row', alignItems: 'center' },
  impactStat: { flex: 1, alignItems: 'center' },
  impactDivider: { width: 1, height: 40, backgroundColor: '#E5E5E5' },
  impactVal: { fontSize: 18, fontWeight: '800', color: C.forest },
  impactLab: { fontSize: 10, color: C.sub, marginTop: 2, fontWeight: '500' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14 },

  // NGO banner
  ngoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  ngoIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ngoText: { flex: 1 },
  ngoTitle: { fontSize: 14, fontWeight: '800' },
  ngoSub: { fontSize: 11, color: C.sub, marginTop: 2, lineHeight: 15 },

  // Cards
  card: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: C.text, letterSpacing: 0.1 },

  // Doc preview
  docPreview: {
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: C.bg,
  },
  docImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  docBadge: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    gap: 5,
  },
  docBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 2,
    gap: 12,
  },
  infoIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(36,79,66,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLabel: { fontSize: 10, color: C.sub, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  infoValue: { fontSize: 14, fontWeight: '600', color: C.text, marginTop: 1 },

  // Settings rows
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  settingsLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.danger + '40',
    backgroundColor: C.dangerBg,
    marginTop: 4,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: C.danger },

  // Bottom nav
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: C.forest,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 10,
  },
  navItem: { alignItems: 'center', gap: 4 },
  navLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(232,232,204,0.65)' },
  navBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: C.amber,
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navBadgeText: { color: C.forest, fontSize: 9, fontWeight: '800' },

  // Modals
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: C.forestDim,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(232,232,204,0.08)',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(232,232,204,0.2)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalHeading: { fontSize: 18, fontWeight: '800', color: C.cream, marginBottom: 6 },
  modalHint: { fontSize: 12, color: 'rgba(232,232,204,0.45)', marginBottom: 18 },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(232,232,204,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(232,232,204,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(232,232,204,0.1)',
  },
  modalCancelText: { color: 'rgba(232,232,204,0.6)', fontWeight: '600', fontSize: 14 },
  modalSaveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.amber,
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  modalSaveText: { color: C.forest, fontWeight: '800', fontSize: 14 },
  errorText: { color: '#FF7C7C', fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 10 },

  // Password field
  pwField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(232,232,204,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(232,232,204,0.1)',
    marginBottom: 12,
    paddingHorizontal: 14,
  },
  pwInput: { flex: 1, paddingVertical: 13, color: C.cream, fontSize: 14 },
  pwEye: { padding: 6 },

  // Edit profile modal
  editAvatarBtn: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(232,232,204,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(245,166,35,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    overflow: 'hidden',
    marginBottom: 6,
  },
  editAvatarImg: { width: '100%', height: '100%', borderRadius: 45 },
  editAvatarFallback: { justifyContent: 'center', alignItems: 'center' },
  editAvatarDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.amber,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: C.forestDim,
  },
  editAvatarHint: { fontSize: 12, color: 'rgba(232,232,204,0.4)', textAlign: 'center', marginBottom: 24 },
  modalFieldLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(232,232,204,0.5)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  modalInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(232,232,204,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(232,232,204,0.1)',
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  modalTextInput: { flex: 1, paddingVertical: 13, color: C.cream, fontSize: 14 },
});
