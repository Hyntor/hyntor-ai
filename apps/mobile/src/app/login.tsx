import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { api, errorMessage } from "../lib/api";
import { setToken } from "../lib/auth";
import { colors, radius } from "../lib/theme";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setBusy(true);
    setError(null);
    try {
      const { token } = await api.user.mobileLogin.mutate({ email: email.trim(), password });
      await setToken(token);
      router.replace("/(tabs)/courses");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.logo}>
        Course<Text style={{ color: colors.brand500 }}>Mind</Text>
      </Text>
      <Text style={styles.tagline}>Don&apos;t just get the answer. Actually learn it.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>University email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@university.edu"
          placeholderTextColor={colors.slate400}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.slate400}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable
          style={[styles.button, busy && { opacity: 0.6 }]}
          onPress={handleLogin}
          disabled={busy}
        >
          <Text style={styles.buttonText}>{busy ? "Logging in..." : "Log in"}</Text>
        </Pressable>
        <Text style={styles.hint}>
          New here? Create your account on the web app first.{"\n"}Demo: alex@demo.edu / coursemind
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.brand950,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  logo: { fontSize: 32, fontWeight: "800", color: colors.white },
  tagline: { color: colors.brand300, marginTop: 6, marginBottom: 28, textAlign: "center" },
  card: {
    width: "100%",
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 20,
  },
  label: { fontSize: 13, fontWeight: "600", color: colors.slate600, marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
  },
  error: {
    backgroundColor: colors.rose50,
    color: colors.rose700,
    padding: 10,
    borderRadius: radius.md,
    marginTop: 12,
    fontSize: 13,
  },
  button: {
    backgroundColor: colors.brand600,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: { color: colors.white, fontWeight: "700", fontSize: 15 },
  hint: { color: colors.slate400, fontSize: 12, textAlign: "center", marginTop: 14, lineHeight: 18 },
});
