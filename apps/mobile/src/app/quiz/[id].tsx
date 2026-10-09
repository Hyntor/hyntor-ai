// Native quiz taking: MCQ + written answers, submit, inline results.
import { useCallback, useState } from "react";
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useFocusEffect, useNavigation } from "expo-router";
import { api, errorMessage } from "../../lib/api";
import { colors, radius } from "../../lib/theme";

type QuizPayload = Awaited<ReturnType<typeof api.quiz.get.query>>;
type AttemptPayload = Awaited<ReturnType<typeof api.quiz.attempt.query>>;

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [quiz, setQuiz] = useState<QuizPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AttemptPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void api.quiz.get
        .query({ quizId: id })
        .then((q) => {
          setQuiz(q);
          navigation.setOptions({ title: "Quiz" });
        })
        .catch((err) => setError(errorMessage(err)));
    }, [id, navigation])
  );

  async function submit() {
    if (!quiz) return;
    setBusy(true);
    setError(null);
    try {
      const payload = quiz.questions.map((q) => ({
        questionId: q.id,
        response: answers[q.id] ?? "",
      }));
      const { attemptId } = await api.quiz.submit.mutate({ quizId: id, answers: payload });
      setResult(await api.quiz.attempt.query({ attemptId }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (error && !quiz) return <Text style={styles.error}>{error}</Text>;
  if (!quiz) return <Text style={styles.loading}>Loading...</Text>;

  // ---------- Results view ----------
  if (result) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Your score</Text>
          <Text style={styles.scoreValue}>{result.score}%</Text>
          {result.weakTopics.length > 0 && (
            <Text style={styles.weakTopics}>Revisit: {result.weakTopics.join(", ")}</Text>
          )}
        </View>
        {result.review.map(({ question, answer }, i) => (
          <View
            key={question.id}
            style={[
              styles.card,
              {
                borderLeftWidth: 4,
                borderLeftColor:
                  answer?.correct === true
                    ? "#34d399"
                    : answer?.correct === false
                      ? "#fb7185"
                      : colors.slate200,
              },
            ]}
          >
            <Text style={styles.qMeta}>
              Q{i + 1} -{" "}
              {answer?.correct === true ? "correct" : answer?.correct === false ? "incorrect" : "self-check"}
            </Text>
            <Text style={styles.qPrompt}>{question.prompt}</Text>
            {answer?.feedback ? <Text style={styles.feedback}>{answer.feedback}</Text> : null}
            {question.explanation ? (
              <Text style={styles.explanation}>Why: {question.explanation}</Text>
            ) : null}
          </View>
        ))}
        <Pressable
          style={styles.button}
          onPress={() => {
            setResult(null);
            setAnswers({});
          }}
        >
          <Text style={styles.buttonText}>Retake quiz</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ---------- Taking view ----------
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.title}>{quiz.title}</Text>
      {quiz.questions.map((q, i) => (
        <View key={q.id} style={styles.card}>
          <Text style={styles.qMeta}>
            Question {i + 1} - {q.topic}
          </Text>
          <Text style={styles.qPrompt}>{q.prompt}</Text>
          {q.type === "mcq" && q.options ? (
            q.options.map((option, optionIndex) => (
              <Pressable
                key={optionIndex}
                style={[
                  styles.option,
                  answers[q.id] === String(optionIndex) && styles.optionActive,
                ]}
                onPress={() => setAnswers((prev) => ({ ...prev, [q.id]: String(optionIndex) }))}
              >
                <Text
                  style={[
                    styles.optionText,
                    answers[q.id] === String(optionIndex) && { color: colors.brand700, fontWeight: "700" },
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            ))
          ) : (
            <TextInput
              style={styles.textArea}
              multiline
              placeholder={q.type === "code" ? "Write your code..." : "Your answer..."}
              placeholderTextColor={colors.slate400}
              value={answers[q.id] ?? ""}
              onChangeText={(text) => setAnswers((prev) => ({ ...prev, [q.id]: text }))}
            />
          )}
        </View>
      ))}
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={[styles.button, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? "Grading..." : "Submit & grade"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink, marginBottom: 12 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.slate200,
    marginBottom: 12,
  },
  qMeta: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.slate400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  qPrompt: { fontSize: 15, fontWeight: "600", color: colors.ink, lineHeight: 21 },
  option: {
    borderWidth: 2,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 8,
  },
  optionActive: { borderColor: colors.brand600, backgroundColor: colors.brand50 },
  optionText: { fontSize: 14, color: colors.slate600, lineHeight: 20 },
  textArea: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 10,
    minHeight: 90,
    fontSize: 14,
    color: colors.ink,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: colors.brand600,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: colors.white, fontWeight: "700", fontSize: 15 },
  error: { backgroundColor: colors.rose50, color: colors.rose700, padding: 10, borderRadius: radius.md, marginBottom: 10, fontSize: 13 },
  loading: { margin: 20, color: colors.slate400 },
  scoreCard: {
    backgroundColor: colors.brand950,
    borderRadius: radius.xl,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  scoreLabel: { color: colors.brand300, fontSize: 13 },
  scoreValue: { color: colors.ember400, fontSize: 44, fontWeight: "800" },
  weakTopics: { color: colors.white, fontSize: 13, marginTop: 6, textAlign: "center" },
  feedback: {
    backgroundColor: colors.brand50,
    color: colors.brand900,
    padding: 10,
    borderRadius: radius.md,
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
  },
  explanation: { color: colors.slate500, fontSize: 13, marginTop: 8, lineHeight: 19 },
});
