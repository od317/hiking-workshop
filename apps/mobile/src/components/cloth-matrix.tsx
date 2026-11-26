import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ProductionBoard, ProductionLine } from "@/lib/api";
import { ApiError, apiFetch } from "@/lib/api-client";

const QUICK_SIZES = ["S", "M", "L", "XL", "XXL"];

interface Row {
  size: string;
  qty: string;
  cutQty: number; // already cut: row can't be removed or go below this
}
interface Group {
  color: string;
  rows: Row[];
}

const digits = (v: string) => v.replace(/[^0-9]/g, "");
const num = (v: string) => parseInt(v, 10) || 0;

function toGroups(lines: ProductionLine[]): Group[] {
  const map = new Map<string, Group>();
  for (const l of lines) {
    const g = map.get(l.color) ?? { color: l.color, rows: [] };
    g.rows.push({ size: l.size, qty: String(l.orderedQty), cutQty: l.cutQty });
    map.set(l.color, g);
  }
  return [...map.values()];
}

export function ClothMatrix({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const [groups, setGroups] = useState<Group[]>([]);
  const [dirty, setDirty] = useState(false);
  const [newColor, setNewColor] = useState("");
  const [globalQty, setGlobalQty] = useState("");
  const [bulk, setBulk] = useState<Record<string, string>>({});
  const [customSize, setCustomSize] = useState<Record<string, string>>({});

  const { data: board } = useQuery({
    queryKey: ["production", orderId],
    queryFn: () => apiFetch<ProductionBoard>(`/orders/${orderId}/production`),
  });

  // Sync from server only when there are no unsaved edits
  useEffect(() => {
    if (board && !dirty) setGroups(toGroups(board.lines));
  }, [board, dirty]);

  const edit = (fn: (g: Group[]) => Group[]) => {
    setGroups((prev) => fn(prev));
    setDirty(true);
  };

  const addColor = () => {
    const color = newColor.trim();
    if (!color) return;
    if (groups.some((g) => g.color.toLowerCase() === color.toLowerCase())) {
      Alert.alert("اللون موجود", "هذا اللون مضاف مسبقاً");
      return;
    }
    edit((g) => [...g, { color, rows: [] }]);
    setNewColor("");
  };

  const removeColor = (color: string) => {
    const g = groups.find((x) => x.color === color);
    if (g?.rows.some((r) => r.cutQty > 0)) {
      Alert.alert("لا يمكن الحذف", "تم قص قطع من هذا اللون");
      return;
    }
    edit((all) => all.filter((x) => x.color !== color));
  };

  const addSize = (color: string, sizeRaw: string) => {
    const size = sizeRaw.trim();
    if (!size) return;
    edit((all) =>
      all.map((g) => {
        if (g.color !== color) return g;
        if (g.rows.some((r) => r.size.toLowerCase() === size.toLowerCase()))
          return g;
        const last = g.rows[g.rows.length - 1];
        return {
          ...g,
          rows: [...g.rows, { size, qty: last?.qty ?? "", cutQty: 0 }],
        };
      }),
    );
    setCustomSize((s) => ({ ...s, [color]: "" }));
  };

  const removeSize = (color: string, size: string) =>
    edit((all) =>
      all.map((g) =>
        g.color === color
          ? { ...g, rows: g.rows.filter((r) => r.size !== size) }
          : g,
      ),
    );

  const setQty = (color: string, size: string, v: string) =>
    edit((all) =>
      all.map((g) =>
        g.color === color
          ? {
              ...g,
              rows: g.rows.map((r) =>
                r.size === size ? { ...r, qty: digits(v) } : r,
              ),
            }
          : g,
      ),
    );

  const applyColor = (color: string) => {
    const v = digits(bulk[color] ?? "");
    if (!v) return;
    edit((all) =>
      all.map((g) =>
        g.color === color
          ? { ...g, rows: g.rows.map((r) => ({ ...r, qty: v })) }
          : g,
      ),
    );
  };

  const applyEverything = () => {
    const v = digits(globalQty);
    if (!v) return;
    edit((all) =>
      all.map((g) => ({ ...g, rows: g.rows.map((r) => ({ ...r, qty: v })) })),
    );
  };

  const invalid = (r: Row) => num(r.qty) < 1 || num(r.qty) < r.cutQty;
  const hasInvalid = groups.some((g) => g.rows.some(invalid));
  const colorTotal = (g: Group) => g.rows.reduce((s, r) => s + num(r.qty), 0);
  const grandTotal = groups.reduce((s, g) => s + colorTotal(g), 0);

  const save = useMutation({
    mutationFn: async () => {
      const wanted = groups.flatMap((g) =>
        g.rows.map((r) => ({
          color: g.color.trim(),
          size: r.size.trim(),
          orderedQty: num(r.qty),
        })),
      );
      const keep = new Set(wanted.map((w) => `${w.color}|${w.size}`));
      const toDelete = (board?.lines ?? []).filter(
        (l) => !keep.has(`${l.color}|${l.size}`),
      );
      for (const l of toDelete) {
        await apiFetch(`/orders/${orderId}/lines/${l.id}`, {
          method: "DELETE",
        });
      }
      if (wanted.length) {
        await apiFetch(`/orders/${orderId}/lines`, {
          method: "POST",
          body: { lines: wanted },
        });
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["production", orderId] });
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      setDirty(false);
    },
    onError: (err) =>
      Alert.alert(
        "تعذر الحفظ",
        err instanceof ApiError ? err.message : "حدث خطأ",
      ),
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.totalBar}>
        <Text style={styles.totalLabel}>المجموع الكلي</Text>
        <Text style={styles.totalValue}>{grandTotal} قطعة</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>ألوان ومقاسات وكميات</Text>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="لون جديد (أبيض)"
            value={newColor}
            onChangeText={setNewColor}
            textAlign="right"
          />
          <Pressable style={styles.darkBtn} onPress={addColor}>
            <Text style={styles.btnText}>+ لون</Text>
          </Pressable>
        </View>

        {groups.length > 0 ? (
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="رقم واحد لكل الألوان والمقاسات"
              value={globalQty}
              onChangeText={(v) => setGlobalQty(digits(v))}
              keyboardType="number-pad"
              textAlign="right"
            />
            <Pressable style={styles.lightBtn} onPress={applyEverything}>
              <Text style={styles.lightBtnText}>تطبيق على الكل</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {groups.map((g) => {
        const missing = QUICK_SIZES.filter(
          (s) => !g.rows.some((r) => r.size.toLowerCase() === s.toLowerCase()),
        );
        return (
          <View key={g.color} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.colorName}>{g.color}</Text>
              <View style={styles.row}>
                <Text style={styles.colorTotal}>{colorTotal(g)} قطعة</Text>
                <Pressable onPress={() => removeColor(g.color)} hitSlop={8}>
                  <Text style={styles.remove}>✕</Text>
                </Pressable>
              </View>
            </View>

            {g.rows.length > 0 ? (
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="رقم موحد لكل مقاسات هذا اللون"
                  value={bulk[g.color] ?? ""}
                  onChangeText={(v) =>
                    setBulk((b) => ({ ...b, [g.color]: digits(v) }))
                  }
                  keyboardType="number-pad"
                  textAlign="right"
                />
                <Pressable
                  style={styles.lightBtn}
                  onPress={() => applyColor(g.color)}
                >
                  <Text style={styles.lightBtnText}>تطبيق</Text>
                </Pressable>
              </View>
            ) : null}

            {g.rows.map((r) => (
              <View key={r.size} style={styles.sizeRow}>
                <Text style={styles.sizeLabel}>{r.size}</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.qtyInput,
                    invalid(r) && styles.inputError,
                  ]}
                  placeholder="الكمية"
                  value={r.qty}
                  onChangeText={(v) => setQty(g.color, r.size, v)}
                  keyboardType="number-pad"
                  textAlign="center"
                />
                {r.cutQty > 0 ? (
                  <Text style={styles.cutNote}>مقصوص {r.cutQty}</Text>
                ) : (
                  <Pressable
                    onPress={() => removeSize(g.color, r.size)}
                    hitSlop={8}
                  >
                    <Text style={styles.remove}>✕</Text>
                  </Pressable>
                )}
              </View>
            ))}

            <View style={styles.chipWrap}>
              {missing.map((s) => (
                <Pressable
                  key={s}
                  style={styles.chip}
                  onPress={() => addSize(g.color, s)}
                >
                  <Text style={styles.chipText}>+ {s}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="مقاس آخر (مثلاً 42)"
                value={customSize[g.color] ?? ""}
                onChangeText={(v) =>
                  setCustomSize((c) => ({ ...c, [g.color]: v }))
                }
                textAlign="right"
              />
              <Pressable
                style={styles.lightBtn}
                onPress={() => addSize(g.color, customSize[g.color] ?? "")}
              >
                <Text style={styles.lightBtnText}>إضافة</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      {dirty ? (
        <View style={styles.row}>
          <Pressable
            style={styles.cancelBtn}
            disabled={save.isPending}
            onPress={() => {
              setGroups(toGroups(board?.lines ?? []));
              setDirty(false);
            }}
          >
            <Text style={styles.cancelText}>تراجع</Text>
          </Pressable>
          <Pressable
            style={[
              styles.saveBtn,
              (hasInvalid || save.isPending) && { opacity: 0.5 },
            ]}
            disabled={hasInvalid || save.isPending}
            onPress={() => save.mutate()}
          >
            <Text style={styles.btnText}>
              {save.isPending ? "جاري الحفظ..." : "حفظ الألوان والمقاسات"}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {hasInvalid ? (
        <Text style={styles.errorText}>
          كل مقاس يحتاج كمية 1 على الأقل، ولا تقل عن الكمية المقصوصة
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 10,
  },
  title: { fontSize: 16, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
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
  inputError: { borderColor: "#dc2626", backgroundColor: "#fef2f2" },
  darkBtn: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  lightBtn: {
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  lightBtnText: { color: "#2563eb", fontWeight: "700", fontSize: 12 },
  totalBar: {
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalLabel: { color: "#d1d5db", fontWeight: "600" },
  totalValue: { color: "#fff", fontWeight: "800", fontSize: 16 },
  colorName: { fontSize: 16, fontWeight: "700" },
  colorTotal: { fontSize: 13, fontWeight: "700", color: "#2563eb" },
  remove: {
    color: "#dc2626",
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 4,
  },
  sizeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sizeLabel: { width: 48, fontSize: 15, fontWeight: "700" },
  qtyInput: { flex: 1 },
  cutNote: { fontSize: 12, color: "#16a34a", fontWeight: "600", minWidth: 60 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontSize: 13, fontWeight: "600", color: "#111827" },
  saveBtn: {
    flex: 1,
    backgroundColor: "#16a34a",
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  cancelText: { color: "#374151", fontWeight: "700" },
  errorText: { color: "#dc2626", fontSize: 12 },
});
