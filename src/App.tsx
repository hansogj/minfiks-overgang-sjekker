import React, { useState, useEffect, useCallback, useRef } from 'react';
import Login from './components/Login';
import Tracker from './components/Tracker';

const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionTimeoutRef = useRef<number | null>(null);

  const handleLogout = useCallback(() => {
    setToken(null);
    localStorage.removeItem('authToken');
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }
  }, []);

  const resetSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }
    sessionTimeoutRef.current = window.setTimeout(() => {
      handleLogout();
      // Optionally, inform the user they have been logged out.
      // You could use a modal or a toast notification for a better UX.
      alert('Your session has expired due to inactivity. Please log in again.');
    }, SESSION_DURATION_MS);
  }, [handleLogout]);

  useEffect(() => {
    if (token) {
      resetSessionTimeout();
    }
    // Cleanup on unmount
    return () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, [token, resetSessionTimeout]);


  const handleLogin = (username: string, password: string) => {
    setLoading(true);
    setError(null);
    // Mocking a successful login after a short delay
    setTimeout(() => {
      if (username && password) {
        const dummyToken = `dummy-token-${Date.now()}`;
        setToken(dummyToken);
        localStorage.setItem('authToken', dummyToken);
      } else {
        setError("Please enter a username and password.");
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="container">
      {token ? (
        <Tracker token={token} onLogout={handleLogout} onActivity={resetSessionTimeout} />
      ) : (
        <Login onLogin={handleLogin} loading={loading} error={error} />
      )}
    </div>
  );
}

export default App;
