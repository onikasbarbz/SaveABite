import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, FlatList, Image,
  TouchableOpacity, ActivityIndicator, Alert, Modal, Dimensions, TextInput, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { api, API_BASE_URL } from '../services/api';

const { width, height } = Dimensions.get('window');

const COLORS = {
  primary: '#244F42',
  accent: '#F4A71D',
  white: '#FFFFFF',
  textMain: '#1A1A1A',
  textSub: '#757575',
  bgLight: '#F3F4F6',
  cardBg: '#FFFFFF',
  success: '#10B981',
  danger: '#EF4444',
};

interface NGORegistration {
  id: number;
  name: string;
  reg_number: string;
  email: string;
  contact_person: string;
  phone: string;
  status: string;
  user_id: number;
  document_image?: string;
  users?: {
    identity_document?: string;
  };
}

const AdminNGOVerify = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<NGORegistration[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'verified' | 'rejected'>('pending');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Rejection Modal States
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectingAppId, setRejectingAppId] = useState<number | null>(null);

  useEffect(() => {
    fetchAppsByStatus();
  }, [activeTab]);

  const fetchAppsByStatus = async () => {
    try {
      setLoading(true);
      // Construct query based on tab
      let queryStatus = activeTab;
      // For pending tab, we actually want both pending and reviewing
      const url = activeTab === 'pending' 
        ? '/api/ngo/admin/pending' 
        : `/api/ngo/admin/pending?status=${activeTab}`;
        
      const res = await api.request(url, { method: 'GET' });
      if (res.success) {
        setApplications(res.data || []);
      }
    } catch (error: any) {
      console.error("Admin Fetch Error:", error);
      Alert.alert("Error", `Could not load ${activeTab} applications.`);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: number, status: string, reason?: string) => {
    try {
      setProcessingId(id);
      const res = await api.request(`/api/ngo/verify/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status, reason }),
      });

      if (res.success) {
        if (status !== 'reviewing') {
          Alert.alert("Success", `NGO has been ${status}.`);
          setApplications(prev => prev.filter(app => app.id !== id));
        } else {
          // Just update local state for 'reviewing'
          setApplications(prev => prev.map(app => app.id === id ? { ...app, status: 'reviewing' } : app));
        }
      } else {
        Alert.alert("Failed", res.message || "Could not update status.");
      }
    } catch (error: any) {
      console.error("Status Update Error:", error);
      Alert.alert("Error", error.message || "Update failed.");
    } finally {
      setProcessingId(null);
    }
  };

  const startReview = (id: number, currentStatus: string) => {
    if (currentStatus === 'pending') {
      handleStatusUpdate(id, 'reviewing');
    }
  };

  const openRejectModal = (id: number) => {
    setRejectingAppId(id);
    setRejectionReason("");
    setRejectModalVisible(true);
  };

  const submitRejection = () => {
    if (!rejectionReason.trim()) {
      Alert.alert("Reason Required", "Please provide a reason for rejection.");
      return;
    }
    if (rejectingAppId) {
      handleStatusUpdate(rejectingAppId, 'rejected', rejectionReason);
      setRejectModalVisible(false);
    }
  };

  const confirmApproval = (id: number) => {
    Alert.alert(
      "Confirm Approval",
      "Are you sure you want to verify this NGO? They will gain full access to the NGO dashboard.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "VERIFY",
          onPress: () => handleStatusUpdate(id, 'verified')
        }
      ]
    );
  };

  const renderApplication = ({ item }: { item: NGORegistration }) => {
    // Construct document URLs with safety checks
    const ngoDoc = item.document_image
      ? `${API_BASE_URL}${item.document_image.startsWith('/') ? '' : '/'}${item.document_image}`
      : null;
    
    const userDoc = item.users?.identity_document
      ? `${API_BASE_URL}${item.users.identity_document.startsWith('/') ? '' : '/'}${item.users.identity_document}`
      : null;

    const docUrl = ngoDoc || userDoc;

    const openDocument = () => {
      if (docUrl) {
        setSelectedImage(docUrl);
        startReview(item.id, item.status);
      } else {
        Alert.alert("No Document", "This NGO has not uploaded a verification document yet.");
      }
    };

    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.9}
        onPress={openDocument}
      >
        <View style={styles.cardHeader}>
          <View style={styles.ngoInfo}>
            <Text style={styles.ngoName}>{item.name}</Text>
            <Text style={styles.regNumber}>Reg: {item.reg_number}</Text>
          </View>
          <View style={[
            styles.statusBadge,
            item.status === 'reviewing' ? styles.reviewingBadge : styles.pendingBadge
          ]}>
            <Text style={[
              styles.statusBadgeText,
              item.status === 'reviewing' ? styles.reviewingText : styles.pendingText
            ]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={16} color={COLORS.textSub} />
          <Text style={styles.detailText}>{item.contact_person || 'N/A'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="call-outline" size={16} color={COLORS.textSub} />
          <Text style={styles.detailText}>{item.phone || 'N/A'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="mail-outline" size={16} color={COLORS.textSub} />
          <Text style={styles.detailText}>{item.email}</Text>
        </View>

        {docUrl ? (
          <View style={styles.docSection}>
            <View style={styles.docLabelRow}>
              <View>
                <Text style={styles.docLabel}>Registration Document</Text>
                <Text style={styles.docSubLabel}>
                  {ngoDoc ? "Direct Upload" : "User Profile Document"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.viewFullBtn}
                onPress={() => {
                  setSelectedImage(docUrl);
                  startReview(item.id, item.status);
                }}
              >
                <Text style={styles.viewFullText}>View Full</Text>
                <Ionicons name="expand-outline" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                setSelectedImage(docUrl);
                startReview(item.id, item.status);
              }}
            >
              <Image
                source={{
                  uri: docUrl,
                  headers: { 'ngrok-skip-browser-warning': '69420' }
                }}
                style={styles.docThumbnail}
                resizeMode="cover"
                onError={(e) => console.log("Image Load Error:", e.nativeEvent.error)}
              />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.noDoc}>
            <MaterialCommunityIcons name="file-hidden" size={24} color={COLORS.danger} />
            <Text style={styles.noDocText}>No document provided</Text>
          </View>
        )}

        {activeTab === 'pending' && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => openRejectModal(item.id)}
              disabled={processingId === item.id}
            >
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => confirmApproval(item.id)}
              disabled={processingId === item.id || !docUrl}
            >
              {processingId === item.id ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.approveBtnText}>Approve NGO</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={26} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NGO Verification</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('AdminCertificates')}>
            <MaterialCommunityIcons name="certificate-outline" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.backBtn} onPress={fetchAppsByStatus}>
            <Ionicons name="refresh" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>Pending</Text>
          {activeTab === 'pending' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'verified' && styles.activeTab]}
          onPress={() => setActiveTab('verified')}
        >
          <Text style={[styles.tabText, activeTab === 'verified' && styles.activeTabText]}>Verified</Text>
          {activeTab === 'verified' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'rejected' && styles.activeTab]}
          onPress={() => setActiveTab('rejected')}
        >
          <Text style={[styles.tabText, activeTab === 'rejected' && styles.activeTabText]}>Rejected</Text>
          {activeTab === 'rejected' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading applications...</Text>
        </View>
      ) : (
        <FlatList
          data={applications}
          renderItem={renderApplication}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons 
                name={activeTab === 'pending' ? "clipboard-check-outline" : (activeTab === 'verified' ? "check-circle-outline" : "close-circle-outline")} 
                size={80} 
                color="#D0D0D0" 
              />
              <Text style={styles.emptyText}>
                {activeTab === 'pending' ? "No pending applications" : (activeTab === 'verified' ? "No verified NGOs" : "No rejected requests")}
              </Text>
              <Text style={styles.emptySub}>
                {activeTab === 'pending' ? "All set! Check back later." : `You haven't ${activeTab} any NGOs yet.`}
              </Text>
            </View>
          }
        />
      )}

      {/* Full Image Modal */}
      <Modal visible={!!selectedImage} transparent={true} animationType="fade">
        <View style={styles.modalBg}>
          <TouchableOpacity style={styles.closeModal} onPress={() => setSelectedImage(null)}>
            <Ionicons name="close" size={32} color="#FFF" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage, headers: { 'ngrok-skip-browser-warning': 'true' } }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Rejection Reason Modal */}
      <Modal visible={rejectModalVisible} transparent={true} animationType="slide">
        <View style={styles.rejectionModalBg}>
          <View style={styles.rejectionContent}>
            <Text style={styles.rejectionTitle}>Rejection Reason</Text>
            <Text style={styles.rejectionSub}>Please explain why this application is being rejected. This will be shown to the user.</Text>

            <TextInput
              style={styles.rejectionInput}
              placeholder="e.g. Uploaded document is blurred or registration number is invalid..."
              multiline
              numberOfLines={4}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              textAlignVertical="top"
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmRejectBtn}
                onPress={submitRejection}
              >
                <Text style={styles.confirmRejectBtnText}>Confirm Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default AdminNGOVerify;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgLight },
  header: {
    height: 70,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' },
  backBtn: { padding: 5 },

  // Tab Bar Styles
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  activeTab: {},
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSub,
  },
  activeTabText: {
    color: COLORS.primary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: '60%',
    height: 3,
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },

  listContent: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ngoInfo: { flex: 1 },
  ngoName: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
  regNumber: { fontSize: 12, color: COLORS.textSub, marginTop: 2, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontWeight: 'bold' },
  pendingBadge: { backgroundColor: '#FFF5E1' },
  pendingText: { color: '#B45309' },
  reviewingBadge: { backgroundColor: '#E0F2FE' },
  reviewingText: { color: '#0284C7' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 15 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  detailText: { fontSize: 14, color: COLORS.textMain, marginLeft: 10 },
  docSection: { marginTop: 15, backgroundColor: '#F8FAFC', borderRadius: 15, padding: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  docLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  docLabel: { fontSize: 14, fontWeight: 'bold', color: COLORS.textMain },
  docSubLabel: { fontSize: 11, color: COLORS.textSub, marginTop: 2 },
  viewFullBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E0F2FE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  viewFullText: { fontSize: 12, fontWeight: '600', color: COLORS.primary, marginRight: 4 },
  docThumbnail: { width: '100%', height: 180, borderRadius: 10, backgroundColor: '#EDF2F7', marginTop: 5 },
  noDoc: { marginTop: 15, padding: 20, alignItems: 'center', backgroundColor: '#FFF5F5', borderRadius: 12, borderWidth: 1, borderColor: '#FED7D7' },
  noDocText: { fontSize: 13, color: COLORS.danger, marginTop: 5, fontWeight: '600' },
  actionRow: { flexDirection: 'row', marginTop: 20, gap: 12 },
  actionBtn: { flex: 1, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  approveBtn: { backgroundColor: COLORS.primary },
  approveBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 15 },
  rejectBtn: { backgroundColor: '#FEE2E2' },
  rejectBtnText: { color: COLORS.danger, fontWeight: 'bold', fontSize: 15 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: COLORS.textSub },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, marginTop: 20 },
  emptySub: { fontSize: 14, color: COLORS.textSub, marginTop: 5 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closeModal: { position: 'absolute', top: 50, right: 30, zIndex: 10 },
  fullImage: { width: width, height: height * 0.8 },

  // Rejection Modal
  rejectionModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  rejectionContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    paddingBottom: Platform.OS === 'ios' ? 40 : 25
  },
  rejectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 10 },
  rejectionSub: { fontSize: 14, color: COLORS.textSub, marginBottom: 20, lineHeight: 20 },
  rejectionInput: {
    backgroundColor: COLORS.bgLight,
    borderRadius: 15,
    padding: 15,
    height: 120,
    fontSize: 15,
    color: COLORS.textMain,
    borderWidth: 1,
    borderColor: '#E0E0E0'
  },
  modalActionRow: { flexDirection: 'row', marginTop: 20, gap: 15 },
  cancelBtn: { flex: 1, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bgLight },
  cancelBtnText: { color: COLORS.textSub, fontWeight: 'bold' },
  confirmRejectBtn: { flex: 1, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.danger },
  confirmRejectBtnText: { color: COLORS.white, fontWeight: 'bold' },

});
