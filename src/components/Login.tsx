import React, { useState } from 'react';

interface LoginProps {
    onLogin: (username: string, password: string) => void;
    loading: boolean;
    error: string | null;
}

function Login({ onLogin, loading, error }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(username, password);
  };

  return (
    <div className="login-container">
      <h1>Player Tracker Login</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
            required
            aria-required="true"
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            required
            aria-required="true"
          />
        </div>
        <button type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
        {error && <p className="error-message" role="alert">{error}</p>}
        <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '1rem' }}>
          Note: Login is mocked. Enter any details to proceed.
        </p>
      </form>
    </div>
  );
}

export default Login;
