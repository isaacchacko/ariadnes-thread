import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image } from 'react-native';
import { Magnetometer, DeviceMotion, Accelerometer } from 'expo-sensors';

type AccelSample = { x: number; y: number; z: number };

function calculateHeading(x: number, y: number): number {
  let angle = Math.atan2(-x, y) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  return angle; // in degrees
}

const ROLLING_WINDOW = 1;
const UPDATE_INTERVAL = 100;

const CompassScreen = () => {
  const [heading, setHeading] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [roll, setRoll] = useState(0);
  const [yaw, setYaw] = useState(0);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const [accelSamples, setAccelSamples] = useState<AccelSample[]>([]);
  const [avgX, setAvgX] = useState(0);
  const [avgY, setAvgY] = useState(0);
  const [avgZ, setAvgZ] = useState(0);

  useEffect(() => {
    Magnetometer.setUpdateInterval(UPDATE_INTERVAL);
    DeviceMotion.setUpdateInterval(UPDATE_INTERVAL);
    Accelerometer.setUpdateInterval(UPDATE_INTERVAL);

    const magSubscription = Magnetometer.addListener((data) => {
      const { x, y } = data;
      const nextHeading = calculateHeading(x, y);
      setHeading(nextHeading);

      // Animates compass arrow smoothly
      Animated.timing(rotateAnim, {
        toValue: nextHeading,
        duration: 160,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    });

    const motionSubscription = DeviceMotion.addListener(({ rotation }) => {
      const pitchDeg = rotation?.beta ? rotation.beta * (180 / Math.PI) : 0;
      const rollDeg = rotation?.gamma ? rotation.gamma * (180 / Math.PI) : 0;
      const yawDeg = rotation?.alpha ? rotation.alpha * (180 / Math.PI) : 0;
      setPitch(pitchDeg);
      setRoll(rollDeg);
      setYaw(yawDeg);
    });

    const accelSubscription = Accelerometer.addListener(({ x, y, z }) => {
      setAccelSamples(prev => {
        const updated = [...prev, { x, y, z }].slice(-ROLLING_WINDOW);
        const len = updated.length;
        const sumX = updated.reduce((sum, v) => sum + v.x, 0);
        const sumY = updated.reduce((sum, v) => sum + v.y, 0);
        const sumZ = updated.reduce((sum, v) => sum + v.z, 0);
        setAvgX(sumX / len);
        setAvgY(sumY / len);
        setAvgZ(sumZ / len);
        return updated;
      });
    });

    Accelerometer.addListener(data => {
      fetch('http://10.136.15.144:5000/accel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    });

    DeviceMotion.addListener(data => {
      fetch('http://10.136.15.144:5000/gyro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    });

    return () => {
      magSubscription.remove();
      motionSubscription.remove();
      accelSubscription.remove();
    };
  }, []);

  // Rotates the compass arrow to match heading
  const animatedStyle = {
    transform: [
      {
        rotate: rotateAnim.interpolate({
          inputRange: [0, 360],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headingText}>Heading: {heading.toFixed(2)}°</Text>
      <Text style={styles.dataText}>Pitch: {pitch.toFixed(2)}°</Text>
      <Text style={styles.dataText}>Roll: {roll.toFixed(2)}°</Text>
      <Text style={styles.dataText}>Yaw: {yaw.toFixed(2)}°</Text>
      <Text style={styles.dataText}>Avg X (Accel): {avgX.toFixed(3)}</Text>
      <Text style={styles.dataText}>Avg Y (Accel): {avgY.toFixed(3)}</Text>
      <Text style={styles.dataText}>Avg Z (Accel): {avgZ.toFixed(3)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa' },
  headingText: { fontSize: 22, fontWeight: '600', marginBottom: 8 },
  dataText: { fontSize: 18, marginBottom: 4 },
  compassContainer: { marginTop: 32, justifyContent: 'center', alignItems: 'center', width: 220, height: 220, borderWidth: 1, borderColor: '#ccc', borderRadius: 110, backgroundColor: '#fff' },
  arrowContainer: { position: 'absolute', left: 60, top: 60, width: 100, height: 100, justifyContent: 'center', alignItems: 'center' },
  arrowImage: { width: 80, height: 80, resizeMode: 'contain' },
  compassLabel: { position: 'absolute', top: 10, left: 105, fontSize: 32, fontWeight: 'bold', color: 'red' },
});

export default CompassScreen;
