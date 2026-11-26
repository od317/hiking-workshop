import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/auth.store";
import { ApiError } from "../../lib/api-client";

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(6),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { t } = useTranslation();
  const login = useAuthStore((s) => s.login);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    setServerError(null);
    try {
      await login(data.username, data.password);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setServerError(t("auth.invalidCredentials"));
      } else {
        setServerError(t("common.errorGeneric"));
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("auth.title")}</Text>

      <Text style={styles.label}>{t("auth.username")}</Text>
      <Controller
        control={control}
        name="username"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            value={value}
            onChangeText={onChange}
            textAlign="right"
          />
        )}
      />
      {errors.username && (
        <Text style={styles.error}>{t("auth.usernameRequired")}</Text>
      )}

      <Text style={styles.label}>{t("auth.password")}</Text>
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            secureTextEntry
            value={value}
            onChangeText={onChange}
            textAlign="right"
          />
        )}
      />
      {errors.password && (
        <Text style={styles.error}>{t("auth.passwordMin")}</Text>
      )}

      {serverError && <Text style={styles.error}>{serverError}</Text>}

      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{t("auth.submit")}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 24,
    textAlign: "start" as any,
  },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  error: { color: "#dc2626", fontSize: 13, marginTop: 4 },
  button: {
    backgroundColor: "#111827",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
