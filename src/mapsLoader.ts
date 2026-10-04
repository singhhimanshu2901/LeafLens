/**
 * Google Maps Platform Loader & Utilities for LeafLens
 * Strictly adheres to google-maps-platform-ghp-integration & maps-javascript-api skills:
 * - Includes mandatory solution tracking attribution: internalUsageAttributionIds: ['gmp_git_agentskills_v1']
 * - Uses dynamic library import (google.maps.importLibrary)
 * - Required user attribution notice: "Google Maps"
 */

export let GOOGLE_MAPS_API_KEY: string = '';

export const GMP_INTERNAL_ATTRIBUTION_ID = 'gmp_git_agentskills_v1';

let loadPromise: Promise<void> | null = null;

export async function resolveGoogleMapsApiKey(): Promise<string> {
  if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.trim() !== '') {
    return GOOGLE_MAPS_API_KEY;
  }

  // Attempt fetching from backend /api/maps/config
  try {
    const res = await fetch('/api/maps/config');
    if (res.ok) {
      const data = await res.json();
      if (data.apiKey && typeof data.apiKey === 'string') {
        GOOGLE_MAPS_API_KEY = data.apiKey;
        return GOOGLE_MAPS_API_KEY;
      }
    }
  } catch (err) {
    console.warn('Could not retrieve Google Maps API key from backend config:', err);
  }

  return GOOGLE_MAPS_API_KEY;
}

export async function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  // Already loaded
  if (window.google?.maps?.importLibrary) {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const apiKey = await resolveGoogleMapsApiKey();

    if (!apiKey) {
      throw new Error(
        'Google Maps API Key not configured. Please set VITE_GOOGLE_MAPS_API_KEY in your environment.'
      );
    }

    // Check if script already on page
    const existing = document.querySelector('script[data-gmp-loader="true"]');
    if (existing) {
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (window.google?.maps?.importLibrary) {
            clearInterval(check);
            resolve();
          }
        }, 50);
      });
      return;
    }

    // Google Maps official bootstrap loader
    await new Promise<void>((resolve, reject) => {
      // prettier-ignore
      ((g: any) => {
        let h: any, a: any, k: any, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b = window as any;
        b[c] = b[c] || {};
        const d = b[c].maps = b[c].maps || {};
        const r = new Set();
        const e = new URLSearchParams();
        u = () => h || (h = new Promise(async (f, n) => {
          a = m.createElement("script");
          a.dataset.gmpLoader = "true";
          e.set("libraries", [...r] + "");
          for (k in g) e.set(k.replace(/[A-Z]/g, (t: string) => "_" + t[0].toLowerCase()), g[k]);
          e.set("callback", c + ".maps." + q);
          a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
          d[q] = f;
          a.onerror = () => n(Error(p + " could not load."));
          a.nonce = (m.querySelector("script[nonce]") as any)?.nonce || "";
          m.head.append(a);
        }));
        var u: any;
        d[l] ? console.warn(p + " only loads once. Ignoring:", g) : d[l] = (f: any, ...n: any[]) => r.add(f) && u().then(() => d[l](f, ...n));
      })({
        key: apiKey,
        v: "weekly",
        libraries: "places,marker,geometry",
      });

      // Wait until importLibrary is ready
      const interval = setInterval(() => {
        if (window.google?.maps?.importLibrary) {
          clearInterval(interval);
          resolve();
        }
      }, 50);

      setTimeout(() => {
        clearInterval(interval);
        if (window.google?.maps?.importLibrary) {
          resolve();
        } else {
          reject(new Error('Google Maps API loading timed out'));
        }
      }, 15000);
    });
  })();

  return loadPromise;
}
