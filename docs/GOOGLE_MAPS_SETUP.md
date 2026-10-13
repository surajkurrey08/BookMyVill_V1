# Google Maps Platform Integration Setup Guide

This guide details the setup, configuration, security, and verification for Google Maps Platform Location Autocomplete in **BookMyVilla**.

---

## 1. Google Cloud Console Setup

To enable Google Maps Location Autocomplete in BookMyVilla, configure your Google Cloud project as follows:

### Step 1: Create or Select a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select an existing project or create a new project (e.g., `BookMyVilla-Production`).

### Step 2: Enable Billing
- A linked billing account is required by Google Maps Platform to activate the APIs.
- Google provides a **$200 monthly credit** on Maps Platform, which covers thousands of autocomplete requests.

### Step 3: Enable the Required APIs
Enable the following APIs in the **APIs & Services > Library**:
1. **Places API** (Required for Places Autocomplete and Place Details)
2. **Maps JavaScript API** (Required for the client-side Google Maps script and services)
3. **Geocoding API** (Recommended fallback for coordinates lookup)

---

## 2. API Key Configuration & Security

### Step 1: Generate an API Key
1. In Google Cloud Console, navigate to **APIs & Services > Credentials**.
2. Click **Create Credentials > API key**.
3. Copy your API key.

### Step 2: Set Application Restrictions (HTTP Referrers)
Because this API key is used in client-side frontend code, you **must** restrict it by HTTP referrers:

- **Local Development**:
  - `http://localhost:*`
  - `http://127.0.0.1:*`
- **Production & Staging**:
  - `https://bookmyvilla.online/*`
  - `https://*.bookmyvilla.online/*`

### Step 3: Set API Restrictions
Under **API restrictions**, choose **Restrict key** and allow only:
- **Maps JavaScript API**
- **Places API**
- **Geocoding API**

---

## 3. Environment Variables Setup

### Frontend Configuration
The frontend reads the API key from Vite environment variables:

```bash
# In frontend/.env (local dev)
VITE_GOOGLE_MAPS_API_KEY=AIzaSy...YourRealKeyHere
```

### Environment Conventions:
- `frontend/.env.example` provides the placeholder:
  ```bash
  VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
  ```
- `root/.env.example` includes build-time variable documentation.
- **Never commit real credentials** to Git. `.env` is ignored in `.gitignore`.

### Docker & CI/CD Deployment
When building the frontend production container with Vite (`npm run build` / `vite build`):
- Vite inlines `VITE_*` variables at **build time**.
- Supply `VITE_GOOGLE_MAPS_API_KEY` as a build argument in Docker or deployment pipeline:
  ```dockerfile
  ARG VITE_GOOGLE_MAPS_API_KEY
  ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
  ```

---

## 4. Architecture & Data Flow

```
+-------------------------------------------------------------------------------+
|                             Customer Search Bar                               |
|        (StaySearchForm on Home / Explore, and Hero search field)             |
+---------------------------------------+---------------------------------------+
                                        |
                   User types query (e.g. "Mahabaleshwar")
                                        |
               +------------------------v------------------------+
               |      googleMaps.js (Singleton Service)          |
               |                                                 |
               | - Lazy-loads Google Maps JS API script once     |
               | - AutocompleteSessionToken for billing bounds   |
               | - Component restriction: country: 'in'          |
               +------------------------+------------------------+
                                        |
                +-----------------------+-----------------------+
                |                                               |
        [Google API Available]                       [API Key Missing / Error]
                |                                               |
  Fetches Google Places Predictions             Falls back to Curated Destinations
  (e.g., Mahabaleshwar, Maharashtra)            (Mahabaleshwar, Panchgani, Lonavala...)
                |                                               |
                +-----------------------+-----------------------+
                                        |
               User selects suggestion or submits manual text
                                        |
           Resolves Place Details / Coordinates (lat, lng, placeId)
                                        |
             Invalidates stale place if user edits input text
                                        |
+---------------------------------------v---------------------------------------+
|                    React Router Navigation to /explore                        |
|                                                                               |
| /explore?search=Mahabaleshwar&placeId=ChIJ...&lat=17.92&lng=73.65&checkIn=... |
+---------------------------------------+---------------------------------------+
                                        |
+---------------------------------------v---------------------------------------+
|                              Explore Stays Page                               |
|                                                                               |
| 1. Reads search, placeId, lat, lng, checkIn, checkOut, guests from URL.      |
| 2. Populates search dock controls.                                           |
| 3. Fetches database properties and merges with local catalog.                |
| 4. Intelligent match (token matching + coordinates proximity within 35km).   |
| 5. Preserves all filters (price, rating, property types, amenities).          |
+-------------------------------------------------------------------------------+
```

---

## 5. Error Handling & Reliability

- **Missing or Invalid API Key**: Autocomplete gracefully displays curated Maharashtra and India destinations (Mahabaleshwar, Panchgani, Lonavala, Khandala, Matheran, Pune, Alibaug, Goa, etc.). The page never crashes or fails to search.
- **Manual Input**: If the user types any custom text without selecting a Google suggestion, searching remains fully functional.
- **Script Failure**: Caught via `onerror` and `window.gm_authFailure` hooks. Diagnostics are logged only in development (`import.meta.env.DEV`) without leaking key strings.
- **Billing Not Activated**: If billing is missing on the Google Cloud project, Google rejects Places requests; the search bar immediately falls back to the local destination catalog.

---

## 6. Testing & Validation Commands

### Frontend Unit Tests
```bash
cd frontend
npm test
```
Tests cover:
- Coordinate validation (`isValidCoordinate`)
- Date range checking (`isValidDateRange`)
- Haversine distance formula (`haversineDistance`)
- Multi-token and coordinate property location matching (`matchesPropertyLocation`)
- Key detection and placeholder rejection (`isGoogleMapsConfigured`)

### Frontend Production Build
```bash
cd frontend
npm run build
```

### Backend Integration & Unit Tests
```bash
cd backend
npm test
```
Validates all 153 backend test suites including query validation and search service parameter checks.
