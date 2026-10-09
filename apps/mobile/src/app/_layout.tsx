import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../lib/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.white },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: colors.paper },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="course/[id]" options={{ title: "Course" }} />
        <Stack.Screen name="study/[courseId]" options={{ title: "Smart Study" }} />
        <Stack.Screen name="session/[id]" options={{ title: "Tutor" }} />
        <Stack.Screen name="quiz/[id]" options={{ title: "Quiz" }} />
      </Stack>
    </>
  );
}
