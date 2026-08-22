import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const PlantCatalogContext = createContext(null);

export function PlantCatalogProvider({ children }) {
  const { user } = useAuth();
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // reload() selbst setzt loading nie auf true — nur der Login-Wechsel unten
  // tut das. reload() wird auch nach jedem Anlegen/Bearbeiten/Löschen einer
  // Pflanze in PlantManager erneut aufgerufen; würde das jedes Mal `loading`
  // kurz auf true setzen, würden sowohl PlantManagers Liste als auch (über
  // catalogLoading) der komplette BedPlanner kurz durch einen Ladetext ersetzt
  // (Flackern bei jedem Klick).
  const reload = useCallback(() => {
    if (!user) {
      setPlants([]);
      return Promise.resolve();
    }
    return api
      .listPlants()
      .then(({ plants }) => setPlants(plants))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    setLoading(true);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const plantsById = useMemo(() => Object.fromEntries(plants.map((p) => [p.id, p])), [plants]);

  return (
    <PlantCatalogContext.Provider value={{ plants, plantsById, loading, error, reload }}>
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
