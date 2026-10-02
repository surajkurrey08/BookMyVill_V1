import heroVilla from '../../assets/home/hero-villa.jpg';
import cliffValley from '../../assets/home/cliff-valley.jpg';
import lakeValley from '../../assets/home/lake-valley.jpg';
import forestViewpoint from '../../assets/home/forest-viewpoint.jpg';
import lakesideResort from '../../assets/home/lakeside-resort.jpg';
import hillChalet from '../../assets/home/hill-chalet.jpg';
import suiteBalcony from '../../assets/home/suite-balcony.jpg';
import suitePanorama from '../../assets/home/suite-panorama.jpg';
import spa from '../../assets/home/spa.jpg';
import redCottage from '../../assets/home/red-cottage.jpg';
import strawberries from '../../assets/hillstationhome (2).jpg';
import ridgeView from '../../assets/hillstationhome (1).jpg';
import waterfallValley from '../../assets/waterfallvalley.jpg';
import katesPointView from '../../assets/home/kates-point.jpg';
import krishnabaiTemple from '../../assets/krishnabai-temple-mahabaleshwar-maharashtra-1-attr-nearby.jpg';
import morarjiCastle from '../../assets/morarji-castle-.jpg';

export const images = {
  heroVilla,
  forestViewpoint,
};

export const TOWN_CENTER = [17.9237, 73.6586];

// Hero quick-category circles. `action` decides where a click takes the guest.
export const categories = [
  { label: 'Hill Stations', image: lakeValley, action: { scroll: 'hp-destinations' } },
  { label: 'Luxury Stays', image: heroVilla, action: { scroll: 'hp-stays', filter: 'All' } },
  { label: 'Family Resorts', image: lakesideResort, action: { scroll: 'hp-stays', filter: 'Resort' } },
  { label: 'Villas', image: hillChalet, action: { scroll: 'hp-stays', filter: 'Villa' } },
  { label: 'Homestays', image: redCottage, action: { scroll: 'hp-stays', filter: 'Homestay' } },
  { label: 'View Points', image: forestViewpoint, action: { scroll: 'hp-map', layer: 'viewpoints' } },
  { label: 'Adventure', image: ridgeView, action: { scroll: 'hp-map', layer: 'attractions' } },
  { label: 'Food & Dining', image: strawberries, action: { scroll: 'hp-map', layer: 'restaurants' } },
  { label: 'Wellness', image: spa, action: { route: '/packages' } },
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

export const stays = [
  stay({
    id: 'hp-orchid', name: 'The Orchid Hotel Pune', location: 'Mahabaleshwar', type: 'Hotel', tag: 'Luxury',
    priceValue: 5500, rating: 4.8, reviewsCount: 124, lat: 17.9265, lon: 73.6560,
    image: heroVilla, photos: [heroVilla, suitePanorama, spa],
    amenities: ['Infinity Pool', 'Valley View', 'Free Wi-Fi', 'Spa'],
  }),
  stay({
    id: 'hp-regal-woods', name: 'Regal Woods Resort', location: 'Metgutad', type: 'Resort', tag: 'Cozy',
    priceValue: 6200, rating: 4.7, reviewsCount: 98, lat: 17.9180, lon: 73.6760,
    image: hillChalet, photos: [hillChalet, suiteBalcony, spa],
    amenities: ['Fireplace Lounge', 'Garden Terrace', 'Free Wi-Fi', 'Restaurant'],
  }),
  stay({
    id: 'hp-elysium', name: 'Elysium Nature Stay', location: 'Old Mahabaleshwar', type: 'Hotel', tag: 'Boutique',
    priceValue: 4800, rating: 4.6, reviewsCount: 86, lat: 17.9390, lon: 73.6420,
    image: suiteBalcony, photos: [suiteBalcony, suitePanorama, forestViewpoint],
    amenities: ['Private Balcony', 'Forest View', 'Free Wi-Fi', 'Breakfast'],
  }),
  stay({
    id: 'hp-tranquil-valley', name: 'Tranquil Valley Resort', location: 'Bhilar', type: 'Resort', tag: 'Premium',
    priceValue: 7200, rating: 4.9, reviewsCount: 143, lat: 17.9180, lon: 73.7590,
    image: lakesideResort, photos: [lakesideResort, suitePanorama, spa],
    amenities: ['Infinity Pool', 'Lake View', 'Spa', 'Free Wi-Fi'],
  }),
  stay({
    id: 'hp-sunrise-hills', name: 'Sunrise Hills Villa', location: 'Panchgani', type: 'Villa', tag: 'Villa',
    priceValue: 5000, rating: 4.5, reviewsCount: 72, lat: 17.9245, lon: 73.8010,
    image: suitePanorama, photos: [suitePanorama, suiteBalcony, cliffValley],
    amenities: ['Sunrise Deck', 'Bathtub', 'Free Wi-Fi', 'Kitchen'],
  }),
  stay({
    id: 'hp-forest-glen', name: 'Forest Glen Resort', location: 'Tapola Road', type: 'Resort', tag: 'Nature',
    priceValue: 8500, rating: 4.8, reviewsCount: 101, lat: 17.9050, lon: 73.6550,
    image: heroVilla, imagePosition: '78% center', photos: [heroVilla, suiteBalcony, spa],
    amenities: ['Pool Deck', 'Forest View', 'Spa', 'Free Wi-Fi'],
  }),
  stay({
    id: 'hp-mountain-bliss', name: 'Mountain Bliss Stay', location: 'Mahabaleshwar', type: 'Villa', tag: 'Premium',
    priceValue: 6900, rating: 4.6, reviewsCount: 67, lat: 17.9215, lon: 73.6620,
    image: lakesideResort, imagePosition: '85% center', photos: [lakesideResort, suitePanorama, lakeValley],
    amenities: ['Private Pool', 'Lake View', 'Free Wi-Fi', 'Butler'],
  }),
  stay({
    id: 'hp-valley-view', name: 'Valley View Homestay', location: 'Lingmala', type: 'Homestay', tag: 'Homely',
    priceValue: 4300, rating: 4.4, reviewsCount: 53, lat: 17.9095, lon: 73.6800,
    image: redCottage, photos: [redCottage, suiteBalcony, waterfallValley],
    amenities: ['Home-cooked Meals', 'Valley View', 'Free Wi-Fi', 'Garden'],
  }),
];

export const stayFilters = [
  { key: 'All', label: 'All', icon: 'fa-house' },
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
