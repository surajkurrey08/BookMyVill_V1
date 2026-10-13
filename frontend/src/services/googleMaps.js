/**
 * Google Maps Platform Service for BookMyVilla
 * Provides singleton loader for Google Maps JavaScript API,
 * Places API (New) autocomplete, and Place Details / Geocoder resolution.
 */

let loadPromise = null;
let authFailed = false;

// Safe key retrieval supporting both Vite build/dev and Node environments
export function getGoogleMapsApiKey() {
  const key =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_GOOGLE_MAPS_API_KEY);
  if (!key || typeof key !== 'string') return '';
  const trimmed = key.trim();
  if (
    trimmed === '' ||
    trimmed === 'your_google_maps_api_key' ||
    trimmed.startsWith('YOUR_')
  ) {
    return '';
  }
  return trimmed;
}

export function isGoogleMapsConfigured() {
  return Boolean(getGoogleMapsApiKey());
}

// Development-only diagnostic logger (never reveals sensitive secrets)
export function logDiagnostic(message, data) {
  const isDev =
    (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production');

  if (isDev) {
    const prefix = '[BookMyVilla Maps]';
    if (data !== undefined) {
      console.info(prefix, message, data);
    } else {
      console.info(prefix, message);
    }
  }
}

/**
 * Loads the Google Maps JavaScript API with Places library once.
 * Reuses the existing promise on concurrent/subsequent calls.
 */
export function loadGoogleMaps() {
  if (authFailed) {
    return Promise.reject(new Error('Google Maps authentication failed (check API key / referrers / billing).'));
  }

  if (window.google?.maps?.places) {
    return Promise.resolve(window.google.maps);
  }

  if (loadPromise) {
    return loadPromise;
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    logDiagnostic('No valid VITE_GOOGLE_MAPS_API_KEY detected. Using local destination fallback.');
    return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not configured'));
  }

  loadPromise = new Promise((resolve, reject) => {
    // Check if script already injected by another component
    const existingScript = document.querySelector('script[data-bmv-google-maps="true"]');
    if (existingScript && window.google?.maps?.places) {
      resolve(window.google.maps);
      return;
    }

    // Google Maps authentication failure hook
    const prevAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
      authFailed = true;
      console.warn(
        '[BookMyVilla Maps] Google Maps API Key authorization failed. ' +
        'Please verify API key restrictions, HTTP referrers, and that Places API is enabled with billing in Google Cloud Console.'
      );
      if (typeof prevAuthFailure === 'function') {
        prevAuthFailure();
      }
      reject(new Error('Google Maps API authentication failed.'));
    };

    const callbackName = '__bmvInitGoogleMaps_' + Date.now();
    window[callbackName] = () => {
      cleanupCallback();
      if (window.google?.maps?.places) {
        logDiagnostic('Google Maps JavaScript API & Places Library loaded successfully.');
        resolve(window.google.maps);
      } else {
        reject(new Error('Google Maps loaded but Places library is missing.'));
      }
    };

    const cleanupCallback = () => {
      try {
        delete window[callbackName];
      } catch {
        window[callbackName] = undefined;
      }
    };

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.setAttribute('data-bmv-google-maps', 'true');

    script.onerror = () => {
      cleanupCallback();
      loadPromise = null;
      console.warn('[BookMyVilla Maps] Failed to load Google Maps script (network or blocked origin). Falling back to local destinations.');
      reject(new Error('Failed to load Google Maps script'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

// Places API (New) classes. The legacy AutocompleteService / PlacesService are
// rejected for projects that only have Places API (New) enabled.
async function loadPlacesLibrary() {
  const maps = await loadGoogleMaps();
  if (typeof maps.importLibrary === 'function') {
    return maps.importLibrary('places');
  }
  return maps.places;
}

/**
 * Creates an autocomplete session token for billing efficiency.
 */
export function createSessionToken() {
  if (window.google?.maps?.places?.AutocompleteSessionToken) {
    return new window.google.maps.places.AutocompleteSessionToken();
  }
  return null;
}

/**
 * Fetches place predictions from Places API (New) AutocompleteSuggestion.
 * Restricts results to India.
 */
export async function getPlacePredictions(input, sessionToken = null) {
  const query = (input || '').trim();
  if (!query || query.length < 2) {
    return [];
  }

  const places = await loadPlacesLibrary();
  if (!places?.AutocompleteSuggestion) {
    logDiagnostic('AutocompleteSuggestion is unavailable in the loaded Places library.');
    return [];
  }

  const request = {
    input: query,
    includedRegionCodes: ['in'],
  };
  if (sessionToken) {
    request.sessionToken = sessionToken;
  }

  try {
    const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
    return (suggestions || [])
      .map((suggestion) => suggestion.placePrediction)
      .filter(Boolean)
      .map((p) => ({
        placeId: p.placeId,
        description: p.text?.text || '',
        mainText: p.mainText?.text || p.text?.text || '',
        secondaryText: p.secondaryText?.text || '',
        types: p.types || [],
        // Kept so details can be fetched within the same autocomplete session
        prediction: p,
      }));
  } catch (error) {
    logDiagnostic('Places autocomplete request failed:', error?.message);
    return [];
  }
}

/**
 * Resolves place details (coordinates, formatted address) for a prediction or place ID.
 * Uses Places API (New) Place.fetchFields with fallback to Geocoder.
 */
export async function getPlaceDetails(placeOrId) {
  const placeId = typeof placeOrId === 'string' ? placeOrId : placeOrId?.placeId;
  if (!placeId) return null;

  const places = await loadPlacesLibrary();

  try {
    // toPlace() ends the autocomplete session; a bare Place is used otherwise
    const place = placeOrId?.prediction?.toPlace
      ? placeOrId.prediction.toPlace()
      : new places.Place({ id: placeId });
    await place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress', 'location'] });
    if (place.location) {
      return {
        placeId: place.id || placeId,
        name: place.displayName || '',
        formattedAddress: place.formattedAddress || '',
        lat: place.location.lat(),
        lng: place.location.lng(),
      };
    }
  } catch (error) {
    logDiagnostic('Place details request failed:', error?.message);
  }

  return new Promise((resolve) => fallbackGeocode(placeId, resolve));
}

/**
 * Finds the best-matching place for free text (e.g. "Villa name, town") using
 * Places API (New) text search. Returns null when nothing matches.
 */
export async function findPlaceByText(textQuery) {
  const query = (textQuery || '').trim();
  if (!query) return null;

  const places = await loadPlacesLibrary();
  if (!places?.Place?.searchByText) return null;

  const { places: results } = await places.Place.searchByText({
    textQuery: query,
    fields: ['displayName', 'formattedAddress', 'location'],
    maxResultCount: 1,
    region: 'in',
  });
  const place = results?.[0];
  if (!place?.location) return null;
  return {
    name: place.displayName || '',
    formattedAddress: place.formattedAddress || '',
    lat: place.location.lat(),
    lng: place.location.lng(),
  };
}

function fallbackGeocode(placeId, resolve) {
  if (!window.google?.maps?.Geocoder) {
    resolve(null);
    return;
  }

  const geocoder = new window.google.maps.Geocoder();
  geocoder.geocode({ placeId }, (results, status) => {
    if (status === 'OK' && results?.[0]?.geometry?.location) {
      const loc = results[0].geometry.location;
      resolve({
        placeId,
        name: results[0].address_components?.[0]?.long_name || '',
        formattedAddress: results[0].formatted_address || '',
        lat: loc.lat(),
        lng: loc.lng(),
      });
    } else {
      resolve(null);
    }
  });
}
