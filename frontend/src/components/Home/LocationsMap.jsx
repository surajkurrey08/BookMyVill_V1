import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mapLayers, mapPlaces, stays, TOWN_CENTER } from './homeData';
import { API_BASE_URL } from '../../config';

const layerIcons = {
  hotels: 'fa-hotel',
  viewpoints: 'fa-binoculars',
  restaurants: 'fa-utensils',
  attractions: 'fa-camera',
};

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const pinIcon = (L, layer, label, active) =>
  L.divIcon({
    className: 'hp-pin-wrap',
    html: `<span class="hp-pin hp-pin--${layer} ${active ? 'is-active' : ''}">
             <span class="hp-pin-dot"><i class="fa-solid ${layerIcons[layer]}"></i></span>
             <span class="hp-pin-label">${escapeHtml(label)}</span>
           </span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });

const LocationsMap = ({ focus }) => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);
  const [layer, setLayer] = useState('hotels');
  const [liveHotels,setLiveHotels]= useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [mapFailed, setMapFailed] = useState(false);
 
  //Fetch real villas from database
  useEffect(()=>{
    fetch(`${API_BASE_URL}/api/properties/all`)
    .then((res)=>res.json())
    .then((data)=>{
      if(Array.isArray(data) && data.length>0 ){
        const formatted = data.map((v)=>({
          id: v._id || v.id,
          name: v.name,
          location: v.location,
          lat: v.coordinates?.lat || 18.6525,
          lon: v.coordinates?.lng || 73.4935,
          rating: Number(v.rating) || 4.9,
          reviewsCount: Number(v.reviewsCount || v.reviewCount) || 85,
          image: v.photos?.[0] || '',
        }));

        setLiveHotels(formatted);
        setSelectedId((prev)=>prev || formatted[0]?.id || null);

      }
    })
    .catch((err)=> console.log('LocationsMap live stays error:', err));

  },[])


  const items = useMemo(() =>  (layer === 'hotels' ? liveHotels : (mapPlaces[layer] || [])), [layer, liveHotels]);
  const selected = items.find((i) => i.id === selectedId) || items[0]|| null;

  // Create the map once.
  useEffect(() => {
    const L = window.L;
    if (!L || !containerRef.current) {
      setMapFailed(true);
      return undefined;
    }
    const map = L.map(containerRef.current, {
      center: TOWN_CENTER,
      zoom: 12,
      scrollWheelZoom: false,
      zoomControl: false,
      attributionControl: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);

    L.marker(TOWN_CENTER, {
      interactive: false,
      icon: L.divIcon({
        className: 'hp-pin-wrap',
        html: '<span class="hp-town-pin"><i class="fa-solid fa-location-dot"></i><span>Mahabaleshwar</span></span>',
        iconSize: [40, 40],
        iconAnchor: [14, 36],
      }),
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      window.removeEventListener('resize', onResize);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Redraw markers whenever the layer or selection changes.
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    const group = markersRef.current;
    if (!L || !map || !group) return;

    group.clearLayers();
    items.forEach((item) => {
      const active = item.id === selected?.id;
      L.marker([item.lat, item.lon], {
        icon: pinIcon(L, layer, item.name, active),
        zIndexOffset: active ? 1000 : 0,
        title: item.name,
      })
        .on('click', () => setSelectedId(item.id))
        .addTo(group);
    });
  }, [items, layer, selected]);

  // Fit the map to the current layer when it changes.
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map) return;
    const bounds = L.latLngBounds(items.map((i) => [i.lat, i.lon]).concat([TOWN_CENTER]));
    // Extra bottom padding keeps pins clear of the info card.
    map.flyToBounds(bounds, { paddingTopLeft: [40, 40], paddingBottomRight: [40, 110], duration: 0.8, maxZoom: 13 });
  }, [items]);

  // Requests from elsewhere on the page: a hero category opens a layer,
  // "Map View" on a stay card focuses that hotel.
  useEffect(() => {
    if (!focus) return;
    if (focus.layer) {
      setLayer(focus.layer);
      setSelectedId(mapPlaces[focus.layer][0].id);
      return;
    }
    setLayer('hotels');
    setSelectedId(focus.id);
    const hotel = stays.find((s) => s.id === focus.id);
    const map = mapRef.current;
    if (hotel && map) {
      map.invalidateSize();
      setTimeout(() => map.flyTo([hotel.lat, hotel.lon], 14, { duration: 1 }), 400);
    }
  }, [focus]);

  const switchLayer = (key) => {
    setLayer(key);
    setSelectedId(key === 'hotels' ? (liveHotels[0]?.id || null) : (mapPlaces[key]?.[0]?.id || null));
  };

  const openDetails = () => {
    if (selected?.id) navigate(`/property/${selected.id}`, { state: { property: selected } });
  };

  return (
    <div className="hp-map-panel hp-reveal" id="hp-map">
      <span className="hp-eyebrow">Find Us Easily</span>
      <h2 className="hp-title">Mahabaleshwar Hotel <span className="hp-gold">Locations</span> Map</h2>
      <p className="hp-lead">Explore hotel locations, nearby attractions and plan your perfect trip.</p>

      <div className="hp-map-card">
        <div className="hp-map-tabs" role="tablist" aria-label="Map layers">
          {mapLayers.map((l) => (
            <button
              key={l.key}
              type="button"
              role="tab"
              aria-selected={layer === l.key}
              className={`hp-map-tab ${layer === l.key ? 'is-active' : ''}`}
              onClick={() => switchLayer(l.key)}
            >
              <i className={`fa-solid ${l.icon}`}></i> {l.label}
            </button>
          ))}
        </div>

        <div className="hp-map-canvas">
          <div ref={containerRef} className="hp-map-leaflet" aria-label="Map of Mahabaleshwar" />
          {mapFailed && (
            <div className="hp-map-fallback">
              <i className="fa-solid fa-map-location-dot"></i>
              <p>Map could not be loaded. Check your connection and refresh.</p>
            </div>
          )}

          {selected && (
            <div className="hp-map-info" key={selected.id}>
              {layer === 'hotels' ? (
                <>
                  <img src={selected.image} alt="" style={selected.imagePosition ? { objectPosition: selected.imagePosition } : undefined} />
                  <div>
                    <strong>{selected.name}</strong>
                    <span className="hp-map-info-sub">{selected.location}</span>
                    <span className="hp-map-info-rate">
                      <i className="fa-solid fa-star"></i> {selected.rating.toFixed(1)} <small>({selected.reviewsCount})</small>
                    </span>
                    <button type="button" className="hp-map-info-btn" onClick={openDetails}>
                      <i className="fa-regular fa-eye"></i> View Details
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className={`hp-map-info-icon hp-pin--${layer}`}>
                    <i className={`fa-solid ${layerIcons[layer]}`}></i>
                  </span>
                  <div>
                    <strong>{selected.name}</strong>
                    <span className="hp-map-info-sub">{selected.note}</span>
                    <a
                      className="hp-map-info-btn"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <i className="fa-solid fa-diamond-turn-right"></i> Directions
                    </a>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationsMap;
