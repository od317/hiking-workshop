import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { File } from "expo-file-system";

import { Attachment, AttachmentEntityType } from "@/lib/api";
import { API_URL, ApiError, apiFetch, apiUpload } from "@/lib/api-client";

interface PhotoGalleryProps {
  entityType: AttachmentEntityType;
  entityId: string;
  label?: string;
}

export function PhotoGallery({
  entityType,
  entityId,
  label = "الصور",
}: PhotoGalleryProps) {
  const qc = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const queryKey = ["attachments", entityType, entityId];

  const { data: photos, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      apiFetch<Attachment[]>(
        `/attachments?entityType=${entityType}&entityId=${entityId}`,
      ),
    enabled: Boolean(entityId),
  });

  const uploadPhoto = useMutation({
    mutationFn: async (uri: string) => {
      const form = new File(uri); // a Blob-like file the new fetch understands
      const body = new FormData();
      body.append("file", form);
      body.append("entityType", entityType);
      body.append("entityId", entityId);

      return apiUpload<Attachment>("/attachments/upload", body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (err) => {
      Alert.alert(
        "خطأ في الرفع",
        err instanceof ApiError ? err.message : "تعذر رفع الصورة",
      );
    },
  });

  const deletePhoto = useMutation({
    mutationFn: (attachmentId: string) =>
      apiFetch(`/attachments/${attachmentId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (err) => {
      Alert.alert(
        "خطأ",
        err instanceof ApiError ? err.message : "تعذر حذف الصورة",
      );
    },
  });

  const pickImage = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      Alert.alert("صلاحية مطلوبة", "يرجى السماح بالوصول للكاميرا أو المعرض");
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.7,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.7,
        });

    if (!result.canceled && result.assets[0]?.uri) {
      uploadPhoto.mutate(result.assets[0].uri);
    }
  };

  const openPickerMenu = () => {
    Alert.alert("إضافة صورة", "اختر المصدر", [
      { text: "الكاميرا", onPress: () => pickImage(true) },
      { text: "المعرض", onPress: () => pickImage(false) },
      { text: "إلغاء", style: "cancel" },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>
          {label} ({photos?.length ?? 0})
        </Text>
        <Pressable
          style={styles.addBtn}
          disabled={uploadPhoto.isPending}
          onPress={openPickerMenu}
        >
          {uploadPhoto.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.addBtnText}>+ صورة</Text>
          )}
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" />
      ) : (photos?.length ?? 0) > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.strip}>
            {photos!.map((p) => {
              const fullUrl = `${API_URL}${p.url}`;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPreviewUrl(fullUrl)}
                  onLongPress={() =>
                    Alert.alert("حذف الصورة", "هل تريد حذف هذه الصورة؟", [
                      { text: "إلغاء", style: "cancel" },
                      {
                        text: "حذف",
                        style: "destructive",
                        onPress: () => deletePhoto.mutate(p.id),
                      },
                    ])
                  }
                >
                  <Image source={{ uri: fullUrl }} style={styles.thumb} />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      ) : null}

      <Modal visible={Boolean(previewUrl)} transparent animationType="fade">
        <Pressable style={styles.modalBg} onPress={() => setPreviewUrl(null)}>
          {previewUrl ? (
            <Image
              source={{ uri: previewUrl }}
              style={styles.fullImg}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginTop: 4 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: { fontSize: 12, fontWeight: "600", color: "#4b5563" },
  addBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  strip: { flexDirection: "row", gap: 8 },
  thumb: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  fullImg: { width: "100%", height: "80%" },
});
