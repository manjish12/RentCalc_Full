// src/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // On app load, check localStorage for saved user
  useEffect(() => {
    const savedUser = localStorage.getItem('rentcalc_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Failed to parse saved user');
        localStorage.removeItem('rentcalc_user');
      }
    }
  }, []);

  // Save user to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('rentcalc_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('rentcalc_user');
    }
  }, [user]);

  const login = (userData) => {
    setUser(userData);
    // No redirect here — let the ProtectedRoute handle it
  };

  const logout = () => {
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};