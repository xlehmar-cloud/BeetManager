import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { PlantCatalogProvider } from './context/PlantCatalogContext.jsx';
import './index.css';
import './styles/planner.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PlantCatalogProvider>
          <App />
        </PlantCatalogProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
