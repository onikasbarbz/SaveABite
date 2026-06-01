import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ChevronLeft, Save, Trash2, Info, Package, Calendar, Clock } from 'lucide-react-native';
import { api, API_BASE_URL } from '../services/api';

interface Listing {
  id: number;
  item_name: string;
  category: string;
  original_price: number;
  selling_price: number;
  stock_quantity: number;
  is_surprise_bag?: boolean;
  dietary_preference?: string | null;
  health_note?: string | null;
  rescue_deadline?: string | null;
  ngo_expiry?: string | null;
  auto_donate?: boolean;
  image_url?: string | null;
  is_active?: boolean;
}

const EditListing = ({ navigation, route }: any) => {
  const existingListing: Listing | undefined = route.params?.listing;

  const [form, setForm] = useState({
    item_name: existingListing?.item_name || '',
    category: existingListing?.category || '',
    original_price: existingListing?.original_price?.toString() || '',
    selling_price: existingListing?.selling_price?.toString() || '',
    stock_quantity: existingListing?.stock_quantity?.toString() || '1',
    dietary_preference: existingListing?.dietary_preference || '',
    health_note: existingListing?.health_note || '',
    is_active: existingListing?.is_active ?? true,
  });

  const [rescueEnabled, setRescueEnabled] = useState<boolean>(!!existingListing?.rescue_deadline);
  const [rescueDate, setRescueDate] = useState<Date>(() => {
    if (!existingListing?.rescue_deadline) return new Date(new Date().setHours(20, 0, 0, 0));
    const d = new Date(existingListing.rescue_deadline);
    if (!isNaN(d.getTime())) return d;
    const match = existingListing.rescue_deadline.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      const now = new Date();
      let hours = parseInt(match[1]);
      const mins = parseInt(match[2]);
      const meridiem = match[3].toUpperCase();
      if (meridiem === 'PM' && hours !== 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;
      now.setHours(hours, mins, 0, 0);
      return now;
    }
    return new Date(new Date().setHours(20, 0, 0, 0));
  });

  const [ngoEnabled, setNgoEnabled] = useState<boolean>(!!existingListing?.ngo_expiry);
  const [ngoRescueDate, setNgoRescueDate] = useState<Date>(() => {
    if (!existingListing?.ngo_expiry) return new Date(new Date().setHours(22, 0, 0, 0));
    const d = new Date(existingListing.ngo_expiry);
    return isNaN(d.getTime()) ? new Date(new Date().setHours(22, 0, 0, 0)) : d;
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showNgoDatePicker, setShowNgoDatePicker] = useState(false);
  const [showNgoTimePicker, setShowNgoTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const imageUrl = existingListing?.image_url
    ? existingListing.image_url.startsWith('http')
      ? existingListing.image_url
      : `${API_BASE_URL}${existingListing.image_url}`
    : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c';

  const handleUpdate = async () => {
    if (!existingListing?.id) {
      Alert.alert('Error', 'Listing not found.');
      return;
    }
    if (!form.item_name.trim() || !form.selling_price.trim() || !form.stock_quantity.trim()) {
      Alert.alert('Missing Information', 'Please fill in item name, offer price, and quantity.');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        item_name: form.item_name,
        category: form.category,
        original_price: form.original_price,
        selling_price: form.selling_price,
        stock_quantity: form.stock_quantity,
        dietary_preference: form.dietary_preference,
        health_note: form.health_note,
        rescue_deadline: rescueEnabled ? rescueDate.toISOString() : null,
        ngo_expiry: ngoEnabled ? ngoRescueDate.toISOString() : null,
        is_active: form.is_active,
      };
      const result = await api.updateListing(existingListing.id, payload);
      if (result.success) {
        Alert.alert('Success', 'Listing updated successfully.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', result.message || 'Failed to update listing.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not update listing.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!existingListing?.id) {
      Alert.alert('Error', 'Listing not found.');
      return;
    }
    Alert.alert(
      'Delete Listing',
      'This action cannot be undone. Do you want to remove this listing?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              const result = await api.deleteListing(existingListing.id);
              if (result.success) {
                Alert.alert('Deleted', 'Listing removed successfully.', [
                  { text: 'OK', onPress: () => navigation.goBack() },
                ]);
              } else {
                Alert.alert('Error', result.message || 'Failed to delete listing.');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Could not delete listing.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <ChevronLeft color="#1C4532" size={22} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Listing</Text>
          <TouchableOpacity onPress={handleDelete} style={styles.deleteButton} disabled={deleting}>
            {deleting
              ? <ActivityIndicator size="small" color="#EF4444" />
              : <Trash2 color="#EF4444" size={18} />}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero Image ── */}
          <View style={styles.imageWrapper}>
            <Image source={{ uri: imageUrl }} style={styles.listingImage} />
            <View style={styles.imageOverlay} />
            <View style={styles.imageBadge}>
              <Text style={styles.imageBadgeText}>
                {form.is_active ? '● Active' : '● Ended'}
              </Text>
            </View>
          </View>

          {/* ── Section: Basic Info ── */}
          <SectionLabel text="Basic Info" />

          <View style={styles.formGroup}>
            <Text style={styles.label}>Item Title</Text>
            <TextInput
              style={styles.input}
              value={form.item_name}
              onChangeText={(text) => setForm({ ...form, item_name: text })}
              placeholder="e.g., Surprise Bakery Bag"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Category</Text>
            <TextInput
              style={styles.input}
              value={form.category}
              onChangeText={(text) => setForm({ ...form, category: text })}
              placeholder="e.g., Bakery Item"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* ── Pricing Row ── */}
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Original (Rs.)</Text>
              <View style={styles.priceContainer}>
                <Text style={styles.currencySymbol}>₨</Text>
                <TextInput
                  style={styles.priceInput}
                  value={form.original_price}
                  keyboardType="numeric"
                  onChangeText={(text) => setForm({ ...form, original_price: text })}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Offer Price (Rs.)</Text>
              <View style={[styles.priceContainer, styles.offerPriceContainer]}>
                <Text style={[styles.currencySymbol, { color: '#059669' }]}>₨</Text>
                <TextInput
                  style={[styles.priceInput, { color: '#059669', fontWeight: '700' }]}
                  value={form.selling_price}
                  keyboardType="numeric"
                  onChangeText={(text) => setForm({ ...form, selling_price: text })}
                  placeholder="0"
                  placeholderTextColor="#6EE7B7"
                />
              </View>
            </View>
          </View>

          {/* ── Quantity & Status ── */}
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Quantity</Text>
              <View style={styles.quantityContainer}>
                <Package size={16} color="#6B7280" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.quantityInput}
                  value={form.stock_quantity}
                  keyboardType="numeric"
                  onChangeText={(text) => setForm({ ...form, stock_quantity: text })}
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <Text style={styles.label}>Status</Text>
              <TouchableOpacity
                style={[styles.statusToggle, form.is_active ? styles.statusActive : styles.statusInactive]}
                onPress={() => setForm({ ...form, is_active: !form.is_active })}
                activeOpacity={0.8}
              >
                <View style={[styles.statusDot, { backgroundColor: form.is_active ? '#059669' : '#DC2626' }]} />
                <Text style={[styles.statusToggleText, { color: form.is_active ? '#059669' : '#DC2626' }]}>
                  {form.is_active ? 'Active' : 'Ended'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Section: Details ── */}
          <SectionLabel text="Details" />

          <View style={styles.formGroup}>
            <Text style={styles.label}>Dietary Preference</Text>
            <TextInput
              style={styles.input}
              value={form.dietary_preference}
              onChangeText={(text) => setForm({ ...form, dietary_preference: text })}
              placeholder="e.g., Veg, Non-veg, Vegan"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Health Note</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.health_note}
              onChangeText={(text) => setForm({ ...form, health_note: text })}
              multiline
              numberOfLines={4}
              placeholder="Optional notes about allergens or ingredients"
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
            />
          </View>

          {/* ── Section: Scheduling ── */}
          <SectionLabel text="Scheduling" />

          {/* Pickup Deadline */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Pickup Deadline</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity style={styles.dateTimeBtn} onPress={() => setShowDatePicker(true)}>
                <Calendar color="#2D6A4F" size={16} style={{ marginRight: 8 }} />
                <Text style={styles.dateTimeBtnText}>
                  {rescueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateTimeBtn} onPress={() => setShowTimePicker(true)}>
                <Clock color="#2D6A4F" size={16} style={{ marginRight: 8 }} />
                <Text style={styles.dateTimeBtnText}>
                  {rescueDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>
            {showDatePicker && (
              <DateTimePicker
                value={rescueDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    const newDate = new Date(rescueDate);
                    newDate.setFullYear(selectedDate.getFullYear());
                    newDate.setMonth(selectedDate.getMonth());
                    newDate.setDate(selectedDate.getDate());
                    setRescueDate(newDate);
                  }
                }}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={rescueDate}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedTime) => {
                  setShowTimePicker(false);
                  if (selectedTime) {
                    const newTime = new Date(rescueDate);
                    newTime.setHours(selectedTime.getHours());
                    newTime.setMinutes(selectedTime.getMinutes());
                    setRescueDate(newTime);
                  }
                }}
              />
            )}
          </View>

          {/* NGO Expiry */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>NGO Donation Expiry</Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity style={[styles.dateTimeBtn, styles.dateTimeBtnNgo]} onPress={() => setShowNgoDatePicker(true)}>
                <Calendar color="#B45309" size={16} style={{ marginRight: 8 }} />
                <Text style={[styles.dateTimeBtnText, { color: '#B45309' }]}>
                  {ngoRescueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dateTimeBtn, styles.dateTimeBtnNgo]} onPress={() => setShowNgoTimePicker(true)}>
                <Clock color="#B45309" size={16} style={{ marginRight: 8 }} />
                <Text style={[styles.dateTimeBtnText, { color: '#B45309' }]}>
                  {ngoRescueDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>
            {showNgoDatePicker && (
              <DateTimePicker
                value={ngoRescueDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={rescueDate}
                onChange={(event, selectedDate) => {
                  setShowNgoDatePicker(false);
                  if (selectedDate) {
                    const newDate = new Date(ngoRescueDate);
                    newDate.setFullYear(selectedDate.getFullYear());
                    newDate.setMonth(selectedDate.getMonth());
                    newDate.setDate(selectedDate.getDate());
                    setNgoRescueDate(newDate);
                  }
                }}
              />
            )}
            {showNgoTimePicker && (
              <DateTimePicker
                value={ngoRescueDate}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedTime) => {
                  setShowNgoTimePicker(false);
                  if (selectedTime) {
                    const newTime = new Date(ngoRescueDate);
                    newTime.setHours(selectedTime.getHours());
                    newTime.setMinutes(selectedTime.getMinutes());
                    setNgoRescueDate(newTime);
                  }
                }}
              />
            )}
          </View>

          {/* ── Info Banner ── */}
          <View style={styles.infoBox}>
            <View style={styles.infoIconWrap}>
              <Info size={14} color="#2D6A4F" />
            </View>
            <Text style={styles.infoText}>
              Ensure items are listed clearly so customers can understand price, stock, and pickup timing.
            </Text>
          </View>

          {/* ── Save Button ── */}
          <TouchableOpacity style={styles.saveButton} onPress={handleUpdate} disabled={saving} activeOpacity={0.85}>
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Save size={18} color="#FFF" style={{ marginRight: 10 }} />
                <Text style={styles.saveButtonText}>Save Updates</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

/** Small reusable section divider label */
const SectionLabel = ({ text }: { text: string }) => (
  <View style={styles.sectionLabel}>
    <Text style={styles.sectionLabelText}>{text}</Text>
    <View style={styles.sectionLabelLine} />
  </View>
);

export default EditListing;

const styles = StyleSheet.create({
  /* ── Layout ── */
  container: { flex: 1, backgroundColor: '#F8FAF9' },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9F0EC',
    shadowColor: '#1C4532',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C4532',
    letterSpacing: 0.2,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F0F7F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollContent: { padding: 20, paddingBottom: 40 },

  /* ── Hero Image ── */
  imageWrapper: {
    width: '100%',
    height: 210,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 28,
    backgroundColor: '#D1FAE5',
    shadowColor: '#1C4532',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  listingImage: { width: '100%', height: '100%' },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28,69,50,0.15)',
  },
  imageBadge: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  imageBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C4532',
    letterSpacing: 0.3,
  },

  /* ── Section Label ── */
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  sectionLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2D6A4F',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginRight: 10,
  },
  sectionLabelLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D1FAE5',
  },

  /* ── Form Elements ── */
  formGroup: { marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  textArea: {
    height: 108,
    paddingTop: 14,
  },

  /* ── Pricing ── */
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  offerPriceContainer: {
    borderColor: '#6EE7B7',
    backgroundColor: '#F0FDF4',
  },
  currencySymbol: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '600',
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
    padding: 0,
  },

  /* ── Quantity ── */
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  quantityInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
    padding: 0,
  },

  /* ── Status Toggle ── */
  statusToggle: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 6,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusActive: { backgroundColor: '#F0FDF4', borderColor: '#6EE7B7' },
  statusInactive: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  statusToggleText: { fontWeight: '700', fontSize: 14 },

  /* ── Date / Time ── */
  dateTimeRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  dateTimeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#B7DFC9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  dateTimeBtnNgo: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  dateTimeBtnText: {
    fontSize: 13,
    color: '#1C4532',
    fontWeight: '600',
  },

  /* ── Info Box ── */
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    padding: 14,
    borderRadius: 14,
    alignItems: 'flex-start',
    marginBottom: 24,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  infoIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    flexShrink: 0,
    marginTop: 1,
  },
  infoText: {
    fontSize: 13,
    color: '#065F46',
    flex: 1,
    lineHeight: 19,
  },

  /* ── Save Button ── */
  saveButton: {
    backgroundColor: '#1C4532',
    flexDirection: 'row',
    height: 58,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1C4532',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
    marginBottom: 12,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
