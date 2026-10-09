// Native course library - the first core mobile flow.
import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api, errorMessage } from "../../lib/api";
import { colors, radius } from "../../lib/theme";

type Course = Awaited<ReturnType<typeof api.course.listMine.query>>[number];

export default function CoursesScreen() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setCourses(await api.course.listMine.query());
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <View style={styles.screen}>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={courses}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No courses yet</Text>
              <Text style={styles.emptyBody}>
                Join or create a course on the web app - it will show up here.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/course/${item.id}`)}>
            <Text style={styles.code}>{item.code}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.meta}>
              {item.materialCount} materials - {item.quizCount} quizzes - {item.memberCount} enrolled
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  code: { color: colors.brand600, fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  title: { fontSize: 17, fontWeight: "700", color: colors.ink, marginTop: 4 },
  meta: { fontSize: 12, color: colors.slate400, marginTop: 6 },
  error: {
    backgroundColor: colors.rose50,
    color: colors.rose700,
    padding: 10,
    margin: 16,
    marginBottom: 0,
    borderRadius: radius.md,
    fontSize: 13,
  },
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 30 },
  emptyTitle: { fontWeight: "700", fontSize: 16, color: colors.slate600 },
  emptyBody: { color: colors.slate400, textAlign: "center", marginTop: 6, fontSize: 13 },
});
