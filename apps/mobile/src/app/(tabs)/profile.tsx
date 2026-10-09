import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "../../lib/api";
import { clearToken } from "../../lib/auth";
import { colors, radius } from "../../lib/theme";

type Me = Awaited<ReturnType<typeof api.user.me.query>>;

export default function ProfileScreen() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useFocusEffect(
    useCallback(() => {
      void api.user.me.query().then(setMe).catch(() => null);
    }, [])
  );

  async function logout() {
    await clearToken();
    router.replace("/login");
  }

  return (
    <View style={styles.screen}>
      {me && (
        <>
          <View style={styles.card}>
            <Text style={styles.name}>{me.name}</Text>
            <Text style={styles.meta}>{me.email}</Text>
            <Text style={styles.meta}>{me.university.name}</Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{me.streakCount}</Text>
              <Text style={styles.statLabel}>day streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{me.xp}</Text>
              <Text style={styles.statLabel}>XP</Text>
            </View>
          </View>
        </>
      )}
      <Pressable style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper, padding: 16 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  name: { fontSize: 20, fontWeight: "800", color: colors.ink },
  meta: { fontSize: 13, color: colors.slate400, marginTop: 3 },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.ink },
  statLabel: { fontSize: 12, color: colors.slate400, marginTop: 4 },
  logout: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.white,
  },
  logoutText: { fontWeight: "700", color: colors.slate600 },
});
