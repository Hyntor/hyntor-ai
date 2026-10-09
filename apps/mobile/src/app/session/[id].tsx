// Native tutor chat - same tier-badge mechanic as the web app.
import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useFocusEffect, useNavigation } from "expo-router";
import { api, errorMessage } from "../../lib/api";
import { colors, radius, TIER_LABELS } from "../../lib/theme";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tier?: number;
}

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  useFocusEffect(
    useCallback(() => {
      void api.tutor.getSession
        .query({ sessionId: id })
        .then((session) => {
          setMessages(session.messages.map((m) => ({ role: m.role, content: m.content, tier: m.tier })));
          navigation.setOptions({ title: session.course?.code ?? "Tutor" });
        })
        .catch((err) => setError(errorMessage(err)));
    }, [id, navigation])
  );

  async function send() {
    const content = input.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content }]);
    setInput("");
    try {
      const reply = await api.tutor.sendMessage.mutate({ sessionId: id, content });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply.content, tier: reply.tier ?? undefined },
      ]);
    } catch (err) {
      setError(errorMessage(err));
      setMessages((prev) => prev.slice(0, -1));
      setInput(content);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={busy ? [...messages, { role: "assistant" as const, content: "Thinking..." }] : messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.aiBubble]}>
            {typeof item.tier === "number" && (
              <Text style={styles.tierBadge}>
                Tier {item.tier} - {TIER_LABELS[item.tier]}
              </Text>
            )}
            <Text style={item.role === "user" ? styles.userText : styles.aiText}>
              {item.content}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Ask anything about your course. Hints go deeper as you engage - the final answer is
            always yours.
          </Text>
        }
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Ask the tutor..."
          placeholderTextColor={colors.slate400}
          value={input}
          onChangeText={setInput}
          multiline
        />
        <Pressable
          style={[styles.sendButton, (busy || !input.trim()) && { opacity: 0.5 }]}
          onPress={send}
          disabled={busy || !input.trim()}
        >
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  bubble: { borderRadius: radius.lg, padding: 12, maxWidth: "85%" },
  userBubble: { backgroundColor: colors.brand600, alignSelf: "flex-end" },
  aiBubble: {
    backgroundColor: colors.white,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.slate200,
  },
  userText: { color: colors.white, fontSize: 15, lineHeight: 21 },
  aiText: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  tierBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.brand100,
    color: colors.brand700,
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 6,
  },
  emptyText: { color: colors.slate400, textAlign: "center", marginTop: 40, paddingHorizontal: 30, lineHeight: 20 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    maxHeight: 120,
    color: colors.ink,
  },
  sendButton: {
    backgroundColor: colors.brand600,
    width: 58,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  error: {
    backgroundColor: colors.rose50,
    color: colors.rose700,
    padding: 10,
    marginHorizontal: 12,
    borderRadius: radius.md,
    fontSize: 13,
  },
});
