// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import { HomePage } from './pages/HomePage.jsx';
import { CreateWebsitePage } from './pages/CreateWebsitePage.jsx';
import { WebsiteDetailPage } from './pages/WebsiteDetailPage.jsx';
import { EditWebsitePage } from './pages/EditWebsitePage.jsx';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { CreatorProfilePage } from './pages/CreatorProfilePage.jsx';
import { AboutPage } from './pages/AboutPage.jsx';
import { ChangelogPage } from './pages/ChangelogPage.jsx';
import { ContactPage } from './pages/ContactPage.jsx';
import { IdeaListPage } from './pages/IdeaListPage.jsx';
import { IdeaCreatePage } from './pages/IdeaCreatePage.jsx';
import { IdeaDetailPage } from './pages/IdeaDetailPage.jsx';
import { DiscoverPage } from './pages/DiscoverPage.jsx';
import { WorkMapPage } from './pages/WorkMapPage.jsx';
import { ThemeSwitcher } from './components/ThemeSwitcher.jsx';
import { TechLoader } from './components/TechLoader.jsx';
import { ScrollToTop } from './components/ScrollToTop.jsx';
import { BackToTop } from './components/BackToTop.jsx';
import { useDevice } from './hooks/useDevice.js';
import { AppShell } from './components/AppShell.jsx';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '200px' }}><TechLoader text="加载中..." /></div>;
  return user ? children : <Navigate to="/" replace />;
};

function App() {
  useDevice();
  return (
    <>
      <ScrollToTop />
      <ThemeSwitcher />
      <BackToTop />
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/website/:id" element={<WebsiteDetailPage />} />
          <Route path="/work/:id/map" element={<WorkMapPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
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
          <Route path="/ideas" element={<IdeaListPage />} />
          <Route path="/ideas/new" element={<PrivateRoute><IdeaCreatePage /></PrivateRoute>} />
          <Route path="/ideas/:id" element={<IdeaDetailPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </>
  );
}

export default App;
