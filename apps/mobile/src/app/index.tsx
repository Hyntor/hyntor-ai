// Entry gate: if a token is stored AND still valid, go to the app;
// otherwise go to login.
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../lib/api";
import { getToken, clearToken } from "../lib/auth";
import { colors } from "../lib/theme";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      const token = await getToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      try {
        await api.user.me.query(); // validates the token against the API
        router.replace("/(tabs)/courses");
      } catch {
        await clearToken();
        router.replace("/login");
      }
    })();
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand950 }}>
      <ActivityIndicator color={colors.white} size="large" />
    </View>
  );
}
