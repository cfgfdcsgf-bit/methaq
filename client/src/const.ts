export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Kept as a compatibility helper for older screens; sign-in is local now.
export const startLogin = () => {
  if (window.location.pathname !== "/login") window.location.assign("/login");
  return true;
};
