// src/App.jsx
import React, { Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.js";
// 首屏页面保持同步加载，其余页面按需懒加载（路由级 code-split）
import { HomePage } from "./pages/HomePage.jsx";
import { lazyWithRetry } from "./lib/lazyRetry.js";

const CreateWebsitePage = lazyWithRetry(
  () => import("./pages/CreateWebsitePage.jsx"),
  { exportName: "CreateWebsitePage", sourcePath: "src/pages/CreateWebsitePage.jsx" },
);
const WebsiteDetailPage = lazyWithRetry(
  () => import("./pages/WebsiteDetailPage.jsx"),
  { exportName: "WebsiteDetailPage", sourcePath: "src/pages/WebsiteDetailPage.jsx" },
);
const EditWebsitePage = lazyWithRetry(
  () => import("./pages/EditWebsitePage.jsx"),
  { exportName: "EditWebsitePage", sourcePath: "src/pages/EditWebsitePage.jsx" },
);
const ForgotPasswordPage = lazyWithRetry(
  () => import("./pages/ForgotPasswordPage.jsx"),
  { exportName: "ForgotPasswordPage", sourcePath: "src/pages/ForgotPasswordPage.jsx" },
);
const ProfilePage = lazyWithRetry(
  () => import("./pages/ProfilePage.jsx"),
  { exportName: "ProfilePage", sourcePath: "src/pages/ProfilePage.jsx" },
);
const CreatorProfilePage = lazyWithRetry(
  () => import("./pages/CreatorProfilePage.jsx"),
  { exportName: "CreatorProfilePage", sourcePath: "src/pages/CreatorProfilePage.jsx" },
);
const AboutPage = lazyWithRetry(
  () => import("./pages/AboutPage.jsx"),
  { exportName: "AboutPage", sourcePath: "src/pages/AboutPage.jsx" },
);
const ChangelogPage = lazyWithRetry(
  () => import("./pages/ChangelogPage.jsx"),
  { exportName: "ChangelogPage", sourcePath: "src/pages/ChangelogPage.jsx" },
);
const ContactPage = lazyWithRetry(
  () => import("./pages/ContactPage.jsx"),
  { exportName: "ContactPage", sourcePath: "src/pages/ContactPage.jsx" },
);
const IdeaListPage = lazyWithRetry(
  () => import("./pages/IdeaListPage.jsx"),
  { exportName: "IdeaListPage", sourcePath: "src/pages/IdeaListPage.jsx" },
);
const IdeaCreatePage = lazyWithRetry(
  () => import("./pages/IdeaCreatePage.jsx"),
  { exportName: "IdeaCreatePage", sourcePath: "src/pages/IdeaCreatePage.jsx" },
);
const IdeaDetailPage = lazyWithRetry(
  () => import("./pages/IdeaDetailPage.jsx"),
  { exportName: "IdeaDetailPage", sourcePath: "src/pages/IdeaDetailPage.jsx" },
);
const DiscoverPage = lazyWithRetry(
  () => import("./pages/DiscoverPage.jsx"),
  { exportName: "DiscoverPage", sourcePath: "src/pages/DiscoverPage.jsx" },
);
const WorkMapPage = lazyWithRetry(
  () => import("./pages/WorkMapPage.jsx"),
  { exportName: "WorkMapPage", sourcePath: "src/pages/WorkMapPage.jsx" },
);
const FollowListPage = lazyWithRetry(
  () => import("./pages/FollowListPage.jsx"),
  { exportName: "default", sourcePath: "src/pages/FollowListPage.jsx" },
);

import { ThemeSwitcher } from "./components/ThemeSwitcher.jsx";
import { ScrollToTop } from "./components/ScrollToTop.jsx";
import { BackToTop } from "./components/BackToTop.jsx";
import { RouteFallback, RouteErrorBoundary } from "./components/RouteBoundary.jsx";
import { ChunkPrefetch } from "./components/ChunkPrefetch.jsx";
import { useDevice } from "./hooks/useDevice.js";
import { AppShell } from "./components/AppShell.jsx";
import { YiliMascot } from "./components/YiliMascot.jsx";

const PrivateRoute = ({ children }) => {
  const { user, loading, isAnonymous } = useAuth();
  // 不阻塞渲染，让子组件自行处理未登录状态
  if (!loading && (!user || isAnonymous)) return <Navigate to="/" replace />;
  return children;
};

function App() {
  useDevice();
  return (
    <>
      <ScrollToTop />
      <ThemeSwitcher />
      <BackToTop />
      <YiliMascot />
      <ChunkPrefetch />
      <AppShell>
        <AnimatedRoutes />
      </AppShell>
    </>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div className="ym-route-stage" key={location.pathname}>
      <RouteErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes location={location}>
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
            <Route
              path="/create"
              element={
                <PrivateRoute>
                  <CreateWebsitePage />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <ProfilePage />
                </PrivateRoute>
              }
            />
            <Route path="/user/:id" element={<CreatorProfilePage />} />
            <Route path="/user/:id/followers" element={<FollowListPage />} />
            <Route path="/user/:id/following" element={<FollowListPage />} />
            <Route path="/ideas" element={<IdeaListPage />} />
            <Route
              path="/ideas/new"
              element={
                <PrivateRoute>
                  <IdeaCreatePage />
                </PrivateRoute>
              }
            />
            <Route path="/ideas/:id" element={<IdeaDetailPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/changelog" element={<ChangelogPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </div>
  );
}

export default App;
