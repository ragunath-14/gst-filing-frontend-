import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import ThemeToggle from '../components/ThemeToggle';
import { Mail, Lock, Eye, EyeOff, Receipt, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error('Please fill all fields');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-orb orb1"></div>
      <div className="login-bg-orb orb2"></div>

      <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 2 }}>
        <ThemeToggle />
      </div>

      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">
            <Receipt size={26} color="white" />
          </div>
          <div className="login-brand">
            <div className="login-title">GST Manager</div>
            <div className="login-subtitle">Filing Management System</div>
          </div>
        </div>

        <h1 className="login-form-title">Welcome Back</h1>
        <p className="login-form-sub">Sign in to access your GST filing portal</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="search-bar" style={{ padding: '10px 14px' }}>
              <Mail size={16} />
              <input
                type="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                style={{ width: '100%' }}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="search-bar" style={{ padding: '10px 14px' }}>
              <Lock size={16} />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Enter your password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                style={{ width: '100%' }}
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}
            style={{ marginTop: 8, justifyContent: 'center' }}>
            {loading ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div> Signing in...</>
              : <><ArrowRight size={18} /> Sign In</>}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: '14px', background: 'rgba(99,120,255,0.06)', borderRadius: 10, border: '1px solid rgba(99,120,255,0.15)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Demo Credentials
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            <strong>Admin:</strong> admin@gstfiling.com / admin123
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Company users are created by the admin
          </p>
        </div>
      </div>
    </div>
  );
}
