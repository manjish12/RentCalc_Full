import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from './AuthContext';
import './login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      alert('Please enter email and password');
      return;
    }

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/login`, {
        email: email.trim(),
        password
      });
      login(res.data);
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="login-bg">
      <div className="login-box">
        <h1 className="login-title">Login</h1>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email" className="login-label">Email</label>
          <input
            type="email"
            id="email"
            placeholder="Email"
            className="login-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="password" className="login-label">Password</label>
          <input
            type="password"
            id="password"
            placeholder="Password"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="login-btn">Login</button>
        </form>
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <span>Don't have an account? </span>
          <Link to="/register" style={{ color: '#3a86ff', textDecoration: 'underline' }}>
            Register
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;