import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../api';

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    setLoading(true);
    setError('');
    try {
      const res = await register(email, password);
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify({ email }));
      window.location.href = '/'; 
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
            <span className="material-symbols-outlined">person_add</span>
          </div>
          <div className="auth-brand-name">ContextSwitch</div>
          <div className="auth-brand-sub">Create your account</div>
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
              <label htmlFor="register-email" className="auth-form-label">Email Address</label>
              <div className="auth-field-wrap">
                <span className="material-symbols-outlined auth-field-icon">alternate_email</span>
                <input
                  id="register-email"
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
              <label htmlFor="register-password" className="auth-form-label">Password</label>
              <div className="auth-field-wrap">
                <span className="material-symbols-outlined auth-field-icon">key</span>
                <input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="Choose a strong password"
                  required
                  aria-label="Password"
                />
              </div>
            </div>

            <div>
              <label htmlFor="register-confirm" className="auth-form-label">Confirm Password</label>
              <div className="auth-field-wrap">
                <span className="material-symbols-outlined auth-field-icon">key</span>
                <input
                  id="register-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field"
                  placeholder="Repeat your password"
                  required
                  aria-label="Confirm password"
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
                   <span>Creating account...</span>
                 </>
              ) : (
                 <>
                   <span className="material-symbols-outlined">person_add</span>
                   <span>Get Started</span>
                 </>
              )}
            </button>
            
            <div className="auth-divider">
              <span>secured by contextswitch</span>
            </div>
          </form>

          <div className="text-center mt-2">
            <p className="text-[12px] text-on-surface-variant font-medium">
              Already have an account? <Link to="/login" className="text-auth-primary hover:underline font-bold ml-1" style={{ color: 'var(--auth-primary)' }}>Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
