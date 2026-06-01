import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, AntDesign } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from 'expo-secure-store';
import { api, API_BASE_URL } from "../services/api";

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<any, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Helper function to handle navigation after login
  const handlePostLoginNavigation = async (user: any, token?: string) => {
    await AsyncStorage.setItem("user", JSON.stringify(user));
    if (token) {
      await SecureStore.setItemAsync("token", token);
    }
    const { id, role } = user;

    if (role === "business") {
      navigation.replace("BusinessDashboard");
    } else if (role === "driver") {
      navigation.replace("DriverDashboard");
    } else {
      try {
        const ngoData = await api.getNgoStatus(id);
        if (ngoData.success && ngoData.status === 'verified') {
          // Update stored user role to 'ngo' so app restarts also route correctly
          const updatedUser = { ...user, role: 'ngo' };
          await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
          navigation.replace("NGOHomepage");
        } else {
          navigation.replace("Home");
        }
      } catch (e) {
        navigation.replace("Home");
      }
    }
  };

  const handleLogin = async () => {
    setLoginError("");
    if (!email || !password) {
      setLoginError("Please fill in all fields");
      return;
    }
    try {
      setLoading(true);
      const response = await api.login(email, password);
      if (response && response.user) {
        await handlePostLoginNavigation(response.user, response.token);
      } else if (response && !response.success) {
        setLoginError(response.message || "Invalid credentials or server error");
      }
    } catch (error: any) {
      setLoginError(error?.message || "Invalid credentials or server error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setOauthLoading(true);
    try {
      // 1. Create the return address for the app
      const redirectUri = Linking.createURL("/");
      
      // 2. Point to the NEW Google route on your backend
      // We pass the redirect_uri so the backend knows where to send the user back
      const googleAuthUrl = `${API_BASE_URL}/api/auth/google?role=consumer&redirect_uri=${encodeURIComponent(redirectUri)}`;
      
      console.log("📍 WebBrowser Session Started with URI:", redirectUri);
      console.log("📍 WebBrowser Session Google URL:", googleAuthUrl);
      
      const authSessionResult = await WebBrowser.openAuthSessionAsync(googleAuthUrl, redirectUri);
      console.log("📍 WebBrowser Session Result:", JSON.stringify(authSessionResult));

      // 4. If the login was successful, the URL will contain the auth token
      if (authSessionResult.type === "success" && authSessionResult.url) {
        console.log("📍 Google Auth Result URL:", authSessionResult.url);
        const parsedUrl = Linking.parse(authSessionResult.url);
        let tokenStr = parsedUrl.queryParams?.token as string;
        
        // Robust regex fallback if parsedUrl query params are empty
        if (!tokenStr && authSessionResult.url) {
          const match = authSessionResult.url.match(/[?&]token=([^&]+)/);
          if (match) {
            tokenStr = match[1];
          }
        }

        if (tokenStr) {
          const token = decodeURIComponent(tokenStr);
          console.log("✅ Token received, fetching user profile...");
          
          // Store token first so getMe() can use it
          await SecureStore.setItemAsync("token", token);
          
          // Fetch full user data from backend
          try {
            const meResult = await api.getMe();
            if (meResult.success && meResult.user) {
              console.log("✅ Profile fetched:", meResult.user.full_name);
              await handlePostLoginNavigation(meResult.user, token);
            } else {
              throw new Error("Could not fetch profile");
            }
          } catch (fetchError: any) {
            console.error("❌ Profile Fetch Error:", fetchError);
            setLoginError("Authenticated but failed to retrieve user profile.");
          }
        } else {
          // If authSessionResult.url exists but no token is found, check for an error param
          const errorMatch = authSessionResult.url.match(/[?&]error=([^&]+)/);
          const errorParam = errorMatch ? decodeURIComponent(errorMatch[1]) : null;
          setLoginError(errorParam ? `Google login error: ${errorParam}` : "Could not retrieve authentication token. Please try again.");
        }
      } else {
        // User dismissed the browser — no error needed
        console.log("Google auth dismissed, status:", authSessionResult.type);
      }
    } catch (error: any) {
      setLoginError(error.message || "Google login failed. Please try again.");
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#244F42", "#244F42"]} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Text style={styles.title}>
          Log In{"\n"}To Your Next Great{"\n"}Meal.
        </Text>

        <View style={styles.inputContainer}>
          <Ionicons name="person-outline" size={20} color="#fff" style={styles.inputIcon} />
          <TextInput
            placeholder="Email"
            placeholderTextColor="#BFBFBF"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#fff" style={styles.inputIcon} />
          <TextInput
            placeholder="Password"
            placeholderTextColor="#BFBFBF"
            style={styles.input}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={22} color="#BFBFBF" />
          </TouchableOpacity>
        </View>

        {loginError ? (
          <Text style={styles.errorText}>{loginError}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.disabledBtn]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.loginText}>LOGIN</Text>}
        </TouchableOpacity>

        <View style={styles.rowBetween}>
          <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword") }>
            <Text style={styles.linkText}>Forgot Password?</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Register")}>
            <Text style={styles.linkText}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity
          style={[styles.googleBtn, oauthLoading && styles.disabledBtn]}
          onPress={handleGoogleLogin}
          disabled={oauthLoading}
        >
          {oauthLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <AntDesign name="google" size={20} color="#000" />
              <Text style={styles.socialText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scrollContainer: { flexGrow: 1, paddingHorizontal: 30, justifyContent: "center" },
  title: { color: "#fff", fontSize: 28, fontWeight: "bold", marginBottom: 40 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderColor: "#D3D3D3",
    borderWidth: 1,
    borderRadius: 25,
    height: 50,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: "#fff", fontSize: 16 },
  eyeIcon: { padding: 5 },
  loginBtn: {
    backgroundColor: "#F5A623",
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  loginText: { color: "#000", fontWeight: "bold", fontSize: 16 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  linkText: { color: "#fff", fontSize: 13 },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 25 },
  divider: { flex: 1, height: 1, backgroundColor: "#ccc" },
  orText: { color: "#ccc", marginHorizontal: 10 },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    height: 50,
    borderRadius: 25,
    paddingHorizontal: 20,
  },
  socialText: { marginLeft: 10, fontSize: 15, color: "#000", fontWeight: "600" },
  disabledBtn: { opacity: 0.6 },
  errorText: {
    color: "#FF4D4D",
    fontSize: 13,
    marginBottom: 10,
    marginLeft: 5,
  },
});