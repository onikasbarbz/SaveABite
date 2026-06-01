import * as React from "react";
import { useState } from "react";
import { View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import SplashScreen from "./screens/SplashScreen";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Screen Imports
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import UserHomepage from "./screens/UserHomepage";
import NGOHomepage from "./screens/NGOHomepage";
import NGORegistration from "./screens/NGORegistration"; // ADDED THIS IMPORT
import FoodDetail from "./screens/FoodDetail";
import StoreDetail from "./screens/StoreDetail";
import UserProfile from './screens/UserProfile';
import BusinessDashboard from "./screens/businessDashboard";
import BusinessAddListing from "./screens/businessAddList";
import ManageListings from "./screens/ManageListings";
import AnalyticsDashboard from "./screens/AnalyticsDashboard";
import DriverDashboard from "./screens/driverDashboard";
import DeliveryTracking from "./screens/DeliveryTracking";
import BusinessSettings from "./screens/BusinessSettings";
import DriverProfile from "./screens/DriverProfile";
import EarningsHistory from "./screens/EarningsHistory";
import MyOrders from "./screens/MyOrders";
import EditListing from "./screens/EditListing";
import StoreOrders from "./screens/StoreOrders";
import StoreDonations from "./screens/StoreDonations";
import PaymentVerify from "./screens/PaymentVerify";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen";
import AdminNGOVerify from "./screens/AdminNGOVerify";
import AdminCertificates from "./screens/AdminCertificates";
import SetStoreLocation from "./screens/SetStoreLocation";
import CartScreen from "./screens/CartScreen"; // ADDED THIS IMPORT
import NotificationsScreen from "./screens/NotificationsScreen";
import { CartProvider } from "./context/CartContext"; // ADDED THIS IMPORT

const Stack = createNativeStackNavigator();

const linking = {
  prefixes: ["saveabite-app://", "saveabite://"],
  config: {
    screens: {
      ResetPassword: "reset-password",
      PaymentVerify: "payment/verify",
    },
  },
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <SafeAreaProvider>
      {showSplash ? (
        <View style={{ flex: 1, backgroundColor: "#3A7D2C" }}>
          <SplashScreen onFinish={() => setShowSplash(false)} />
        </View>
      ) : (
        <CartProvider>
          <NavigationContainer linking={linking}>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#F8F9FA" },
            animation: "slide_from_right"
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />

          <Stack.Screen name="Home" component={UserHomepage} options={{ animation: 'none' }} />
          <Stack.Screen name="NGOHomepage" component={NGOHomepage} options={{ animation: 'none' }} />

          {/* ADDED: The dedicated NGO Registration form screen */}
          <Stack.Screen
            name="NGORegistration"
            component={NGORegistration}
            options={{ animation: "slide_from_bottom" }}
          />

          <Stack.Screen name="AdminNGOVerify" component={AdminNGOVerify} />
          <Stack.Screen name="AdminCertificates" component={AdminCertificates} options={{ animation: 'slide_from_right' }} />

          <Stack.Screen name="FoodDetail" component={FoodDetail} />
          <Stack.Screen name="StoreDetail" component={StoreDetail} />
          <Stack.Screen name="StoreOrders" component={StoreOrders} />
          <Stack.Screen name="StoreDonations" component={StoreDonations} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="UserProfile" component={UserProfile} options={{ animation: 'none' }} />
          <Stack.Screen name="BusinessDashboard" component={BusinessDashboard} options={{ animation: 'none' }} />
          <Stack.Screen name="businessAddList" component={BusinessAddListing} options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="ManageListings" component={ManageListings} options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="Analytics" component={AnalyticsDashboard} />
          <Stack.Screen name="Orders" component={MyOrders} options={{ animation: 'none' }} />
          <Stack.Screen name="PaymentVerify" component={PaymentVerify} />
          <Stack.Screen name="EditListing" component={EditListing} />
          <Stack.Screen name="SetStoreLocation" component={SetStoreLocation} />
          <Stack.Screen name="Cart" component={CartScreen} options={{ animation: 'none' }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right' }} />

          <Stack.Screen
            name="Settings"
            component={BusinessSettings}
            options={{
              animation: "slide_from_right",
              contentStyle: { backgroundColor: "#244F42" }
            }}
          />
          <Stack.Screen
            name="DriverDashboard"
            component={DriverDashboard}
            options={{ contentStyle: { backgroundColor: "#244F42" }, animation: "none" }}
          />

          <Stack.Screen
            name="DriverProfile"
            component={DriverProfile}
            options={{
              contentStyle: { backgroundColor: "#244F42" },
              animation: "none",
              gestureEnabled: true,
              gestureDirection: "horizontal"
            }}
          />
          <Stack.Screen
            name="EarningsHistory"
            component={EarningsHistory}
            options={{
              headerShown: false,
              animation: "slide_from_right"
            }}
          />
          <Stack.Screen
            name="DeliveryTracking"
            component={DeliveryTracking}
            options={{
              animation: "slide_from_bottom",
              contentStyle: { backgroundColor: "#FFFFFF" }
            }}
          />
          </Stack.Navigator>
        </NavigationContainer>
      </CartProvider>
      )}
    </SafeAreaProvider>
  );
}