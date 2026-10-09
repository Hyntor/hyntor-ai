// Tutor hub: pick a mode (+ optional course), start chatting.
import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api, errorMessage } from "../../lib/api";
import { colors, radius, TIER_LABELS } from "../../lib/theme";

type Session = Awaited<ReturnType<typeof api.tutor.listSessions.query>>[number];
type Course = Awaited<ReturnType<typeof api.course.listMine.query>>[number];
type Mode = "CONCEPT" | "ASSIGNMENT_HELP" | "CODE_REVIEW" | "DEBUG";

const MODES: { key: Mode; mark: string; label: string }[] = [
  { key: "CONCEPT", mark: "AI", label: "Learn a concept" },
  { key: "ASSIGNMENT_HELP", mark: "HW", label: "Assignment help" },
  { key: "CODE_REVIEW", mark: "CR", label: "Code review" },
  { key: "DEBUG", mark: "DBG", label: "Debug with me" },
];

export default function TutorScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [mode, setMode] = useState<Mode>("CONCEPT");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const [mySessions, myCourses] = await Promise.all([
            api.tutor.listSessions.query(),
            api.course.listMine.query(),
          ]);
          setSessions(mySessions);
          setCourses(myCourses);
          setCourseId((current) => current ?? myCourses[0]?.id ?? null);
        } catch (err) {
          setError(errorMessage(err));
        }
      })();
    }, [])
  );

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const { id } = await api.tutor.createSession.mutate({ mode, courseId });
      router.push(`/session/${id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={styles.heading}>Start a session</Text>
      <View style={styles.modeGrid}>
        {MODES.map((m) => (
          <Pressable
            key={m.key}
            onPress={() => setMode(m.key)}
            style={[styles.modeCard, mode === m.key && styles.modeCardActive]}
          >
            <Text style={[styles.modeMark, mode === m.key && styles.modeMarkActive]}>{m.mark}</Text>
            <Text style={styles.modeLabel}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.heading}>Ground in a course</Text>
      <View style={styles.courseRow}>
        <Pressable
          onPress={() => setCourseId(null)}
          style={[styles.chip, courseId === null && styles.chipActive]}
        >
          <Text style={[styles.chipText, courseId === null && styles.chipTextActive]}>None</Text>
        </Pressable>
        {courses.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setCourseId(c.id)}
            style={[styles.chip, courseId === c.id && styles.chipActive]}
          >
            <Text style={[styles.chipText, courseId === c.id && styles.chipTextActive]}>{c.code}</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={[styles.button, busy && { opacity: 0.6 }]} onPress={start} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? "Starting..." : "Start session"}</Text>
      </Pressable>

      <Text style={[styles.heading, { marginTop: 24 }]}>Past sessions</Text>
      {sessions.map((s) => (
        <Pressable key={s.id} style={styles.sessionCard} onPress={() => router.push(`/session/${s.id}`)}>
          <Text style={styles.sessionTitle} numberOfLines={1}>
            {s.title}
          </Text>
          <Text style={styles.sessionMeta}>
            {s.courseCode ?? "No course"} - {s.mode.replace("_", " ").toLowerCase()}
            {s.mode === "ASSIGNMENT_HELP" && s.tierReached > 0
              ? ` - reached: ${TIER_LABELS[s.tierReached]}`
              : ""}
          </Text>
        </Pressable>
      ))}
      {sessions.length === 0 && <Text style={styles.emptyText}>No sessions yet.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  heading: { fontWeight: "800", fontSize: 16, color: colors.ink, marginBottom: 10, marginTop: 8 },
  modeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  modeCard: {
    width: "47%",
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 2,
    borderColor: colors.slate200,
  },
  modeCardActive: { borderColor: colors.brand600, backgroundColor: colors.brand50 },
  modeMark: {
    alignSelf: "flex-start",
    backgroundColor: colors.paper,
    borderRadius: 7,
    color: colors.brand600,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  modeMarkActive: { backgroundColor: colors.ink, color: colors.white },
  modeLabel: { fontWeight: "700", fontSize: 13, color: colors.ink, marginTop: 8 },
  courseRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.brand600, borderColor: colors.brand600 },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.slate600 },
  chipTextActive: { color: colors.white },
  button: {
    backgroundColor: colors.brand600,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: colors.white, fontWeight: "700", fontSize: 15 },
  error: {
    backgroundColor: colors.rose50,
    color: colors.rose700,
    padding: 10,
    borderRadius: radius.md,
    marginBottom: 10,
    fontSize: 13,
  },
  sessionCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.slate200,
    marginBottom: 10,
  },
  sessionTitle: { fontWeight: "700", fontSize: 14, color: colors.ink },
  sessionMeta: { fontSize: 12, color: colors.slate400, marginTop: 4 },
  emptyText: { color: colors.slate400, fontSize: 13 },
});
