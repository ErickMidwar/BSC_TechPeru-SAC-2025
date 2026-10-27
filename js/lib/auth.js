import { compliance } from "./constants.js";

let currentUser = null;
let authToken = null;

export function getUser() { return currentUser; }
export function getToken() { return authToken; }

export function saveSession(token, user) {
  authToken = token;
  currentUser = user;
  sessionStorage.setItem("bsc_token", token);
  sessionStorage.setItem("bsc_user", JSON.stringify(user));
}

export function clearSession() {
  authToken = null;
  currentUser = null;
  sessionStorage.removeItem("bsc_token");
  sessionStorage.removeItem("bsc_user");
}

export function restoreSession() {
  const t = sessionStorage.getItem("bsc_token");
  const u = sessionStorage.getItem("bsc_user");
  if (t && u) {
    authToken = t;
    currentUser = JSON.parse(u);
    return true;
  }
  return false;
}

export function canEdit() {
  return currentUser && compliance.canEditStrategy(currentUser.rol);
}

export function canMeasure() {
  return currentUser && compliance.canMeasure(currentUser.rol);
}

export function canApprove() {
  return currentUser && compliance.canApproveMeasurement(currentUser.rol);
}

export function canAdmin() {
  return currentUser && compliance.canAdmin(currentUser.rol);
}
