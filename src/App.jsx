// src/App.jsx
import React, { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.js";
// 首屏页面保持同步加载，其余页面按需懒加载（路由级 code-split）
import { HomePage } from "./pages/HomePage.jsx";

const CreateWebsitePage = lazy(() =>
  import("./pages/CreateWebsitePage.jsx").then((m) => ({
    default: m.CreateWebsitePage,
  })),
);
const WebsiteDetailPage = lazy(() =>
  import("./pages/WebsiteDetailPage.jsx").then((m) => ({
    default: m.WebsiteDetailPage,
  })),
);
const EditWebsitePage = lazy(() =>
  import("./pages/EditWebsitePage.jsx").then((m) => ({
    default: m.EditWebsitePage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import("./pages/ForgotPasswordPage.jsx").then((m) => ({
    default: m.ForgotPasswordPage,
  })),
);
const ProfilePage = lazy(() =>
  import("./pages/ProfilePage.jsx").then((m) => ({ default: m.ProfilePage })),
);
const CreatorProfilePage = lazy(() =>
  import("./pages/CreatorProfilePage.jsx").then((m) => ({
    default: m.CreatorProfilePage,
  })),
);
const AboutPage = lazy(() =>
  import("./pages/AboutPage.jsx").then((m) => ({ default: m.AboutPage })),
);
const ChangelogPage = lazy(() =>
  import("./pages/ChangelogPage.jsx").then((m) => ({
    default: m.ChangelogPage,
  })),
);
const ContactPage = lazy(() =>
  import("./pages/ContactPage.jsx").then((m) => ({ default: m.ContactPage })),
);
const IdeaListPage = lazy(() =>
  import("./pages/IdeaListPage.jsx").then((m) => ({ default: m.IdeaListPage })),
);
const IdeaCreatePage = lazy(() =>
  import("./pages/IdeaCreatePage.jsx").then((m) => ({
    default: m.IdeaCreatePage,
  })),
);
const IdeaDetailPage = lazy(() =>
  import("./pages/IdeaDetailPage.jsx").then((m) => ({
    default: m.IdeaDetailPage,
  })),
);
const DiscoverPage = lazy(() =>
  import("./pages/DiscoverPage.jsx").then((m) => ({ default: m.DiscoverPage })),
);
const WorkMapPage = lazy(() =>
  import("./pages/WorkMapPage.jsx").then((m) => ({ default: m.WorkMapPage })),
);

import { ThemeSwitcher } from "./components/ThemeSwitcher.jsx";
import { ScrollToTop } from "./components/ScrollToTop.jsx";
import { BackToTop } from "./components/BackToTop.jsx";
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
      <Suspense fallback={null}>
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
    </div>
  );
}

export default App;
