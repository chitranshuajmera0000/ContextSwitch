import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../api';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await login(email, password);
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify({ email }));
      window.location.href = '/'; // Hard reload to clear states
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-backdrop" aria-hidden="true"></div>
      <div className="auth-container">
        {/* Branding Hero */}
        <div className="auth-hero">
          <div className="auth-logo-ring">
            <span className="material-symbols-outlined">data_exploration</span>
          </div>
          <div className="auth-brand-name">ContextSwitch</div>
          <div className="auth-brand-sub">Developer Session Tracker</div>
        </div>

        {/* Form Card */}
        <div className="auth-form-card">
           {error && (
             <div className="auth-error-container">
               <span className="material-symbols-outlined text-[18px] text-error">error</span>
               <div className="auth-error-text">{error}</div>
             </div>
           )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label htmlFor="login-email" className="auth-form-label">Email Address</label>
              <div className="auth-field-wrap">
                <span className="material-symbols-outlined auth-field-icon">alternate_email</span>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="name@company.com"
                  required
                  aria-label="Email"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="login-password" className="auth-form-label">Password</label>
              <div className="auth-field-wrap">
                <span className="material-symbols-outlined auth-field-icon">key</span>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="••••••••"
                  required
                  aria-label="Password"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? (
                 <>
                   <span className="spinner"></span>
                   <span>Authenticating...</span>
                 </>
              ) : (
                 <>
                   <span className="material-symbols-outlined">login</span>
                   <span>Sign In</span>
                 </>
              )}
            </button>
            
            <div className="auth-divider">
              <span>secured by contextswitch</span>
            </div>
          </form>

          <div className="text-center mt-2">
            <p className="text-[12px] text-on-surface-variant font-medium">
              New to ContextSwitch? <Link to="/register" className="text-auth-primary hover:underline font-bold ml-1" style={{ color: 'var(--auth-primary)' }}>Create an account</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
