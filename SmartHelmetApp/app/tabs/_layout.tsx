import { Tabs } from 'expo-router';
import { Home, Trash2, Car, Activity, Settings, AlertTriangle } from 'lucide-react-native';
import { View } from 'react-native';

import { useColorScheme } from 'nativewind';

export default function TabLayout() {
  const { colorScheme } = useColorScheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colorScheme === 'dark' ? '#ffffff' : '#000000',
        tabBarInactiveTintColor: '#94a3b8',
      }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="traffic"
        options={{
          title: 'Traffic',
          tabBarIcon: ({ color }) => <Car size={24} color={color} />,
          href: null
        }}
      />
      <Tabs.Screen
        name="waste"
        options={{
          title: 'Waste',
          tabBarIcon: ({ color }) => <Trash2 size={24} color={color} />
        }}
      />
      <Tabs.Screen
        name="potholes"
        options={{
          title: 'Potholes',
          tabBarIcon: ({ color }) => <AlertTriangle size={24} color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="impact"
        options={{
          title: 'Impact',
          tabBarIcon: ({ color }) => <Activity size={24} color={color} />,
          // href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="location"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
