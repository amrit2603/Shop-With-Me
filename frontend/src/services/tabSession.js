export const USER_KEY = "vyumi_tab_user";
export const TOKEN_KEY = "vyumi_tab_token";
export function tabFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "X-Session-Token": sessionStorage.getItem(TOKEN_KEY) || "none",
    },
  });
}
