import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
  StatusBar, Alert, Dimensions, Image, Modal
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { api, API_BASE_URL } from '../services/api';

const { width } = Dimensions.get('window');

const COLORS = {
  primary:   '#244F42',
  secondary: '#C8E0C8',
  accent:    '#F4A71D',
  white:     '#FFFFFF',
  bgGray:    '#F3F4F6',
  textSub:   '#757575',
  urgent:    '#E51904',
  success:   '#27AB34',
  amber:     '#8B6914',
};

// ─── Status helpers ───────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  accepted:              { label: 'Accepted',          color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  proof_pending:         { label: 'Awaiting Proof',    color: COLORS.amber, bg: 'rgba(139,105,20,0.12)' },
  verified:              { label: 'Verified ✓',        color: COLORS.success, bg: 'rgba(39,171,52,0.12)' },
  delivery_unconfirmed:  { label: 'Proof Expired',     color: COLORS.urgent, bg: 'rgba(229,25,4,0.1)' },
};

export default function NGOHomepage() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'Donations' | 'History'>('Donations');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [donations, setDonations] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  // Proof upload modal state
  const [proofModalVisible, setProofModalVisible] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<any>(null);
  const [proofImageUri, setProofImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Load user data once when the screen comes into focus — not on every tab switch.
  useFocusEffect(useCallback(() => {
    loadUserData();
    fetchDonations(activeTab);
  }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when the tab changes, but do NOT re-register the focus effect.
  useEffect(() => {
    fetchDonations(activeTab);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadUserData = async () => {
    try {
      const saved = await AsyncStorage.getItem('user');
      if (saved) setUser(JSON.parse(saved));
    } catch (e) {}
  };

  // Accept the tab as a parameter so this function never reads a stale closure.
  const fetchDonations = async (tab: 'Donations' | 'History') => {
    setLoading(true);
    try {
      const result = tab === 'Donations'
        ? await api.getAvailableDonations()
        : await api.getMyDonations();
      if (result.success) setDonations(result.donations || []);
    } catch (e) {
      console.error('NGO Fetch Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAccept = (item: any) => {
    Alert.alert(
      'Accept Donation',
      `Accept the rescue for "${item.item_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              const result = await api.acceptDonation(item.id);
              if (result.success) {
                Alert.alert('Accepted!', result.message || 'Donation accepted.');
                fetchDonations(activeTab);
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Something went wrong');
            }
          },
        },
      ]
    );
  };

  const openProofModal = (item: any) => {
    setSelectedDonation(item);
    setProofImageUri(null);
    setProofModalVisible(true);
  };

  const pickProofImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera roll access is required to upload proof.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setProofImageUri(result.assets[0].uri);
    }
  };

  const handleUploadProof = async () => {
    if (!proofImageUri || !selectedDonation) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('proof', {
        uri: proofImageUri,
        name: 'proof.jpg',
        type: 'image/jpeg',
      } as any);

      const result = await api.uploadDonationProof(selectedDonation.id, formData);
      if (result.success) {
        Alert.alert('Verified!', 'Proof uploaded. The donation is now fully verified.');
        setProofModalVisible(false);
        setProofImageUri(null);
        fetchDonations(activeTab);
      }
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not upload proof.');
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (d: Date | null) => {
    if (!d) return 'End of day';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (d: Date | null) => {
    if (!d) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTimestamp = (iso: string | null) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // ─── Donation card (Live Donations tab) ───────────────────────
  const renderAvailableCard = (item: any) => {
    const consumerDeadline = item.rescue_deadline ? new Date(item.rescue_deadline) : null;
    const ngoDeadline = item.ngo_expiry ? new Date(item.ngo_expiry) : null;

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.tagRow}>
          <View style={[styles.tag, item.is_urgent && { backgroundColor: COLORS.urgent }]}>
            <Text style={styles.tagText}>{item.is_urgent ? 'URGENT' : 'RESCUE'}</Text>
          </View>
          {ngoDeadline && (
            <View style={[styles.tag, { backgroundColor: COLORS.accent }]}>
              <Text style={styles.tagText}>EXPIRES {formatDate(ngoDeadline)}</Text>
            </View>
          )}
        </View>

        <Text style={styles.itemName}>{item.item_name}</Text>
        <Text style={styles.storeName}>📍 {item.store_name}</Text>

        <View style={styles.cardFooterRow}>
          <View>
            <Text style={styles.timeLabel}>Rescue Window</Text>
            <Text style={styles.timeValue}>
              {formatTime(consumerDeadline)} — {formatTime(ngoDeadline)}
            </Text>
          </View>
          <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item)}>
            <Text style={styles.acceptBtnText}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── History card (My Pickups tab) ────────────────────────────
  const renderHistoryCard = (item: any) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG['accepted'];
    const isProofPending = item.status === 'proof_pending';
    const isVerified = item.status === 'verified';
    const isExpired = item.status === 'delivery_unconfirmed';

    return (
      <View key={item.id} style={styles.card}>
        {/* Status badge */}
        <View style={styles.tagRow}>
          <View style={[styles.tag, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.tagText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        <Text style={styles.itemName}>{item.item_name}</Text>
        <Text style={styles.storeName}>📍 {item.store_name}</Text>

        {/* Accepted — waiting for restaurant to confirm pickup */}
        {item.status === 'accepted' && (
          <View style={styles.infoBox}>
            <Ionicons name="time-outline" size={15} color={COLORS.textSub} />
            <Text style={styles.infoBoxText}>
              Waiting for the restaurant to confirm pickup.
            </Text>
          </View>
        )}

        {/* Proof pending — NGO must upload photo */}
        {isProofPending && (
          <>
            <View style={[styles.infoBox, { borderColor: COLORS.amber + '50', backgroundColor: 'rgba(139,105,20,0.06)' }]}>
              <Ionicons name="camera-outline" size={15} color={COLORS.amber} />
              <Text style={[styles.infoBoxText, { color: COLORS.amber }]}>
                Restaurant confirmed pickup. Upload proof that food reached beneficiaries.
                {item.hours_remaining != null
                  ? ` (${item.hours_remaining}h remaining)`
                  : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.uploadProofBtn}
              onPress={() => openProofModal(item)}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-upload-outline" size={18} color={COLORS.white} />
              <Text style={styles.uploadProofBtnText}>Upload Proof Photo</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Verified — show proof photo + timestamp */}
        {isVerified && item.proof_image_url && (
          <View style={styles.proofSection}>
            <View style={styles.proofHeader}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={styles.proofHeaderText}>
                Proof uploaded · {formatTimestamp(item.proof_uploaded_at)}
              </Text>
            </View>
            <Image
              source={{
                uri: `${API_BASE_URL}${item.proof_image_url}`,
                headers: { 'ngrok-skip-browser-warning': '69420' },
              }}
              style={styles.proofImage}
              resizeMode="cover"
            />
          </View>
        )}

        {/* Expired */}
        {isExpired && (
          <View style={[styles.infoBox, { borderColor: COLORS.urgent + '40', backgroundColor: 'rgba(229,25,4,0.05)' }]}>
            <Ionicons name="alert-circle-outline" size={15} color={COLORS.urgent} />
            <Text style={[styles.infoBoxText, { color: COLORS.urgent }]}>
              Proof deadline passed without upload. Marked as unconfirmed.
            </Text>
          </View>
        )}

        <Text style={styles.cardMeta}>
          Accepted: {formatTimestamp(item.accepted_at)}
          {item.picked_up_at ? `  ·  Picked up: ${formatTimestamp(item.picked_up_at)}` : ''}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'N'}
            </Text>
          </View>
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.welcomeText}>NGO Dashboard</Text>
            <Text style={styles.ngoName}>{user?.full_name || 'NGO Partner'}</Text>
          </View>
        </View>

      </View>

      <View style={styles.whiteSheet}>
        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={[styles.statBox, { backgroundColor: COLORS.secondary }]}>
            <Text style={styles.statVal}>{donations.length}</Text>
            <Text style={styles.statLabel}>
              {activeTab === 'Donations' ? 'Available' : 'Total'}
            </Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'Donations' && styles.tabBtnActive]}
            onPress={() => setActiveTab('Donations')}
          >
            <Text style={[styles.tabText, activeTab === 'Donations' && styles.tabTextActive]}>
              Live Donations
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'History' && styles.tabBtnActive]}
            onPress={() => setActiveTab('History')}
          >
            <Text style={[styles.tabText, activeTab === 'History' && styles.tabTextActive]}>
              My Pickups
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchDonations(activeTab); }}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        >
          <Text style={styles.sectionTitle}>
            {activeTab === 'Donations' ? 'Available for Rescue' : 'Donation History'}
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : donations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="fast-food-outline" size={50} color="#ccc" />
              <Text style={styles.emptyText}>
                {activeTab === 'Donations'
                  ? 'No active donations right now.'
                  : 'No donation history yet.'}
              </Text>
            </View>
          ) : (
            donations.map(item =>
              activeTab === 'Donations'
                ? renderAvailableCard(item)
                : renderHistoryCard(item)
            )
          )}
        </ScrollView>
      </View>

      {/* BOTTOM NAV */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() =>
            navigation.reset({ index: 0, routes: [{ name: 'NGOHomepage' }] })
          }
        >
          <Ionicons name="home" size={24} color={COLORS.accent} />
          <Text style={[styles.navLabel, { color: COLORS.accent }]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('UserProfile')}
        >
          <Ionicons name="person-outline" size={24} color="rgba(232,232,204,0.65)" />
          <Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* PROOF UPLOAD MODAL */}
      <Modal visible={proofModalVisible} transparent animationType="slide"
        onRequestClose={() => { if (!uploading) setProofModalVisible(false); }}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Upload Delivery Proof</Text>
            <Text style={styles.modalSub}>
              Take or upload a photo showing the food reached the beneficiaries.
              This photo will be timestamped and visible to the restaurant.
            </Text>

            <TouchableOpacity style={styles.photoPickerBtn} onPress={pickProofImage} activeOpacity={0.8}>
              {proofImageUri ? (
                <Image source={{ uri: proofImageUri }} style={styles.proofPreview} resizeMode="cover" />
              ) : (
                <View style={styles.photoPickerPlaceholder}>
                  <Ionicons name="camera-outline" size={36} color={COLORS.primary} />
                  <Text style={styles.photoPickerText}>Tap to select photo</Text>
                </View>
              )}
            </TouchableOpacity>

            {proofImageUri && (
              <View style={styles.timestampRow}>
                <Ionicons name="time-outline" size={14} color={COLORS.textSub} />
                <Text style={styles.timestampText}>
                  Will be timestamped: {new Date().toLocaleString('en-US', {
                    month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              </View>
            )}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setProofModalVisible(false)}
                disabled={uploading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, (!proofImageUri || uploading) && { opacity: 0.5 }]}
                onPress={handleUploadProof}
                disabled={!proofImageUri || uploading}
              >
                {uploading
                  ? <ActivityIndicator color={COLORS.primary} size="small" />
                  : <Text style={styles.modalSubmitText}>Submit Proof</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 25, paddingTop: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 45, height: 45, borderRadius: 23, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.white },
  avatarText: { fontWeight: 'bold', color: COLORS.primary, fontSize: 18 },
  welcomeText: { color: COLORS.white, fontSize: 11, opacity: 0.8, textTransform: 'uppercase' },
  ngoName: { color: COLORS.white, fontSize: 20, fontWeight: 'bold' },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },

  whiteSheet: { flex: 1, backgroundColor: COLORS.white, borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden' },
  scrollContent: { padding: 20, paddingBottom: 110 },

  statsContainer: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 },
  statBox: { flex: 1, padding: 15, borderRadius: 20, alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: 'bold', color: COLORS.primary },
  statLabel: { fontSize: 11, color: COLORS.textSub, marginTop: 4, fontWeight: '600' },

  tabContainer: { flexDirection: 'row', backgroundColor: COLORS.bgGray, borderRadius: 15, padding: 6, marginHorizontal: 20, marginBottom: 4 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  tabBtnActive: { backgroundColor: COLORS.white, elevation: 3 },
  tabText: { fontSize: 13, fontWeight: 'bold', color: COLORS.textSub },
  tabTextActive: { color: COLORS.primary },

  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.primary, marginBottom: 14 },

  card: { backgroundColor: COLORS.white, borderRadius: 20, padding: 18, marginBottom: 16, elevation: 3, borderWidth: 1, borderColor: '#F0F0F0' },
  tagRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  tag: { backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  tagText: { color: COLORS.white, fontSize: 10, fontWeight: 'bold' },
  itemName: { fontSize: 17, fontWeight: 'bold', color: COLORS.primary, marginBottom: 4 },
  storeName: { fontSize: 13, color: COLORS.textSub, marginBottom: 12 },

  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  timeLabel: { fontSize: 10, color: COLORS.textSub, fontWeight: 'bold' },
  timeValue: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },

  acceptBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  acceptBtnText: { color: COLORS.white, fontSize: 14, fontWeight: 'bold' },

  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  infoBoxText: { flex: 1, fontSize: 12, color: COLORS.textSub, lineHeight: 18 },

  uploadProofBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.amber, borderRadius: 12, paddingVertical: 12, marginBottom: 8 },
  uploadProofBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },

  proofSection: { marginTop: 4, marginBottom: 8 },
  proofHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  proofHeaderText: { fontSize: 11, color: COLORS.success, fontWeight: '600' },
  proofImage: { width: '100%', height: 180, borderRadius: 12 },

  cardMeta: { fontSize: 10, color: COLORS.textSub, marginTop: 8 },

  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: COLORS.textSub, fontSize: 14, marginTop: 10, textAlign: 'center' },

  bottomNav: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: COLORS.primary, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 10 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(232,232,204,0.65)' },

  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#1a3a31', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, borderTopWidth: 1, borderColor: 'rgba(232,232,204,0.08)' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(232,232,204,0.2)', alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#E8E8CC', marginBottom: 8 },
  modalSub: { fontSize: 12, color: 'rgba(232,232,204,0.55)', marginBottom: 20, lineHeight: 18 },

  photoPickerBtn: { height: 180, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(232,232,204,0.08)', borderWidth: 1.5, borderColor: 'rgba(232,232,204,0.15)', borderStyle: 'dashed', marginBottom: 14 },
  photoPickerPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  photoPickerText: { color: 'rgba(232,232,204,0.5)', fontSize: 13, fontWeight: '600' },
  proofPreview: { width: '100%', height: '100%' },

  timestampRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  timestampText: { fontSize: 11, color: 'rgba(232,232,204,0.5)' },

  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancelBtn: { flex: 1, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(232,232,204,0.08)', borderWidth: 1, borderColor: 'rgba(232,232,204,0.1)' },
  modalCancelText: { color: 'rgba(232,232,204,0.6)', fontWeight: '600', fontSize: 14 },
  modalSubmitBtn: { flex: 1, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.accent },
  modalSubmitText: { color: COLORS.primary, fontWeight: '800', fontSize: 14 },
});
