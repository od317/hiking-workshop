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

import { ProductionBoard } from "@/lib/api";
import { STEP_LABELS } from "@/lib/step-labels";
import { ApiError, apiFetch } from "@/lib/api-client";

export default function OrderProductionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  // Add / update line form
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [orderedQty, setOrderedQty] = useState("");

  // Active inline action per line
  const [activeAction, setActiveAction] = useState<{
    lineId: string;
    mode: "CUT" | "HOLD";
  } | null>(null);
  const [actionQty, setActionQty] = useState("");
  const [actionReason, setActionReason] = useState("");

  const {
    data: board,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["production", id],
    queryFn: () => apiFetch<ProductionBoard>(`/orders/${id}/production`),
    enabled: Boolean(id),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["production", id] });
    qc.invalidateQueries({ queryKey: ["order", id] });
  };

  const upsertLine = useMutation({
    mutationFn: () =>
      apiFetch(`/orders/${id}/lines`, {
        method: "POST",
        body: {
          lines: [
            {
              color: color.trim(),
              size: size.trim(),
              orderedQty: Number(orderedQty),
            },
          ],
        },
      }),
    onSuccess: () => {
      setColor("");
      setSize("");
      setOrderedQty("");
      invalidate();
    },
    onError: (err) => {
      Alert.alert(
        "خطأ",
        err instanceof ApiError ? err.message : "تعذر حفظ السطر",
      );
    },
  });

  const recordCutting = useMutation({
    mutationFn: (vars: { orderLineId: string; quantity: number }) =>
      apiFetch(`/orders/${id}/cutting`, {
        method: "POST",
        body: {
          entries: [{ orderLineId: vars.orderLineId, quantity: vars.quantity }],
        },
      }),
    onSuccess: () => {
      setActiveAction(null);
      setActionQty("");
      invalidate();
    },
    onError: (err) => {
      Alert.alert(
        "لا يمكن تسجيل القص",
        err instanceof ApiError ? err.message : "حدث خطأ",
      );
    },
  });

  const createHold = useMutation({
    mutationFn: (vars: {
      orderLineId: string;
      quantity: number;
      reason: string;
    }) =>
      apiFetch(`/orders/${id}/holds`, {
        method: "POST",
        body: {
          orderLineId: vars.orderLineId,
          stage: "CUTTING",
          quantity: vars.quantity,
          reason: vars.reason,
        },
      }),
    onSuccess: () => {
      setActiveAction(null);
      setActionQty("");
      setActionReason("");
      invalidate();
    },
    onError: (err) => {
      Alert.alert(
        "خطأ",
        err instanceof ApiError ? err.message : "تعذر تسجيل التعليق",
      );
    },
  });

  const resolveHold = useMutation({
    mutationFn: (holdId: string) =>
      apiFetch(`/holds/${holdId}/resolve`, {
        method: "POST",
        body: { resolutionNote: "تم الحل" },
      }),
    onSuccess: invalidate,
    onError: (err) => {
      Alert.alert("خطأ", err instanceof ApiError ? err.message : "تعذر الحل");
    },
  });

  if (!id) {
    return (
      <View style={{ padding: 24, alignItems: "center" }}>
        <Text>معرف الطلب غير موجود (id is undefined)</Text>
      </View>
    );
  }

  if (isLoading) {
    return <ActivityIndicator style={{ marginTop: 40 }} size="large" />;
  }

  if (isError || !board) {
    return (
      <View style={{ padding: 24, alignItems: "center", gap: 12 }}>
        <Text style={{ color: "#dc2626", textAlign: "center" }}>
          {error instanceof ApiError
            ? `خطأ ${error.status}: ${error.message}`
            : "تعذر تحميل بيانات الإنتاج"}
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => refetch()}>
          <Text style={[styles.btnText, { paddingHorizontal: 16 }]}>
            إعادة المحاولة
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* TOTALS BAR */}
      <View style={styles.totalsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{board.totals.orderedQty}</Text>
          <Text style={styles.statLabel}>المطلوب</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: "#16a34a" }]}>
            {board.totals.cutQty}
          </Text>
          <Text style={styles.statLabel}>المقصوص</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: "#dc2626" }]}>
            {board.totals.openHoldQty}
          </Text>
          <Text style={styles.statLabel}>معلق</Text>
        </View>
      </View>

      {/* ADD / UPDATE LINE */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>إضافة / تعديل لون ومقاس</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="اللون (أبيض)"
            value={color}
            onChangeText={setColor}
            textAlign="right"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="المقاس (M)"
            value={size}
            onChangeText={setSize}
            textAlign="right"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="العدد"
            value={orderedQty}
            onChangeText={setOrderedQty}
            keyboardType="numeric"
            textAlign="right"
          />
        </View>
        <Pressable
          style={[
            styles.primaryBtn,
            (!color.trim() ||
              !size.trim() ||
              !Number(orderedQty) ||
              upsertLine.isPending) && { opacity: 0.5 },
          ]}
          disabled={
            !color.trim() ||
            !size.trim() ||
            !Number(orderedQty) ||
            upsertLine.isPending
          }
          onPress={() => upsertLine.mutate()}
        >
          <Text style={styles.btnText}>حفظ السطر</Text>
        </Pressable>
      </View>

      {/* LINES LIST */}
      <Text style={styles.sectionTitle}>
        تفاصيل القص ({board.lines.length})
      </Text>
      {board.lines.map((line) => {
        const isCutting =
          activeAction?.lineId === line.id && activeAction.mode === "CUT";
        const isHolding =
          activeAction?.lineId === line.id && activeAction.mode === "HOLD";

        return (
          <View key={line.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.lineTitle}>
                {line.color} — مقاس {line.size}
              </Text>
              <Text style={styles.lineProgress}>
                {line.cutQty} / {line.orderedQty}
              </Text>
            </View>

            <View style={styles.rowBetween}>
              <Text style={styles.meta}>
                المتبقي للقص: {line.remainingToCut}
              </Text>
              {line.openHoldQty > 0 ? (
                <Text
                  style={[styles.meta, { color: "#dc2626", fontWeight: "700" }]}
                >
                  معلق: {line.openHoldQty}
                </Text>
              ) : null}
            </View>

            <View style={styles.row}>
              <Pressable
                style={[styles.smallBtn, { backgroundColor: "#16a34a" }]}
                onPress={() => {
                  setActionQty("");
                  setActiveAction(
                    isCutting ? null : { lineId: line.id, mode: "CUT" },
                  );
                }}
              >
                <Text style={styles.btnText}>+ تسجيل قص</Text>
              </Pressable>
              <Pressable
                style={[styles.smallBtn, { backgroundColor: "#dc2626" }]}
                onPress={() => {
                  setActionQty("");
                  setActionReason("");
                  setActiveAction(
                    isHolding ? null : { lineId: line.id, mode: "HOLD" },
                  );
                }}
              >
                <Text style={styles.btnText}>تعليق نقص</Text>
              </Pressable>
            </View>

            {isCutting ? (
              <View style={styles.inlineBox}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="الكمية المقصوصة"
                  value={actionQty}
                  onChangeText={setActionQty}
                  keyboardType="numeric"
                  textAlign="right"
                />
                <Pressable
                  style={styles.confirmBtn}
                  disabled={!Number(actionQty) || recordCutting.isPending}
                  onPress={() =>
                    recordCutting.mutate({
                      orderLineId: line.id,
                      quantity: Number(actionQty),
                    })
                  }
                >
                  <Text style={styles.btnText}>حفظ</Text>
                </Pressable>
              </View>
            ) : null}

            {isHolding ? (
              <View style={{ gap: 8 }}>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="العدد الناقص"
                    value={actionQty}
                    onChangeText={setActionQty}
                    keyboardType="numeric"
                    textAlign="right"
                  />
                  <TextInput
                    style={[styles.input, { flex: 2 }]}
                    placeholder="السبب (مثال: نقص قماش)"
                    value={actionReason}
                    onChangeText={setActionReason}
                    textAlign="right"
                  />
                </View>
                <Pressable
                  style={[styles.primaryBtn, { backgroundColor: "#dc2626" }]}
                  disabled={
                    !Number(actionQty) ||
                    !actionReason.trim() ||
                    createHold.isPending
                  }
                  onPress={() =>
                    createHold.mutate({
                      orderLineId: line.id,
                      quantity: Number(actionQty),
                      reason: actionReason.trim(),
                    })
                  }
                >
                  <Text style={styles.btnText}>تأكيد التعليق</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}

      {/* OPEN HOLDS */}
      {board.openHolds.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>
            القطع المعلقة ({board.openHolds.length})
          </Text>
          {board.openHolds.map((h) => (
            <View key={h.id} style={[styles.card, { borderColor: "#fecaca" }]}>
              <View style={styles.rowBetween}>
                <Text style={styles.lineTitle}>
                  {h.quantity} × {h.orderLine.color} ({h.orderLine.size})
                </Text>
                <Text style={styles.meta}>{STEP_LABELS[h.stage]}</Text>
              </View>
              <Text style={styles.meta}>السبب: {h.reason}</Text>
              <Pressable
                style={[styles.smallBtn, { backgroundColor: "#2563eb" }]}
                disabled={resolveHold.isPending}
                onPress={() => resolveHold.mutate(h.id)}
              >
                <Text style={styles.btnText}>تم الحل</Text>
              </Pressable>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, gap: 12, backgroundColor: "#f9fafb", flexGrow: 1 },
  totalsRow: { flexDirection: "row", gap: 8 },
  statBox: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  statValue: { fontSize: 20, fontWeight: "700", color: "#111827" },
  statLabel: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  primaryBtn: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  smallBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  confirmBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  lineTitle: { fontSize: 15, fontWeight: "700" },
  lineProgress: { fontSize: 15, fontWeight: "700", color: "#2563eb" },
  meta: { fontSize: 13, color: "#4b5563" },
  inlineBox: { flexDirection: "row", gap: 8 },
});
