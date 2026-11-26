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

import { StepHeader } from "@/components/step-header";
import { PhotoGallery } from "@/components/photo-gallery";
import { OrderDetail } from "@/lib/api";
import { ApiError, apiFetch } from "@/lib/api-client";

const STATUS_LABELS = {
  PENDING: "قيد الانتظار",
  APPROVED: "موافق عليها",
  REJECTED: "مرفوضة",
} as const;
const STATUS_COLORS = {
  PENDING: "#d97706",
  APPROVED: "#16a34a",
  REJECTED: "#dc2626",
} as const;

export default function SampleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
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

  const createSample = useMutation({
    mutationFn: () =>
      apiFetch(`/orders/${id}/samples`, {
        method: "POST",
        body: { note: note.trim() || undefined },
      }),
    onSuccess: () => {
      setNote("");
      invalidate();
    },
    onError: (err) =>
      Alert.alert(
        "لا يمكن إنشاء عينة",
        err instanceof ApiError ? err.message : "تعذر إنشاء العينة",
      ),
  });

  const decide = useMutation({
    mutationFn: (v: { sampleId: string; decision: "APPROVED" | "REJECTED" }) =>
      apiFetch(`/samples/${v.sampleId}/decision`, {
        method: "POST",
        body: { decision: v.decision, note: decisionNote.trim() || undefined },
      }),
    onSuccess: () => {
      setDecisionNote("");
      invalidate();
    },
    onError: (err) =>
      Alert.alert(
        "خطأ",
        err instanceof ApiError ? err.message : "تعذر حفظ القرار",
      ),
  });

  if (isLoading || !order) {
    return <ActivityIndicator style={{ marginTop: 40 }} size="large" />;
  }

  const hasPending = order.samples.some((s) => s.status === "PENDING");
  const hasApproved = order.samples.some((s) => s.status === "APPROVED");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StepHeader orderId={id} stepType="SAMPLE" />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          العينات ({order.samples.length})
        </Text>

        {!hasPending && !hasApproved ? (
          <View style={styles.inlineRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="ملاحظة على العينة..."
              value={note}
              onChangeText={setNote}
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
                    { backgroundColor: STATUS_COLORS[s.status] },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {STATUS_LABELS[s.status]}
                  </Text>
                </View>
              </View>

              {s.note ? <Text style={styles.itemNote}>{s.note}</Text> : null}
              {s.decisionNote ? (
                <Text style={styles.decisionNote}>
                  ملاحظة القرار: {s.decisionNote}
                </Text>
              ) : null}

              <PhotoGallery
                entityType="SAMPLE"
                entityId={s.id}
                label="صور العينة"
              />

              {s.status === "PENDING" ? (
                <View style={styles.decisionBox}>
                  <TextInput
                    style={styles.input}
                    placeholder="ملاحظة الموافقة أو الرفض (اختياري)"
                    value={decisionNote}
                    onChangeText={setDecisionNote}
                    textAlign="right"
                  />
                  <View style={styles.inlineRow}>
                    <Pressable
                      style={[
                        styles.decisionBtn,
                        { backgroundColor: "#16a34a" },
                      ]}
                      disabled={decide.isPending}
                      onPress={() =>
                        decide.mutate({ sampleId: s.id, decision: "APPROVED" })
                      }
                    >
                      <Text style={styles.btnText}>موافقة الزبون</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.decisionBtn,
                        { backgroundColor: "#dc2626" },
                      ]}
                      disabled={decide.isPending}
                      onPress={() =>
                        decide.mutate({ sampleId: s.id, decision: "REJECTED" })
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
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
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
  itemTitle: { fontSize: 15, fontWeight: "700" },
  itemNote: { fontSize: 13, color: "#4b5563" },
  decisionNote: { fontSize: 13, color: "#1f2937", fontWeight: "500" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  decisionBox: { gap: 8, marginTop: 6 },
  decisionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  empty: { color: "#6b7280", fontSize: 13 },
});
