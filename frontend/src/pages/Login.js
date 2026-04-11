import React, { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useNavigate } from "react-router-dom";
import MangoLeafLogo from "../components/MangoLeafLogo";
import { getApiBaseUrl } from "../utils/apiBase";

const API_BASE_URL = getApiBaseUrl();

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const { lang, switchLang, t } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = isSignUp ? "/register" : "/login";

    try {
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);
      if (isSignUp) {
        formData.append("email", email);
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        setError(errData.detail || (isSignUp ? t('auth', 'registrationFailed') : t('auth', 'invalidCredentials')));
        setLoading(false);
        return;
      }

      const data = await response.json();
      login(data.access_token);
      navigate("/dashboard");
    } catch (err) {
      setError(t('auth', 'serverError'));
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError("");
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <MangoLeafLogo size={48} />
          <h1 className="auth-title">MangoGuard</h1>
          <p className="auth-subtitle">{t('auth', 'subtitle')}</p>
        </div>

        {/* Language toggle on login page */}
        <div className="auth-lang-toggle">
          <div className="lang-toggle">
            <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => switchLang('en')}>EN</button>
            <button className={`lang-btn ${lang === 'am' ? 'active' : ''}`} onClick={() => switchLang('am')}>አማ</button>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>{isSignUp ? t('auth', 'createAccount') : t('auth', 'welcomeBack')}</h2>

          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">{t('auth', 'username')}</label>
            <input
              id="username"
              type="text"
              placeholder={t('auth', 'enterUsername')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          {isSignUp && (
            <div className="form-group">
              <label htmlFor="email">{t('auth', 'email')}</label>
              <input
                id="email"
                type="email"
                placeholder={t('auth', 'enterEmail')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password">{t('auth', 'password')}</label>
            <input
              id="password"
              type="password"
              placeholder={t('auth', 'enterPassword')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? t('auth', 'pleaseWait') : isSignUp ? t('auth', 'signUp') : t('auth', 'signIn')}
          </button>
        </form>

        <div className="auth-footer">
          {isSignUp ? t('auth', 'hasAccount') : t('auth', 'noAccount')}
          <button className="auth-link" type="button" onClick={toggleMode}>
            {isSignUp ? t('auth', 'signIn') : t('auth', 'signUp')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
