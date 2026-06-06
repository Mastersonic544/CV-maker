export const BASE_URL = "http://localhost:8000/api";

const request = async (endpoint, options = {}) => {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  };
  const response = await fetch(url, config);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.message || "Something went wrong");
  }
  return data;
};

export const usersClient = {
  // User CRUD
  listUsers: () => request("/users/"),
  getActiveUser: () => request("/users/active"),
  createUser: (name, avatarColor) => request("/users/", { method: "POST", body: JSON.stringify({ name, avatar_color: avatarColor }) }),
  switchUser: (userId) => request(`/users/switch/${userId}`, { method: "POST" }),
  updateUser: (userId, fields) => request(`/users/${userId}`, { method: "PATCH", body: JSON.stringify(fields) }),
  deleteUser: (userId) => request(`/users/${userId}`, { method: "DELETE" }),

  // API Keys
  getApiKeysMeta: (userId) => request(`/users/${userId}/api-keys`),
  getApiKeysDecrypted: (userId) => request(`/users/${userId}/api-keys/export`),
  setApiKey: (userId, keyName, value) => request(`/users/${userId}/api-keys/${keyName}`, { method: "PUT", body: JSON.stringify({ value }) }),
  deleteApiKey: (userId, keyName) => request(`/users/${userId}/api-keys/${keyName}`, { method: "DELETE" }),
  testApiKey: (userId, keyName, value) => request(`/users/${userId}/api-keys/${keyName}/test`, { method: "POST", body: JSON.stringify({ value }) }),

  // Avatar
  uploadAvatar: async (userId, file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE_URL}/users/${userId}/avatar`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Upload failed");
    return data;
  },
  getAvatarUrl: (userId, updatedAt) =>
    `${BASE_URL}/users/${userId}/avatar${updatedAt ? `?v=${updatedAt}` : ""}`,

  // Onboarding
  submitOnboarding: (userId, payload) => request(`/users/${userId}/onboarding`, { method: "POST", body: JSON.stringify(payload) }),

  // Profile JSON management
  getProfileJson: (userId) => request(`/users/${userId}/profile-json`),
  updateProfileJson: (userId, data) => request(`/users/${userId}/profile-json`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProfileSection: (userId, section) => request(`/users/${userId}/profile-json/section`, { method: "DELETE", body: JSON.stringify({ section }) }),
  aiFillProfile: (userId) => request(`/users/${userId}/profile-json/ai-fill`, { method: "POST" }),
  approveAiFields: (userId, field = null) => request(`/users/${userId}/profile-json/approve`, { method: "POST", body: JSON.stringify(field ? { field } : {}) }),
  enrichProfile: (userId, dumpText) => request(`/users/${userId}/enrich`, { method: "POST", body: JSON.stringify({ dump_text: dumpText }) }),
};

export const apiClient = {
  // Profile
  getProfile: () => request("/profile/"),
  updateProfile: (data) => request("/profile/", { method: "PATCH", body: JSON.stringify(data) }),
  getCompleteness: () => request("/profile/completeness"),

  // Discovery
  suggestRoles: () => request("/discovery/suggest-roles"),
  scrapeJobs: (params) => request("/discovery/scrape", { method: "POST", body: JSON.stringify(params) }),
  getTargets: () => request("/discovery/targets"),
  finalizeTargets: (ids) => request("/discovery/targets/finalize", { method: "POST", body: JSON.stringify({ ids }) }),
  addManualTarget: (data) => request("/discovery/targets/manual", { method: "POST", body: JSON.stringify(data) }),
  importJsonTargets: (jsonData) => request("/discovery/targets/import-json", { method: "POST", body: JSON.stringify({ json_data: jsonData }) }),
  updateTarget: (companyId, data) => request(`/discovery/targets/${companyId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTarget: (companyId) => request(`/discovery/targets/${companyId}`, { method: "DELETE" }),

  // Generation
  generateCV: (companyId) => request(`/generation/cv/generate/${companyId}`, { method: "POST" }),
  getCVJson: (companyId) => request(`/generation/cv/json/${companyId}`),
  updateCVJson: (companyId, data) => request(`/generation/cv/${companyId}`, { method: "PATCH", body: JSON.stringify(data) }),
  optimizeCV: (data) => request("/generation/cv/optimize", { method: "POST", body: JSON.stringify(data) }),
  generateCoverLetter: (companyId) => request(`/generation/cover-letter/generate/${companyId}`, { method: "POST" }),
  getCLJson: (companyId) => request(`/generation/cover-letter/json/${companyId}`),
  updateCLJson: (companyId, data) => request(`/generation/cover-letter/${companyId}`, { method: "PATCH", body: JSON.stringify(data) }),
  getApplicationMeta: (companyId) => request(`/generation/meta/${companyId}`),

  // Quick CV — generate a tailored CV straight from a pasted job description
  quickGenerateCV: (jobTitle, jobDescription) =>
    request("/generation/quick/generate", {
      method: "POST",
      body: JSON.stringify({ job_title: jobTitle, job_description: jobDescription }),
    }),
  listQuickCVs: () => request("/generation/quick/list"),
  deleteQuickCV: (companyId) => request(`/generation/quick/${companyId}`, { method: "DELETE" }),
  reorderQuickCVs: (orderedIds) =>
    request("/generation/quick/reorder", { method: "POST", body: JSON.stringify({ ordered_ids: orderedIds }) }),

  // Harvard resume — generated straight from the profile (no job description)
  quickGenerateResume: () => request("/generation/resume/generate", { method: "POST" }),

  getGANIterations: (companyId) => request(`/generation/iterations/${companyId}`),
  explainInsight: (companyId, insightType, insightValue) =>
    request(`/generation/explain/${companyId}`, {
      method: "POST",
      body: JSON.stringify({ insight_type: insightType, insight_value: insightValue }),
    }),

  // Apply
  getApplyStatus: () => request("/apply/status"),
  applyToCompany: (companyId) => request(`/apply/run/${companyId}`, { method: "POST" }),
  getEmailPreview: (companyId) => request(`/apply/email-preview/${companyId}`),
  updateTargetEmail: (companyId, hrEmail) =>
    request(`/apply/targets/${companyId}/email`, { method: "PATCH", body: JSON.stringify({ hr_email: hrEmail }) }),
  fetchHrEmail: (companyId) => request(`/apply/fetch-email/${companyId}`),
  skipAndBlacklist: (companyId) => request(`/apply/targets/${companyId}/skip`, { method: "DELETE" }),
  generateEmail: (companyId) => request(`/apply/email-content/${companyId}/generate`, { method: "POST" }),
  saveEmail: (companyId, subject, body) => request(`/apply/email-content/${companyId}`, { method: "PATCH", body: JSON.stringify({ subject, body }) }),

  // History
  getHistory: () => request("/history/"),
  updateHistoryStatus: (companyId, status) =>
    request(`/history/${companyId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  // Interview
  startInterviewSession: (companyId) => request(`/interview/${companyId}/start`, { method: "POST" }),
  sendInterviewMessage: (companyId, sessionId, message) =>
    request(`/interview/${companyId}/${sessionId}/message`, { method: "POST", body: JSON.stringify({ message }) }),
  endInterviewSession: (companyId, sessionId) => request(`/interview/${companyId}/${sessionId}/end`, { method: "POST" }),
  getInterviewSessions: (companyId) => request(`/interview/${companyId}/sessions`),
  clearInterviewSessions: (companyId) => request(`/interview/${companyId}/sessions`, { method: "DELETE" }),
  getInterviewHelp: (companyId, sessionId) => request(`/interview/${companyId}/${sessionId}/help`, { method: "POST" }),
};
