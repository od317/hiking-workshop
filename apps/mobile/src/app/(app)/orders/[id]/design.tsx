import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { OrderDetail } from "@/lib/api";
import { ApiError, apiFetch } from "@/lib/api-client";

const SAMPLE_STATUS_LABELS = {
  PENDING: "قيد الانتظار",
  APPROVED: "موافق عليها",
  REJECTED: "مرفوضة",
} as const;

const SAMPLE_STATUS_COLORS = {
  PENDING: "#d97706",
  APPROVED: "#16a34a",
  REJECTED: "#dc2626",
} as const;

export default function OrderDesignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const [patternNote, setPatternNote] = useState("");
  const [sampleNote, setSampleNote] = useState("");
  const [decisionNote, setDecisionNote] = useState("");

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => apiFetch<OrderDetail>(`/orders/${id}`),
    enabled: Boolean(id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  const createPattern = useMutation({
    mutationFn: () =>
      apiFetch(`/orders/${id}/patterns`, {
        method: "POST",
        body: { note: patternNote.trim() || undefined },
      }),
    onSuccess: () => {
      setPatternNote("");
      invalidate();
    },
    onError: (err) => {
      Alert.alert(
        "خطأ",
        err instanceof ApiError ? err.message : "تعذر إضافة الباترون",
      );
    },
  });

  const createSample = useMutation({
    mutationFn: () =>
      apiFetch(`/orders/${id}/samples`, {
        method: "POST",
        body: { note: sampleNote.trim() || undefined },
      }),
    onSuccess: () => {
      setSampleNote("");
      invalidate();
    },
    onError: (err) => {
      Alert.alert(
        "لا يمكن إنشاء عينة",
        err instanceof ApiError ? err.message : "تعذر إنشاء العينة",
      );
    },
  });

  const decideSample = useMutation({
    mutationFn: (vars: {
      sampleId: string;
      decision: "APPROVED" | "REJECTED";
    }) =>
      apiFetch(`/samples/${vars.sampleId}/decision`, {
        method: "POST",
        body: {
          decision: vars.decision,
          note: decisionNote.trim() || undefined,
        },
      }),
    onSuccess: () => {
      setDecisionNote("");
      invalidate();
    },
    onError: (err) => {
      Alert.alert(
        "خطأ",
        err instanceof ApiError ? err.message : "تعذر حفظ القرار",
      );
    },
  });

  if (isLoading || !order) {
    return <ActivityIndicator style={{ marginTop: 40 }} size="large" />;
  }

  const hasPendingSample = order.samples.some((s) => s.status === "PENDING");
  const hasApprovedSample = order.samples.some((s) => s.status === "APPROVED");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* PATTERNS SECTION */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          الباترون ({order.patterns.length})
        </Text>

        <View style={styles.inlineRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="ملاحظة على الباترون..."
            value={patternNote}
            onChangeText={setPatternNote}
            textAlign="right"
          />
          <Pressable
            style={styles.primaryBtn}
            disabled={createPattern.isPending}
            onPress={() => createPattern.mutate()}
          >
            <Text style={styles.btnText}>+ إصدار</Text>
          </Pressable>
        </View>

        {order.patterns.length === 0 ? (
          <Text style={styles.empty}>لا يوجد باترون بعد</Text>
        ) : (
          order.patterns.map((p) => (
            <View key={p.id} style={styles.itemCard}>
              <Text style={styles.itemTitle}>باترون v{p.versionNum}</Text>
              {p.note ? <Text style={styles.itemNote}>{p.note}</Text> : null}
            </View>
          ))
        )}
      </View>

      {/* SAMPLES SECTION */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          العينات ({order.samples.length})
        </Text>

        {!hasPendingSample && !hasApprovedSample ? (
          <View style={styles.inlineRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="ملاحظة على العينة..."
              value={sampleNote}
              onChangeText={setSampleNote}
              textAlign="right"
            />
            <Pressable
              style={styles.primaryBtn}
              disabled={createSample.isPending}
              onPress={() => createSample.mutate()}
            >
              <Text style={styles.btnText}>+ عينة</Text>
            </Pressable>
          </View>
        ) : null}

        {order.samples.length === 0 ? (
          <Text style={styles.empty}>لا توجد عينات بعد</Text>
        ) : (
          order.samples.map((s) => (
            <View key={s.id} style={styles.itemCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.itemTitle}>محاولة #{s.attemptNum}</Text>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: SAMPLE_STATUS_COLORS[s.status] },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {SAMPLE_STATUS_LABELS[s.status]}
                  </Text>
                </View>
              </View>

              {s.note ? <Text style={styles.itemNote}>{s.note}</Text> : null}
              {s.decisionNote ? (
                <Text style={styles.decisionNote}>
                  ملاحظة القرار: {s.decisionNote}
                </Text>
              ) : null}

              {s.status === "PENDING" ? (
                <View style={styles.decisionBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="ملاحظة الموافقة أو الرفض (اختياري)"
                    value={decisionNote}
                    onChangeText={setDecisionNote}
                    textAlign="right"
                  />
                  <View style={styles.decisionBtns}>
                    <Pressable
                      style={[
                        styles.decisionBtn,
                        { backgroundColor: "#16a34a" },
                      ]}
                      disabled={decideSample.isPending}
                      onPress={() =>
                        decideSample.mutate({
                          sampleId: s.id,
                          decision: "APPROVED",
                        })
                      }
                    >
                      <Text style={styles.btnText}>موافقة</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.decisionBtn,
                        { backgroundColor: "#dc2626" },
                      ]}
                      disabled={decideSample.isPending}
                      onPress={() =>
                        decideSample.mutate({
                          sampleId: s.id,
                          decision: "REJECTED",
                        })
                      }
                    >
                      <Text style={styles.btnText}>رفض</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, gap: 16, backgroundColor: "#f9fafb", flexGrow: 1 },
  section: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  inlineRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  primaryBtn: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  itemCard: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 6,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemTitle: { fontSize: 15, fontWeight: "700" },
  itemNote: { fontSize: 13, color: "#4b5563" },
  decisionNote: { fontSize: 13, color: "#1f2937", fontWeight: "500" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  decisionBox: { gap: 8, marginTop: 6 },
  decisionBtns: { flexDirection: "row", gap: 8 },
  decisionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  empty: { color: "#6b7280", fontSize: 13 },
});
