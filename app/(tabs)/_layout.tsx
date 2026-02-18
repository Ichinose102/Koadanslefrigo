import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      headerShown: false, 
      tabBarStyle: { display: 'none' } // 👈 Cette ligne cache complètement la barre noire
    }}>
      <Tabs.Screen name="index" />
    </Tabs>
  );
}