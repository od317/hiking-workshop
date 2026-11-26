import { Pressable, Text } from "react-native";
import { Tabs } from "expo-router";

import { useAuthStore } from "@/store/auth.store";

export default function TabsLayout() {
  const logout = useAuthStore((s) => s.logout);

  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "center",
        headerRight: () => (
          <Pressable onPress={logout} style={{ paddingHorizontal: 14 }}>
            <Text style={{ color: "#dc2626", fontWeight: "600" }}>خروج</Text>
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: "الطلبات" }} />
      <Tabs.Screen name="materials" options={{ title: "المواد" }} />
      <Tabs.Screen name="workshops" options={{ title: "المشاغل" }} />
    </Tabs>
  );
}
