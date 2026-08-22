import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Beete from './pages/Beete.jsx';
import BedPlanner from './pages/BedPlanner.jsx';
import Overview from './pages/Overview.jsx';
import PlantManager from './pages/PlantManager.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="loading">Lade…</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Beete />
          </ProtectedRoute>
        }
      />
      <Route
        path="/beete/:bedId"
        element={
          <ProtectedRoute>
            <BedPlanner />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kalender"
        element={
          <ProtectedRoute>
            <Overview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pflanzen"
        element={
          <ProtectedRoute>
            <PlantManager />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
