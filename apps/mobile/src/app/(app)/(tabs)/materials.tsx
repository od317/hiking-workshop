import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Material, MaterialKind } from "@/lib/api";
import { ApiError, apiFetch } from "@/lib/api-client";

const KIND_LABELS: Record<MaterialKind, string> = {
  FABRIC: "قماش",
  ACCESSORY: "إكسسوار",
};

export default function MaterialsTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<MaterialKind | "ALL">("ALL");
  const [showForm, setShowForm] = useState(false);

  const [kind, setKind] = useState<MaterialKind>("FABRIC");
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [unit, setUnit] = useState("متر");
  const [unitCost, setUnitCost] = useState("");

  const [activeMoveId, setActiveMoveId] = useState<string | null>(null);
  const [moveQty, setMoveQty] = useState("");

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["materials", filter],
    queryFn: () =>
      apiFetch<Material[]>(
        filter === "ALL" ? "/materials" : `/materials?kind=${filter}`,
      ),
  });

  const createMaterial = useMutation({
    mutationFn: () =>
      apiFetch<Material>("/materials", {
        method: "POST",
        body: {
          kind,
          name: name.trim(),
          color: color.trim() || undefined,
          unit: unit.trim(),
          unitCostMinor: unitCost.trim() ? Number(unitCost) : undefined,
        },
      }),
    onSuccess: () => {
      setName("");
      setColor("");
      setUnitCost("");
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["materials"] });
    },
    onError: (err) => {
      Alert.alert(
        "خطأ",
        err instanceof ApiError ? err.message : "تعذر الإضافة",
      );
    },
  });

  const recordMovement = useMutation({
    mutationFn: (vars: { id: string; type: "IN" | "OUT"; quantity: number }) =>
      apiFetch(`/materials/${vars.id}/movements`, {
        method: "POST",
        body: { type: vars.type, quantity: vars.quantity },
      }),
    onSuccess: () => {
      setMoveQty("");
      setActiveMoveId(null);
      qc.invalidateQueries({ queryKey: ["materials"] });
    },
    onError: (err) => {
      Alert.alert(
        "تعذر تحديث المخزون",
        err instanceof ApiError ? err.message : "حدث خطأ",
      );
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {(["ALL", "FABRIC", "ACCESSORY"] as const).map((k) => (
          <Pressable
            key={k}
            style={[styles.filterChip, filter === k && styles.filterChipActive]}
            onPress={() => setFilter(k)}
          >
            <Text
              style={[
                styles.filterText,
                filter === k && styles.filterTextActive,
              ]}
            >
              {k === "ALL" ? "الكل" : KIND_LABELS[k]}
            </Text>
          </Pressable>
        ))}
        <Pressable style={styles.addBtn} onPress={() => setShowForm((v) => !v)}>
          <Text style={styles.addBtnText}>{showForm ? "إغلاق" : "+ مادة"}</Text>
        </Pressable>
      </View>

      {showForm ? (
        <View style={styles.formCard}>
          <View style={styles.row}>
            {(["FABRIC", "ACCESSORY"] as const).map((k) => (
              <Pressable
                key={k}
                style={[styles.kindBtn, kind === k && styles.kindBtnActive]}
                onPress={() => {
                  setKind(k);
                  setUnit(k === "FABRIC" ? "متر" : "حبة");
                }}
              >
                <Text
                  style={[styles.kindText, kind === k && styles.kindTextActive]}
                >
                  {KIND_LABELS[k]}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="اسم المادة (مثال: قطن تركي)"
            value={name}
            onChangeText={setName}
            textAlign="right"
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="اللون (اختياري)"
              value={color}
              onChangeText={setColor}
              textAlign="right"
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="الوحدة (متر/حبة)"
              value={unit}
              onChangeText={setUnit}
              textAlign="right"
            />
          </View>
          <TextInput
            style={styles.input}
            placeholder="سعر الوحدة (اختياري)"
            value={unitCost}
            onChangeText={setUnitCost}
            keyboardType="numeric"
            textAlign="right"
          />
          <Pressable
            style={[
              styles.submitBtn,
              (!name.trim() || !unit.trim() || createMaterial.isPending) && {
                opacity: 0.5,
              },
            ]}
            disabled={!name.trim() || !unit.trim() || createMaterial.isPending}
            onPress={() => createMaterial.mutate()}
          >
            <Text style={styles.submitText}>حفظ المادة</Text>
          </Pressable>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>لا توجد مواد في المستودع بعد</Text>
          }
          renderItem={({ item }) => {
            const isExpanded = activeMoveId === item.id;
            return (
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.itemTitle}>
                      {item.name} {item.color ? `(${item.color})` : ""}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {KIND_LABELS[item.kind]}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={styles.stockText}>
                      {item.currentStock} {item.unit}
                    </Text>
                    <Pressable
                      onPress={() =>
                        setActiveMoveId(isExpanded ? null : item.id)
                      }
                    >
                      <Text style={styles.linkText}>
                        {isExpanded ? "إلغاء" : "حركة مخزون"}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {isExpanded ? (
                  <View style={styles.moveRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="الكمية"
                      value={moveQty}
                      onChangeText={setMoveQty}
                      keyboardType="numeric"
                      textAlign="right"
                    />
                    <Pressable
                      style={[styles.moveBtn, { backgroundColor: "#16a34a" }]}
                      disabled={!Number(moveQty) || recordMovement.isPending}
                      onPress={() =>
                        recordMovement.mutate({
                          id: item.id,
                          type: "IN",
                          quantity: Number(moveQty),
                        })
                      }
                    >
                      <Text style={styles.addBtnText}>+ إدخال</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.moveBtn, { backgroundColor: "#dc2626" }]}
                      disabled={!Number(moveQty) || recordMovement.isPending}
                      onPress={() =>
                        recordMovement.mutate({
                          id: item.id,
                          type: "OUT",
                          quantity: Number(moveQty),
                        })
                      }
                    >
                      <Text style={styles.addBtnText}>- إخراج</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 12 },
  topRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
    alignItems: "center",
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  filterChipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  filterText: { fontSize: 13, color: "#111827" },
  filterTextActive: { color: "#fff", fontWeight: "700" },
  addBtn: {
    marginStart: "auto",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 8,
  },
  row: { flexDirection: "row", gap: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kindBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  kindBtnActive: { backgroundColor: "#111827", borderColor: "#111827" },
  kindText: { color: "#111827", fontWeight: "600" },
  kindTextActive: { color: "#fff" },
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
    paddingVertical: 10,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "700" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 10,
  },
  itemTitle: { fontSize: 15, fontWeight: "700" },
  itemMeta: { fontSize: 12, color: "#6b7280" },
  stockText: { fontSize: 15, fontWeight: "700", color: "#2563eb" },
  linkText: { fontSize: 12, color: "#111827", textDecorationLine: "underline" },
  moveRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  moveBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10 },
  empty: { textAlign: "center", marginTop: 40, color: "#6b7280" },
});
