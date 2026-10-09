// Native Phase 3 Smart Study surface.
import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { api, errorMessage } from "../../lib/api";
import { colors, radius } from "../../lib/theme";

type SmartStudyPayload = Awaited<ReturnType<typeof api.study.courseDashboard.query>>;

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={styles.progressTrack}
    >
      <View style={[styles.progressFill, { width: `${clamped}%` }]} />
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function SmartStudyScreen() {
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const [data, setData] = useState<SmartStudyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const payload = await api.study.courseDashboard.query({ courseId });
      setData(payload);
      setError(null);
      navigation.setOptions({ title: `${payload.course.code} Smart Study` });
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [courseId, navigation]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const plan = data?.plans[0] ?? null;
  const planStats = useMemo(() => {
    if (!plan) return null;
    const completedDays = plan.schedule.filter((day) => day.done).length;
    const totalDays = plan.schedule.length;
    const completion = totalDays === 0 ? 0 : Math.round((completedDays / totalDays) * 100);
    const nextDay =
      plan.schedule
        .filter((day) => !day.done)
        .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
    return { completedDays, totalDays, completion, nextDay };
  }, [plan]);

  const maxWeakCount = useMemo(
    () => Math.max(1, ...(data?.weakTopics.map((topic) => topic.count) ?? [])),
    [data?.weakTopics]
  );
  const totalWeakMisses = useMemo(
    () => data?.weakTopics.reduce((sum, topic) => sum + topic.count, 0) ?? 0,
    [data?.weakTopics]
  );

  if (error && !data) return <Text style={styles.error}>{error}</Text>;
  if (!data) return <Text style={styles.loading}>Loading Smart Study...</Text>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.eyebrow}>{data.course.code}</Text>
      <Text style={styles.title}>{data.course.title}</Text>
      <Text style={styles.subtitle}>Study plans, review queue, and weak topics from this course.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionEyebrow}>READINESS</Text>
        <Text style={styles.sectionTitle}>Course pulse</Text>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Study plan progress</Text>
          <Text style={styles.progressLabel}>{planStats ? `${planStats.completion}%` : "No plan"}</Text>
        </View>
        <ProgressBar value={planStats?.completion ?? 0} label="Study plan progress" />

        <View style={styles.statGrid}>
          <StatTile label="Cards due" value={data.flashcards.due} />
          <StatTile label="Weak misses" value={totalWeakMisses} />
        </View>

        {planStats?.nextDay ? (
          <View style={styles.nextBlock}>
            <Text style={styles.nextLabel}>Next study block</Text>
            <Text style={styles.nextTitle}>
              {formatDate(planStats.nextDay.date)} - {planStats.nextDay.minutes} min
            </Text>
            <Text style={styles.nextBody}>{planStats.nextDay.topics.join(", ")}</Text>
          </View>
        ) : (
          <Text style={styles.mutedText}>Create a study plan on web to populate the next study block.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionEyebrow}>FOCUS</Text>
        <Text style={styles.sectionTitle}>Weak topic radar</Text>
        {data.weakTopics.length === 0 ? (
          <Text style={styles.mutedText}>Missed quiz topics will show up after you submit practice quizzes.</Text>
        ) : (
          <View style={{ gap: 14 }}>
            {data.weakTopics.slice(0, 8).map((topic) => {
              const severity = Math.max(14, Math.round((topic.count / maxWeakCount) * 100));
              return (
                <View key={topic.topic}>
                  <View style={styles.topicHeader}>
                    <Text style={styles.topicName}>{topic.topic}</Text>
                    <Text style={styles.topicCount}>
                      {topic.count} miss{topic.count === 1 ? "" : "es"}
                    </Text>
                  </View>
                  <ProgressBar value={severity} label={`${topic.topic} weak-topic severity`} />
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionEyebrow}>PLAN</Text>
        <Text style={styles.sectionTitle}>Latest schedule</Text>
        {plan ? (
          <View style={{ gap: 10 }}>
            {plan.schedule.slice(0, 8).map((day) => (
              <View key={day.date} style={[styles.planDay, day.done && styles.planDayDone]}>
                <Text style={styles.planDate}>{formatDate(day.date)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planTopics}>{day.topics.join(", ")}</Text>
                  <Text style={styles.planMeta}>
                    {day.minutes} min{day.done ? " - done" : ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.mutedText}>No study plan yet.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionEyebrow}>MATERIALS</Text>
        <Text style={styles.sectionTitle}>Flashcard sources</Text>
        <View style={styles.statGrid}>
          <StatTile label="Readable" value={data.materials.filter((m) => m.hasText).length} />
          <StatTile label="Cards" value={data.flashcards.total} />
        </View>
        <Pressable style={styles.secondaryButton} onPress={() => router.push(`/course/${courseId}`)}>
          <Text style={styles.secondaryButtonText}>Back to course library</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  eyebrow: { color: colors.brand600, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 24, fontWeight: "800", marginTop: 4 },
  subtitle: { color: colors.slate500, fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 14 },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.slate200,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  sectionEyebrow: { color: colors.brand600, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", marginTop: 4, marginBottom: 12 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { color: colors.slate500, fontSize: 12, fontWeight: "700" },
  progressTrack: {
    backgroundColor: colors.brand50,
    borderRadius: 999,
    height: 8,
    overflow: "hidden",
  },
  progressFill: { backgroundColor: colors.brand600, borderRadius: 999, height: "100%" },
  statGrid: { flexDirection: "row", gap: 10, marginTop: 14 },
  statTile: { backgroundColor: colors.paper, borderRadius: radius.md, flex: 1, padding: 12 },
  statLabel: { color: colors.slate400, fontSize: 11, fontWeight: "800" },
  statValue: { color: colors.ink, fontSize: 24, fontWeight: "800", marginTop: 2 },
  nextBlock: { backgroundColor: colors.brand50, borderRadius: radius.md, marginTop: 14, padding: 12 },
  nextLabel: { color: colors.brand700, fontSize: 11, fontWeight: "800" },
  nextTitle: { color: colors.ink, fontSize: 14, fontWeight: "800", marginTop: 3 },
  nextBody: { color: colors.slate600, fontSize: 13, lineHeight: 18, marginTop: 4 },
  mutedText: { color: colors.slate500, fontSize: 13, lineHeight: 19 },
  topicHeader: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginBottom: 6 },
  topicName: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" },
  topicCount: { color: colors.slate400, fontSize: 12, fontWeight: "700" },
  planDay: {
    alignItems: "flex-start",
    backgroundColor: colors.paper,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  planDayDone: { backgroundColor: colors.emerald100, borderColor: colors.emerald100 },
  planDate: { color: colors.brand600, fontSize: 12, fontWeight: "800", width: 54 },
  planTopics: { color: colors.ink, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  planMeta: { color: colors.slate500, fontSize: 12, marginTop: 3 },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.slate200,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 14,
    paddingVertical: 12,
  },
  secondaryButtonText: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  error: {
    backgroundColor: colors.rose50,
    borderRadius: radius.md,
    color: colors.rose700,
    fontSize: 13,
    margin: 16,
    padding: 10,
  },
  loading: { color: colors.slate400, margin: 20 },
});
