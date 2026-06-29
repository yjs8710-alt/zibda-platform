export const SITE_ORIGIN = "https://jibda.co.kr";

export const APP_BUILD_VERSION =
  typeof __APP_BUILD_VERSION__ !== "undefined"
    ? __APP_BUILD_VERSION__
    : "SHARE_ROUTE_CACHE_FIX_20260502_02";

export const addMobileFreshParams = (input: string | URL, value = APP_BUILD_VERSION) => {
  const url = new URL(input.toString(), SITE_ORIGIN);
  url.searchParams.set("v", value);
  url.searchParams.set("kakaoFresh", value);
  url.searchParams.set("mobileFresh", value);
  url.searchParams.set("freshAt", `${Date.now()}`);
  return url.toString();
};

export const buildFreshSiteUrl = (path = "/") => {
  return addMobileFreshParams(new URL(path, SITE_ORIGIN));
};