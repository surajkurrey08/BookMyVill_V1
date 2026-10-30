import { useAppTheme } from '../../context/ThemeContext';
import React, { useState, useMemo } from 'react' ;
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Share, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFavorites } from '../../context/FavoritesContext';
import BrandLogo from '../../components/BrandLogo';
import { resolveVillaPhoto, getStableVillaFallback } from '../../utils/media';

const dateAfterDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const formatStayDate = (date) => new Intl.DateTimeFormat('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric',
}).format(date);

export default function StayDetailsScreen({ route, navigation }) {
  const { colors: COLORS, mode } = useAppTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const { villa } = route.params;
  const { isFavorite, toggleFavorite } = useFavorites();
  const villaId = villa?._id || villa?.id;
  const isSaved = isFavorite(villaId);

  const [nights, setNights] = useState(4);
  const [checkIn, setCheckIn] = useState(() => formatStayDate(dateAfterDays(1)));
  const [checkOut, setCheckOut] = useState(() => formatStayDate(dateAfterDays(5)));

  const updateDates = (duration) => {
    setNights(duration);
    setCheckIn(formatStayDate(dateAfterDays(1)));
    setCheckOut(formatStayDate(dateAfterDays(duration + 1)));
  };

  const editDates = () => Alert.alert('Choose your stay length', 'Check-in will be tomorrow.', [
    { text: '2 nights', onPress: () => updateDates(2) },
    { text: '4 nights', onPress: () => updateDates(4) },
    { text: '7 nights', onPress: () => updateDates(7) },
    { text: 'Cancel', style: 'cancel' },
  ]);

  // COMPLETE VILLA BOOKING (No individual bedroom booking concept)
  const [heroImgError, setHeroImgError] = useState(false);

  const handleShare = async () => {
    const id = villa._id || villa.id;
    const webUrl = `https://bookmyvilla.online/property/${encodeURIComponent(id)}`;
    const villaName = villa.name || 'Luxury Villa';
    const locationName = villa.location?.city || villa.city || villa.location || 'India';
    const rawPrice = villa.pricing?.basePrice || villa.pricePerNight || villa.price || 0;
    const formattedPrice = rawPrice ? ` (₹${Number(rawPrice).toLocaleString('en-IN')}/night)` : '';

    try {
      await Share.share({
        title: `${villaName} | BookMyVilla`,
        message: `✨ Experience luxury at ${villaName} in ${locationName}${formattedPrice}.\n\nExplore photos, amenities & book online:\n${webUrl}`,
        url: webUrl,
      });
    } catch (err) {
      console.log('Share error:', err);
    }
  };
  const pricePerNight = villa?.pricing?.basePrice || villa?.pricePerNight || villa?.price || 38000;
  const bedroomsCount = villa?.bedrooms || 4;
  const maxGuestsCount = villa?.maxGuests || 8;
  const rawHeroPhoto = (villa?.photos && villa.photos[0]) || (villa?.images && villa.images[0]) || villa?.featuredImage;
  const heroImage = heroImgError
    ? getStableVillaFallback(villaId || villa?.name, 0)
    : resolveVillaPhoto(rawHeroPhoto, villaId || villa?.name, 0);

  const completeVillaOption = useMemo(() => ({
    id: 'complete-villa',
    title: 'Complete Villa Booking',
    subtitle: 'Entire Property • 100% Private Access',
    guests: `Up to ${maxGuestsCount} Guests`,
    bedrooms: `${bedroomsCount} Bedrooms`,
    pricePerNight,
    image: heroImage,
  }), [villa, pricePerNight, bedroomsCount, maxGuestsCount, heroImage]);

  const basePrice = pricePerNight * nights;
  const baseTotal = basePrice;
  const taxes = Math.round(basePrice * 0.12);
  const grandTotal = basePrice + taxes;

  return (
    <View style={styles.container}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <BrandLogo size={20} color={COLORS.goldLight} />
          <Text style={styles.headerSubtitle}>STAY DETAILS</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share this villa">
            <Ionicons name="share-social-outline" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { marginLeft: 8 }]} activeOpacity={0.8} onPress={() => toggleFavorite(villa)} accessibilityRole="button" accessibilityLabel={isSaved ? 'Remove from wishlist' : 'Add to wishlist'}>
            <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={20} color={isSaved ? '#FF4B6E' : COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Villa Hero Banner with Bestseller Badge */}
        <View style={styles.heroBox}>
          <Image 
            key={heroImage}
            source={{ uri: heroImage }} 
            style={styles.heroImg} 
            resizeMode="cover"
            onError={() => setHeroImgError(true)}
          />
          <View style={styles.bestsellerBadge}>
            <Ionicons name="ribbon-outline" size={13} color={COLORS.actionText} style={{ marginRight: 4 }} />
            <Text style={styles.bestsellerText}>Bestseller</Text>
          </View>
          <View style={styles.photoCountBadge}>
            <Ionicons name="images-outline" size={12} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.photoCountText}>1 / 24</Text>
          </View>
        </View>

        {/* Villa Title & Meta */}
        <View style={styles.villaMeta}>
          <Text style={styles.villaName}>{villa.name || 'Royal Villa'}</Text>
          <View style={styles.locationRatingRow}>
            <Ionicons name="location" size={14} color={COLORS.goldPrimary} />
            <Text style={styles.locationText}>{villa.location?.city || villa.city || villa.location || 'Lonavala'}</Text>
            <Ionicons name="star" size={13} color={COLORS.goldPrimary} style={{ marginLeft: 10 }} />
            <Text style={styles.ratingText}>
              {villa?.rating ? Number(villa.rating).toFixed(1) : '4.9'} ({villa?.reviewsCount || villa?.reviews?.length || 128} reviews)
            </Text>
          </View>
        </View>

        {/* Date & Guest Info Card */}
        <View style={styles.datesCard}>
          <View style={styles.dateBlock}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.goldPrimary} />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.dateVal}>{checkIn}</Text>
              <Text style={styles.dateLabel}>Check-in</Text>
            </View>
          </View>

          <View style={styles.dateDivider} />

          <View style={styles.dateBlock}>
            <View>
              <Text style={styles.dateVal}>{checkOut}</Text>
              <Text style={styles.dateLabel}>Check-out</Text>
            </View>
          </View>

          <View style={styles.dateDivider} />

          <View style={styles.dateBlock}>
            <Ionicons name="people-outline" size={18} color={COLORS.goldPrimary} />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.dateVal}>2 Adults</Text>
              <Text style={styles.dateLabel}>0 Children</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.editBtn} onPress={editDates} accessibilityRole="button" accessibilityLabel="Edit stay dates">
            <Ionicons name="pencil-outline" size={14} color={COLORS.goldPrimary} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Booking Option Section: Complete Villa Only */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Booking Option</Text>
          <View style={styles.completeVillaBadge}>
            <Ionicons name="checkmark-circle" size={13} color={COLORS.goldPrimary} />
            <Text style={styles.completeVillaBadgeText}>Complete Villa (Selected)</Text>
          </View>
        </View>

        {/* Selected Complete Villa Card */}
        <View style={[styles.roomCard, styles.roomCardActive]}>
          <Image source={{ uri: heroImage }} style={styles.roomThumb} />
          
          <View style={styles.roomDetails}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.roomTitle}>Complete Villa</Text>
              <View style={styles.exclusiveTag}>
                <Text style={styles.exclusiveTagText}>Exclusive</Text>
              </View>
            </View>
            <Text style={styles.roomFeatures}>Private Pool • Entire Property & Grounds</Text>
            
            <View style={styles.roomSpecsRow}>
              <Text style={styles.roomSpec}>
                Up to {maxGuestsCount} Guests  •  {bedroomsCount} Bedrooms  •  100% Privacy
              </Text>
            </View>
          </View>

          <View style={styles.roomPriceCol}>
            <Text style={styles.roomPrice}>₹ {Number(pricePerNight).toLocaleString('en-IN')}</Text>
            <Text style={styles.perNightLabel}>per night</Text>
            <View style={[styles.radioCircle, styles.radioCircleActive]}>
              <Ionicons name="checkmark" size={12} color={COLORS.goldPrimary} />
            </View>
          </View>
        </View>

        {/* Benefits Row (Free Cancellation & Inclusions) */}
        <View style={styles.benefitsRow}>
          <View style={styles.benefitCard}>
            <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.goldPrimary} />
            <Text style={styles.benefitTitle}>Free Cancellation</Text>
            <Text style={styles.benefitSub}>Cancel for free up to 7 days before check-in.</Text>
          </View>

          <View style={styles.benefitCard}>
            <Ionicons name="restaurant-outline" size={22} color={COLORS.goldPrimary} />
            <Text style={styles.benefitTitle}>Inclusions</Text>
            <Text style={styles.inclusionItem}>✓ Daily Breakfast</Text>
            <Text style={styles.inclusionItem}>✓ Welcome Drinks</Text>
            <Text style={styles.inclusionItem}>✓ Complimentary Wi-Fi</Text>
            <Text style={styles.inclusionItem}>✓ Villa Concierge</Text>
          </View>
        </View>

        {/* Price Breakdown */}
        <View style={styles.breakdownCard}>
          <View style={styles.breakdownHeader}>
            <Ionicons name="receipt-outline" size={16} color={COLORS.goldPrimary} />
            <Text style={styles.breakdownTitle}>Price Breakdown</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceItemText}>Complete Villa (₹ {Number(pricePerNight).toLocaleString('en-IN')} × {nights} nights)</Text>
            <Text style={styles.priceValText}>₹ {baseTotal.toLocaleString('en-IN')}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceItemText}>Taxes & Service Fees (12%)</Text>
            <Text style={styles.priceValText}>₹ {taxes.toLocaleString('en-IN')}</Text>
          </View>

          <View style={[styles.priceRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalVal}>₹ {grandTotal.toLocaleString('en-IN')}</Text>
          </View>
        </View>

      </ScrollView>

      {/* Floating Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity 
          style={styles.bookBtn} 
          activeOpacity={0.88}
          onPress={() => {
            navigation.navigate('GuestDetails', {
              villa,
              room: completeVillaOption,
              grandTotal,
              nights,
              checkIn,
              checkOut,
            });
          }}
        >
          <Text style={styles.bookBtnText}>Book This Stay</Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.actionText} style={{ marginLeft: 6 }} />
        </TouchableOpacity>

        <View style={styles.secureBadge}>
          <Ionicons name="lock-closed-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.secureText}>Secure booking with encrypted payments</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgMain },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: COLORS.bgDeep,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  backBtn: { padding: 4 },
  headerCenter: { alignItems: 'center' },
  headerBrand: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold' },
  headerSubtitle: { color: COLORS.goldPrimary, fontSize: 10, letterSpacing: 1.5, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 4 },
  scrollContent: { padding: 16 },
  heroBox: { width: '100%', height: 200, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  bestsellerBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.goldPrimary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bestsellerText: { color: COLORS.actionText, fontSize: 11, fontWeight: 'bold' },
  photoCountBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(7, 21, 17, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  photoCountText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  villaMeta: { marginTop: 14, marginBottom: 12 },
  villaName: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700' },
  locationRatingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  locationText: { color: COLORS.textSecondary, fontSize: 13, marginLeft: 4, fontWeight: '500' },
  ratingText: { color: COLORS.goldPrimary, fontSize: 12, fontWeight: '600', marginLeft: 4 },
  datesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 16,
  },
  dateBlock: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dateVal: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700' },
  dateLabel: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
  dateDivider: { width: 1, height: 24, backgroundColor: COLORS.borderLight, marginHorizontal: 8 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.goldPrimary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 6,
  },
  editBtnText: { color: COLORS.goldPrimary, fontSize: 11, fontWeight: '600', marginLeft: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
  sectionSubTitle: { color: COLORS.textMuted, fontSize: 12 },
  completeVillaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
  },
  completeVillaBadgeText: {
    color: COLORS.goldPrimary,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  exclusiveTag: {
    backgroundColor: COLORS.goldPrimary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  exclusiveTagText: {
    color: COLORS.actionText,
    fontSize: 9.5,
    fontWeight: '800',
  },
  roomCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 12,
  },
  roomCardActive: { borderColor: COLORS.goldPrimary, backgroundColor: COLORS.bgCardElevated },
  roomThumb: { width: 75, height: 75, borderRadius: 10 },
  roomDetails: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  roomTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  roomFeatures: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  roomSpecsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  roomSpec: { color: COLORS.textMuted, fontSize: 10 },
  roomPriceCol: { alignItems: 'flex-end', justifyContent: 'space-between' },
  roomPrice: { color: COLORS.goldPrimary, fontSize: 14, fontWeight: 'bold' },
  perNightLabel: { color: COLORS.textMuted, fontSize: 10 },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  radioCircleActive: { borderColor: COLORS.goldPrimary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.goldPrimary },
  benefitsRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 12 },
  benefitCard: {
    flex: 0.48,
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  benefitTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  benefitSub: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 15 },
  inclusionItem: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 18 },
  breakdownCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginTop: 4,
  },
  breakdownHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  breakdownTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', marginLeft: 6 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  priceItemText: { color: COLORS.textSecondary, fontSize: 13 },
  priceValText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '500' },
  totalRow: { borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingTop: 10, marginTop: 6 },
  totalLabel: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  totalVal: { color: COLORS.goldPrimary, fontSize: 18, fontWeight: 'bold' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.bgCard,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  bookBtn: {
    backgroundColor: COLORS.goldPrimary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 25,
  },
  bookBtnText: { color: COLORS.actionText, fontSize: 16, fontWeight: 'bold' },
  secureBadge: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  secureText: { color: COLORS.textMuted, fontSize: 11, marginLeft: 4 },
});
