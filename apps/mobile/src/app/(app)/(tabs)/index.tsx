import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { OrderSummary } from "@/lib/api";
import { apiFetch } from "@/lib/api-client";

export default function OrdersListScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["orders", search],
    queryFn: () =>
      apiFetch<OrderSummary[]>(
        search.trim()
          ? `/orders?search=${encodeURIComponent(search.trim())}`
          : "/orders",
      ),
  });

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TextInput
          style={styles.search}
          placeholder="بحث برقم الطلب أو الزبون..."
          value={search}
          onChangeText={setSearch}
          textAlign="right"
        />
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push("/(app)/orders/new")}
        >
          <Text style={styles.addBtnText}>+ جديد</Text>
        </Pressable>
      </View>

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
            <Text style={styles.empty}>لا توجد طلبات بعد</Text>
          }
          renderItem={({ item }) => {
            const doneCount = item.steps.filter(
              (s) => s.status === "DONE",
            ).length;
            return (
              <Pressable
                style={styles.card}
                onPress={() => router.push(`/(app)/orders/${item.id}`)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.orderNumber}>{item.orderNumber}</Text>
                  <Text style={styles.progress}>
                    {doneCount}/{item.steps.length} مكتمل
                  </Text>
                </View>
                <Text style={styles.title}>{item.title || "بدون عنوان"}</Text>
                <Text style={styles.customer}>
                  الزبون: {item.customer.name}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 12 },
  topRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  search: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addBtn: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "700" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  orderNumber: { fontWeight: "700", fontSize: 15, color: "#111827" },
  progress: { fontSize: 12, color: "#2563eb", fontWeight: "600" },
  title: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  customer: { fontSize: 13, color: "#4b5563" },
  empty: { textAlign: "center", marginTop: 40, color: "#6b7280" },
});
