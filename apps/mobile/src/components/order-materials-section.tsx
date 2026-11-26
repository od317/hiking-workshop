import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Material, MaterialKind, OrderMaterial } from "@/lib/api";
import { ApiError, apiFetch } from "@/lib/api-client";
import { PhotoGallery } from "@/components/photo-gallery";
import { pickPhoto } from "@/lib/pick-photo";
import { uploadAttachment } from "@/lib/upload-attachment";

export function OrderMaterialsSection({
  orderId,
  kind,
}: {
  orderId: string;
  kind: MaterialKind;
}) {
  const qc = useQueryClient();
  const isFabric = kind === "FABRIC";
  const kindLabel = isFabric ? "قماش" : "إكسسوار";

  const [mode, setMode] = useState<"CATALOG" | "CUSTOM">("CATALOG");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deduct, setDeduct] = useState(true);
  const [customName, setCustomName] = useState("");
  const [customColor, setCustomColor] = useState("");
  const [customUnit, setCustomUnit] = useState(isFabric ? "متر" : "حبة");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["order-materials", orderId, kind],
    queryFn: () =>
      apiFetch<OrderMaterial[]>(`/orders/${orderId}/materials?kind=${kind}`),
  });

  const { data: catalog } = useQuery({
    queryKey: ["materials", kind],
    queryFn: () => apiFetch<Material[]>(`/materials?kind=${kind}`),
  });

  const add = useMutation({
    mutationFn: async () => {
      const created = await apiFetch<OrderMaterial>(
        `/orders/${orderId}/materials`,
        {
          method: "POST",
          body:
            mode === "CATALOG"
              ? {
                  kind,
                  materialId: selectedId,
                  quantity: Number(quantity),
                  deductFromStock: deduct,
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
        },
      );

      // The photo is optional. If it fails the item is still saved.
      let photoFailed = false;
      if (photoUri) {
        try {
          await uploadAttachment(photoUri, "ORDER_MATERIAL", created.id);
        } catch {
          photoFailed = true;
        }
      }
      return { photoFailed };
    },
    onSuccess: ({ photoFailed }) => {
      setQuantity("");
      setNote("");
      setCustomName("");
      setCustomColor("");
      setPhotoUri(null);
      qc.invalidateQueries({ queryKey: ["order-materials", orderId] });
      qc.invalidateQueries({ queryKey: ["materials"] });
      if (photoFailed) {
        Alert.alert(
          "تمت الإضافة",
          "لكن تعذر رفع الصورة. يمكنك إضافتها من القائمة أدناه.",
        );
      }
    },
    onError: (err) =>
      Alert.alert(
        "خطأ",
        err instanceof ApiError ? err.message : "تعذر الإضافة للطلب",
      ),
  });

  const canSubmit =
    Number(quantity) > 0 &&
    (mode === "CATALOG"
      ? Boolean(selectedId)
      : Boolean(customName.trim() && customUnit.trim()));

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.card}>
        <Text style={styles.title}>
          {isFabric ? "القماش المستخدم" : "إضافة إكسسوار للطلب"}
        </Text>

        <View style={styles.row}>
          {(["CATALOG", "CUSTOM"] as const).map((m) => (
            <Pressable
              key={m}
              style={[styles.toggle, mode === m && styles.toggleActive]}
              onPress={() => setMode(m)}
            >
              <Text
                style={[styles.toggleText, mode === m && { color: "#fff" }]}
              >
                {m === "CATALOG" ? "من المستودع" : "خاص بالطلب"}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === "CATALOG" ? (
          <>
            <View style={styles.chipWrap}>
              {(catalog ?? []).map((m) => {
                const sel = m.id === selectedId;
                return (
                  <Pressable
                    key={m.id}
                    style={[styles.chip, sel && styles.chipSel]}
                    onPress={() => setSelectedId(m.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        sel && { color: "#fff", fontWeight: "600" },
                      ]}
                    >
                      {m.name} ({m.currentStock} {m.unit})
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.rowBetween}>
              <Text>خصم الكمية من المستودع</Text>
              <Switch value={deduct} onValueChange={setDeduct} />
            </View>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder={`اسم ال${kindLabel}`}
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

        <View style={styles.photoRow}>
          {photoUri ? (
            <View>
              <Image source={{ uri: photoUri }} style={styles.preview} />
              <Pressable
                style={styles.previewRemove}
                onPress={() => setPhotoUri(null)}
                hitSlop={8}
              >
                <Text style={styles.previewRemoveText}>✕</Text>
              </Pressable>
            </View>
          ) : null}
          <Pressable
            style={styles.photoBtn}
            onPress={async () => {
              const uri = await pickPhoto();
              if (uri) setPhotoUri(uri);
            }}
          >
            <Text style={styles.photoBtnText}>
              {photoUri ? "تغيير الصورة" : `📷 صورة ال${kindLabel} (اختياري)`}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={[
            styles.submit,
            (!canSubmit || add.isPending) && { opacity: 0.5 },
          ]}
          disabled={!canSubmit || add.isPending}
          onPress={() => add.mutate()}
        >
          <Text style={styles.submitText}>إضافة للطلب</Text>
        </Pressable>
      </View>

      <Text style={styles.title}>
        {isFabric ? "أقمشة الطلب" : "إكسسوارات الطلب"} ({items?.length ?? 0})
      </Text>

      {isLoading ? (
        <ActivityIndicator />
      ) : (
        (items ?? []).map((om) => (
          <View key={om.id} style={styles.itemCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.itemTitle}>
                {om.material?.name ?? om.customName}
                {om.material?.color || om.customColor
                  ? ` (${om.material?.color ?? om.customColor})`
                  : ""}
              </Text>
              <Text style={styles.qty}>
                {om.quantity} {om.unit}
              </Text>
            </View>
            {om.note ? <Text style={styles.meta}>{om.note}</Text> : null}
            <PhotoGallery
              entityType="ORDER_MATERIAL"
              entityId={om.id}
              label="صورة"
            />
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 10,
  },
  title: { fontSize: 16, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8 },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toggle: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  toggleActive: { backgroundColor: "#111827", borderColor: "#111827" },
  toggleText: { color: "#111827", fontWeight: "600", fontSize: 13 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipSel: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { fontSize: 13, color: "#111827" },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  photoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  photoBtn: {
    flex: 1,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#9ca3af",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  photoBtnText: { color: "#374151", fontWeight: "600", fontSize: 13 },
  preview: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
  },
  previewRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "#dc2626",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  previewRemoveText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  submit: {
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
    gap: 6,
  },
  itemTitle: { fontSize: 15, fontWeight: "700" },
  qty: { fontSize: 14, fontWeight: "700", color: "#2563eb" },
  meta: { fontSize: 12, color: "#6b7280" },
});
