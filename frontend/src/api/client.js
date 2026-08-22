const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const TOKEN_KEY = 'beet-manager-token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = auth ? getToken() : null;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.error || `Anfrage fehlgeschlagen (${res.status})`);
    error.status = res.status;
    error.conflicts = data.conflicts;
    error.strandedPlantings = data.strandedPlantings;
    throw error;
  }

  return data;
}

export const api = {
  register: (email, password) =>
    request('/auth/register', { method: 'POST', body: { email, password }, auth: false }),
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  me: () => request('/me'),

  listPlants: () => request('/plants'),

  listBeds: () => request('/beds'),
  createBed: (data) => request('/beds', { method: 'POST', body: data }),
  getBed: (id) => request(`/beds/${id}`),
  updateBed: (id, data) => request(`/beds/${id}`, { method: 'PUT', body: data }),
  deleteBed: (id) => request(`/beds/${id}`, { method: 'DELETE' }),

  listPlantings: (bedId, year) =>
    request(`/beds/${bedId}/plantings${year ? `?year=${year}` : ''}`),
  createPlanting: (bedId, data) => request(`/beds/${bedId}/plantings`, { method: 'POST', body: data }),
  updatePlanting: (bedId, id, data) =>
    request(`/beds/${bedId}/plantings/${id}`, { method: 'PUT', body: data }),
  deletePlanting: (bedId, id) => request(`/beds/${bedId}/plantings/${id}`, { method: 'DELETE' }),

  listAllPlantings: (year) => request(`/plantings${year ? `?year=${year}` : ''}`),
};
