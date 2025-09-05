// frontend/context/AuthContext.js
import React, { createContext, useContext } from 'react';

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
