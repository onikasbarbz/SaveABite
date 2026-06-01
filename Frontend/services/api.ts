import { BASE_URL } from "./apiConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from 'expo-secure-store';

export const API_BASE_URL = BASE_URL; 
export type UserRole = "consumer" | "business" | "driver" | "ngo";

export interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  user: {
    id: number;
    full_name: string;      
    store_name?: string | null; 
    email: string;
    role: UserRole;
    profile_image?: string | null;
    cover_image?: string | null;
  };
}

export interface PaymentInitiateResponse {
  success: boolean;
  message?: string;
  order_id?: number;
  pidx?: string;
  payment_url?: string;
  amount?: number;
}

export interface PaymentVerifyResponse {
  success: boolean;
  message?: string;
  order?: { pickup_code?: string | null; id?: number };
  payment?: { status?: string; amount?: number; transaction_id?: string };
  payment_status?: string;
}

/**
 * Get the stored auth token from SecureStore
 */
async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync("token");
  } catch {
    return null;
  }
}

export const api = {
  // Generic JSON Request Helper
  async request(endpoint: string, options: RequestInit = {}) {
    const cleanBaseUrl = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${cleanBaseUrl}${cleanEndpoint}`;

    const token = await getToken();
    console.log("API Request Token:", token ? "Present" : "Missing");

    const config: RequestInit = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "69420",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);
    const text = await response.text();

    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      console.error("🔥 JSON Parse Error. Server sent:", text);
      throw new Error("Server sent invalid response. Check terminal.");
    }

    if (!response.ok) {
      if (response.status === 401) {
        await SecureStore.deleteItemAsync("token");
        await AsyncStorage.removeItem("user");
      }
      throw new Error(data.message || data.error || "Request failed");
    }

    return data;
  },

  async upload(endpoint: string, formData: FormData) {
    const cleanBaseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${cleanBaseUrl}${cleanEndpoint}`;

    const token = await getToken();

    try {
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        headers: {
          "ngrok-skip-browser-warning": "69420",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Upload failed");
      return data;
    } catch (error: any) {
      console.error("❌ Upload Error:", error.message);
      throw error;
    }
  },

  // =====================
  // AUTH
  // =====================
  
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    
    // Auto-store token on successful login
    if (response.token) {
      await SecureStore.setItemAsync("token", response.token);
    }
    
    return response;
  },

  async register(data: any) {
    const response = await this.request("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });

    // Auto-store token on successful registration
    if (response.token) {
      await SecureStore.setItemAsync("token", response.token);
    }

    return response;
  },

  async updateProfile(data: any) {
    return this.request("/api/auth/update-profile", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async getUserImpact(userId: number) {
    return this.request(`/api/impact/user/${userId}`, { method: "GET" });
  },

  async getMe() {
    return this.request("/api/auth/me", { method: "GET" });
  },

  async refreshToken() {
    const response = await this.request("/api/auth/refresh-token", { method: "GET" });
    if (response.success && response.token) {
      await SecureStore.setItemAsync("token", response.token);
      if (response.user) {
        await AsyncStorage.setItem("user", JSON.stringify(response.user));
      }
    }
    return response;
  },

  async uploadDocument(formData: FormData) {
    return this.upload("/api/ngo/upload-document", formData);
  },

  async forgotPassword(email: string) {
    return this.request("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token: string, password: string) {
    return this.request(`/api/auth/reset-password/${encodeURIComponent(token)}`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async logout() {
    await AsyncStorage.multiRemove(["user"]);
    await SecureStore.deleteItemAsync("token");
  },

  // =====================
  // NGO
  // =====================

  async getNgoStatus(userId: number) {
    return this.request(`/api/ngo/status/${userId}`, {
      method: "GET",
    });
  },

  // =====================
  // BRANDING
  // =====================

  async updateBranding(formData: FormData) {
    return this.upload("/api/auth/update-branding", formData);
  },

  // =====================
  // LISTINGS
  // =====================

  async getActiveListings() {
    return this.request("/api/listings/active", { method: "GET" });
  },

  async addListing(formData: FormData) {
    return this.upload("/api/listings/add", formData);
  },

  async getStoreListings(storeId: number) {
    return this.request(`/api/listings/store/${storeId}`, { method: "GET" });
  },

  async getMyListings() {
    return this.request("/api/listings/my-listings", { method: "GET" });
  },

  async getStoreOrders(storeId: number) {
    return this.request(`/api/listings/store-orders/${storeId}`, { method: "GET" });
  },

  async confirmPickup(reservationId: number, pickupCode: string) {
    return this.request(`/api/listings/confirm-pickup/${reservationId}`, {
      method: "PUT",
      body: JSON.stringify({ pickup_code: pickupCode }),
    });
  },

  async updateListing(listingId: number, data: any) {
    return this.request(`/api/listings/${listingId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteListing(listingId: number) {
    return this.request(`/api/listings/${listingId}`, {
      method: "DELETE",
    });
  },

  // =====================
  // RESERVATIONS
  // =====================

  async reserveItem(listingId: number) {
    return this.request("/api/listings/order", {
      method: "POST",
      body: JSON.stringify({ listing_id: listingId }),
    });
  },

  async cancelReservation(reservationId: number) {
    return this.request(`/api/listings/cancel-reservation/${reservationId}`, {
      method: "DELETE",
    });
  },

  async cancelOrder(reservationId: number) {
    return this.request(`/api/listings/user-cancel/${reservationId}`, {
      method: "POST",
    });
  },

  async getUserReservations(userId: number) {
    return this.request(`/api/listings/user-reservations/${userId}`, {
      method: "GET",
    });
  },

  async getDriverOrders() {
    return this.request("/api/listings/driver/orders", {
      method: "GET",
    });
  },

  async getDriverRating() {
    return this.request("/api/listings/driver/rating", { method: "GET" });
  },

  async getDriverActiveOrder() {
    return this.request("/api/listings/driver/active-order", { method: "GET" });
  },

  async driverAcceptOrder(reservationId: number) {
    return this.request(`/api/listings/driver/accept/${reservationId}`, { method: "PUT" });
  },

  async driverStartRide(reservationId: number) {
    return this.request(`/api/listings/driver/start-ride/${reservationId}`, { method: "PUT" });
  },

  async driverDeliverOrder(reservationId: number) {
    return this.request(`/api/listings/driver/deliver/${reservationId}`, { method: "PUT" });
  },

  async rateDriver(reservationId: number, rating: number) {
    return this.request(`/api/listings/rate-driver/${reservationId}`, {
      method: "PUT",
      body: JSON.stringify({ rating }),
    });
  },


  // =====================
  // DONATIONS
  // =====================

  async getAvailableDonations() {
    return this.request("/api/donations/available", { method: "GET" });
  },

  async acceptDonation(donationId: number) {
    return this.request(`/api/donations/${donationId}/accept`, { method: "PUT" });
  },

  /** @deprecated NGOs cannot confirm pickup — use uploadDonationProof after restaurant marks picked up */
  async confirmDonationPickup(donationId: number) {
    return this.request(`/api/donations/${donationId}/pickup`, { method: "PUT" });
  },

  async markRestaurantDonationPickup(donationId: number) {
    return this.request(`/api/donations/${donationId}/restaurant-pickup`, { method: "PUT" });
  },

  async uploadDonationProof(donationId: number, formData: FormData) {
    return this.upload(`/api/donations/${donationId}/proof`, formData);
  },

  async getMyDonations() {
    return this.request("/api/donations/my-donations", { method: "GET" });
  },

  async getStoreDonations() {
    return this.request("/api/donations/store-donations", { method: "GET" });
  },

  async requestDonationCertificate(donationId: number) {
    return this.request(`/api/donations/${donationId}/request-certificate`, { method: "POST" });
  },

  async getAdminCertificateRequests() {
    return this.request("/api/donations/certificate-requests", { method: "GET" });
  },

  async uploadDonationCertificate(donationId: number, formData: FormData) {
    return this.upload(`/api/donations/${donationId}/upload-certificate`, formData);
  },

  // =====================
  // IMPACT
  // =====================

  async getGlobalImpact() {
    return this.request("/api/impact/global", { method: "GET" });
  },

  // =====================
  // PAYMENT
  // =====================

  async initiatePayment(data: {
    listing_id: number;
    order_type?: string;
    delivery_lat?: number;
    delivery_lng?: number;
    delivery_address?: string;
    delivery_fee?: number;
  }): Promise<PaymentInitiateResponse> {
    return this.request("/api/payment/initiate", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async verifyPayment(pidx: string, orderId: number): Promise<PaymentVerifyResponse> {
    return this.request("/api/payment/verify", {
      method: "POST",
      body: JSON.stringify({ pidx, order_id: orderId }),
    });
  },

  async cancelPayment(orderId: number): Promise<{ success?: boolean; message?: string }> {
    return this.request("/api/payment/cancel", {
      method: "POST",
      body: JSON.stringify({ order_id: orderId }),
    });
  },

  /** Direct reservation (no Khalti) — same as POST /api/listings/order */
  async placeOrder(listingId: number) {
    return this.reserveItem(listingId);
  },

  // =====================
  // ADMIN
  // =====================

  async getAdminDashboard() {
    return this.request("/api/admin/dashboard", { method: "GET" });
  },

  async getAdminDonations(page: number = 1, limit: number = 10) {
    return this.request(`/api/admin/donations?page=${page}&limit=${limit}`, { method: "GET" });
  },

  async getAdminUsers(page: number = 1, limit: number = 10) {
    return this.request(`/api/admin/users?page=${page}&limit=${limit}`, { method: "GET" });
  },

  async getAdminListings(page: number = 1, limit: number = 10) {
    return this.request(`/api/admin/listings?page=${page}&limit=${limit}`, { method: "GET" });
  },

  // =====================
  // ANALYTICS
  // =====================

  async getBusinessAnalytics(storeId: number) {
    return this.request(`/api/analytics/business/${storeId}`, { method: "GET" });
  },

  // =====================
  // NOTIFICATIONS
  // =====================

  async getNotifications() {
    return this.request("/api/notifications", { method: "GET" });
  },

  async markNotificationsRead() {
    return this.request("/api/notifications/read-all", { method: "PATCH" });
  },

  // =====================
  // ADVERTISEMENTS
  // =====================

  async getAds() {
    return this.request("/api/ads", { method: "GET" });
  },
};