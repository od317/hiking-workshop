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

import { FulfillmentSummary } from "@/lib/api";
import { ApiError, apiFetch } from "@/lib/api-client";
import { StepHeader } from "@/components/step-header";

type ActionMode = "FINISH" | "QC" | "DELIVER" | "RETURN";

export default function OrderDeliveryScreen() {
  const { id, step } = useLocalSearchParams<{
    id: string;
    step?: "FINISHING" | "FINAL_CHECK" | "DELIVERY";
  }>();
  const qc = useQueryClient();

  const [active, setActive] = useState<{
    lineId: string;
    mode: ActionMode;
  } | null>(null);
  const [qty, setQty] = useState("");
  const [rejectedQty, setRejectedQty] = useState("0");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["fulfillment", id],
    queryFn: () => apiFetch<FulfillmentSummary>(`/orders/${id}/fulfillment`),
    enabled: Boolean(id),
  });

  const invalidate = () => {
    setActive(null);
    setQty("");
    setRejectedQty("0");
    qc.invalidateQueries({ queryKey: ["fulfillment", id] });
    qc.invalidateQueries({ queryKey: ["order", id] });
  };

  const runAction = useMutation({
    mutationFn: async (vars: { lineId: string; mode: ActionMode }) => {
      const n = Number(qty);
      if (vars.mode === "FINISH") {
        return apiFetch(`/orders/${id}/finishing`, {
          method: "POST",
          body: { orderLineId: vars.lineId, quantity: n },
        });
      }
      if (vars.mode === "QC") {
        return apiFetch(`/orders/${id}/quality-checks`, {
          method: "POST",
          body: {
            orderLineId: vars.lineId,
            passedQty: n,
            rejectedQty: Number(rejectedQty) || 0,
          },
        });
      }
      if (vars.mode === "DELIVER") {
        return apiFetch(`/orders/${id}/deliveries`, {
          method: "POST",
          body: { items: [{ orderLineId: vars.lineId, quantity: n }] },
        });
      }
      return apiFetch(`/orders/${id}/returns`, {
        method: "POST",
        body: {
          items: [
            { orderLineId: vars.lineId, quantity: n, disposition: "REPAIR" },
          ],
        },
      });
    },
    onSuccess: invalidate,
    onError: (err) => {
      Alert.alert(
        "لا يمكن التنفيذ",
        err instanceof ApiError ? err.message : "حدث خطأ",
      );
    },
  });

  if (isLoading) {
    return <ActivityIndicator style={{ marginTop: 40 }} size="large" />;
  }

  if (isError || !data) {
    return (
      <View style={{ padding: 24, alignItems: "center", gap: 12 }}>
        <Text style={{ color: "#dc2626" }}>
          {error instanceof ApiError ? error.message : "تعذر التحميل"}
        </Text>
        <Pressable style={styles.confirmBtn} onPress={() => refetch()}>
          <Text style={styles.btnText}>إعادة المحاولة</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StepHeader orderId={id} stepType={step ?? "DELIVERY"} />
      {data.lines.length === 0 ? (
        <Text style={styles.empty}>أضف أسطر الإنتاج أولاً من شاشة القص</Text>
      ) : (
        data.lines.map((line) => {
          const isOpen = active?.lineId === line.id;
          return (
            <View key={line.id} style={styles.card}>
              <Text style={styles.title}>
                {line.color} — مقاس {line.size} (مطلوب: {line.orderedQty})
              </Text>
              <Text style={styles.meta}>
                مكوي: {line.finishedQty} • فحص ناجح: {line.qcPassedQty} • مرفوض:{" "}
                {line.qcRejectedQty}
              </Text>
              <Text style={styles.meta}>
                جاهز للتسليم: {line.readyToDeliverQty} • مسلّم:{" "}
                {line.deliveredQty} • مرتجع: {line.returnedQty}
              </Text>

              <View style={styles.btnGrid}>
                {(
                  [
                    ["FINISH", "كوي"],
                    ["QC", "فحص"],
                    ["DELIVER", "تسليم"],
                    ["RETURN", "مرتجع"],
                  ] as const
                ).map(([mode, label]) => (
                  <Pressable
                    key={mode}
                    style={[
                      styles.actionChip,
                      isOpen &&
                        active?.mode === mode &&
                        styles.actionChipActive,
                    ]}
                    onPress={() => {
                      setQty("");
                      setRejectedQty("0");
                      setActive(
                        isOpen && active?.mode === mode
                          ? null
                          : { lineId: line.id, mode },
                      );
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isOpen &&
                          active?.mode === mode &&
                          styles.chipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {isOpen && active ? (
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder={active.mode === "QC" ? "الناجح" : "الكمية"}
                    value={qty}
                    onChangeText={setQty}
                    keyboardType="numeric"
                    textAlign="right"
                  />
                  {active.mode === "QC" ? (
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="المرفوض"
                      value={rejectedQty}
                      onChangeText={setRejectedQty}
                      keyboardType="numeric"
                      textAlign="right"
                    />
                  ) : null}
                  <Pressable
                    style={styles.confirmBtn}
                    disabled={runAction.isPending}
                    onPress={() =>
                      runAction.mutate({ lineId: line.id, mode: active.mode })
                    }
                  >
                    <Text style={styles.btnText}>حفظ</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, gap: 12, backgroundColor: "#f9fafb", flexGrow: 1 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 8,
  },
  title: { fontSize: 15, fontWeight: "700" },
  meta: { fontSize: 13, color: "#4b5563" },
  btnGrid: { flexDirection: "row", gap: 6 },
  actionChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  actionChipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#111827" },
  chipTextActive: { color: "#fff" },
  row: { flexDirection: "row", gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  confirmBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  empty: { textAlign: "center", marginTop: 40, color: "#6b7280" },
});
