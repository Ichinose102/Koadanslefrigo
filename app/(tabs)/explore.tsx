import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ 
      headerShown: false, 
      tabBarStyle: { display: 'none' } // 👈 Ceci cache la barre noire en bas
    }}>
      <Tabs.Screen name="index" />
    </Tabs>
  );
}