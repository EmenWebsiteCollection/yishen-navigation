// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import { HomePage } from './pages/HomePage.jsx';
import { CreateWebsitePage } from './pages/CreateWebsitePage.jsx';
import { WebsiteDetailPage } from './pages/WebsiteDetailPage.jsx';
import { EditWebsitePage } from './pages/EditWebsitePage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { CreatorProfilePage } from './pages/CreatorProfilePage.jsx';
import { AboutPage } from './pages/AboutPage.jsx';
import { ChangelogPage } from './pages/ChangelogPage.jsx';
import { ContactPage } from './pages/ContactPage.jsx';
import { ThemeSwitcher } from './components/ThemeSwitcher.jsx';
import { ScrollToTop } from './components/ScrollToTop.jsx';
import { BackToTop } from './components/BackToTop.jsx';
import { useDevice } from './hooks/useDevice.js';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ textAlign: 'center', marginTop: '200px' }}>加载中...</div>;
  return user ? children : <Navigate to="/" replace />;
};

function App() {
  useDevice();
  return (
    <>
      <ScrollToTop />
      <ThemeSwitcher />
      <BackToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/website/:id" element={<WebsiteDetailPage />} />
        <Route
          path="/website/:id/edit"
          element={
            <PrivateRoute>
              <EditWebsitePage />
            </PrivateRoute>
          }
        />
        <Route path="/create" element={<PrivateRoute><CreateWebsitePage /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
        <Route path="/user/:id" element={<CreatorProfilePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/changelog" element={<ChangelogPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
