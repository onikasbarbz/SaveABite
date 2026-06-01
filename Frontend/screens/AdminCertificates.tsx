import React, { useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, FlatList, Image,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { api, API_BASE_URL } from '../services/api';

const COLORS = {
  primary: '#244F42',
  accent:  '#F4A71D',
  white:   '#FFFFFF',
  textMain:'#1A1A1A',
  textSub: '#757575',
  bgLight: '#F3F4F6',
  success: '#10B981',
  amber:   '#8B6914',
};

function imageUri(path: string | null | undefined) {
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
}

export default function AdminCertificates() {
  const navigation = useNavigation<any>();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  const load = async () => {
    try {
      const result = await api.getAdminCertificateRequests();
      if (result.success) setRequests(result.requests || []);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not load certificate requests');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, []));

  const handleUploadCertificate = async (item: any) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];

      Alert.alert(
        'Upload Certificate',
        `Upload "${file.name}" as the certificate for ${item.store.name} — ${item.item_name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upload',
            onPress: async () => {
              try {
                setUploadingId(item.id);
                const formData = new FormData();
                formData.append('certificate', {
                  uri: file.uri,
                  name: file.name,
                  type: file.mimeType || 'application/pdf',
                } as any);

                const res = await api.uploadDonationCertificate(item.id, formData);
                if (res.success) {
                  Alert.alert('Done', 'Certificate uploaded. The restaurant can now download it.');
                  load();
                } else {
                  Alert.alert('Error', res.message || 'Upload failed');
                }
              } catch (e: any) {
                Alert.alert('Error', e.message || 'Upload failed');
              } finally {
                setUploadingId(null);
              }
            },
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not open file picker');
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const proofUri = imageUri(item.proof_image_url);

    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.storeInfo}>
            <Text style={styles.storeName}>{item.store.name}</Text>
            <Text style={styles.storeEmail}>{item.store.email}</Text>
          </View>
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>PENDING</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Donation details */}
        <View style={styles.detailRow}>
          <Ionicons name="fast-food-outline" size={15} color={COLORS.textSub} />
          <Text style={styles.detailText}>{item.item_name}</Text>
        </View>
        {item.ngo_name && (
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="home-heart-outline" size={15} color={COLORS.textSub} />
            <Text style={styles.detailText}>NGO: {item.ngo_name}</Text>
          </View>
        )}
        {item.picked_up_at && (
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={15} color={COLORS.textSub} />
            <Text style={styles.detailText}>
              Picked up: {new Date(item.picked_up_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </Text>
          </View>
        )}
        {item.certificate_requested_at && (
          <View style={styles.detailRow}>
            <Ionicons name="document-text-outline" size={15} color={COLORS.amber} />
            <Text style={[styles.detailText, { color: COLORS.amber }]}>
              Requested: {new Date(item.certificate_requested_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </Text>
          </View>
        )}

        {/* NGO proof photo */}
        {proofUri && (
          <View style={styles.proofSection}>
            <Text style={styles.proofLabel}>NGO Delivery Proof</Text>
            <Image
              source={{ uri: proofUri, headers: { 'ngrok-skip-browser-warning': '69420' } }}
              style={styles.proofImage}
              resizeMode="cover"
            />
          </View>
        )}

        {/* Upload button */}
        <TouchableOpacity
          style={[styles.uploadBtn, uploadingId === item.id && { opacity: 0.6 }]}
          onPress={() => handleUploadCertificate(item)}
          disabled={uploadingId === item.id}
          activeOpacity={0.8}
        >
          {uploadingId === item.id ? (
            <ActivityIndicator color={COLORS.primary} size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="file-upload-outline" size={20} color={COLORS.primary} />
              <Text style={styles.uploadBtnText}>Upload Certificate (PDF or Image)</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Certificate Requests</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => { setLoading(true); load(); }}>
          <Ionicons name="refresh" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="certificate-outline" size={64} color="#D0D0D0" />
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptySub}>Certificate requests from restaurants will appear here.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgLight },
  header: {
    height: 64,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: COLORS.white, fontSize: 18, fontWeight: '800' },

  list: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: { backgroundColor: COLORS.white, borderRadius: 18, padding: 18, marginBottom: 14, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  storeInfo: { flex: 1, marginRight: 10 },
  storeName: { fontSize: 16, fontWeight: '800', color: COLORS.textMain },
  storeEmail: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  pendingBadge: { backgroundColor: 'rgba(139,105,20,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  pendingBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.amber },

  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 12 },

  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  detailText: { fontSize: 13, color: COLORS.textSub },

  proofSection: { marginTop: 12, marginBottom: 4 },
  proofLabel: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 8 },
  proofImage: { width: '100%', height: 200, borderRadius: 12, backgroundColor: COLORS.bgLight },

  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 12, paddingVertical: 12 },
  uploadBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },

  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textMain, marginTop: 16 },
  emptySub: { fontSize: 14, color: COLORS.textSub, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
