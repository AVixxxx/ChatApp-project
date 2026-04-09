import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "@/features/auth/pages/LoginPage";
import RegisterPage from "@/features/auth/pages/RegisterPage";
import ForgotPasswordPage from "@/features/auth/pages/ForgotPasswordPage";
import HomePage from "@/features/chat/pages/HomePage";
import ContactsPage from "@/features/contacts/pages/ContactsPage";
import ProfilePage from "@/features/profile/pages/ProfilePage";
import OnboardingPage from "@/pages/OnboardingPage";
import SplashPage from "@/pages/SplashPage";
import ProtectedRoute from "@/routes/ProtectedRoute";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<SplashPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/contacts"
        element={
          <ProtectedRoute>
            <ContactsPage />
          </ProtectedRoute>
        }
      />

      <Route path="/friend-profile" element={<Navigate to="/contacts" replace />} />
    </Routes>
  );
}

export default AppRoutes;
