import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api, API_BASE_URL } from "../services/api";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

export default function DriverProfile({ navigation }: any) {
  const [modalVisible, setModalVisible] = useState(false);
  const [dailyGoal, setDailyGoal] = useState("1500");
  const [tempGoal, setTempGoal] = useState("1500");

  // Dynamic summary stats
  const [totalDeliveries, setTotalDeliveries] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalCO2, setTotalCO2] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  // Dynamic Driver Registered personal info
  const [driverName, setDriverName] = useState("Suraj Rai");
  const [driverPhone, setDriverPhone] = useState("+977 98xxxxxxxx");
  const [driverEmail, setDriverEmail] = useState("julia.fox@gmail.com");

  // Edit Profile States
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editProfileImageUri, setEditProfileImageUri] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [driverProfileImage, setDriverProfileImage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);

  // Vehicle Info (Editable & Persisted)
  const [vehicleModalVisible, setVehicleModalVisible] = useState(false);
  const [vehicleType, setVehicleType] = useState("Scooter");
  const [licensePlate, setLicensePlate] = useState("BA 18 PA 7892");
  const [tempVehicleType, setTempVehicleType] = useState("Scooter");
  const [tempLicensePlate, setTempLicensePlate] = useState("BA 18 PA 7892");

  // Change Password States
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useFocusEffect(
    useCallback(() => {
      const fetchDriverStatsAndProfile = async () => {
        setLoadingStats(true);
        try {
          // 1. Fetch Orders Stats (Dynamically aggregates completed/confirmed orders for total stats)
          const response = await api.getDriverOrders();
          if (response.success && response.orders) {
            let deliveries = 0;
            let earnings = 0;

            response.orders.forEach((order: any) => {
              deliveries++;
              earnings += Number(order.delivery_fee) || 0;
            });

            setTotalDeliveries(deliveries);
            setTotalEarnings(earnings);
            // Estimate: each delivery saves ~1.2kg CO2
            setTotalCO2(parseFloat((deliveries * 1.2).toFixed(1)));
          }

          // 1b. Fetch average customer rating
          const ratingRes = await api.getDriverRating();
          if (ratingRes?.success) {
            setAvgRating(ratingRes.average_rating);
          }

          // 2. Fetch Personal profile registered info dynamically
          const profileRes = await api.getMe();
          if (profileRes && profileRes.user) {
            const u = profileRes.user;
            setCurrentUserId(u.id);
            setDriverName(u.full_name || "Suraj Rai");
            setDriverEmail(u.email || "julia.fox@gmail.com");
            setDriverPhone(u.phone || "+977 98xxxxxxxx");
            setDriverProfileImage(u.profile_image ? `${API_BASE_URL}${u.profile_image.startsWith('/') ? '' : '/'}${u.profile_image}` : null);
          }

          // 3. Load Vehicle Info from local storage
          const storedVehicleType = await AsyncStorage.getItem('driver_vehicle_type');
          const storedLicensePlate = await AsyncStorage.getItem('driver_license_plate');
          if (storedVehicleType) setVehicleType(storedVehicleType);
          if (storedLicensePlate) setLicensePlate(storedLicensePlate);

          // 4. Load Active Order from local storage
          const storedActiveOrder = await AsyncStorage.getItem('active_order');
          if (storedActiveOrder) {
            setActiveOrder(JSON.parse(storedActiveOrder));
          } else {
            setActiveOrder(null);
          }

        } catch (error) {
          console.error("Failed to load driver profile details:", error);
        } finally {
          setLoadingStats(false);
        }
      };
      fetchDriverStatsAndProfile();
    }, [])
  );

  const openEditModal = () => {
    setEditName(driverName);
    setEditPhone(driverPhone === '+977 98xxxxxxxx' ? '' : driverPhone);
    setEditProfileImageUri(driverProfileImage);
    setEditProfileModalVisible(true);
  };

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setEditProfileImageUri(result.assets[0].uri);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert("Error", "Name cannot be empty.");
      return;
    }
    if (!editPhone.trim()) {
      Alert.alert("Error", "Phone number is compulsory.");
      return;
    }
    const cleanPhone = editPhone.replace(/[\s-+]/g, "");
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
    setSavingProfile(true);
    try {
      const updateRes = await api.updateProfile({ full_name: editName, phone: editPhone });
      if (!updateRes.success) throw new Error(updateRes.message || "Failed to update profile.");

      if (editProfileImageUri && editProfileImageUri !== driverProfileImage && currentUserId) {
        const formData = new FormData();
        formData.append("userId", String(currentUserId));
        formData.append("type", "profile");
        const uriParts = editProfileImageUri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        formData.append("image", { uri: editProfileImageUri, name: `profile-${currentUserId}.${fileType}`, type: `image/${fileType}` } as any);
        
        const imgRes = await api.updateBranding(formData);
        if (!imgRes.success) throw new Error("Profile details saved, but failed to upload image.");
      }
      
      Alert.alert("Success 🎉", "Profile updated successfully!");
      setEditProfileModalVisible(false);
      
      const freshUser = await api.getMe();
      if (freshUser.success && freshUser.user) {
        const u = freshUser.user;
        setDriverName(u.full_name || "Suraj Rai");
        setDriverPhone(u.phone || '+977 98xxxxxxxx');
        setDriverProfileImage(u.profile_image ? `${API_BASE_URL}${u.profile_image.startsWith('/') ? '' : '/'}${u.profile_image}` : null);
      }
    } catch (err: any) {
      console.error("Save profile error:", err);
      Alert.alert("Error", err.message || "Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveGoal = () => {
    if (tempGoal && parseInt(tempGoal) > 0) {
      setDailyGoal(tempGoal);
    }
    setModalVisible(false);
  };

  const handleSaveVehicleInfo = async () => {
    if (!tempVehicleType.trim() || !tempLicensePlate.trim()) {
      Alert.alert("Error", "Please fill in all vehicle information fields.");
      return;
    }
    try {
      await AsyncStorage.setItem('driver_vehicle_type', tempVehicleType);
      await AsyncStorage.setItem('driver_license_plate', tempLicensePlate);
      setVehicleType(tempVehicleType);
      setLicensePlate(tempLicensePlate);
      setVehicleModalVisible(false);
      Alert.alert("Success 🎉", "Vehicle Information updated successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to save vehicle details.");
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
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
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
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

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out of your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.clear();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
        },
      ]
    );
  };

  const getInitials = (name: string) => {
    if (!name) return "SR";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatEarnings = (amount: number) => {
    if (amount >= 1000) {
      return `NPR ${(amount / 1000).toFixed(1)}K`;
    }
    return `NPR ${amount}`;
  };

  // Dynamic Driver Tiers calculation based on Completed Rides (Deliveries) count
  const getDriverTier = (deliveriesCount: number) => {
    if (deliveriesCount < 5) {
      return { label: "Bronze Driver", color: "#CD7F32", star: "★" };
    } else if (deliveriesCount < 15) {
      return { label: "Gold Driver", color: "#F5A623", star: "★★" };
    } else {
      return { label: "Platinum Driver", color: "#E8E8CC", star: "★★★" };
    }
  };

  const currentTier = getDriverTier(totalDeliveries);
  const progressPercent = Math.min((totalEarnings / parseInt(dailyGoal || "1")) * 100, 100);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.headerNav}>
        <TouchableOpacity
          style={styles.navIconBtn}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'DriverDashboard' }] })}
        >
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.navIconBtn}
          onPress={openEditModal}
        >
          <MaterialCommunityIcons name="pencil-outline" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        overScrollMode="never"
      >
        {/* HEADER SECTION */}
        <View style={styles.header}>
          <View style={styles.monogramContainer}>
            <TouchableOpacity onPress={openEditModal} activeOpacity={0.9}>
              <View style={styles.monogramCircle}>
                {driverProfileImage ? (
                  <Image source={{ uri: driverProfileImage }} style={styles.headerProfileImage} />
                ) : (
                  <Text style={styles.monogramText}>{getInitials(driverName)}</Text>
                )}
              </View>
              <View style={styles.verifiedBadge}>
                <MaterialCommunityIcons name="camera" size={14} color="#244F42" />
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.driverName}>{driverName}</Text>
          <Text style={[styles.driverRating, { color: currentTier.color }]}>
            {currentTier.star} {currentTier.label}
          </Text>
        </View>

        {/* PERFORMANCE SUMMARY CARD - NOW DYNAMIC */}
        <TouchableOpacity
          style={styles.summaryCard}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("EarningsHistory", { sharedGoal: dailyGoal })}
        >
          <View style={styles.summaryHeader}>
            <Ionicons name="ribbon-outline" size={18} color="#F5A623" />
            <Text style={styles.summaryTitle}>Today's Summary</Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" style={{ marginLeft: 'auto' }} />
          </View>
          {loadingStats ? (
            <ActivityIndicator size="small" color="#244F42" style={{ marginVertical: 15 }} />
          ) : (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalDeliveries}</Text>
                <Text style={styles.statLabel}>Deliveries</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatEarnings(totalEarnings)}</Text>
                <Text style={styles.statLabel}>Earnings</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalCO2}kg</Text>
                <Text style={styles.statLabel}>CO₂ Saved</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* DAILY GOAL PROGRESS CARD - NOW DYNAMIC */}
        <TouchableOpacity
          style={styles.goalCard}
          activeOpacity={0.8}
          onPress={() => {
            setTempGoal(dailyGoal);
            setModalVisible(true);
          }}
        >
          <View style={styles.goalHeader}>
            <View>
              <Text style={styles.goalTitle}>Daily Progress</Text>
              <Text style={styles.goalSub}>NPR {totalEarnings} of {dailyGoal} Goal</Text>
            </View>
            <MaterialCommunityIcons name="target" size={24} color="#244F42" />
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.tapToEdit}>Tap to set new goal</Text>
        </TouchableOpacity>

        {/* ACTIVE DELIVERY STATUS */}
        {activeOrder && (
          <TouchableOpacity
            style={styles.activeDeliveryCard}
            onPress={() => navigation.navigate('DeliveryTracking', { order: activeOrder })}
          >
            <View style={styles.activeDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeTitle}>Active Delivery</Text>
              <Text style={styles.activeSubText}>Delivering to {activeOrder.customer_name || "Customer"}</Text>
              <Text style={styles.activeEta}>ETA: 8 mins</Text>
            </View>
            <View style={styles.viewDetailsBtn}>
              <Text style={styles.viewDetailsText}>View Details</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* VEHICLE INFO - CLICKABLE TO EDIT */}
        <TouchableOpacity
          style={styles.infoCard}
          activeOpacity={0.7}
          onPress={() => {
            setTempVehicleType(vehicleType);
            setTempLicensePlate(licensePlate);
            setVehicleModalVisible(true);
          }}
        >
          <View style={styles.cardHeaderWithEdit}>
            <Text style={styles.cardTitle}>Vehicle Information</Text>
            <MaterialCommunityIcons name="pencil-outline" size={16} color="#244F42" />
          </View>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="scooter" size={24} color="#9CA3AF" />
            <View style={styles.detailTextStack}>
              <Text style={styles.detailLabel}>Vehicle Type</Text>
              <Text style={styles.detailValue}>{vehicleType}</Text>
            </View>
          </View>
          <View style={[styles.detailRow, { marginTop: 15 }]}>
            <Ionicons name="card-outline" size={24} color="#9CA3AF" />
            <View style={styles.detailTextStack}>
              <Text style={styles.detailLabel}>License Plate</Text>
              <Text style={styles.detailValue}>{licensePlate}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* PERSONAL INFORMATION */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Personal Information</Text>
          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={22} color="#9CA3AF" />
            <View style={styles.detailTextStack}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{driverPhone}</Text>
            </View>
          </View>
          <View style={[styles.detailRow, { marginTop: 15 }]}>
            <Ionicons name="mail-outline" size={22} color="#9CA3AF" />
            <View style={styles.detailTextStack}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{driverEmail}</Text>
            </View>
          </View>
        </View>

        {/* PERFORMANCE METRICS SECTION */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Performance Metrics</Text>

          <View style={styles.metricContainer}>
            <View style={styles.metricTextRow}>
              <Text style={styles.metricLabel}>On-time Delivery Rate</Text>
              <Text style={[styles.metricValueText, { color: '#244F42' }]}>92%</Text>
            </View>
            <View style={styles.metricBg}>
              <View style={[styles.metricFill, { width: '92%', backgroundColor: '#244F42' }]} />
            </View>
          </View>

          <View style={styles.metricContainer}>
            <View style={styles.metricTextRow}>
              <Text style={styles.metricLabel}>Customer Rating</Text>
              <Text style={[styles.metricValueText, { color: '#F5A623' }]}>
                {avgRating !== null ? `${avgRating} / 5` : '—'}
              </Text>
            </View>
            <View style={styles.metricBg}>
              <View style={[styles.metricFill, { width: avgRating !== null ? `${(avgRating / 5) * 100}%` : '0%', backgroundColor: '#F5A623' }]} />
            </View>
          </View>

          <View style={styles.metricContainer}>
            <View style={styles.metricTextRow}>
              <Text style={styles.metricLabel}>Acceptance Rate</Text>
              <Text style={[styles.metricValueText, { color: '#244F42' }]}>85%</Text>
            </View>
            <View style={styles.metricBg}>
              <View style={[styles.metricFill, { width: '85%', backgroundColor: '#244F42', opacity: 0.8 }]} />
            </View>
          </View>
        </View>

        {/* PRIVACY & SECURITY SECTION */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Privacy & Security</Text>
          
          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomWidth: 0, paddingHorizontal: 0, paddingVertical: 12 }]} 
            onPress={() => {
              setPasswordError("");
              setChangePasswordModalVisible(true);
            }}
          >
            <Ionicons name="key-outline" size={20} color="#111827" />
            <Text style={styles.menuText}>Change Password</Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* LOGOUT BUTTON */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* BOTTOM NAVIGATION FOOTER */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'DriverDashboard' }] })}
        >
          <Ionicons name="home" size={26} color="#FFFFFF" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="person" size={26} color="#E8E8CC" />
          <Text style={[styles.navText, { color: '#E8E8CC' }]}>Profile</Text>
        </TouchableOpacity>
      </View>

      {/* DAILY GOAL MODAL */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay} onStartShouldSetResponder={() => true}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Daily Goal</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currencyLabel}>NPR</Text>
              <TextInput
                style={styles.goalInput}
                keyboardType="numeric"
                value={tempGoal}
                onChangeText={setTempGoal}
                autoFocus={true}
                maxLength={5}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveGoal} style={styles.modalSave}>
                <Text style={styles.saveText}>Update Goal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* EDIT VEHICLE MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={vehicleModalVisible}
        onRequestClose={() => setVehicleModalVisible(false)}
      >
        <View style={styles.modalOverlay} onStartShouldSetResponder={() => true}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Vehicle Information</Text>
            
            <View style={styles.editInputContainer}>
              <Text style={styles.inputLabel}>Vehicle Type</Text>
              <TextInput
                style={styles.textInput}
                value={tempVehicleType}
                onChangeText={setTempVehicleType}
                placeholder="e.g., Scooter, Bicycle, Motorcycle"
              />
            </View>

            <View style={styles.editInputContainer}>
              <Text style={styles.inputLabel}>License Plate</Text>
              <TextInput
                style={styles.textInput}
                value={tempLicensePlate}
                onChangeText={setTempLicensePlate}
                placeholder="e.g., BA 18 PA 7892"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setVehicleModalVisible(false)} style={styles.modalCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveVehicleInfo} style={styles.modalSave}>
                <Text style={styles.saveText}>Save Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* EDIT DRIVER PROFILE MODAL */}
      <Modal
        visible={editProfileModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!savingProfile) setEditProfileModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay} onStartShouldSetResponder={() => true}>
          <View style={styles.modalContainer}>
            <View style={styles.editProfileHeader}>
              <Text style={styles.modalTitleLight}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditProfileModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color="#E8E8CC" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.editProfileScroll}>
              <View style={styles.editImageSection}>
                <TouchableOpacity onPress={handlePickImage} style={styles.editImageCircle}>
                  {editProfileImageUri ? (
                    <Image source={{ uri: editProfileImageUri }} style={styles.editImagePreview} />
                  ) : (
                    <Ionicons name="camera-outline" size={32} color="rgba(232, 232, 204, 0.6)" />
                  )}
                  <View style={styles.editImageBadge}>
                    <Ionicons name="pencil" size={12} color="#244F42" />
                  </View>
                </TouchableOpacity>
                <Text style={styles.editImageText}>Tap to change avatar</Text>
              </View>

              <Text style={styles.inputLabelLight}>Full Name</Text>
              <View style={styles.editProfileInputContainer}>
                <TextInput
                  style={styles.editProfileInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Full Name"
                  placeholderTextColor="rgba(232, 232, 204, 0.4)"
                />
              </View>

              <Text style={styles.inputLabelLight}>Phone Number</Text>
              <View style={styles.editProfileInputContainer}>
                <TextInput
                  style={styles.editProfileInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="Phone Number"
                  placeholderTextColor="rgba(232, 232, 204, 0.4)"
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#F5A623', marginTop: 15 }]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#244F42" />
                ) : (
                  <Text style={[styles.saveBtnText, { color: '#244F42' }]}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
              <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={styles.eyeIcon}>
                <Ionicons name={showCurrentPassword ? "eye-off-outline" : "eye-outline"} size={20} color="rgba(232, 232, 204, 0.6)" />
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
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeIcon}>
                <Ionicons name={showNewPassword ? "eye-off-outline" : "eye-outline"} size={20} color="rgba(232, 232, 204, 0.6)" />
              </TouchableOpacity>
            </View>

            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                placeholder="Confirm New Password"
                placeholderTextColor="rgba(232, 232, 204, 0.4)"
                secureTextEntry={!showConfirmPassword}
                editable={!savingPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color="rgba(232, 232, 204, 0.6)" />
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
  container: { flex: 1, backgroundColor: "#244F42" },
  scrollContent: { backgroundColor: '#F8F9FA' },
  headerNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10,
    paddingBottom: 15,
    backgroundColor: '#244F42',
    zIndex: 10,
  },
  navIconBtn: { padding: 10, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12 },
  header: { backgroundColor: '#244F42', paddingTop: 10, paddingBottom: 45, alignItems: 'center' },
  monogramContainer: { position: 'relative', marginTop: 10 },
  monogramCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#E8E8CC', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  monogramText: { fontSize: 32, fontWeight: 'bold', color: '#244F42', letterSpacing: 1 },
  headerProfileImage: { width: 84, height: 84, borderRadius: 42, resizeMode: 'cover' },
  verifiedBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#fff', borderRadius: 12, padding: 4, elevation: 2 },
  driverName: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginTop: 12 },
  driverRating: { fontSize: 13, marginTop: 4, fontWeight: '600' },

  summaryCard: { backgroundColor: '#fff', marginHorizontal: 20, borderRadius: 24, padding: 20, marginTop: -30, elevation: 8, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  summaryTitle: { fontSize: 15, fontWeight: 'bold', marginLeft: 8, color: '#111827' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  statLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },

  goalCard: { backgroundColor: '#fff', marginHorizontal: 20, marginTop: 15, marginBottom: 8, borderRadius: 20, padding: 18, elevation: 1 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  goalTitle: { fontSize: 14, fontWeight: 'bold', color: '#111827' },
  goalSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  progressBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#244F42', borderRadius: 4 },
  tapToEdit: { fontSize: 10, color: '#9CA3AF', marginTop: 8, textAlign: 'right', fontStyle: 'italic' },

  activeDeliveryCard: { backgroundColor: '#FEF3C7', marginHorizontal: 20, marginVertical: 8, borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F5A623' },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F5A623', marginRight: 12 },
  activeTitle: { fontSize: 14, fontWeight: 'bold', color: '#92400E' },
  activeSubText: { fontSize: 12, color: '#92400E', opacity: 0.8 },
  activeEta: { fontSize: 12, color: '#92400E', marginTop: 4, fontWeight: '500' },
  viewDetailsBtn: { backgroundColor: '#244F42', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  viewDetailsText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  infoCard: { backgroundColor: '#fff', marginHorizontal: 20, marginTop: 8, marginBottom: 8, borderRadius: 20, padding: 20, elevation: 1 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#111827', marginBottom: 15 },
  cardHeaderWithEdit: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  detailRow: { flexDirection: 'row', alignItems: 'center' },
  detailTextStack: { marginLeft: 15, flex: 1 },
  detailLabel: { fontSize: 11, color: '#9CA3AF' },
  detailValue: { fontSize: 14, fontWeight: '500', color: '#111827', marginTop: 2 },

  metricContainer: { marginBottom: 18 },
  metricTextRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  metricLabel: { fontSize: 14, color: '#4B5563', fontWeight: '500' },
  metricValueText: { fontSize: 14, fontWeight: 'bold' },
  metricBg: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 10, overflow: 'hidden' },
  metricFill: { height: '100%', borderRadius: 10 },

  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', justifyContent: 'space-between' },
  menuText: { flex: 1, marginLeft: 15, fontSize: 15, fontWeight: '500', color: '#111827' },

  logoutButton: { marginHorizontal: 20, marginTop: 10, height: 55, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#EF4444' },
  logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 25, width: '100%', maxWidth: 340 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 20, textAlign: 'center' },
  modalTitleLight: { fontSize: 18, fontWeight: 'bold', color: '#E8E8CC', textAlign: 'center' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#244F42', marginBottom: 30, paddingHorizontal: 10 },
  currencyLabel: { fontSize: 20, fontWeight: 'bold', color: '#244F42', marginRight: 10 },
  goalInput: { fontSize: 24, fontWeight: 'bold', color: '#111827', flex: 1, paddingVertical: 10 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  modalCancel: { marginRight: 20, padding: 10 },
  cancelText: { color: '#6B7280', fontWeight: '600' },
  modalSave: { backgroundColor: '#244F42', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  saveText: { color: '#fff', fontWeight: 'bold' },

  editInputContainer: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  textInput: { height: 48, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 15, fontSize: 15, color: '#111827', backgroundColor: '#F9FAFB' },

  // Edit Driver Profile Modal Styles
  editProfileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(232, 232, 204, 0.1)', paddingBottom: 15 },
  modalCloseBtn: { padding: 4 },
  editProfileScroll: { width: '100%' },
  editImageSection: { alignItems: 'center', marginBottom: 25 },
  editImageCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(232, 232, 204, 0.08)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#F5A623', overflow: 'hidden', position: 'relative' },
  editImagePreview: { width: '100%', height: '100%', borderRadius: 50, resizeMode: 'cover' },
  editImageBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#E8E8CC', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#244F42' },
  editImageText: { fontSize: 13, color: '#E8E8CC', marginTop: 10 },
  inputLabelLight: { fontSize: 14, color: '#E8E8CC', marginBottom: 6, fontWeight: '600' },
  editProfileInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(232, 232, 204, 0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(232, 232, 204, 0.1)', marginBottom: 20 },
  editProfileInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, color: '#E8E8CC', fontSize: 16 },

  // Change Password Modal Styles matching User Profile
  modalContainer: { width: '100%', maxWidth: 340, backgroundColor: '#244F42', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(232, 232, 204, 0.15)', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  passwordInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(232, 232, 204, 0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(232, 232, 204, 0.1)', marginBottom: 15, width: '100%' },
  passwordInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, color: '#E8E8CC', fontSize: 16 },
  eyeIcon: { padding: 12 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 15, width: '100%' },
  modalBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cancelBtn: { backgroundColor: 'rgba(232, 232, 204, 0.1)' },
  cancelBtnText: { color: 'rgba(232, 232, 204, 0.7)', fontWeight: '600', fontSize: 15 },
  saveBtn: { backgroundColor: '#F5A623' },
  saveBtnText: { color: '#244F42', fontWeight: 'bold', fontSize: 15 },

  // Consistent Bottom Navigation Footer
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', height: 85, backgroundColor: '#244F42', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 10 },
  navItem: { alignItems: "center", justifyContent: "center" },
  navText: { fontSize: 10, marginTop: 4, fontWeight: '600', color: '#FFFFFF' },
  passwordErrorText: {
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
});