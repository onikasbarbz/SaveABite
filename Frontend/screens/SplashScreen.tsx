import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  View,
  Image,
  Dimensions,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");
const LOGO_SIZE = width * 0.62;

interface Props {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: Props) {
  const logoScale = useRef(new Animated.Value(0.75)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.6)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(12)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // 1. Glow blooms first
      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // 2. Logo fades + springs in
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      // 3. Tagline slides up
      Animated.delay(250),
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 750,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(taglineTranslateY, {
          toValue: 0,
          duration: 750,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      // 4. Hold
      Animated.delay(1400),
      // 5. Fade out
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 700,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFinish();
    });
  }, []);

  return (
    <Animated.View style={[styles.wrapper, { opacity: screenOpacity }]}>
      <LinearGradient
        // Matched closely to the logo's own green-to-yellow gradient
        colors={["#2E7D32", "#4A8C1C", "#6B9A18", "#9BA815", "#C8A415"]}
        locations={[0, 0.25, 0.5, 0.75, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.gradient}
      >
        {/* Subtle top-left light orb for depth */}
        <View style={styles.lightOrbTopLeft} pointerEvents="none" />
        {/* Subtle bottom-right light orb for depth */}
        <View style={styles.lightOrbBottomRight} pointerEvents="none" />

        <View style={styles.content}>
          {/* Radial glow behind the logo so it floats instead of sitting flat */}
          <Animated.View
            style={[
              styles.glowContainer,
              {
                opacity: glowOpacity,
                transform: [{ scale: glowScale }],
              },
            ]}
            pointerEvents="none"
          >
            <View style={styles.glowOuter} />
            <View style={styles.glowInner} />
          </Animated.View>

          {/* Logo — the image already contains "Save a Bite" text */}
          <Animated.View
            style={[
              styles.logoWrapper,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <Image
              source={require("../assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Tagline beneath — complements without duplicating the logo text */}
          <Animated.Text
            style={[
              styles.tagline,
              {
                opacity: taglineOpacity,
                transform: [{ translateY: taglineTranslateY }],
              },
            ]}
          >
            Rescue food. Reduce waste.
          </Animated.Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  gradient: {
    flex: 1,
  },

  // Atmospheric light orbs to add depth to the background
  lightOrbTopLeft: {
    position: "absolute",
    top: -height * 0.1,
    left: -width * 0.2,
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: width * 0.375,
    backgroundColor: "rgba(255, 255, 200, 0.08)",
  },
  lightOrbBottomRight: {
    position: "absolute",
    bottom: -height * 0.08,
    right: -width * 0.15,
    width: width * 0.65,
    height: width * 0.65,
    borderRadius: width * 0.325,
    backgroundColor: "rgba(80, 160, 40, 0.12)",
  },

  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Layered radial glow — makes the logo feel like it's emitting light
  glowContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  glowOuter: {
    width: LOGO_SIZE * 1.55,
    height: LOGO_SIZE * 1.55,
    borderRadius: LOGO_SIZE * 0.775,
    backgroundColor: "rgba(255, 245, 150, 0.13)",
  },
  glowInner: {
    position: "absolute",
    width: LOGO_SIZE * 1.1,
    height: LOGO_SIZE * 1.1,
    borderRadius: LOGO_SIZE * 0.55,
    backgroundColor: "rgba(255, 245, 180, 0.18)",
  },

  logoWrapper: {
    // Drop shadow so the logo lifts off the background
    shadowColor: "#1a3d0a",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    // Rounded corners clip the logo's own square background,
    // making it blend into the gradient seamlessly
    borderRadius: LOGO_SIZE * 0.22,
    overflow: "hidden",
  },

  tagline: {
    marginTop: 20,
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.82)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
