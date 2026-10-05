import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import HomeHeader from '../Home/HomeHeader';
import HomeFooter from '../Home/HomeFooter';
import { API_BASE_URL } from '../../config';
import useSiteHero from '../../hooks/useSiteHero';
import heroVilla from '../../assets/home/hero-villa.jpg';
import lakesideVilla from '../../assets/home/lakeside-resort.jpg';
import hillVilla from '../../assets/home/hill-chalet.jpg';
import '../../assets/fonts/google-fonts.css';
import '../../assets/fonts/font-awesome.css';
import '../Home/Home.css';
import './JoinUs.css';

const benefits = [
  { icon: 'fa-chart-simple', title: 'High Occupancy Support', text: 'Get featured across our platform and marketing channels to reach verified travelers and increase your bookings.' },
  { icon: 'fa-users', title: 'Verified Luxury Travelers', text: 'Host genuine families, couples and corporate travelers with verified profiles and secure booking process.' },
  { icon: 'fa-arrow-trend-up', title: 'Revenue Growth & ROI', text: "Competitive commission model and strategic promotions to maximize your property's earnings and long-term value." },
  { icon: 'fa-headset', title: 'Dedicated Partner Assistance', text: 'Our team works closely with you for listing support, marketing guidance and ongoing partnership assistance.' },
];

const steps = [
  { icon: 'fa-file-lines', title: 'Submit Your Property', text: 'Fill in your property details, photos, amenities and pricing information through our simple listing form.' },
  { icon: 'fa-shield-halved', title: 'Verification & Review', text: 'Our team reviews your property details and verifies the information to ensure quality standards.' },
  { icon: 'fa-rocket', title: 'Go Live & Receive Bookings', text: 'Once approved, your property goes live on BookMyVilla and starts reaching verified luxury travelers.' },
];

// Reference partners provide the community fallback when the API is offline.
const referencePartners = [
  { id: 'owner-1', name: 'Vikramaditya Patil', property: 'Royal Mist Luxury Villa', location: 'Mahabaleshwar', rating: '4.9', experience: '12+ Stays Managed', image: heroVilla },
  { id: 'owner-2', name: 'Ananya Deshmukh', property: 'Panchgani Crest Retreat', location: 'Panchgani', rating: '4.8', experience: '8+ Stays Managed', image: lakesideVilla },
  { id: 'owner-3', name: 'Rajesh Sharma', property: 'Strawberry Hillside Estate', location: 'Mahabaleshwar', rating: '4.9', experience: '15+ Stays Managed', image: heroVilla },
  { id: 'owner-4', name: 'Santosh Kadam', property: 'Panchgani Valley View Villa', location: 'Panchgani', rating: '4.7', experience: '10+ Stays Managed', image: lakesideVilla },
];

const Icon = ({ name, className = '' }) => <i className={`fa-solid ${name} ${className}`} aria-hidden="true" />;

const JoinUs = () => {
  const currentHeroImage = useSiteHero('join', heroVilla);
  const [livePartners, setLivePartners] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    const loadPartners = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/partner/all`, { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data)) {
          setLivePartners(data.filter(partner => partner.status === 'approved' && partner.partnerType !== 'Caretaker' && partner.fullName).map(partner => ({
            id: partner._id,
            name: partner.fullName,
            property: partner.propertyName && partner.propertyName !== 'N/A' ? partner.propertyName : 'Mahabaleshwar Stay',
            location: partner.city || 'Mahabaleshwar',
            experience: partner.experience || 'Verified Partner',
            image: hillVilla,
          })));
        }
      } catch {
        // Keep the bundled community available when the API is offline.
      }
    };
    loadPartners();
    return () => controller.abort();
  }, []);

  const partners = [...referencePartners, ...livePartners];

  return (
    <div className="hp-root joinus-page">
      <HomeHeader />
      <main>
        <section className="join-hero" aria-labelledby="join-title">
          <img className="join-hero-image" src={currentHeroImage} alt="Luxury pool villa overlooking the hills and lake at sunset" fetchPriority="high" />
          <div className="join-hero-shade" />
          <div className="join-wrap join-hero-content">
            <p className="join-eyebrow">Partner With Us</p>
            <h1 id="join-title">Partner With<br /><span>BookMyVilla</span></h1>
            <p className="join-hero-description">List your villa, resort or boutique stay in Mahabaleshwar<br className="join-desktop-break" /> and nearby hill destinations, and reach verified luxury<br className="join-desktop-break" /> travelers across India.</p>
            <div className="join-hero-actions">
              <Link to="/register-property" className="join-action join-action-primary"><Icon name="fa-hotel" />List Your Property<Icon name="fa-arrow-right" /></Link>
              <Link to="/partner-inquiry" className="join-action join-action-secondary"><Icon name="fa-envelope" />Send an Inquiry</Link>
            </div>
          </div>
        </section>

        <section className="join-benefits join-wrap" aria-labelledby="join-benefits-title">
          <div className="join-section-heading">
            <div>
              <p className="join-eyebrow">Why Partner With BookMyVilla</p>
              <h2 id="join-benefits-title">Grow Your Property Business<br />With a <span>Trusted Brand</span></h2>
            </div>
            <p className="join-section-description">We bring together premium property owners and verified luxury travelers, helping you maximize occupancy, revenue and brand visibility across Mahabaleshwar's most sought-after destinations.</p>
          </div>
          <div className="join-benefit-grid">
            {benefits.map(benefit => (
              <article className="join-benefit-card" key={benefit.title}>
                <div className="join-benefit-heading"><span className="join-icon-circle"><Icon name={benefit.icon} /></span><h3>{benefit.title}</h3></div>
                <p>{benefit.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="join-process" aria-labelledby="join-process-title">
          <div className="join-wrap">
            <div className="join-section-heading">
              <div><p className="join-eyebrow">How It Works</p><h2 id="join-process-title">Join Our <span>Property Network</span></h2></div>
              <p className="join-section-description">Get your property listed in just a few simple steps and start receiving bookings from verified travelers.</p>
            </div>
            <ol className="join-step-grid">
              {steps.map((step, index) => (
                <li className="join-step" key={step.title}>
                  <span className="join-icon-circle"><Icon name={step.icon} /></span>
                  <div><span className="join-step-number">0{index + 1}</span><h3>{step.title}</h3><p>{step.text}</p></div>
                  {index < steps.length - 1 && <Icon name="fa-arrow-right" className="join-step-arrow" />}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="join-community join-wrap" aria-labelledby="join-community-title">
          <div className="join-section-heading">
            <div><p className="join-eyebrow">Our Valued Property Partners</p><h2 id="join-community-title">Meet Our <span>Property Owners</span></h2></div>
            <Link to="/explore" className="join-view-properties">View All Partner Properties<Icon name="fa-arrow-right" /></Link>
          </div>
          <div className="join-owner-grid">
            {partners.map(partner => (
              <article className="join-owner-card" key={partner.id}>
                <div className="join-owner-photo">
                  <img src={partner.image} alt={partner.property} loading="lazy" width="600" height="340" />
                  <span className="join-owner-label"><Icon name="fa-house-user" />Property Owner</span>
                  {partner.rating && <span className="join-owner-rating" aria-label={`Rating ${partner.rating} out of 5`}><Icon name="fa-star" />{partner.rating}</span>}
                </div>
                <div className="join-owner-info">
                  <h3>{partner.name}</h3><p className="join-owner-property">{partner.property}</p>
                  <p className="join-owner-location"><Icon name="fa-location-dot" />{partner.location}</p>
                  <div className="join-owner-meta"><span><Icon name="fa-house-chimney" />{partner.experience}</span><span className="join-verified"><Icon name="fa-circle-check" />Approved & Verified</span></div>
                </div>
              </article>
            ))}
          </div>
          <div className="join-trust-strip" aria-label="Partner network highlights">
            <div><Icon name="fa-hotel" /><p><strong>12+</strong><span>Villas Managed</span></p></div>
            <div><Icon name="fa-headset" /><p><strong>24/7</strong><span>Partner Support</span></p></div>
            <div><Icon name="fa-shield-halved" /><p><strong>100%</strong><span>Verified Listings</span></p></div>
            <div><Icon name="fa-star" /><p><strong>4.8+</strong><span>Average Guest Rating</span></p></div>
          </div>
        </section>
      </main>
      <HomeFooter />
    </div>
  );
};

export default JoinUs;
