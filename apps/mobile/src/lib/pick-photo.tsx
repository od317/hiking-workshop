import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";

async function pick(fromCamera: boolean): Promise<string | null> {
  const perm = fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!perm.granted) {
    Alert.alert("صلاحية مطلوبة", "يرجى السماح بالوصول للكاميرا أو المعرض");
    return null;
  }

  const options = { mediaTypes: ["images" as const], quality: 0.7 };
  const result = fromCamera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);

  return !result.canceled && result.assets[0]?.uri
    ? result.assets[0].uri
    : null;
}

/** Asks camera or gallery, resolves with the local uri (or null if cancelled). */
export function pickPhoto(): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert(
      "إضافة صورة",
      "اختر المصدر",
      [
        { text: "الكاميرا", onPress: () => pick(true).then(resolve) },
        { text: "المعرض", onPress: () => pick(false).then(resolve) },
        { text: "إلغاء", style: "cancel", onPress: () => resolve(null) },
      ],
      { onDismiss: () => resolve(null) },
    );
  });
}
