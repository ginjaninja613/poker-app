import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen from './screens/HomeScreen1';
import CasinoDetailScreen from './screens/CasinoDetailScreen';
import AddTournamentScreen from './screens/AddTournamentScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Poker Tournament App' }}
        />
        <Stack.Screen
          name="CasinoDetail"
          component={CasinoDetailScreen}
          options={{ title: 'Casino Details' }}
        />
        <Stack.Screen
          name="AddTournament"
          component={AddTournamentScreen}
          options={{ title: 'Add Tournament' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
