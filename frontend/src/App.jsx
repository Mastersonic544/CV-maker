import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Discovery from './pages/Discovery';
import Review from './pages/Review';
import Apply from './pages/Apply';
import Interview from './pages/Interview';
import Landing from './pages/Landing';
import ProfileSelector from './pages/ProfileSelector';
import Onboarding from './pages/Onboarding';
import SetupApis from './pages/SetupApis';
import ProfileManagement from './pages/ProfileManagement';
import { ThemeProvider } from './contexts/ThemeContext';
import { I18nProvider } from './contexts/I18nContext';

const USER_KEY = 'cvmaker_active_user';

// Wraps all main app routes — redirects to /profile-selector if no active user
const AppLayout = () => {
  const navigate = useNavigate();
  const userId = localStorage.getItem(USER_KEY);

  useEffect(() => {
    if (!userId) navigate('/profile-selector', { replace: true });
  }, [userId, navigate]);

  if (!userId) return null;

  return (
    <Layout>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/discover" element={<Discovery />} />
        <Route path="/review" element={<Review />} />
        <Route path="/apply" element={<Apply />} />
        <Route path="/interview/:companyId" element={<Interview />} />
        <Route path="/interview" element={<Interview />} />
        <Route path="/profile-management" element={<ProfileManagement />} />
      </Routes>
    </Layout>
  );
};

const App = () => (
  <ThemeProvider>
    <I18nProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public pages — no auth required */}
          <Route path="/" element={<Landing />} />
          <Route path="/profile-selector" element={<ProfileSelector />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/setup-apis" element={<SetupApis />} />
          {/* Protected app shell */}
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </Router>
    </I18nProvider>
  </ThemeProvider>
);

export default App;
