// app/(tabs)/record.tsx
import React, { useRef, useState } from "react";
import { View, Text, Button, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Waypoint, Edge, Session } from "../types/session";
import { saveSession } from "../lib/storage";

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export default function RecordScreen() {
  const router = useRouter();
  const camRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [nodes, setNodes] = useState<Waypoint[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [t0, setT0] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="Grant permission" />
      </View>
    );
  }

  const addWaypoint = async () => {
    if (!isCameraReady) {
      Alert.alert("Camera not ready. Please wait...");
      return;
    }
    if (t0 === null) setT0(Date.now());
    setLoading(true);
    try {
      // @ts-ignore
      const photo = await camRef.current?.takePictureAsync({ base64: true });
      const base64Image = photo.base64;
      // Gemini 2.5 Flash API call
      const body = {
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Image,
                },
              },
              { text: 'What is the main subject of this image?' }
            ]
          }
        ]
      };
      let label = '';
      try {
        const response = await fetch(GEMINI_ENDPOINT + `?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        );
        const data = await response.json();
        if (response.ok && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
          label = data.candidates[0].content.parts.map(p => p.text).join(' ');
        } else {
          console.log('Gemini API error:', data);
          label = 'Could not identify';
        }
      } catch (err) {
        console.log('Network or fetch error:', err);
        label = 'Could not identify';
      }
      setNodes((prev) => [
        ...prev,
        {
          id: `wp-${Date.now()}`,
          tMs: t0 ? Date.now() - t0 : 0,
          headingDeg: 0, // or your heading logic
          photoUri: photo.uri,
          label,
        },
      ]);
      setElapsed(t0 ? Date.now() - t0 : 0);
    } catch (err) {
      Alert.alert("Photo error", String(err));
    }
    setLoading(false);
  };

  const buildEdges = (ns: Waypoint[]): Edge[] => {
    const edges: Edge[] = [];
    for (let i = 0; i < ns.length - 1; i++) {
      const a = ns[i], b = ns[i + 1];
      const dt = Math.max(1, b.tMs - a.tMs);
      let d = b.headingDeg - a.headingDeg;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      edges.push({ fromId: a.id, toId: b.id, weight: dt, turnDeg: d });
    }
    return edges;
  };

  const onSave = async () => {
    if (nodes.length === 0) return;
    const edges = buildEdges(nodes);
    const session: Session = {
      id: `sess-${Date.now()}`,
      startedAt: t0 ?? Date.now(),
      durationMs: elapsed,
      nodes,
      edges,
      stats: { nNodes: nodes.length, elapsedMs: elapsed },
    };
    await saveSession(session);
    router.push({ pathname: "/session-summary", params: { id: session.id } });
  };

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        ref={camRef}
        style={{ flex: 1 }}
        facing="back"
        onCameraReady={() => setIsCameraReady(true)}
      />
      <View style={styles.overlay}>
        <Text style={styles.hud}>
          {`Waypoints: ${nodes.length} • ${Math.round(elapsed / 1000)}s`}
        </Text>
        <Button title="Add Waypoint (Take Photo)" onPress={addWaypoint} disabled={!isCameraReady || loading} />
        <Button title="Save session" onPress={onSave} disabled={nodes.length === 0 || loading} />
        {loading && <ActivityIndicator size="small" color="#1f6feb" style={{ marginTop: 8 }} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, gap: 8 },
  hud: { color: "white", fontSize: 16, textShadowColor: "black", textShadowRadius: 4 },
});
