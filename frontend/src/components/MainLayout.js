import React, { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import Navbar from './Navbar';
import MobileNav from './MobileNav';
import { useLanguage } from '../context/LanguageContext';

export default function MainLayout() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const token = localStorage.getItem('token');

  // Responsive state
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);

  useEffect(() => {
    if (user?.username === 'admin' && 
        !location.pathname.startsWith('/admin') && 
        !location.pathname.startsWith('/settings')) {
      navigate('/admin');
    }
  }, [user, location.pathname, navigate]);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!token) {
    return <Navigate to="/" />;
  }

  // Determine active tab based on path
  const getActiveTabFromPath = (path) => {
    if (path.startsWith('/dashboard')) return 'home';
    if (path.startsWith('/analysis')) return 'analysis';
    if (path.startsWith('/logs')) return 'logs';
    if (path.startsWith('/settings')) return 'settings';
    if (path.startsWith('/user') || path.startsWith('/profile')) return 'user';
    return 'home';
  };

  const activeTab = getActiveTabFromPath(location.pathname);

  return (
    <div className="dashboard">
      <Navbar activeTab={activeTab} />

      <div className="dashboard-wrapper">
        <div className="subpage-wrapper">
          <Outlet />
        </div>
      </div>

      {!isDesktop && <MobileNav activeTab={activeTab} />}

      <div className="footer">
        {t('footer', 'text')}
      </div>
    </div>
  );
}
