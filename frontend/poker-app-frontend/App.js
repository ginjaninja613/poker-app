// App.js
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import EditTournamentScreen from './screens/EditTournamentScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen1';
import CasinoDetailScreen from './screens/CasinoDetailScreen';
import TournamentDetailScreen from './screens/TournamentDetailScreen';
import AddTournamentScreen from './screens/AddTournamentScreen';
import AdminStaffRequestsScreen from './screens/AdminStaffRequestsScreen';
import ProfileScreen from './screens/ProfileScreen';
import StartTournamentScreen from './screens/StartTournamentScreen'; // ⬅️ NEW

// ⬇️ context (no require cycle)
import { AuthContext } from './context/AuthContext';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleAlign: 'center',
        tabBarActiveTintColor: '#111827',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: { height: 58, paddingBottom: 6 },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Poker Tournament App' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('token');
      setIsLoggedIn(!!token);
      setChecking(false);
    })();
  }, []);

  const signIn = () => setIsLoggedIn(true);
  const signOut = () => setIsLoggedIn(false);

  if (checking) return null;

  return (
    <AuthContext.Provider value={{ isLoggedIn, signIn, signOut }}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={isLoggedIn ? 'Main' : 'Login'}>
          {!isLoggedIn ? (
            <>
              <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
              <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Register' }} />
            </>
          ) : (
            <>
              <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
              <Stack.Screen
                name="AdminStaffRequests"
                component={AdminStaffRequestsScreen}
                options={{ title: 'Staff Requests' }}
              />
              <Stack.Screen
                name="CasinoDetail"
                component={CasinoDetailScreen}
                options={{ title: 'Casino Details' }}
              />
              <Stack.Screen
                name="TournamentDetail"
                component={TournamentDetailScreen}
                options={{ title: 'Tournament Details' }}
              />
              <Stack.Screen
                name="StartTournament" // ⬅️ NEW
                component={StartTournamentScreen}
                options={{ title: 'Tournament Clock' }}
              />
              <Stack.Screen
                name="AddTournament"
                component={AddTournamentScreen}
                options={{ title: 'Add Tournament' }}
              />
              <Stack.Screen name="EditTournament" component={EditTournamentScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
