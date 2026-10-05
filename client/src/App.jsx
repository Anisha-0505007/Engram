import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Register  from './pages/Register';
import Login     from './pages/Login';
import Dashboard from './pages/Dashboard';

/**
 * App — declares the three routes.
 * There is no global auth context; each protected page calls /api/auth/me
 * itself and redirects to /login if it fails. This keeps things simple
 * for now (no prop-drilling or context API needed yet).
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Navigate to="/dashboard" replace />} />
        <Route path="/register"  element={<Register />} />
        <Route path="/login"     element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
