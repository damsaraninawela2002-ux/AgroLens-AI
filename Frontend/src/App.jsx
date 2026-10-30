import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from "./context/LanguageContext";
import { AuthProvider } from "./context/AuthContext";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import PublicLayout from "./layouts/PublicLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import FarmerDashboard from "./pages/farmer/FarmerDashboard";
import NewScan from "./pages/farmer/NewScan";
import ScanResult from "./pages/farmer/ScanResult";
import ScanHistory from "./pages/farmer/ScanHistory";
import AIAssistant from "./pages/farmer/AIAssistant";
import FarmerProfile from "./pages/farmer/FarmerProfile";
import OfficerDashboard from "./pages/officer/OfficerDashboard";
import ReviewQueue from "./pages/officer/ReviewQueue";
import OfficerReviewDetail from "./pages/officer/OfficerReviewDetail";
import ReviewedCases from "./pages/officer/ReviewedCases";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminApprovals from "./pages/admin/AdminApprovals";
import AdminTreatments from "./pages/admin/AdminTreatments";
import AdminDiagnoses from "./pages/admin/AdminDiagnoses";
import AdminModelPerformance from "./pages/admin/AdminModelPerformance";
import AssistantAnalytics from "./pages/admin/AssistantAnalytics";
import AdminAuditLog from "./pages/admin/AdminAuditLog";
import Security from "./pages/admin/Security";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                borderRadius: "14px",
                background: "#0f172a",
                color: "#f8fafc",
                fontSize: "13px",
                fontWeight: 500,
              },
            }}
          />

          <ErrorBoundary>
            <Routes>
              {/* Public Layout Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Landing />} />
              <Route path="*" element={<NotFound />} />
            </Route>

            {/* Split-Screen Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected Role-Based Dashboard Routes */}
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              {/* Farmer Portal Routes */}
              <Route
                path="/farmer/dashboard"
                element={
                  <RoleRoute allowedRoles={["farmer"]}>
                    <FarmerDashboard />
                  </RoleRoute>
                }
              />
              <Route
                path="/farmer/scan"
                element={
                  <RoleRoute allowedRoles={["farmer"]}>
                    <NewScan />
                  </RoleRoute>
                }
              />
              <Route
                path="/farmer/scan/:id"
                element={
                  <RoleRoute allowedRoles={["farmer"]}>
                    <ScanResult />
                  </RoleRoute>
                }
              />
              <Route
                path="/farmer/history"
                element={
                  <RoleRoute allowedRoles={["farmer"]}>
                    <ScanHistory />
                  </RoleRoute>
                }
              />
              <Route
                path="/farmer/assistant"
                element={
                  <RoleRoute allowedRoles={["farmer"]}>
                    <AIAssistant />
                  </RoleRoute>
                }
              />
              <Route
                path="/farmer/profile"
                element={
                  <RoleRoute allowedRoles={["farmer"]}>
                    <FarmerProfile />
                  </RoleRoute>
                }
              />

              {/* Agricultural Officer Portal Routes */}
              <Route
                path="/officer/dashboard"
                element={
                  <RoleRoute allowedRoles={["officer", "admin"]}>
                    <OfficerDashboard />
                  </RoleRoute>
                }
              />
              <Route
                path="/officer/queue"
                element={
                  <RoleRoute allowedRoles={["officer", "admin"]}>
                    <ReviewQueue />
                  </RoleRoute>
                }
              />
              <Route
                path="/officer/review/:id"
                element={
                  <RoleRoute allowedRoles={["officer", "admin"]}>
                    <OfficerReviewDetail />
                  </RoleRoute>
                }
              />
              <Route
                path="/officer/reviewed"
                element={
                  <RoleRoute allowedRoles={["officer", "admin"]}>
                    <ReviewedCases />
                  </RoleRoute>
                }
              />
              <Route
                path="/officer/assistant"
                element={
                  <RoleRoute allowedRoles={["officer", "admin"]}>
                    <AIAssistant />
                  </RoleRoute>
                }
              />
              <Route
                path="/officer/profile"
                element={
                  <RoleRoute allowedRoles={["officer", "admin"]}>
                    <FarmerProfile />
                  </RoleRoute>
                }
              />

              {/* Admin Panel Routes */}
              <Route
                path="/admin/dashboard"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminOverview />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminUsers />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/approvals"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminApprovals />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/treatments"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminTreatments />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/diagnoses"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminDiagnoses />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/model"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminModelPerformance />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/assistant"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AssistantAnalytics />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/audit-log"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <AdminAuditLog />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/security"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <Security />
                  </RoleRoute>
                }
              />
              <Route
                path="/admin/profile"
                element={
                  <RoleRoute allowedRoles={["admin"]}>
                    <FarmerProfile />
                  </RoleRoute>
                }
              />
            </Route>
          </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}