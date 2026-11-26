import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerTitleAlign: "center" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="orders/new" options={{ title: "طلب جديد" }} />
      <Stack.Screen name="orders/[id]" options={{ title: "تفاصيل الطلب" }} />
      <Stack.Screen
        name="orders/[id]/design"
        options={{ title: "الباترون والعينة" }}
      />
      <Stack.Screen
        name="orders/[id]/materials"
        options={{ title: "القماش والإكسسوارات" }}
      />
      <Stack.Screen
        name="orders/[id]/production"
        options={{ title: "القص والإنتاج" }}
      />
    </Stack>
  );
}
