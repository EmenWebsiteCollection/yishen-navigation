// src/App.jsx（完整替换）
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.js';
import { HomePage } from './pages/HomePage.jsx';
import { CreateWebsitePage } from './pages/CreateWebsitePage.jsx';
import { WebsiteDetailPage } from './pages/WebsiteDetailPage.jsx';
import { EditWebsitePage } from './pages/EditWebsitePage.jsx';
import { ThemeSwitcher } from './components/ThemeSwitcher.jsx';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ textAlign: 'center', marginTop: '200px' }}>加载中...</div>;
  return user ? children : <Navigate to="/" replace />;
};

function App() {
  return (
    <>
      <ThemeSwitcher />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;