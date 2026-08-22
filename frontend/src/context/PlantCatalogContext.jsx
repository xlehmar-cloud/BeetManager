import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const PlantCatalogContext = createContext(null);

export function PlantCatalogProvider({ children }) {
  const { user } = useAuth();
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setPlants([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .listPlants()
      .then(({ plants }) => setPlants(plants))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  const plantsById = useMemo(() => Object.fromEntries(plants.map((p) => [p.id, p])), [plants]);

  return (
    <PlantCatalogContext.Provider value={{ plants, plantsById, loading, error }}>
      {children}
    </PlantCatalogContext.Provider>
  );
}

export function usePlantCatalog() {
  const ctx = useContext(PlantCatalogContext);
  if (!ctx) {
    throw new Error('usePlantCatalog muss innerhalb von <PlantCatalogProvider> verwendet werden.');
  }
  return ctx;
}
