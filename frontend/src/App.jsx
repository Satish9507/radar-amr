import { Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import RQPage      from "./pages/RQPage";
import QMRAPage    from "./pages/QMRAPage";
import CAMRIPage   from "./pages/CAMRIPage";
import ComingSoon  from "./pages/ComingSoon";

// ─── Route map ────────────────────────────────────────────────────────────────
// To add a new tool in the future:
//   1. Create src/pages/YourToolPage.jsx
//   2. Add a <Route path="/your-tool" element={<YourToolPage />} /> here
//   3. Set active: true for that tool in src/components/NavBar.jsx

export default function App() {
  return (
    <Routes>
      {/* Landing */}
      <Route path="/"      element={<LandingPage />} />

      {/* Active tools */}
      <Route path="/rq"    element={<RQPage />} />

      {/* Coming soon tools */}
      <Route path="/qmra"  element={<QMRAPage />} />
      <Route path="/camri" element={<CAMRIPage />} />
      <Route path="/daly"  element={<ComingSoon tool="QMRA-DALY" desc="Quantitative Microbial Risk Assessment using Disability-Adjusted Life Years" />} />

      {/* Catch-all → redirect home */}
      <Route path="*"      element={<Navigate to="/" replace />} />
    </Routes>
  );
}
