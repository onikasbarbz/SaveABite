import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Image, Alert, ActivityIndicator,
  RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api, API_BASE_URL } from '../services/api';

const COLORS = {
  primary: '#244F42',
  accent:  '#F4A71D',
  white:   '#FFFFFF',
  bgGray:  '#F3F4F6',
  textSub: '#757575',
  urgent:  '#E51904',
  success: '#27AB34',
  amber:   '#8B6914',
};

function imageUri(path: string | null | undefined) {
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
}

function statusLabel(status: string, displayStatus?: string) {
  const s = displayStatus || status;
  switch (s) {
    case 'accepted':             return { label: 'Awaiting pickup',       color: '#F57C00', bg: '#FFF3E0' };
    case 'proof_pending':        return { label: 'Awaiting NGO proof',    color: '#1565C0', bg: '#E3F2FD' };
    case 'verified':             return { label: 'Delivery verified',     color: COLORS.success, bg: '#E8F5E9' };
    case 'delivery_unconfirmed': return { label: 'Delivery unconfirmed',  color: COLORS.urgent, bg: '#FFEBEE' };
    default:                     return { label: s, color: COLORS.textSub, bg: COLORS.bgGray };
  }
}

export default function StoreDonations({ navigation }: any) {
  const [donations, setDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [certRequestingId, setCertRequestingId] = useState<number | null>(null);

  const load = async () => {
    try {
      const result = await api.getStoreDonations();
      if (result.success) setDonations(result.donations || []);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not load donations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, []));

  const handleMarkPickedUp = (item: any) => {
    Alert.alert(
      'Confirm pickup',
      `Mark "${item.item_name}" as picked up by ${item.ngo_name || 'the NGO'}? They will need to upload delivery proof within 24 hours.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark picked up',
          onPress: async () => {
            try {
              setActionId(item.id);
              const result = await api.markRestaurantDonationPickup(item.id);
              if (result.success) { Alert.alert('Done', result.message || 'Pickup recorded.'); load(); }
              else Alert.alert('Error', result.message || 'Could not update');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not update');
            } finally {
              setActionId(null);
            }
          },
        },
      ]
    );
  };

  const handleRequestCertificate = (item: any) => {
    Alert.alert(
      'Request Certificate',
      'Request a donation certificate for this verified donation? The admin will review and upload it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request',
          onPress: async () => {
            try {
              setCertRequestingId(item.id);
              const result = await api.requestDonationCertificate(item.id);
              if (result.success) {
                Alert.alert('Requested!', result.message || 'Certificate request submitted.');
                load();
              } else {
                Alert.alert('Error', result.message || 'Could not submit request');
              }
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not submit request');
            } finally {
              setCertRequestingId(null);
            }
          },
        },
      ]
    );
  };

  const handleViewCertificate = (certUrl: string) => {
    const fullUrl = certUrl.startsWith('http') ? certUrl : `${API_BASE_URL}${certUrl}`;
    Linking.openURL(fullUrl).catch(() =>
      Alert.alert('Error', 'Could not open the certificate. Try again.')
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NGO Donations</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {donations.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={48} color={COLORS.bgGray} />
              <Text style={styles.emptyText}>No NGO donations yet.</Text>
            </View>
          ) : (
            donations.map((item) => {
              const badge = statusLabel(item.status, item.display_status);
              const proofUri = imageUri(item.proof_image_url);
              const isVerified = item.status === 'verified';
              const certRequested = item.certificate_requested;
              const certReady = !!item.certificate_url;

              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.itemName}>{item.item_name}</Text>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                  </View>

                  <Text style={styles.sub}>NGO: {item.ngo_name || '—'}</Text>
                  <Text style={styles.sub}>Qty: {item.quantity}</Text>
                  {item.picked_up_at && (
                    <Text style={styles.sub}>Picked up: {new Date(item.picked_up_at).toLocaleString()}</Text>
                  )}
                  {item.proof_uploaded_at && (
                    <Text style={styles.sub}>Proof uploaded: {new Date(item.proof_uploaded_at).toLocaleString()}</Text>
                  )}

                  {/* Proof photo */}
                  {item.proof_image_url && (
                    <View style={styles.proofBox}>
                      <Text style={styles.proofLabel}>Beneficiary delivery proof</Text>
                      <Image
                        source={{
                          uri: item.proof_image_url.startsWith('http')
                            ? item.proof_image_url
                            : `${API_BASE_URL}${item.proof_image_url}`,
                          headers: { 'ngrok-skip-browser-warning': '69420' },
                        }}
                        style={styles.proofImage}
                        resizeMode="cover"
                      />
                    </View>
                  )}

                  {/* Mark picked up */}
                  {item.status === 'accepted' && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleMarkPickedUp(item)}
                      disabled={actionId === item.id}
                    >
                      {actionId === item.id
                        ? <ActivityIndicator color={COLORS.white} />
                        : <Text style={styles.actionBtnText}>Mark as picked up</Text>}
                    </TouchableOpacity>
                  )}

                  {/* Certificate section — only for verified donations */}
                  {isVerified && (
                    <View style={styles.certSection}>
                      <View style={styles.certDivider} />

                      {/* Certificate ready — show download */}
                      {certReady ? (
                        <TouchableOpacity
                          style={styles.certDownloadBtn}
                          onPress={() => handleViewCertificate(item.certificate_url)}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons name="file-certificate-outline" size={20} color={COLORS.white} />
                          <Text style={styles.certDownloadBtnText}>View / Download Certificate</Text>
                        </TouchableOpacity>
                      ) : certRequested ? (
                        /* Requested — waiting for admin */
                        <View style={styles.certPendingRow}>
                          <Ionicons name="time-outline" size={16} color={COLORS.amber} />
                          <Text style={styles.certPendingText}>
                            Certificate requested · Awaiting admin upload
                          </Text>
                        </View>
                      ) : (
                        /* Not yet requested */
                        <TouchableOpacity
                          style={styles.certRequestBtn}
                          onPress={() => handleRequestCertificate(item)}
                          disabled={certRequestingId === item.id}
                          activeOpacity={0.8}
                        >
                          {certRequestingId === item.id
                            ? <ActivityIndicator color={COLORS.primary} size="small" />
                            : <>
                                <MaterialCommunityIcons name="certificate-outline" size={18} color={COLORS.primary} />
                                <Text style={styles.certRequestBtnText}>Request Certificate</Text>
                              </>}
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  scroll: { padding: 20, paddingBottom: 40, backgroundColor: COLORS.bgGray, flexGrow: 1 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: COLORS.textSub, marginTop: 12 },

  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemName: { fontSize: 17, fontWeight: '800', color: COLORS.primary, flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  sub: { fontSize: 13, color: COLORS.textSub, marginTop: 4 },

  proofBox: { marginTop: 12 },
  proofLabel: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 8 },
  proofImage: { width: '100%', height: 180, borderRadius: 12, backgroundColor: COLORS.bgGray },

  actionBtn: { marginTop: 14, backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  actionBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },

  // Certificate
  certSection: { marginTop: 4 },
  certDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 14 },
  certRequestBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 12, paddingVertical: 11 },
  certRequestBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  certPendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(139,105,20,0.08)', borderRadius: 10, padding: 12 },
  certPendingText: { fontSize: 13, color: COLORS.amber, fontWeight: '600', flex: 1 },
  certDownloadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.success, borderRadius: 12, paddingVertical: 12 },
  certDownloadBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
});
