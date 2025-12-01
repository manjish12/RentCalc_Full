// src/Register.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './register.css';

const Register = () => {
  const [userType, setUserType] = useState('tenant');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    ownerCode: ''
  });
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (!form.name.trim() || !form.password) {
      alert('Name and password are required');
      return;
    }

    if (userType === 'tenant' && !form.ownerCode) {
      alert('Owner code is required for tenants');
      return;
    }

    try {
      const payload = {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        password: form.password,
        role: userType
      };

      if (userType === 'tenant') {
        payload.ownerCode = form.ownerCode;
      }

      const res = await axios.post('http://localhost:5000/api/users', payload);
      alert(`Registration successful! ${userType === 'owner' ? 'Your owner code: ' + res.data.owner_code : ''}`);
      navigate('/login');
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed';
      alert(msg);
    }
  };

  return (
    <div className="register-bg">
      <div className="register-box">
        <h1 className="register-title">Register</h1>
        <form onSubmit={handleSubmit}>
          <label className="register-label" htmlFor="name">Full Name</label>
          <input
            className="register-input"
            type="text"
            id="name"
            placeholder="Full Name"
            value={form.name}
            onChange={handleChange}
            required
          />

          <label className="register-label" htmlFor="password">Password</label>
          <input
            className="register-input"
            type="password"
            id="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
          />

          <label className="register-label" htmlFor="confirmPassword">Confirm Password</label>
          <input
            className="register-input"
            type="password"
            id="confirmPassword"
            placeholder="Confirm Password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
          />

          <label className="register-label" htmlFor="email">Email </label>
          <input
            className="register-input"
            type="email"
            id="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
          />

       

          <div className="register-label" style={{ marginBottom: '0.5rem' }}>User Type</div>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ marginRight: '1.5rem' }}>
              <input
                type="radio"
                name="userType"
                value="owner"
                checked={userType === 'owner'}
                onChange={() => setUserType('owner')}
              /> Owner
            </label>
            <label>
              <input
                type="radio"
                name="userType"
                value="tenant"
                checked={userType === 'tenant'}
                onChange={() => setUserType('tenant')}
              /> Tenant
            </label>
          </div>

          {userType === 'tenant' && (
            <>
              <label className="register-label" htmlFor="ownerCode">Owner Code</label>
              <input
                className="register-input"
                type="text"
                id="ownerCode"
                placeholder="Owner Code"
                value={form.ownerCode}
                onChange={handleChange}
                required
              />
            </>
          )}

          <button className="register-btn" type="submit">Register</button>
        </form>
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <span>Already have an account? </span>
          <Link to="/login" style={{ color: '#3a86ff', textDecoration: 'underline' }}>
            login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;