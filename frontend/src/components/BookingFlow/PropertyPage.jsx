import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { setStructuredData, updateSeoMetadata } from '../../utils/seoMetadata';
import Gallery from './Gallery';
import PropertyMap from './PropertyMap';
import { Amenity, Breadcrumb, DateGuestFields, FlowShell, Notice, addDays, bookingApi, icon, propertyPhotos, queryFor, today, useProperty } from './shared';
import { API_BASE_URL } from '../../config';

// Blue tick: verified by BookMyVilla (managed villas, or owners Admin has verified).
export function VerifiedTick() {
  return <span className="bf-verified" title="Verified by BookMyVilla" aria-label="Verified by BookMyVilla">{icon('circle-check')}<span>Verified</span></span>;
}

export default function PropertyPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { property, loading, error, bookable } = useProperty(id);
  const [search, setSearch] = useState(() => ({
    checkIn: params.get('checkIn') || addDays(today(), 1),
    checkOut: params.get('checkOut') || addDays(today(), 3),
    guests: Math.max(1, Number(params.get('guests')) || 2)
  }));
  const [rooms, setRooms] = useState([]);
  const [roomError, setRoomError] = useState('');
  const [activeTab, setActiveTab] = useState('Overview');
  const [saved, setSaved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('bookmyvilla-explore-favorites') || '[]').some(value => String(value) === String(id));
    } catch {
      return false;
    }
  });
  const [copied, setCopied] = useState(false);
  const photos = propertyPhotos(property);
  const amenities = Array.isArray(property?.amenities) ? property.amenities : [];

  // Enquiry form state
  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryPhone, setEnquiryPhone] = useState('');
  const [enquiryEmail, setEnquiryEmail] = useState('');
  const [enquiryMessage, setEnquiryMessage] = useState('');
  const [enquirySending, setEnquirySending] = useState(false);
  const [enquirySuccess, setEnquirySuccess] = useState(false);
  const [enquiryError, setEnquiryError] = useState('');

  const nights = Math.max(1, Math.round((new Date(`${search.checkOut}T12:00:00`) - new Date(`${search.checkIn}T12:00:00`)) / 86400000) || 1);

  useEffect(() => {
    if (!property) return;

    const location = property.location || 'Maharashtra';
    const propertyName = property.name || 'Villa';
    const description = `Explore ${propertyName} in ${location}. View amenities, guest details and submit an enquiry with BookMyVilla.`;

    updateSeoMetadata({
      title: `${propertyName} in ${location} | BookMyVilla`,
      description,
      canonicalUrl: `https://bookmyvilla.online/property/${encodeURIComponent(id)}`,
      shouldIndex: true
    });
  }, [id, property]);

  // Rich-result data for Google.
  useEffect(() => {
    if (!property?.name) return undefined;
    const images = propertyPhotos(property).filter(src => /^https?:\/\//.test(src)).slice(0, 5);
    const hasCoords = Number.isFinite(Number(property.coordinates?.lat)) && Number.isFinite(Number(property.coordinates?.lng));
    setStructuredData('villa', {
      '@context': 'https://schema.org',
      '@type': 'LodgingBusiness',
      name: property.name,
      url: `https://bookmyvilla.online/property/${encodeURIComponent(id)}`,
      ...(property.description && { description: property.description }),
      ...(images.length && { image: images }),
      address: { '@type': 'PostalAddress', addressLocality: property.location || 'Maharashtra', addressRegion: 'Maharashtra', addressCountry: 'IN' },
      ...(hasCoords && { geo: { '@type': 'GeoCoordinates', latitude: Number(property.coordinates.lat), longitude: Number(property.coordinates.lng) } }),
      ...(Array.isArray(property.amenities) && property.amenities.length && { amenityFeature: property.amenities.slice(0, 20).map(name => ({ '@type': 'LocationFeatureSpecification', name, value: true })) }),
      ...(Number(property.rating) > 0 && Number(property.reviewsCount) > 0 && { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(property.rating), reviewCount: Number(property.reviewsCount) } })
    });
    return () => setStructuredData('villa', null);
  }, [id, property]);

  const unit = rooms.length >= 1 ? rooms[0] : (property ? {
    _id: property._id || property.id || `unit-${id}`,
    name: property.name || 'Entire Villa',
    number: 'ENTIRE',
    type: 'Entire villa',
    capacity: property.details?.guestCapacity || 12,
    status: 'available',
  } : null);

  useEffect(() => {
    if (!bookable) return undefined;
    const controller = new AbortController();
    bookingApi(`/properties/${id}/rooms?${queryFor(search)}`, { signal: controller.signal })
      .then(data => {
        const roomList = Array.isArray(data?.rooms) ? data.rooms : [];
        setRooms(roomList.filter(room => room?.active !== false));
        setRoomError('');
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setRooms([]);
          setRoomError(err.message);
        }
      });
    return () => controller.abort();
  }, [id, bookable, search]);

  const handleSendEnquiry = async (e) => {
    e?.preventDefault();
    if (!enquiryName.trim() || !enquiryPhone.trim()) {
      setEnquiryError('Please enter your Name and WhatsApp/Phone number.');
      return;
    }
    const cleanPhone = enquiryPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setEnquiryError('Please enter a valid 10-digit mobile / WhatsApp number.');
      return;
    }

    setEnquirySending(true);
    setEnquiryError('');
    try {
      const summaryMsg = `Customer Enquiry for ${property?.name || 'Villa'} (${property?.location || 'Maharashtra'}). Stay: ${nights} night(s) (Check-in: ${search.checkIn}, Check-out: ${search.checkOut}) for ${search.guests} guest(s). ${enquiryMessage ? 'Requirements: ' + enquiryMessage : ''}`.trim();

      const targetUrl = API_BASE_URL ? `${API_BASE_URL}/api/partner/inquiry` : '/api/partner/inquiry';
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: enquiryName.trim(),
          phone: cleanPhone,
          email: enquiryEmail.trim() || 'guest@bookmyvilla.online',
          propertyName: property?.name || 'Villa Stay',
          city: property?.location || 'Maharashtra',
          message: summaryMsg
        })
      });

      const contentType = res.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => ({}));
      } else {
        const text = await res.text().catch(() => '');
        throw new Error(text && !text.startsWith('<') ? text : 'Could not reach backend server. Please verify backend is running on port 2001.');
      }

      if (!res.ok) throw new Error(data.msg || 'Could not submit enquiry.');
      setEnquirySuccess(true);
    } catch (err) {
      setEnquiryError(err.message || 'Could not send enquiry right now. Please try again.');
    } finally {
      setEnquirySending(false);
    }
  };

  const scrollToEnquiry = () => {
    document.querySelector('.bf-property-booking')?.scrollIntoView({ behavior: 'smooth' });
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const toggleSaved = () => {
    try {
      const current = JSON.parse(localStorage.getItem('bookmyvilla-explore-favorites') || '[]');
      const next = saved ? current.filter(value => String(value) !== String(id)) : [...new Set([...current, id])];
      localStorage.setItem('bookmyvilla-explore-favorites', JSON.stringify(next));
    } catch { /* Browser storage can be unavailable */ }
    setSaved(value => !value);
  };

  const tabTargets = {
    Overview: 'bf-overview',
    'The Villa': 'bf-rooms',
    Amenities: 'bf-amenities',
    'Property Highlights': 'bf-highlights',
    'House Rules': 'bf-rules',
    Location: 'bf-location',
    'Nearby Places': 'bf-nearby',
    'Guest Reviews': 'bf-reviews'
  };

  const selectTab = tab => {
    setActiveTab(tab);
    const target = document.getElementById(tabTargets[tab]);
    if (!target) return;
    clearTimeout(window.__bfFlashTimer);
    document.querySelectorAll('.bf-flash').forEach(node => node.classList.remove('bf-flash'));
    void target.offsetWidth;
    target.classList.add('bf-flash');
    window.__bfFlashTimer = setTimeout(() => target.classList.remove('bf-flash'), 3200);
  };

  return (
    <FlowShell>
      <Breadcrumb items={[{ label: 'Explore Stays', to: '/explore' }, { label: property?.name || 'Property' }]} />
      {error && <Notice tone="error">{error}</Notice>}
      {loading && !property ? (
        <div className="bf-panel bf-loading">Loading this stay…</div>
      ) : !property ? (
        <div className="bf-panel bf-empty">
          <h1>Stay not found</h1>
          <Link to="/explore">Explore stays</Link>
        </div>
      ) : (
        <>
          <div className="bf-detail-grid">
            <div className="bf-detail-main">
              <Gallery
                photos={photos}
                name={property.name}
                badge={
                  <span className="bf-rating-badge">
                    {property.rating ? `★ ${Number(property.rating).toFixed(1)}${property.reviewsCount ? ` (${property.reviewsCount})` : ''}` : property.verified ? <>{icon('circle-check')} Verified stay</> : 'Explore this stay'}
                  </span>
                }
              />
              {amenities.length > 0 && (
                <div className="bf-amenity-strip" id="bf-amenities">
                  {amenities.slice(0, 5).map(label => <Amenity key={label} label={label} />)}
                </div>
              )}
            </div>

            <aside className="bf-panel bf-property-booking" style={{ padding: '14px 16px', maxHeight: 'calc(100vh - 85px)', overflowY: 'auto' }}>
              <div className="bf-title-actions">
                <h1 style={{ fontSize: '1.25rem', margin: 0, lineHeight: 1.25 }}>{property.name}{property.verified && <VerifiedTick />}</h1>
                <div>
                  <button type="button" onClick={toggleSaved} aria-label={saved ? 'Remove saved stay' : 'Save stay'}>
                    {icon('heart')} <span>{saved ? 'Saved' : 'Save'}</span>
                  </button>
                  <button type="button" onClick={share}>
                    {icon('share-nodes')} <span>{copied ? 'Copied' : 'Share'}</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', margin: '6px 0 8px' }}>
                <p className="bf-location" style={{ margin: 0, fontSize: '0.8rem' }}>{icon('location-dot')} {property.location || 'Maharashtra'}</p>
                {property.rating && (
                  <p className="bf-rating" style={{ margin: 0, fontSize: '0.8rem' }}>
                    ★ <strong>{Number(property.rating).toFixed(1)}</strong> {property.reviewsCount ? `(${property.reviewsCount})` : ''}
                  </p>
                )}
                <span style={{ fontSize: '0.7rem', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '2px 7px', borderRadius: '5px', fontWeight: 600 }}>
                  Whole Villa Stay
                </span>
              </div>

              <DateGuestFields {...search} onChange={setSearch} compact={true} />

              {enquirySuccess ? (
                <div style={{ background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '10px', padding: '1rem', marginTop: '0.65rem', color: '#065f46' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>✓</span>
                    <strong style={{ fontSize: '1rem' }}>Enquiry Received!</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.84rem', lineHeight: '1.4', color: '#047857' }}>
                    Thank you <strong>{enquiryName}</strong>. Our villa reservations team will contact you via WhatsApp / Phone shortly with dates availability and customized package tariffs.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setEnquirySuccess(false); setEnquiryMessage(''); }}
                    style={{ marginTop: '0.65rem', background: '#059669', color: '#fff', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                  >
                    Send Another Request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendEnquiry} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.55rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.45rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#374151' }}>Your Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rahul Sharma"
                        value={enquiryName}
                        onChange={e => setEnquiryName(e.target.value)}
                        style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#374151' }}>WhatsApp / Mobile *</label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 9876543210"
                        value={enquiryPhone}
                        onChange={e => setEnquiryPhone(e.target.value)}
                        style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.45rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#374151' }}>Email (Optional)</label>
                      <input
                        type="email"
                        placeholder="e.g. rahul@gmail.com"
                        value={enquiryEmail}
                        onChange={e => setEnquiryEmail(e.target.value)}
                        style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#374151' }}>Special Request</label>
                      <input
                        type="text"
                        placeholder="e.g. Cook, Pool party"
                        value={enquiryMessage}
                        onChange={e => setEnquiryMessage(e.target.value)}
                        style={{ padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  {enquiryError && <Notice tone="error">{enquiryError}</Notice>}

                  <button
                    type="submit"
                    disabled={enquirySending}
                    className="bf-primary"
                    style={{ width: '100%', padding: '0.6rem 1rem', fontSize: '0.92rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.2rem', borderRadius: '8px' }}
                  >
                    {enquirySending ? 'Sending Enquiry…' : 'Send Enquiry Now'}
                  </button>
                </form>
              )}

              <div className="bf-trust-row" style={{ marginTop: '0.5rem', fontSize: '0.68rem', opacity: 0.85 }}>
                <span>{icon('shield-halved')} Verified Villa</span>
                <span>{icon('calendar-days')} Fast WhatsApp Reply</span>
                <span>{icon('headset')} Direct Management</span>
              </div>
            </aside>
          </div>

          <nav className="bf-tabs" aria-label="Property sections">
            {Object.entries(tabTargets).map(([tab, target]) => (
              <a
                key={tab}
                href={`#${target}`}
                className={activeTab === tab ? 'is-active' : ''}
                onClick={() => selectTab(tab)}
              >
                {tab === 'Location' && icon('map-location-dot')} {tab}
              </a>
            ))}
          </nav>

          <div className="bf-overview-layout" id="bf-overview">
            <section className="bf-panel bf-about">
              <h2>About This Stay</h2>
              <p>
                {property.description || (
                  <span className="bf-not-yet">{icon('circle-info')} The host has not added a description for this stay yet.</span>
                )}
              </p>
              <div className="bf-about-facts">
                <span>{icon('hotel')}<small>Property Type</small><strong>{property.type || 'Stay'} · entire place</strong></span>
                {property.details?.guestCapacity && (
                  <span>{icon('users')}<small>Guests</small><strong>Up to {property.details.guestCapacity}</strong></span>
                )}
                {property.details?.bedrooms !== undefined && (
                  <span>{icon('bed')}<small>Bedrooms</small><strong>{property.details.bedrooms}</strong></span>
                )}
                {property.details?.bathrooms !== undefined && (
                  <span>{icon('bath')}<small>Bathrooms</small><strong>{property.details.bathrooms}</strong></span>
                )}
                <span>{icon('location-dot')}<small>Location</small><strong>{property.location}</strong></span>
                <span>{icon('calendar-check')}<small>Check-in</small><strong>{property.arrival?.checkInTime || 'Not added yet'}</strong></span>
                <span>{icon('calendar-xmark')}<small>Check-out</small><strong>{property.arrival?.checkOutTime || 'Not added yet'}</strong></span>
              </div>
            </section>

            <section className="bf-panel bf-choose" id="bf-rooms">
              <div className="bf-section-head">
                <div>
                  <h2>The Whole Villa Is Yours</h2>
                  <p>Private for your group. No shared rooms.</p>
                </div>
              </div>
              {roomError && <Notice tone="error">{roomError}</Notice>}
              {unit ? (
                <article className="bf-teaser bf-villa-unit">
                  <img src={photos[1 % photos.length]} alt={property.name} />
                  <div>
                    <h3>Entire {String(property.type || 'villa').toLowerCase()}</h3>
                    <p>{icon('users')} Up to {unit.capacity} guests <span>{icon('house')} Private stay</span></p>
                    <div className="bf-teaser-bottom">
                      <strong>Entire Private Villa<small> 100% Privacy</small></strong>
                      <button
                        type="button"
                        className="bf-primary"
                        onClick={scrollToEnquiry}
                      >
                        Enquire Now {icon('arrow-right')}
                      </button>
                    </div>
                  </div>
                </article>
              ) : (
                <div className="bf-empty-inline">
                  {bookable ? 'Villa details are ready for inquiries.' : 'Direct inquiries are open for this stay.'}
                </div>
              )}
            </section>
          </div>

          <div className="bf-info-grid">
            <section className="bf-panel" id="bf-highlights">
              <h2>Property Highlights</h2>
              {amenities.length ? amenities.slice(0, 3).map(label => <p key={label}>{icon('circle-check')} {label}</p>) : <p className="bf-not-yet">{icon('circle-info')} No highlights have been added for this stay yet.</p>}
            </section>
            <section className="bf-panel">
              <h2>Amenities</h2>
              {amenities.length ? amenities.slice(0, 6).map(label => <p key={label}>{icon('circle-check')} {label}</p>) : <p className="bf-not-yet">{icon('circle-info')} The host has not listed amenities for this stay yet.</p>}
            </section>
            <section className="bf-panel" id="bf-rules">
              <h2>House Rules</h2>
              {property.arrival?.houseRules?.length ? property.arrival.houseRules.map(rule => <p key={rule}>{icon('circle-check')} {rule}</p>) : <p className="bf-not-yet">{icon('circle-info')} The host has not added house rules yet.</p>}
            </section>
            <section className="bf-panel" id="bf-nearby">
              <h2>Nearby Places</h2>
              <p className="bf-not-yet">{icon('circle-info')} Nearby places have not been added for this stay yet.</p>
              {property.location && <p>{icon('location-dot')} Area: {property.location}</p>}
            </section>
            <section className="bf-panel" id="bf-reviews">
              <h2>Guest Reviews</h2>
              {property.reviews?.length ? property.reviews.slice(0, 2).map(review => <p key={review._id}>★ {review.rating} · {review.guestName}: {review.reviewText}</p>) : <p className="bf-not-yet">{icon('circle-info')} No guest reviews yet. Reviews appear here after guests complete a stay.</p>}
            </section>
          </div>

          <PropertyMap
            name={property.name}
            location={property.location}
            mapLink={property.mapLink}
            coordinates={property.coordinates}
          />
        </>
      )}
    </FlowShell>
  );
}
