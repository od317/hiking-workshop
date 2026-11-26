import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/auth.store";

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>
        {t("auth.welcome", { name: user?.fullName ?? user?.username })}
      </Text>
      <Pressable style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>{t("common.logout")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  welcome: { fontSize: 22, fontWeight: "600", marginBottom: 24 },
  button: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
