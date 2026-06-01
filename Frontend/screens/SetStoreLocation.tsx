import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SetStoreLocation = ({ navigation }: any) => {
  const [region, setRegion] = useState<any>(null);
  const [markerPosition, setMarkerPosition] = useState<any>(null);
  const [address, setAddress] = useState('Fetching address...');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const mapRef = React.useRef<MapView | null>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Allow location access to set your store location.');
        setLoading(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const initialRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      setRegion(initialRegion);
      setMarkerPosition({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      reverseGeocode(location.coords.latitude, location.coords.longitude);
      setLoading(false);
    })();
  }, []);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (result.length > 0) {
        const item = result[0];
        const addr = `${item.name || ''}, ${item.street || ''}, ${item.city || ''}`.replace(/^, |, $/g, '');
        setAddress(addr || 'Unknown Location');
      }
    } catch (e) {
      setAddress('Unknown Location');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const searchQueryString = searchQuery.toLowerCase().includes('nepal') 
        ? searchQuery 
        : `${searchQuery}, Nepal`;

      const result = await Location.geocodeAsync(searchQueryString);
      if (result.length > 0) {
        const loc = result[0];
        const newRegion = {
          latitude: loc.latitude,
          longitude: loc.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };
        mapRef.current?.animateToRegion(newRegion, 1000);
        setMarkerPosition({
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
        reverseGeocode(loc.latitude, loc.longitude);
      } else {
        Alert.alert("Location not found", "Could not locate this address. Try searching for a nearby city/landmark.");
      }
    } catch (e) {
      console.log("Search failed", e);
      Alert.alert("Error", "Could not perform location search.");
    }
  };

  const onRegionChangeComplete = (newRegion: any) => {
    setMarkerPosition({
      latitude: newRegion.latitude,
      longitude: newRegion.longitude,
    });
    reverseGeocode(newRegion.latitude, newRegion.longitude);
  };

  const handleSave = async () => {
    if (!markerPosition) return;
    setSaving(true);
    try {
      const response = await api.updateProfile({
        store_lat: markerPosition.latitude,
        store_lng: markerPosition.longitude,
        store_address: address,
      });

      if (response.success) {
        // Update local user storage
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          const updatedUser = { ...user, ...response.user };
          await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        }
        Alert.alert('Success', 'Store location updated successfully!');
        navigation.goBack();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save location');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#244F42" />
        <Text style={styles.loadingText}>Loading Map...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#244F42" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Set Store Location</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={region}
          onRegionChangeComplete={onRegionChangeComplete}
        >
          {markerPosition && <Marker coordinate={markerPosition} />}
        </MapView>

        {/* Floating search bar overlay */}
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search address (e.g. Maitidevi)"
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#999" style={styles.clearIcon} />
            </TouchableOpacity>
          ) : null}
        </View>
        
        <View style={styles.markerFixed}>
          <Ionicons name="location" size={40} color="#C62828" />
        </View>

        <View style={styles.addressCard}>
          <View style={styles.addressRow}>
            <Ionicons name="map-outline" size={20} color="#244F42" />
            <Text style={styles.addressText} numberOfLines={2}>{address}</Text>
          </View>
          <Text style={styles.hintText}>Drag the map to pinpoint your store</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.saveBtn, saving && { opacity: 0.7 }]} 
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save Store Location</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#244F42', fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#244F42' },
  mapContainer: { flex: 1, position: 'relative' },
  map: { ...StyleSheet.absoluteFillObject },
  markerFixed: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressCard: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  addressText: { flex: 1, fontSize: 14, color: '#333', marginLeft: 10, fontWeight: '500' },
  hintText: { fontSize: 12, color: '#999', textAlign: 'center' },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#eee' },
  saveBtn: { backgroundColor: '#244F42', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  searchBarContainer: {
    position: 'absolute',
    top: 15,
    left: 15,
    right: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 50,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    height: '100%',
  },
  clearIcon: {
    marginLeft: 8,
  },
});

export default SetStoreLocation;
