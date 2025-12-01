// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './AuthContext';
import React, { useContext } from 'react';
import Login from './login';
import Register from './register';
import OwnerDashboard from './OwnerDashboard';
import TenantDashboard from './TenantDashboard';

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

const ProtectedRoute = () => {
  const { user } = useContext(AuthContext);
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return user.role === 'owner' ? <OwnerDashboard /> : <TenantDashboard />;
};

export default App;