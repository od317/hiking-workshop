import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerTitleAlign: "center" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="orders/new" options={{ title: "طلب جديد" }} />
      <Stack.Screen name="orders/[id]" options={{ title: "تفاصيل الطلب" }} />
      <Stack.Screen
        name="orders/[id]/pattern"
        options={{ title: "الباترون" }}
      />
      <Stack.Screen name="orders/[id]/sample" options={{ title: "العينة" }} />
      <Stack.Screen
        name="orders/[id]/accessories"
        options={{ title: "الإكسسوارات" }}
      />
      <Stack.Screen name="orders/[id]/cloth" options={{ title: "القماش" }} />
      <Stack.Screen
        name="orders/[id]/production"
        options={{ title: "القص والإنتاج" }}
      />
      <Stack.Screen
        name="orders/[id]/workshops"
        options={{ title: "المشغل والدفعات" }}
      />
      <Stack.Screen
        name="orders/[id]/delivery"
        options={{ title: "الكوي والتسليم" }}
      />
      <Stack.Screen
        name="orders/[id]/finance"
        options={{ title: "المالية والأرباح" }}
      />
    </Stack>
  );
}
