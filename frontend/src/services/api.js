const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const API_TOKEN = import.meta.env.VITE_API_TOKEN || '';

function authHeaders() {
  return API_TOKEN ? { Authorization: `Token ${API_TOKEN}` } : {};
}

export async function calculateRQ(file) {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_BASE}/rq/calculate/`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });

  const json = await res.json();

  if (!res.ok || json.status === 'error') {
    const err = new Error(json.message || 'Calculation failed');
    err.code = json.code;
    err.details = json;
    throw err;
  }

  return json;
}

export async function calculateQMRA(file) {
  const form = new FormData();
  form.append('file', file);

  const res  = await fetch(`${API_BASE}/qmra/calculate/`, {
    method:  'POST',
    headers: authHeaders(),
    body:    form,
  });

  const json = await res.json();

  if (!res.ok || json.status === 'error') {
    const err   = new Error(json.message || 'QMRA calculation failed');
    err.code    = json.code;
    err.details = json;
    throw err;
  }

  return json;
}

export async function getCompounds() {
  const res = await fetch(`${API_BASE}/compounds/`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch compounds');
  return res.json();
}

export async function getModuleConfig(moduleCode) {
  const res = await fetch(`${API_BASE}/config/${moduleCode}/`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch config for ${moduleCode}`);
  return res.json();
}

export async function getModuleConfigs() {
  const res = await fetch(`${API_BASE}/config/`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch module configs');
  return res.json();
}

export async function validateCAMRI(arbFile, argFile) {
  const form = new FormData();
  if (arbFile) form.append('arb_file', arbFile);
  if (argFile) form.append('arg_file', argFile);

  const res = await fetch(`${API_BASE}/camri/validate/`, {
    method: 'POST', headers: authHeaders(), body: form,
  });
  const json = await res.json();
  if (!res.ok || json.status === 'error') {
    const err = new Error(json.message || 'Validation failed');
    err.code = json.code; err.details = json; throw err;
  }
  return json;
}

export async function calculateCAMRI(arbFile, argFile, alpha = 0.6) {
  const form = new FormData();
  if (arbFile) form.append('arb_file', arbFile);
  if (argFile) form.append('arg_file', argFile);
  form.append('alpha', String(alpha));

  const res = await fetch(`${API_BASE}/camri/calculate/`, {
    method: 'POST', headers: authHeaders(), body: form,
  });
  const json = await res.json();
  if (!res.ok || json.status === 'error') {
    const err = new Error(json.message || 'CAMRI calculation failed');
    err.code = json.code; err.details = json; throw err;
  }
  return json;
}

export async function downloadCAMRITemplate(fileType) {
  const res = await fetch(`${API_BASE}/camri/template/${fileType}/`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Template download failed');
  return res.blob();
}

export async function startSensitivityAnalysis(records, nSim = 10000) {
  const res = await fetch(`${API_BASE}/qmra/sensitivity/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ records, n_sim: nSim }),
  });
  const json = await res.json();
  if (!res.ok || json.status === 'error') {
    throw new Error(json.message || 'Failed to start sensitivity analysis');
  }
  return json;
}

export async function pollSensitivityStatus(taskId) {
  const res = await fetch(`${API_BASE}/qmra/sensitivity/status/${taskId}/`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to poll sensitivity status');
  return res.json();
}
