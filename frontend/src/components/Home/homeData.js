import heroVilla from '../../assets/home/hero-villa.webp';
import cliffValley from '../../assets/home/cliff-valley.webp';
import lakeValley from '../../assets/home/lake-valley.webp';
import forestViewpoint from '../../assets/home/forest-viewpoint.webp';
import lakesideResort from '../../assets/home/lakeside-resort.webp';
import hillChalet from '../../assets/home/hill-chalet.webp';
import suiteBalcony from '../../assets/home/suite-balcony.webp';
import suitePanorama from '../../assets/home/suite-panorama.webp';
import spa from '../../assets/home/spa.webp';
import redCottage from '../../assets/home/red-cottage.webp';
import strawberries from '../../assets/hillstationhome (2).jpg';
import ridgeView from '../../assets/hillstationhome (1).jpg';
import waterfallValley from '../../assets/waterfallvalley.jpg';
import katesPointView from '../../assets/home/kates-point.webp';
import krishnabaiTemple from '../../assets/krishnabai-temple-mahabaleshwar-maharashtra-1-attr-nearby.jpg';
import morarjiCastle from '../../assets/morarji-castle-.jpg';

export const images = {
  heroVilla,
  forestViewpoint,
};

export const TOWN_CENTER = [17.9237, 73.6586];

// Hero discovery stories. The CTA action decides where the guest continues.
export const categories = [
  {
    label: 'Hill Villas', image: lakeValley, action: { scroll: 'hp-destinations' },
    story: { eyebrow: 'Mountain escape', title: 'Wake up above the valleys', description: 'Find complete villas near Mahabaleshwar and Panchgani, with cool mornings and scenic drives close by.', highlights: ['Entire villa privacy', 'Valley locations', 'Easy group stays'], cta: 'Explore hill locations' }
  },
  {
    label: 'Luxury Villas', image: heroVilla, action: { scroll: 'hp-stays', filter: 'All' },
    story: { eyebrow: 'Private luxury', title: 'The whole villa, made for your group', description: 'Enjoy spacious living areas, premium comforts and private time together without sharing the villa with other guests.', highlights: ['Complete villa booking', 'Premium amenities', 'Handpicked stays'], cta: 'View luxury villas' }
  },
  {
    label: 'Family Escapes', image: lakesideResort, action: { scroll: 'hp-stays', filter: 'Resort' },
    story: { eyebrow: 'Family time', title: 'More room for every generation', description: 'Choose welcoming villas with shared lounges, outdoor space and room for the whole family to stay together.', highlights: ['Family friendly spaces', 'Multiple bedrooms', 'Relaxed shared moments'], cta: 'Find family villas' }
  },
  {
    label: 'Private Villas', image: hillChalet, action: { scroll: 'hp-stays', filter: 'Villa' },
    story: { eyebrow: 'All yours', title: 'A private stay from check-in to checkout', description: 'Book the complete villa shown on the website. The displayed amount is for the whole villa for one night.', highlights: ['No shared rooms', 'One clear villa price', 'Private group stay'], cta: 'Browse private villas' }
  },
  {
    label: 'Cozy Stays', image: redCottage, action: { scroll: 'hp-stays', filter: 'Homestay' },
    story: { eyebrow: 'Warm and personal', title: 'Slow evenings in a home-style villa', description: 'Settle into peaceful spaces with local character, garden corners and everything your group needs to feel at home.', highlights: ['Quiet neighbourhoods', 'Comfortable common areas', 'Local character'], cta: 'See cozy stays' }
  },
  {
    label: 'Scenic Views', image: forestViewpoint, action: { scroll: 'hp-map', layer: 'viewpoints' },
    story: { eyebrow: 'Stay near the view', title: 'Plan sunrise and sunset around your villa', description: 'Discover viewpoints near your stay and spend less time planning routes during your Mahabaleshwar trip.', highlights: ['Nearby viewpoints', 'Simple map discovery', 'Perfect photo stops'], cta: 'Open viewpoint map' }
  },
  {
    label: 'Adventure', image: ridgeView, action: { scroll: 'hp-map', layer: 'attractions' },
    story: { eyebrow: 'Explore outside', title: 'Your villa base for every adventure', description: 'Keep the group together in one villa, then discover trails, boating, heritage places and family attractions nearby.', highlights: ['Group friendly base', 'Nearby attractions', 'Rest after exploring'], cta: 'Find nearby adventures' }
  },
  {
    label: 'Local Flavours', image: strawberries, action: { scroll: 'hp-map', layer: 'restaurants' },
    story: { eyebrow: 'Taste Mahabaleshwar', title: 'Local food, shared around one table', description: 'Find strawberry treats and popular dining spots, then return to the comfort and privacy of your complete villa.', highlights: ['Local favourites', 'Restaurant map', 'Easy group dining'], cta: 'Explore food nearby' }
  },
  {
    label: 'Wellness', image: spa, action: { route: '/packages' },
    story: { eyebrow: 'A slower stay', title: 'Space to pause, breathe and reconnect', description: 'Choose restful villa experiences made for unhurried mornings, peaceful evenings and quality time together.', highlights: ['Private relaxation', 'Nature-led experiences', 'Simple package booking'], cta: 'View wellness packages' }
  },
];

export const destinations = [
  { name: 'Mahabaleshwar', tagline: 'Scenic Views & Strawberry Farms', image: lakeValley },
  { name: 'Panchgani', tagline: 'Table Land & Beautiful Valleys', image: cliffValley },
  { name: 'Mapro Garden', tagline: 'Famous for Strawberries', image: strawberries },
  { name: 'Lingmala Waterfall', tagline: "Nature's Beautiful Cascade", image: waterfallValley },
  { name: "Kate's Point", tagline: 'Dhom Dam & Krishna Valley Views', image: katesPointView },
  { name: "Arthur's Seat", tagline: 'Queen of All Points', image: ridgeView },
  { name: 'Krishnabai Temple', tagline: 'Ancient Stone Temple, Old Mahabaleshwar', image: krishnabaiTemple },
  { name: 'Morarji Castle', tagline: 'Colonial Heritage of Panchgani', image: morarjiCastle },
];

const stay = (s) => ({
  ...s,
  price: `₹${s.priceValue.toLocaleString('en-IN')}`,
  mapLink: `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`,
});

export const stays = [];

export const stayFilters = [
  { key: 'All', label: 'All', icon: 'fa-house' },
  { key: 'Favourites', label: 'Favourites', icon: 'fa-heart' },
  { key: 'Resort', label: 'Resorts', icon: 'fa-umbrella-beach' },
  { key: 'Villa', label: 'Villas', icon: 'fa-building' },
  { key: 'Hotel', label: 'Hotels', icon: 'fa-hotel' },
  { key: 'Homestay', label: 'Homestays', icon: 'fa-house-chimney' },
];

export const mapLayers = [
  { key: 'hotels', label: 'Hotels', icon: 'fa-location-dot' },
  { key: 'viewpoints', label: 'View Points', icon: 'fa-binoculars' },
  { key: 'restaurants', label: 'Restaurants', icon: 'fa-utensils' },
  { key: 'attractions', label: 'Attractions', icon: 'fa-camera' },
];

// Coordinates are approximate and only used to place pins on the overview map.
export const mapPlaces = {
  viewpoints: [
    { id: 'wilson', name: 'Wilson Point', note: 'Highest point — best sunrise view', lat: 17.9290, lon: 73.6660 },
    { id: 'arthurs', name: "Arthur's Seat", note: 'Queen of all points, Savitri valley', lat: 17.9405, lon: 73.6215 },
    { id: 'kates', name: "Kate's Point", note: 'Dhom dam & Krishna valley', lat: 17.9545, lon: 73.6930 },
    { id: 'lodwick', name: 'Lodwick Point', note: 'Panoramic Western Ghats view', lat: 17.9170, lon: 73.6390 },
    { id: 'tableland', name: 'Table Land', note: 'Vast volcanic plateau, Panchgani', lat: 17.9200, lon: 73.7960 },
  ],
  restaurants: [
    { id: 'grapevine', name: 'The Grapevine', note: 'Market road dining', lat: 17.9248, lon: 73.6567 },
    { id: 'venna-stalls', name: 'Venna Lake Food Stalls', note: 'Corn, chana & strawberry cream', lat: 17.9332, lon: 73.6720 },
    { id: 'mapro-cafe', name: 'Mapro Food Park', note: 'Strawberry treats & café', lat: 17.9003, lon: 73.7400 },
  ],
  attractions: [
    { id: 'venna', name: 'Venna Lake', note: 'Boating & horse rides', lat: 17.9335, lon: 73.6745 },
    { id: 'lingmala', name: 'Lingmala Waterfall', note: '600 ft monsoon cascade', lat: 17.9090, lon: 73.6880 },
    { id: 'mapro', name: 'Mapro Garden', note: 'Strawberry farms & festival', lat: 17.8990, lon: 73.7420 },
    { id: 'krishnabai', name: 'Krishnabai Temple', note: 'Ancient Shiva temple', lat: 17.9385, lon: 73.6410 },
    { id: 'pratapgad', name: 'Pratapgad Fort', note: '17th-century Maratha fort', lat: 17.9360, lon: 73.5770 },
  ],
};

export const testimonials = [
  {
    name: 'Rahul Mehta', city: 'Mumbai', rating: 5,
    text: 'Absolutely loved the stay! Stunning views, peaceful environment and amazing hospitality. Highly recommended for families and couples.',
  },
  {
    name: 'Priya Sharma', city: 'Pune', rating: 5,
    text: 'One of the best resorts in Mahabaleshwar. Clean rooms, great food and breathtaking sunrise view. Will definitely visit again!',
  },
  {
    name: 'Amit Desai', city: 'Ahmedabad', rating: 5,
    text: 'Perfect place for a weekend getaway. The location, food and service were excellent. Truly a memorable experience.',
  },
  {
    name: 'Sneha Kulkarni', city: 'Nashik', rating: 5,
    text: 'The strawberry farm tour and the sunset at Arthur’s Seat were magical. Booking was effortless and the caretaker was so warm.',
  },
  {
    name: 'Vikram Joshi', city: 'Bengaluru', rating: 4,
    text: 'Woke up above the clouds every morning. Lovely villa with a private balcony — the evening bonfire was the highlight of our trip.',
  },
];
