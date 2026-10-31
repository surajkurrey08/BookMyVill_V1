import { useAppTheme } from '../../context/ThemeContext';
import React, { useEffect, useState, useContext, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  TextInput,
  Dimensions, 
  Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../../context/AuthContext';
import { useFavorites } from '../../context/FavoritesContext';
import apiClient from '../../api/client';
import BrandLogo from '../../components/BrandLogo';
import { resolveVillaPhoto, getStableVillaFallback } from '../../utils/media';

const { width } = Dimensions.get('window');
const BUNDLED_HERO_IMAGE = require('../../../assets/hero-villa.webp');

// 4 Categories from the reference design
const CATEGORIES = [
  { id: 'villas', label: 'Villas', icon: 'home-outline' },
  { id: 'resorts', label: 'Resorts', icon: 'leaf-outline' },
  { id: 'homestays', label: 'Homestays', icon: 'business-outline' },
  { id: 'beachfront', label: 'Beachfront', icon: 'umbrella-outline' },
];

export default function HomeScreen({ navigation }) {
  const { colors: COLORS, mode, toggleTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(COLORS, mode), [COLORS, mode]);
  const insets = useSafeAreaInsets();
  const { user } = useContext(AuthContext);
  const { toggleFavorite, isFavorite } = useFavorites();

  const [activeCategory, setActiveCategory] = useState('villas');
  const [searchQuery, setSearchQuery] = useState('');
  const [villas, setVillas] = useState([]);
  const [failedPhotoIds, setFailedPhotoIds] = useState({});
  
  // Hero Image: uses high-resolution web hero_page1.png, updates if admin uploaded a custom hero in /site-heroes
  const [heroImageSource, setHeroImageSource] = useState(
    BUNDLED_HERO_IMAGE
  );

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'GOOD MORNING,';
    if (hour < 17) return 'GOOD AFTERNOON,';
    return 'GOOD EVENING,';
  };

  const userName = user?.name ? user.name.split(' ')[0] : null;

  // 1. Fetch live admin-updated Hero Image from /site-heroes
  useEffect(() => {
    const fetchAdminHero = async () => {
      try {
        const res = await apiClient.get('/site-heroes');
        const adminHeroUrl = res.data?.images?.home?.url;
        if (adminHeroUrl) {
          const apiBase = (apiClient.defaults.baseURL || '').replace(/\/api\/?$/, '');
          setHeroImageSource({ uri: `${apiBase}${adminHeroUrl}` });
        }
      } catch (err) {
        // Keeps bundled hero_page1.png if backend hero not found
      }
    };
    fetchAdminHero();
  }, []);

  // 2. Fallback villas matching the exact luxury theme
  // Curated category stays so that each tab (Villas, Resorts, Homestays, Beachfront)
  // always has luxury stays ready to view even if the backend only has a few entries
  const CURATED_CATEGORY_STAYS = useMemo(() => [], []);

  // 3. Fetch properties from backend
  useEffect(() => {
    const loadVillas = async () => {
      try {
        const res = await apiClient.get('/properties/all');
        const list = Array.isArray(res.data) ? res.data : (res.data.properties || []);
        if (list.length > 0) {
          setVillas(list);
        }
      } catch (err) {
        // Keeps curated stays
      }
    };
    loadVillas();
  }, []);

  // Search handler: navigates to Explore with search query pre-filled
  const handleSearchSubmit = () => {
    navigation.navigate('Explore', { 
      initialQuery: searchQuery.trim(), 
      initialCategory: CATEGORIES.find(c => c.id === activeCategory)?.label || 'All' 
    });
  };

  // Filter right here on the same screen for the cards below
  const handleCategoryPress = (category) => {
    setActiveCategory(category.id);
  };

  // Show live database villas when available; only fallback to curated when empty
  const allStays = useMemo(() => {
    if (villas && villas.length > 0) return villas;
    return CURATED_CATEGORY_STAYS;
  }, [villas, CURATED_CATEGORY_STAYS]);

  // Robust category matcher for Villas, Resorts, Homestays, and Beachfront
  const matchesCategory = (item, catId) => {
    if (!catId || catId === 'all') return true;

    const type = (item.type || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    const city = (item.location?.city || item.city || item.location || '').toLowerCase();
    const allText = `${type} ${name} ${desc} ${city}`;

    if (catId === 'villas') {
      return type.includes('villa') || name.includes('villa') || (!type.includes('resort') && !type.includes('homestay'));
    }
    if (catId === 'resorts') {
      return type.includes('resort') || name.includes('resort') || desc.includes('resort') || allText.includes('spa');
    }
    if (catId === 'homestays') {
      return type.includes('homestay') || type.includes('cottage') || name.includes('homestay') || name.includes('cottage') || desc.includes('homestay');
    }
    if (catId === 'beachfront') {
      return type.includes('beach') || name.includes('beach') || desc.includes('beach') || desc.includes('ocean') || city.includes('goa') || city.includes('alibaug') || city.includes('bali') || city.includes('phuket') || city.includes('beach');
    }
    return true;
  };

  // Filter villas right on Home screen by selected category tab AND search query
  const displayList = useMemo(() => {
    return allStays.filter((item) => {
      // 1. Category tab filter (Villas, Resorts, Homestays, Beachfront)
      if (!matchesCategory(item, activeCategory)) {
        return false;
      }
      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (item.name || '').toLowerCase();
        const city = (item.location?.city || item.city || '').toLowerCase();
        return name.includes(q) || city.includes(q);
      }
      return true;
    });
  }, [allStays, activeCategory, searchQuery]);

  return (
    <View style={styles.container}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        bounces={false}
      >
        {/* ============================================================= */}
        {/* HERO SECTION: EDGE-TO-EDGE VILLA SUNSET WITH SMOOTH GRADIENT  */}
        {/* ============================================================= */}
        <View style={styles.heroContainer}>
          {/* Full bleed edge-to-edge villa photo (complete villa & pool framed) */}
          <Image
            source={heroImageSource}
            style={[styles.heroBackgroundImage, { width: width * 2, left: -width }]}
            resizeMode="cover"
            onError={() => {
              if (heroImageSource !== BUNDLED_HERO_IMAGE) {
                setHeroImageSource(BUNDLED_HERO_IMAGE);
              }
            }}
          />

          {/* Smooth cinematic gradient from top status bar down into page background */}
          <LinearGradient
            colors={[
              'rgba(7, 21, 17, 0.65)',
              'rgba(7, 21, 17, 0.12)',
              'rgba(7, 21, 17, 0.35)',
              COLORS.bgMain,
            ]}
            locations={[0, 0.32, 0.70, 1.0]}
            style={[StyleSheet.absoluteFillObject, styles.heroBackgroundGradient]}
          />

          {/* Keep hero copy above the absolute image layers on Android. */}
          <View style={[styles.navHeader, styles.heroNavHeader, { top: Math.max(insets.top, 24) + 8 }]}>
              <View style={styles.logoRow}>
                <View>
                  <BrandLogo size={26} color="#FFFFFF" />
                </View>
              </View>

              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.headerActionBtn}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Notifications"
                  onPress={() => Alert.alert('Notifications', 'You have no unread notifications.')}
                >
                  <Ionicons 
                    name="notifications-outline" 
                    size={20} 
                    color={mode === 'dark' ? '#FFFFFF' : '#1D2924'} 
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerActionBtn}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}
                  onPress={toggleTheme}
                >
                  <Ionicons 
                    name={mode === 'dark' ? 'sunny' : 'moon'} 
                    size={20} 
                    color={mode === 'dark' ? '#ECC86B' : '#85620D'} 
                  />
                </TouchableOpacity>
              </View>
            </View>

          <View style={styles.heroGreeting}>
            <View style={styles.greetingSection}>
              <View style={styles.greetingBadge}>
                <Text style={styles.greetingPre}>{getGreeting()}</Text>
              </View>
              <View style={styles.nameRow}>
                <Text style={styles.greetingName}>{userName ? userName : 'Welcome'}</Text>
                <Text style={styles.waveEmoji}> 👋</Text>
              </View>
              <Text style={styles.greetingDesc}>
                Find your luxury villa
              </Text>
            </View>
          </View>
        </View>

        {/* ============================================================= */}
        {/* INTERACTIVE CREAM SEARCH BAR (FUNCTIONAL TEXT INPUT + SEARCH) */}
        {/* ============================================================= */}
        <View style={styles.searchBarWrapper}>
          <View style={styles.searchPill}>
            {/* Location Pin */}
            <Ionicons name="location-sharp" size={22} color={COLORS.goldPrimary} style={styles.searchPinIcon} />

            {/* Real Interactive Input */}
            <View style={styles.searchTextCol}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search villas..."
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                onSubmitEditing={handleSearchSubmit}
                autoCorrect={false}
              />
            </View>

            {/* Clear Button (when text is entered) */}
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                style={styles.searchClearBtn}
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}

            {/* Golden Circle Search Action Button */}
            <TouchableOpacity 
              style={styles.searchGoldCircle}
              activeOpacity={0.85}
              onPress={handleSearchSubmit}
            >
              <Ionicons name="search" size={19} color={COLORS.actionText} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ============================================================= */}
        {/* 4 CIRCULAR CATEGORY BUTTONS (Villas, Resorts, Homestays, Beach)*/}
        {/* ============================================================= */}
        <View style={styles.categoriesRow}>
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={styles.categoryItem}
                activeOpacity={0.8}
                onPress={() => handleCategoryPress(cat)}
                accessibilityRole="button"
                accessibilityLabel={`Browse ${cat.label}`}
              >
                <View style={[styles.categoryCircle, isActive && styles.categoryCircleActive]}>
                  <Ionicons 
                    name={cat.icon} 
                    size={22} 
                    color={COLORS.goldPrimary} 
                  />
                </View>
                <Text style={[styles.categoryLabel, isActive && styles.categoryLabelActive]}>
                  {cat.label}
                </Text>
                {/* Active Gold Underline Bar */}
                {isActive && <View style={styles.activeCategoryBar} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ============================================================= */}
        {/* FEATURED LUXURY STAYS (DARK LUXURY EMERALD CARDS)            */}
        {/* ============================================================= */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleWhite}>
            Featured <Text style={styles.sectionTitleGold}>
              {CATEGORIES.find((c) => c.id === activeCategory)?.label || 'Luxury Stays'}
            </Text>
            {searchQuery.trim().length > 0 && (
              <Text style={styles.searchMatchCount}> ({displayList.length} found)</Text>
            )}
          </Text>
          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Explore', { 
              initialQuery: searchQuery.trim(),
              initialCategory: CATEGORIES.find((c) => c.id === activeCategory)?.label || ''
            })}
          >
            <Text style={styles.viewAllText}>View All →</Text>
          </TouchableOpacity>
        </View>

        {/* Horizontal Cards Scroll (Dark Emerald Surface) */}
        {displayList.length === 0 ? (
          <View style={styles.noResultsBox}>
            <Ionicons name="search-outline" size={28} color={COLORS.goldPrimary} />
            <Text style={styles.noResultsTitle}>
              No {CATEGORIES.find((c) => c.id === activeCategory)?.label.toLowerCase() || 'stays'} found
              {searchQuery.trim() ? ` matching "${searchQuery}"` : ''}
            </Text>
            <TouchableOpacity 
              style={styles.noResultsBtn}
              onPress={() => {
                setActiveCategory('villas');
                setSearchQuery('');
              }}
            >
              <Text style={styles.noResultsBtnText}>Show All Villas →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredScrollContent}
          >
            {displayList.map((item) => {
              const rawPhoto = (item.photos && item.photos[0]) || 
                               (item.images && item.images[0]) || 
                               item.featuredImage;
              const photoUrl = failedPhotoIds[item._id] 
                ? getStableVillaFallback(item._id || item.name, 0)
                : resolveVillaPhoto(rawPhoto, item._id || item.name, 0);
              const price = item.pricing?.basePrice || item.pricePerNight || item.price || 38000;
              const location = item.location?.city || item.city || 'Goa, India';
              const rating = item.rating ? Number(item.rating).toFixed(1) : '4.9';
              const reviewsCount = item.reviewsCount || 120;
              const isFav = isFavorite(item._id);

              return (
                <TouchableOpacity 
                  key={item._id}
                  style={styles.featuredCard}
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate('VillaDetail', { villa: item })}
                >
                  {/* Top Image */}
                  <View style={styles.cardImageContainer}>
                    <Image
                      source={{ uri: photoUrl }}
                      style={styles.cardPhoto}
                      resizeMode="cover"
                      onError={() => {
                        setFailedPhotoIds((current) => (
                          current[item._id] ? current : { ...current, [item._id]: true }
                        ));
                      }}
                    />
                    
                    {/* Floating Heart Button */}
                    <TouchableOpacity 
                      style={styles.cardHeartBtn}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={isFav ? `Remove ${item.name} from saved stays` : `Save ${item.name}`}
                      onPress={(event) => {
                        event.stopPropagation();
                        toggleFavorite(item);
                      }}
                    >
                      <Ionicons 
                        name={isFav ? "heart" : "heart-outline"} 
                        size={16} 
                        color={isFav ? "#FF4B6E" : "#FFFFFF"} 
                      />
                    </TouchableOpacity>

                    {/* Rating Tag (Bottom-left of photo) */}
                    <View style={styles.cardRatingTag}>
                      <Ionicons name="star" size={10} color={COLORS.goldPrimary} />
                      <Text style={styles.cardRatingText}>{rating} ({reviewsCount})</Text>
                    </View>
                  </View>

                  {/* Bottom Half: DARK LUXURY EMERALD SURFACE */}
                  <View style={styles.cardBody}>
                    {/* Villa Name Heading */}
                    <Text style={styles.cardVillaName} numberOfLines={1}>
                      {item.name}
                    </Text>

                    {/* Single Aligned Line Below Heading: Location (Left) + Price (Right) */}
                    <View style={styles.cardBottomRow}>
                      <View style={styles.cardLocRow}>
                        <Ionicons name="location" size={12} color={COLORS.goldPrimary} />
                        <Text style={styles.cardLocText} numberOfLines={1}>{location}</Text>
                      </View>

                      <View style={styles.cardPriceInline}>
                        <Text style={styles.cardPriceAmount}>
                          ₹ {Number(price).toLocaleString('en-IN')}
                        </Text>
                        <Text style={styles.cardPerNight}> / night</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ============================================================= */}
        {/* EXCLUSIVE MEMBER BENEFITS BANNER (DARK EMERALD + GOLD)       */}
        {/* ============================================================= */}
        <View style={styles.memberBannerWrapper}>
          <View style={styles.memberBanner}>
            <View style={styles.memberLeftCol}>
              <View style={styles.memberTitleRow}>
                {/* Crown Badge */}
                <View style={styles.crownCircle}>
                  <Ionicons name="sparkles" size={16} color={COLORS.goldPrimary} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.memberHeading}>Exclusive Member Benefits</Text>
                  <Text style={styles.memberSub}>Up to 25% OFF on premium villas</Text>
                </View>
              </View>

              {/* Unlock Deals Pill */}
              <TouchableOpacity 
                style={styles.unlockBtn} 
                activeOpacity={0.88}
                onPress={() => navigation.navigate('Profile')}
              >
                <Text style={styles.unlockBtnText}>Unlock Deals →</Text>
              </TouchableOpacity>
            </View>

            {/* Right Side Gazebo Photo */}
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400' }} 
              style={styles.memberPhoto} 
            />
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS, mode = 'light') => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgMain,
  },

  // 1. Hero Container & Background (Complete Villa & Pool Framed)
  heroContainer: {
    width: '100%',
    height: 405, // Ample height so complete 2-story villa, sunset, and pool reflection are framed
    position: 'relative',
    backgroundColor: COLORS.bgDeep,
    overflow: 'hidden',
  },
  heroBackgroundImage: { position: 'absolute', top: 0, height: '100%', zIndex: 0 },
  heroBackgroundGradient: { zIndex: 1 },
  heroNavHeader: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 10,
    elevation: 10,
  },
  heroGreeting: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 52,
    zIndex: 10,
    elevation: 10,
  },

  // Top Nav Header: Prominent BookMyVilla Branding
  navHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: mode === 'dark' ? 'rgba(7, 21, 17, 0.72)' : '#FFFFFF',
    borderWidth: 1,
    borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(152, 112, 15, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: mode === 'dark' ? 0.35 : 0.16,
    shadowRadius: 5,
    elevation: 5,
  },
  // Greeting
  greetingSection: {
    zIndex: 10,
    maxWidth: '85%',
  },
  greetingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  greetingPre: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2.2,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  waveEmoji: {
    fontSize: 26,
  },
  greetingDesc: {
    fontSize: 13,
    color: '#FFFFFF',
    marginTop: 3,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // 2. Interactive Search Bar (Functional TextInput + Gold Action Button)
  searchBarWrapper: {
    paddingHorizontal: 16,
    marginTop: -28,
    zIndex: 20,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: 34,
    paddingVertical: 8,
    paddingLeft: 14,
    paddingRight: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  searchPinIcon: {
    marginRight: 8,
  },
  searchTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  searchInput: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '500',
    paddingVertical: 0,
    height: 38,
  },
  searchClearBtn: {
    paddingHorizontal: 6,
  },
  searchGoldCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.goldPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },

  // 3. Category Icons Row (4 Circular Buttons)
  categoriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginTop: 22,
    marginBottom: 20,
  },
  categoryItem: {
    alignItems: 'center',
    width: 70,
  },
  categoryCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryCircleActive: {
    borderColor: COLORS.goldPrimary,
    borderWidth: 2,
    backgroundColor: COLORS.bgCardElevated,
  },
  categoryLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  categoryLabelActive: {
    color: COLORS.goldPrimary,
    fontWeight: '700',
  },
  activeCategoryBar: {
    width: 22,
    height: 2.5,
    backgroundColor: COLORS.goldPrimary,
    borderRadius: 1.5,
    marginTop: 4,
  },

  // 4. Featured Luxury Stays Section
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  sectionTitleWhite: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  sectionTitleGold: {
    color: COLORS.goldLight,
  },
  searchMatchCount: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  viewAllText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.goldLight,
  },

  // Horizontal Carousel
  featuredScrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 6,
    gap: 14,
  },
  // DARK LUXURY EMERALD CARDS (Wide, breathing space, high luxury)
  featuredCard: {
    width: 205,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: COLORS.bgCard, // Dark Emerald card surface
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)', // Subtle gold hairline border
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardImageContainer: {
    width: '100%',
    height: 135,
    position: 'relative',
    backgroundColor: COLORS.bgDeep,
  },
  cardPhoto: {
    width: '100%',
    height: '100%',
  },
  cardHeartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(7, 21, 17, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
  },
  cardRatingTag: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(7, 21, 17, 0.85)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    gap: 3,
  },
  cardRatingText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Bottom Half of Card: DARK LUXURY EMERALD
  cardBody: {
    padding: 12,
    backgroundColor: COLORS.bgCard,
  },
  cardVillaName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  cardLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
    marginRight: 6,
  },
  cardLocText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  cardPriceInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  cardPriceAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.goldPrimary,
  },
  cardPerNight: {
    fontSize: 9.5,
    color: COLORS.textMuted,
    fontWeight: '500',
  },

  // No Results fallback
  noResultsBox: {
    padding: 24,
    marginHorizontal: 18,
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    alignItems: 'center',
  },
  noResultsTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  noResultsBtn: {
    marginTop: 12,
    backgroundColor: COLORS.goldPrimary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  noResultsBtnText: {
    color: COLORS.actionText,
    fontWeight: '700',
    fontSize: 12,
  },

  // 5. Exclusive Member Benefits Banner
  memberBannerWrapper: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  memberBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    padding: 14,
    overflow: 'hidden',
  },
  memberLeftCol: {
    flex: 1,
    paddingRight: 8,
  },
  memberTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  crownCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.goldPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberHeading: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.goldLight,
  },
  memberSub: {
    fontSize: 10.5,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  unlockBtn: {
    backgroundColor: COLORS.goldPrimary,
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  unlockBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.actionText,
  },
  memberPhoto: {
    width: 85,
    height: 75,
    borderRadius: 12,
  },
});
