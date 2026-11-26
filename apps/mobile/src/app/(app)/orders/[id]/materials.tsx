import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Material, MaterialKind, OrderMaterial } from "@/lib/api";
import { ApiError, apiFetch } from "@/lib/api-client";

export default function OrderMaterialsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const [mode, setMode] = useState<"CATALOG" | "CUSTOM">("CATALOG");
  const [kind, setKind] = useState<MaterialKind>("FABRIC");
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(
    null,
  );
  const [deductFromStock, setDeductFromStock] = useState(true);

  const [customName, setCustomName] = useState("");
  const [customColor, setCustomColor] = useState("");
  const [customUnit, setCustomUnit] = useState("حبة");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const { data: orderMaterials, isLoading } = useQuery({
    queryKey: ["order-materials", id],
    queryFn: () => apiFetch<OrderMaterial[]>(`/orders/${id}/materials`),
    enabled: Boolean(id),
  });

  const { data: catalog } = useQuery({
    queryKey: ["materials", kind],
    queryFn: () => apiFetch<Material[]>(`/materials?kind=${kind}`),
  });

  const addMaterial = useMutation({
    mutationFn: () =>
      apiFetch(`/orders/${id}/materials`, {
        method: "POST",
        body:
          mode === "CATALOG"
            ? {
                kind,
                materialId: selectedMaterialId,
                quantity: Number(quantity),
                deductFromStock,
                note: note.trim() || undefined,
              }
            : {
                kind,
                customName: customName.trim(),
                customColor: customColor.trim() || undefined,
                unit: customUnit.trim(),
                quantity: Number(quantity),
                note: note.trim() || undefined,
              },
      }),
    onSuccess: () => {
      setQuantity("");
      setNote("");
      setCustomName("");
      setCustomColor("");
      qc.invalidateQueries({ queryKey: ["order-materials", id] });
      qc.invalidateQueries({ queryKey: ["materials"] });
    },
    onError: (err) => {
      Alert.alert(
        "خطأ",
        err instanceof ApiError ? err.message : "تعذر إضافة المادة للطلب",
      );
    },
  });

  const canSubmit =
    Number(quantity) > 0 &&
    (mode === "CATALOG"
      ? Boolean(selectedMaterialId)
      : Boolean(customName.trim() && customUnit.trim()));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>إضافة مادة للطلب</Text>

        <View style={styles.row}>
          {(["FABRIC", "ACCESSORY"] as const).map((k) => (
            <Pressable
              key={k}
              style={[styles.toggleBtn, kind === k && styles.toggleActive]}
              onPress={() => {
                setKind(k);
                setSelectedMaterialId(null);
              }}
            >
              <Text
                style={[
                  styles.toggleText,
                  kind === k && styles.toggleTextActive,
                ]}
              >
                {k === "FABRIC" ? "قماش" : "إكسسوار"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          {(["CATALOG", "CUSTOM"] as const).map((m) => (
            <Pressable
              key={m}
              style={[styles.toggleBtn, mode === m && styles.toggleActive]}
              onPress={() => setMode(m)}
            >
              <Text
                style={[
                  styles.toggleText,
                  mode === m && styles.toggleTextActive,
                ]}
              >
                {m === "CATALOG" ? "من المستودع" : "مادة خاصة بالطلب"}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === "CATALOG" ? (
          <>
            <View style={styles.chipWrap}>
              {(catalog ?? []).map((m) => {
                const selected = m.id === selectedMaterialId;
                return (
                  <Pressable
                    key={m.id}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setSelectedMaterialId(m.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}
                    >
                      {m.name} ({m.currentStock} {m.unit})
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.switchRow}>
              <Text>خصم الكمية من المستودع</Text>
              <Switch
                value={deductFromStock}
                onValueChange={setDeductFromStock}
              />
            </View>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="اسم المادة الخاصة"
              value={customName}
              onChangeText={setCustomName}
              textAlign="right"
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="اللون"
                value={customColor}
                onChangeText={setCustomColor}
                textAlign="right"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="الوحدة"
                value={customUnit}
                onChangeText={setCustomUnit}
                textAlign="right"
              />
            </View>
          </>
        )}

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="الكمية"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            textAlign="right"
          />
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="ملاحظة (اختياري)"
            value={note}
            onChangeText={setNote}
            textAlign="right"
          />
        </View>

        <Pressable
          style={[
            styles.submitBtn,
            (!canSubmit || addMaterial.isPending) && { opacity: 0.5 },
          ]}
          disabled={!canSubmit || addMaterial.isPending}
          onPress={() => addMaterial.mutate()}
        >
          <Text style={styles.submitText}>إضافة للطلب</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>
        مواد الطلب ({orderMaterials?.length ?? 0})
      </Text>

      {isLoading ? (
        <ActivityIndicator />
      ) : (
        (orderMaterials ?? []).map((om) => (
          <View key={om.id} style={styles.itemCard}>
            <View style={styles.switchRow}>
              <Text style={styles.itemTitle}>
                {om.material?.name ?? om.customName}
                {om.material?.color || om.customColor
                  ? ` (${om.material?.color ?? om.customColor})`
                  : ""}
              </Text>
              <Text style={styles.qtyText}>
                {om.quantity} {om.unit}
              </Text>
            </View>
            <Text style={styles.meta}>
              {om.kind === "FABRIC" ? "قماش" : "إكسسوار"}
              {om.note ? ` • ${om.note}` : ""}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, gap: 12, backgroundColor: "#f9fafb", flexGrow: 1 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8 },
  toggleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  toggleActive: { backgroundColor: "#111827", borderColor: "#111827" },
  toggleText: { color: "#111827", fontWeight: "600", fontSize: 13 },
  toggleTextActive: { color: "#fff" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipSelected: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { fontSize: 13, color: "#111827" },
  chipTextSelected: { color: "#fff", fontWeight: "600" },
  switchRow: {
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
  submitBtn: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "700" },
  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 4,
  },
  itemTitle: { fontSize: 15, fontWeight: "700" },
  qtyText: { fontSize: 14, fontWeight: "700", color: "#2563eb" },
  meta: { fontSize: 12, color: "#6b7280" },
});
