import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, ActivityIndicator,
  TouchableOpacity, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { api } from '../services/api';

const COLORS = {
  primary: '#244F42',
  accent: '#F4A71D',
  white: '#FFFFFF',
  success: '#27AB34',
  error: '#E51904',
  textSub: '#757575',
  bgLight: '#F3F4F6',
};

type VerifyState = 'loading' | 'success' | 'failed' | 'pending';

const PaymentVerify = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const [state, setState] = useState<VerifyState>('loading');
  const [pickupCode, setPickupCode] = useState<string>('----');
  const [message, setMessage] = useState('Verifying your payment...');

  useEffect(() => {
    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    try {
      // Params can come from deep link (strings) or direct navigation
      const pidx = route.params?.pidx as string;
      const order_id = route.params?.order_id as string;

      if (!pidx || !order_id) {
        setState('failed');
        setMessage('Missing payment information. Please check your orders.');
        return;
      }

      const result = await api.verifyPayment(pidx, parseInt(order_id));

      if (result.success) {
        setState('success');
        setPickupCode(result.order?.pickup_code || '----');
        setMessage('Payment verified! Your order is confirmed.');
      } else if (result.payment_status === 'Pending') {
        setState('pending');
        setMessage(result.message || 'Payment is still pending.');
      } else {
        setState('failed');
        setMessage(result.message || 'Payment failed or was cancelled.');
      }
    } catch (error: any) {
      console.error('Payment Verify Error:', error);
      setState('failed');
      setMessage(error.message || 'Could not verify payment. Please check your orders.');
    }
  };

  const renderIcon = () => {
    switch (state) {
      case 'loading':
        return <ActivityIndicator size={60} color={COLORS.accent} />;
      case 'success':
        return (
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(39, 171, 52, 0.12)' }]}>
            <Ionicons name="checkmark-circle" size={70} color={COLORS.success} />
          </View>
        );
      case 'pending':
        return (
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(244, 167, 29, 0.12)' }]}>
            <MaterialCommunityIcons name="clock-outline" size={70} color={COLORS.accent} />
          </View>
        );
      case 'failed':
        return (
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(229, 25, 4, 0.12)' }]}>
            <Ionicons name="close-circle" size={70} color={COLORS.error} />
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Payment Status</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.card}>
          {renderIcon()}

          <Text style={styles.statusTitle}>
            {state === 'loading' && 'Verifying Payment...'}
            {state === 'success' && 'Order Confirmed! 🎉'}
            {state === 'pending' && 'Payment Pending'}
            {state === 'failed' && 'Payment Failed'}
          </Text>

          <Text style={styles.statusMessage}>{message}</Text>

          {/* Pickup Code — only show on success */}
          {state === 'success' && (
            <View style={styles.codeContainer}>
              <Text style={styles.codeLabel}>YOUR PICKUP CODE</Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{pickupCode}</Text>
              </View>
              <Text style={styles.codeHint}>
                Show this code at the store to collect your food
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        {state !== 'loading' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('Orders')}
            >
              <Ionicons name="receipt" size={20} color={COLORS.primary} />
              <Text style={styles.primaryBtnText}>  View My Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={styles.secondaryBtnText}>Back to Home</Text>
            </TouchableOpacity>

            {state === 'failed' && (
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={verifyPayment}
              >
                <Ionicons name="refresh" size={18} color={COLORS.white} />
                <Text style={styles.retryBtnText}>  Retry Verification</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 30,
    justifyContent: 'center',
  },
  card: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  statusMessage: {
    fontSize: 15,
    color: COLORS.textSub,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  codeContainer: {
    marginTop: 30,
    alignItems: 'center',
    width: '100%',
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSub,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  codeBox: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 16,
  },
  codeText: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.accent,
    letterSpacing: 6,
  },
  codeHint: {
    fontSize: 13,
    color: COLORS.textSub,
    marginTop: 12,
    textAlign: 'center',
  },
  actions: {
    marginTop: 20,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    height: 55,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: '800',
  },
  secondaryBtn: {
    height: 48,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  retryBtn: {
    height: 48,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.error,
  },
  retryBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
});

export default PaymentVerify;
