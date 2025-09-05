import React, { useEffect, useState, createContext, useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import EditTournamentScreen from './screens/EditTournamentScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import HomeScreen from './screens/HomeScreen1';
import CasinoDetailScreen from './screens/CasinoDetailScreen';
import TournamentDetailScreen from './screens/TournamentDetailScreen';
import AddTournamentScreen from './screens/AddTournamentScreen';

const Stack = createStackNavigator();

// ---- Auth context (new) ----
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  // One-time check on app start
  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('token');
      setIsLoggedIn(!!token);
      setChecking(false);
    })();
  }, []);

  // These only flip UI; storage is handled in screens/services
  const signIn = () => setIsLoggedIn(true);
  const signOut = () => setIsLoggedIn(false);

  if (checking) return null;

  return (
    <AuthContext.Provider value={{ isLoggedIn, signIn, signOut }}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={isLoggedIn ? 'Home' : 'Login'}>
          {!isLoggedIn ? (
            <>
              <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
              <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Register' }} />
            </>
          ) : (
            <>
              <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Poker Tournament App' }} />
              <Stack.Screen name="CasinoDetail" component={CasinoDetailScreen} options={{ title: 'Casino Details' }} />
              <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} options={{ title: 'Tournament Details' }} />
              <Stack.Screen name="AddTournament" component={AddTournamentScreen} options={{ title: 'Add Tournament' }} />
              <Stack.Screen name="EditTournament" component={EditTournamentScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
