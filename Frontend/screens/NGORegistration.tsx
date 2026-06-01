import React, { useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { api, API_BASE_URL } from '../services/api';
import { BASE_URL } from '../services/apiConfig';

const C = {
  forest:    '#244F42',
  forestDim: '#1a3a31',
  cream:     '#E8E8CC',
  amber:     '#F5A623',
  white:     '#FFFFFF',
  bg:        '#F0F0E4',
  text:      '#1A1A1A',
  sub:       '#757575',
  border:    '#E2E2D5',
  success:   '#2E7D32',
};

const FIELDS = [
  { key: 'name',          label: 'NGO Name',            placeholder: 'Official registered name',   icon: 'home-heart',           required: true },
  { key: 'regNumber',     label: 'Registration Number', placeholder: 'Govt. registration ID',      icon: 'card-account-details', required: true },
  { key: 'contactPerson', label: 'Contact Person',      placeholder: 'Full name',                  icon: 'account-outline',      required: false },
  { key: 'phone',         label: 'Phone Number',        placeholder: '98xxxxxxxx',                 icon: 'phone-outline',        required: true,  keyboard: 'phone-pad' },
  { key: 'address',       label: 'Full Address',        placeholder: 'City, Street',               icon: 'map-marker-outline',   required: false },
  { key: 'description',   label: 'Mission Description', placeholder: 'Describe your mission…',     icon: 'text-box-outline',     required: false, multiline: true },
];

export default function NGORegistration() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { userId, existingData } = route.params || {};

  const [loading, setLoading] = useState(false);
  const [ngoDetails, setNgoDetails] = useState({
    name:          existingData?.name            || '',
    regNumber:     existingData?.reg_number      || '',
    country:       existingData?.country         || 'Nepal',
    address:       existingData?.address         || '',
    contactPerson: existingData?.contact_person  || '',
    phone:         existingData?.phone           || '',
    description:   existingData?.description     || '',
    document_image: existingData?.document_image || '',
  });
  const [documentUri, setDocumentUri] = useState<string | null>(
    existingData?.document_image ? `${API_BASE_URL}${existingData.document_image}` : null
  );
  const [isUploading, setIsUploading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const set = (key: string, val: string) => setNgoDetails(prev => ({ ...prev, [key]: val }));

  const pickDocument = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { Alert.alert("Permission Required", "Allow photo access to upload a document."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,  // Documents must not be cropped — upload as-is
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length > 0) handleUpload(result.assets[0].uri);
  };

  const handleUpload = async (uri: string) => {
    try {
      setIsUploading(true);
      setDocumentUri(uri);
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'document.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      formData.append('document', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: filename, type,
      } as any);
      const res = await api.uploadDocument(formData);
      if (res.success) {
        set('document_image', res.filePath);
      } else {
        throw new Error(res.message);
      }
    } catch (error: any) {
      Alert.alert("Upload Failed", error.message || "Something went wrong.");
      setDocumentUri(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleNgoSubmit = async () => {
    if (!ngoDetails.name || !ngoDetails.regNumber) {
      Alert.alert("Required Fields", "NGO Name and Registration Number are mandatory."); return;
    }
    if (!ngoDetails.phone) {
      Alert.alert("Required Field", "Phone Number is mandatory."); return;
    }
    const cleanPhone = ngoDetails.phone.replace(/[\s\-+]/g, "");
    let localPhone = cleanPhone;
    if (cleanPhone.startsWith("977")) localPhone = cleanPhone.slice(3);
    else if (cleanPhone.startsWith("+977")) localPhone = cleanPhone.slice(4);
    if (!/^9\d{9}$/.test(localPhone)) {
      Alert.alert("Invalid Phone", "Enter a valid 10-digit Nepali number (e.g. 98xxxxxxxx)."); return;
    }
    if (!ngoDetails.document_image) {
      Alert.alert("Missing Document", "Please upload a registration document first."); return;
    }
    if (!userId) {
      Alert.alert("Auth Error", "User ID not found. Please log in again."); return;
    }
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      const response = await fetch(`${BASE_URL}/api/ngo/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...ngoDetails, userId }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        Alert.alert("Submitted!", "Your registration is under review. We'll notify you once verified.", [
          { text: "OK", onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert("Failed", result.message || "Authentication failed. Please log in again.");
      }
    } catch (e) {
      Alert.alert("Error", "Server connection failed. Check your internet.");
    } finally {
      setLoading(false);
    }
  };

  const completedCount = [
    ngoDetails.name,
    ngoDetails.regNumber,
    ngoDetails.phone,
    ngoDetails.document_image,
  ].filter(Boolean).length;
  const totalRequired = 4;
  const progress = completedCount / totalRequired;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="rgba(232,232,204,0.9)" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>NGO Registration</Text>
            <Text style={styles.headerSub}>Help rescue food across Nepal</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="home-heart" size={20} color={C.amber} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Progress bar ── */}
          <View style={styles.progressCard}>
            <View style={styles.progressTop}>
              <Text style={styles.progressLabel}>Registration Progress</Text>
              <Text style={styles.progressCount}>{completedCount}/{totalRequired} required fields</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={styles.progressSteps}>
              {['Organization', 'Contact', 'Document', 'Submit'].map((step, i) => (
                <View key={step} style={styles.progressStep}>
                  <View style={[styles.progressDot, i < completedCount && styles.progressDotDone]}>
                    {i < completedCount
                      ? <Ionicons name="checkmark" size={10} color="#fff" />
                      : <Text style={styles.progressDotNum}>{i + 1}</Text>
                    }
                  </View>
                  <Text style={[styles.progressStepLabel, i < completedCount && { color: C.forest }]}>{step}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Section 1: Organization Details ── */}
          <SectionHeader number="01" title="Organization Details" icon="office-building-outline" />
          <View style={styles.card}>
            <FormField
              field={FIELDS[0]}
              value={ngoDetails.name}
              onChange={(v) => set('name', v)}
              focused={focusedField === 'name'}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
            />
            <FormField
              field={FIELDS[1]}
              value={ngoDetails.regNumber}
              onChange={(v) => set('regNumber', v)}
              focused={focusedField === 'regNumber'}
              onFocus={() => setFocusedField('regNumber')}
              onBlur={() => setFocusedField(null)}
            />
            <FormField
              field={FIELDS[5]}
              value={ngoDetails.description}
              onChange={(v) => set('description', v)}
              focused={focusedField === 'description'}
              onFocus={() => setFocusedField('description')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {/* ── Section 2: Contact ── */}
          <SectionHeader number="02" title="Contact Information" icon="card-account-phone-outline" />
          <View style={styles.card}>
            <FormField
              field={FIELDS[2]}
              value={ngoDetails.contactPerson}
              onChange={(v) => set('contactPerson', v)}
              focused={focusedField === 'contactPerson'}
              onFocus={() => setFocusedField('contactPerson')}
              onBlur={() => setFocusedField(null)}
            />
            <FormField
              field={FIELDS[3]}
              value={ngoDetails.phone}
              onChange={(v) => set('phone', v)}
              focused={focusedField === 'phone'}
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
            />
            <FormField
              field={FIELDS[4]}
              value={ngoDetails.address}
              onChange={(v) => set('address', v)}
              focused={focusedField === 'address'}
              onFocus={() => setFocusedField('address')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {/* ── Section 3: Document ── */}
          <SectionHeader number="03" title="Verification Document" icon="file-document-outline" />
          <View style={styles.card}>
            <Text style={styles.docHint}>
              Upload your NGO registration certificate or official government document.
            </Text>

            <TouchableOpacity
              style={[styles.uploadBox, documentUri && !isUploading && styles.uploadBoxDone]}
              onPress={pickDocument}
              disabled={isUploading}
              activeOpacity={0.8}
            >
              {isUploading ? (
                <View style={styles.uploadingState}>
                  <ActivityIndicator color={C.forest} size="large" />
                  <Text style={styles.uploadingText}>Uploading document…</Text>
                </View>
              ) : documentUri ? (
                <>
                  <Image source={{ uri: documentUri }} style={styles.docPreview} />
                  <View style={styles.docOverlay}>
                    <Ionicons name="camera-outline" size={18} color="#fff" />
                    <Text style={styles.docOverlayText}>Change Document</Text>
                  </View>
                </>
              ) : (
                <View style={styles.uploadEmptyState}>
                  <View style={styles.uploadIconBox}>
                    <MaterialCommunityIcons name="cloud-upload-outline" size={32} color={C.forest} />
                  </View>
                  <Text style={styles.uploadTitle}>Tap to upload</Text>
                  <Text style={styles.uploadSub}>JPG, PNG — Max 5MB</Text>
                </View>
              )}
            </TouchableOpacity>

            {documentUri && !isUploading && (
              <View style={styles.docReadyRow}>
                <View style={styles.docReadyDot}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
                <Text style={styles.docReadyText}>Document uploaded and ready</Text>
              </View>
            )}
          </View>

          {/* ── Submit ── */}
          <TouchableOpacity
            style={[styles.submitBtn, (loading || progress < 1) && styles.submitBtnDim]}
            onPress={handleNgoSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={C.forest} />
            ) : (
              <>
                <MaterialCommunityIcons name="send-outline" size={18} color={C.forest} />
                <Text style={styles.submitText}>Submit Registration</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.footerNote}>
            Your application will be reviewed within 1–3 business days. We'll notify you via the app.
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

const C_local = {
  forest: '#244F42',
  amber:  '#F5A623',
  cream:  '#E8E8CC',
  sub:    '#757575',
  border: '#E2E2D5',
  bg:     '#F0F0E4',
};

function SectionHeader({ number, title, icon }: { number: string; title: string; icon: string }) {
  return (
    <View style={sh.row}>
      <View style={sh.numBadge}>
        <Text style={sh.numText}>{number}</Text>
      </View>
      <MaterialCommunityIcons name={icon as any} size={16} color="rgba(232,232,204,0.7)" style={{ marginRight: 6 }} />
      <Text style={sh.title}>{title}</Text>
    </View>
  );
}

const sh = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 20, marginBottom: 10 },
  numBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: C_local.amber, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  numText:  { fontSize: 11, fontWeight: '800', color: C_local.forest },
  title:    { fontSize: 14, fontWeight: '800', color: C_local.cream, letterSpacing: 0.1 },
});

function FormField({ field, value, onChange, focused, onFocus, onBlur }: {
  field: any; value: string; onChange: (v: string) => void;
  focused: boolean; onFocus: () => void; onBlur: () => void;
}) {
  return (
    <View style={ff.wrapper}>
      <View style={ff.labelRow}>
        <MaterialCommunityIcons name={field.icon} size={14} color={focused ? C_local.forest : C_local.sub} />
        <Text style={[ff.label, focused && { color: C_local.forest }]}>
          {field.label}{field.required ? ' *' : ''}
        </Text>
      </View>
      <TextInput
        style={[ff.input, focused && ff.inputFocused, field.multiline && { height: 80, textAlignVertical: 'top' }]}
        placeholder={field.placeholder}
        placeholderTextColor="#bbb"
        value={value}
        onChangeText={onChange}
        keyboardType={field.keyboard || 'default'}
        multiline={!!field.multiline}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </View>
  );
}

const ff = StyleSheet.create({
  wrapper:      { marginBottom: 14 },
  labelRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 7 },
  label:        { fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 0.4, textTransform: 'uppercase' },
  input: {
    backgroundColor: '#F7F7F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1A1A1A',
    borderWidth: 1.5,
    borderColor: '#E2E2D5',
  },
  inputFocused: { borderColor: '#244F42', backgroundColor: '#fff' },
});

// ── Main styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#244F42' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 10 : 4,
    paddingBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, marginLeft: 14 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#E8E8CC', letterSpacing: -0.2 },
  headerSub: { fontSize: 11, color: 'rgba(232,232,204,0.5)', marginTop: 2 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  scroll: { paddingHorizontal: 16, paddingBottom: 20 },

  // Progress card
  progressCard: {
    backgroundColor: '#E8E8CC',
    borderRadius: 20,
    padding: 18,
    marginTop: 4,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 13, fontWeight: '700', color: '#244F42' },
  progressCount: { fontSize: 11, color: '#888', fontWeight: '600' },
  progressTrack: { height: 6, backgroundColor: 'rgba(36,79,66,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 14 },
  progressFill: { height: '100%', backgroundColor: '#F5A623', borderRadius: 3 },
  progressSteps: { flexDirection: 'row', justifyContent: 'space-between' },
  progressStep: { alignItems: 'center', gap: 5 },
  progressDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(36,79,66,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotDone: { backgroundColor: '#244F42' },
  progressDotNum: { fontSize: 10, fontWeight: '800', color: '#aaa' },
  progressStepLabel: { fontSize: 9, color: '#aaa', fontWeight: '600', textTransform: 'uppercase' },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // Document upload
  docHint: { fontSize: 12, color: '#888', marginBottom: 14, lineHeight: 17 },
  uploadBox: {
    height: 170,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    backgroundColor: '#F7F7F0',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadBoxDone: { borderStyle: 'solid', borderColor: '#244F42' },
  uploadEmptyState: { alignItems: 'center', gap: 8 },
  uploadIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(36,79,66,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  uploadTitle: { fontSize: 14, fontWeight: '700', color: '#244F42' },
  uploadSub: { fontSize: 11, color: '#aaa' },
  uploadingState: { alignItems: 'center', gap: 10 },
  uploadingText: { fontSize: 13, color: '#244F42', fontWeight: '600' },
  docPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  docOverlay: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  docOverlayText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  docReadyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    alignSelf: 'center',
  },
  docReadyDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
  },
  docReadyText: { fontSize: 12, fontWeight: '700', color: '#2E7D32' },

  // Submit
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F5A623',
    borderRadius: 18,
    paddingVertical: 18,
    marginTop: 22,
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnDim: { opacity: 0.6, shadowOpacity: 0 },
  submitText: { fontSize: 16, fontWeight: '800', color: '#244F42', letterSpacing: 0.2 },

  footerNote: {
    fontSize: 11,
    color: 'rgba(232,232,204,0.45)',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 17,
    paddingHorizontal: 20,
  },
});
