declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

window.dataLayer = window.dataLayer || [];
window.gtag = (...args: unknown[]) => {
  window.dataLayer?.push(args);
};

window.gtag("js", new Date());
window.gtag("config", "G-YSSHTK2DYC");

export {};
