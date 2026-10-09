import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "../../lib/theme";

function TabIcon({ mark, focused }: { mark: string; focused: boolean }) {
  return (
    <Text style={{ color: focused ? colors.brand600 : colors.slate400, fontSize: 12, fontWeight: "800" }}>
      {mark}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.ink,
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: colors.brand600,
        tabBarInactiveTintColor: colors.slate400,
        sceneStyle: { backgroundColor: colors.paper },
      }}
    >
      <Tabs.Screen
        name="courses"
        options={{
          title: "Courses",
          tabBarIcon: ({ focused }) => <TabIcon mark="CR" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tutor"
        options={{
          title: "AI Tutor",
          tabBarIcon: ({ focused }) => <TabIcon mark="AI" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <TabIcon mark="ME" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
