// Course library: shared materials + quizzes, natively.
import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect, useNavigation } from "expo-router";
import { api, errorMessage } from "../../lib/api";
import { colors, radius } from "../../lib/theme";

type CoursePayload = Awaited<ReturnType<typeof api.course.get.query>>;

export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [course, setCourse] = useState<CoursePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void api.course.get
        .query({ courseId: id })
        .then((c) => {
          setCourse(c);
          navigation.setOptions({ title: c.code });
        })
        .catch((err) => setError(errorMessage(err)));
    }, [id, navigation])
  );

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!course) return <Text style={styles.loading}>Loading...</Text>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={styles.title}>{course.title}</Text>
      <Text style={styles.meta}>
        {course.subject} - {course.memberCount} enrolled
      </Text>

      <Pressable style={styles.smartStudyCard} onPress={() => router.push(`/study/${course.id}`)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.smartStudyEyebrow}>SMART STUDY</Text>
          <Text style={styles.smartStudyTitle}>Plans, flashcards, and weak spots</Text>
          <Text style={styles.smartStudyBody}>See what to review next before your exam.</Text>
        </View>
        <Text style={styles.smartStudyArrow}>Open</Text>
      </Pressable>

      <Text style={styles.heading}>Shared library</Text>
      {course.materials.map((m) => (
        <View key={m.id} style={styles.card}>
          <Text style={styles.cardTitle}>{m.title}</Text>
          <Text style={styles.cardMeta}>
            {m.type} - by {m.uploaderName}
            {!m.hasText ? " - no extracted text" : ""}
          </Text>
        </View>
      ))}
      {course.materials.length === 0 && (
        <Text style={styles.emptyText}>No materials yet - upload from the web app.</Text>
      )}

      <Text style={styles.heading}>Practice quizzes</Text>
      {course.quizzes.map((q) => (
        <Pressable key={q.id} style={styles.card} onPress={() => router.push(`/quiz/${q.id}`)}>
          <Text style={styles.cardTitle}>{q.title}</Text>
          <Text style={styles.cardMeta}>
            {q.attemptCount} attempt{q.attemptCount === 1 ? "" : "s"} - tap to take
          </Text>
        </Pressable>
      ))}
      {course.quizzes.length === 0 && (
        <Text style={styles.emptyText}>No quizzes yet - generate one from the web app.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  title: { fontSize: 22, fontWeight: "800", color: colors.ink },
  meta: { fontSize: 13, color: colors.slate400, marginTop: 4, marginBottom: 8 },
  heading: { fontWeight: "800", fontSize: 15, color: colors.ink, marginTop: 18, marginBottom: 8 },
  smartStudyCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.brand100,
    marginTop: 12,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  smartStudyEyebrow: { color: colors.brand600, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  smartStudyTitle: { color: colors.ink, fontSize: 15, fontWeight: "700", marginTop: 4 },
  smartStudyBody: { color: colors.slate500, fontSize: 12, marginTop: 4, lineHeight: 17 },
  smartStudyArrow: { color: colors.brand600, fontSize: 13, fontWeight: "800", marginLeft: 12 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.slate200,
    marginBottom: 8,
  },
  cardTitle: { fontWeight: "700", fontSize: 14, color: colors.ink },
  cardMeta: { fontSize: 12, color: colors.slate400, marginTop: 4 },
  emptyText: { color: colors.slate400, fontSize: 13 },
  error: { margin: 20, color: colors.rose700 },
  loading: { margin: 20, color: colors.slate400 },
});
