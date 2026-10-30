import { useAppTheme } from '../../context/ThemeContext';
import React, { useState, useMemo } from 'react';
import { 
  View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Share, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFavorites } from '../../context/FavoritesContext';
import { resolveVillaPhoto, getStableVillaFallback, LUXURY_VILLA_PHOTOS } from '../../utils/media';

const { width } = Dimensions.get('window');

const SAMPLE_GALLERY = LUXURY_VILLA_PHOTOS.slice(0, 8);

export default function VillaDetailScreen({ route, navigation }) {
  const { colors: COLORS, mode, toggleTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(COLORS, mode), [COLORS, mode]);
  const { isFavorite, toggleFavorite } = useFavorites();
  const insets = useSafeAreaInsets();
  const { villa } = route.params;

  // Use villa photos supplemented to always provide a rich 7-photo luxury gallery
  const rawImages = useMemo(() => {
    const existing = (Array.isArray(villa.photos) && villa.photos.length > 0)
      ? villa.photos
      : (Array.isArray(villa.images) && villa.images.length > 0)
        ? villa.images
        : [];
    
    const result = [...existing];
    for (let i = result.length; i < 7; i++) {
      result.push(getStableVillaFallback(villa._id || villa.name, i));
    }
    return result;
  }, [villa]);

  const [failedPhotoIndices, setFailedPhotoIndices] = useState({});

  const getImageUri = (idx) => {
    if (failedPhotoIndices[idx]) {
      return getStableVillaFallback(villa._id || villa.name || 'royal-villa', idx);
    }
    const raw = rawImages[idx];
    return resolveVillaPhoto(raw, villa._id || villa.name || 'royal-villa', idx);
  };

  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const isLiked = isFavorite(villa._id || villa.id);

  const price = villa.pricing?.basePrice || villa.pricePerNight || villa.price || 8000;
  const location = (typeof villa.location === 'string' && villa.location.trim())
    ? villa.location.trim()
    : (villa.location?.city || villa.city || 'Maharashtra, India');
  const description = villa.listingData?.description || villa.description || 'A stunning luxury villa with panoramic views, modern architectural design, and world-class amenities. Perfect for family getaways or luxury escapes.';
  const bedrooms = villa.listingData?.bedrooms || villa.details?.bedrooms || villa.bedrooms || 4;
  const guestCapacity = villa.listingData?.maxGuests || villa.details?.guestCapacity || villa.maxGuests || 8;
  const amenities = Array.isArray(villa.amenities) && villa.amenities.length > 0
    ? villa.amenities.map((amenity) => typeof amenity === 'string' ? amenity : amenity.name).filter(Boolean)
    : ['High speed Wi-Fi', 'Private chef on request', 'Gym', 'Spa and wellness', 'Airport transfer', 'Daily housekeeping'];
  const reviewCount = villa.reviewsCount || villa.reviews?.length || 0;
  const rating = villa.rating ? Number(villa.rating).toFixed(1) : '4.8';

  const handleShare = async () => {
    const villaId = villa._id || villa.id;
    const webUrl = `https://bookmyvilla.online/property/${encodeURIComponent(villaId)}`;
    const villaName = villa.name || 'Luxury Villa';
    const formattedPrice = `₹${Number(price).toLocaleString('en-IN')}`;

    try {
      await Share.share({
        title: `${villaName} | BookMyVilla`,
        message: `✨ Experience luxury at ${villaName} in ${location} (${formattedPrice}/night).\n\nExplore photos, amenities & book online:\n${webUrl}`,
        url: webUrl,
      });
    } catch (error) {
      Alert.alert('Unable to share', 'Please try sharing this stay again.');
    }
  };

  const showAmenities = () => Alert.alert(`${villa.name || 'Stay'} amenities`, amenities.join('\n'));

  const showRoomDetails = () => {
    const roomDescription = villa.details?.roomDescription || villa.roomDescription || 'Room details are confirmed by the host after you choose your dates.';
    Alert.alert('Room details', `${bedrooms} bedrooms · accommodates up to ${guestCapacity} guests\n\n${roomDescription}`);
  };

  const showReviewSummary = () => {
    const countText = reviewCount ? `Based on ${reviewCount} guest reviews.` : 'Guest reviews will appear here as guests share their stays.';
    Alert.alert('Guest reviews', `${rating} out of 5\n${countText}`);
  };

  // Format title so it never repeats "Villa Villa"
  const rawName = villa.name || 'Royal Villa';
  const nameParts = rawName.trim().split(' ');
  const hasVillaSuffix = nameParts.length > 1 && nameParts[nameParts.length - 1].toLowerCase() === 'villa';
  const mainTitle = hasVillaSuffix ? nameParts.slice(0, -1).join(' ') : rawName;
  const suffix = hasVillaSuffix ? 'Villa' : '';

  return (
    <View style={styles.container}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 + insets.bottom }]} 
        showsVerticalScrollIndicator={false}
      >
        {/* Main Hero Photo Container */}
        <View style={styles.heroContainer}>
          <Image 
            key={getImageUri(selectedImageIdx)}
            source={{ uri: getImageUri(selectedImageIdx) }} 
            style={styles.heroImage} 
            resizeMode="cover"
            onError={() => {
              setFailedPhotoIndices(prev => ({ ...prev, [selectedImageIdx]: true }));
            }}
          />

          {/* Top Floating Header Buttons */}
          <View style={[styles.topBar, { top: insets.top + 8 }]}>
            <TouchableOpacity 
              style={styles.iconCircle} 
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={22} color={mode === 'dark' ? '#FFFFFF' : '#1D2924'} />
            </TouchableOpacity>

            <View style={styles.topRightIcons}>
              <TouchableOpacity style={styles.iconCircle} activeOpacity={0.8} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share this stay">
                <Ionicons name="share-social-outline" size={20} color={mode === 'dark' ? '#FFFFFF' : '#1D2924'} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.iconCircle, { marginLeft: 10 }]} 
                accessibilityRole="button"
                accessibilityLabel={isLiked ? 'Remove from saved stays' : 'Save this stay'}
                onPress={() => toggleFavorite(villa)}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={20} 
                  color={isLiked ? '#FF4D4D' : (mode === 'dark' ? '#FFFFFF' : '#1D2924')} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Photo Counter Badge */}
          <View style={styles.photoBadge}>
            <Ionicons name="images-outline" size={13} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.photoBadgeText}>{selectedImageIdx + 1} / {rawImages.length}</Text>
          </View>
        </View>

        {/* Horizontal Photo Thumbnail Row */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.thumbnailRow}
        >
          {rawImages.map((_, idx) => {
            const isSelected = selectedImageIdx === idx;
            const thumbUri = getImageUri(idx);
            return (
              <TouchableOpacity 
                key={idx} 
                activeOpacity={0.85} 
                onPress={() => setSelectedImageIdx(idx)}
                style={[styles.thumbnailWrap, isSelected && styles.thumbnailWrapActive]}
              >
                <Image 
                  key={thumbUri}
                  source={{ uri: thumbUri }} 
                  style={styles.thumbnail}
                  resizeMode="cover"
                  onError={() => {
                    setFailedPhotoIndices(prev => ({ ...prev, [idx]: true }));
                  }}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Villa Title & Rating Header */}
        <View style={styles.contentPad}>
          <View style={styles.titleRow}>
            <Text style={styles.villaTitle}>
              {mainTitle}{' '}
              {suffix ? <Text style={styles.titleGold}>{suffix}</Text> : null}
            </Text>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={14} color={COLORS.goldPrimary} />
              <Text style={styles.ratingText}>
                {rating}
              </Text>
            </View>
          </View>

          <View style={styles.locationRow}>
            <Ionicons name="location" size={15} color={COLORS.goldPrimary} />
            <Text style={styles.locationText}>{location}</Text>
            {reviewCount > 0 && <Text style={styles.reviewsCount}>({reviewCount} reviews)</Text>}
          </View>

          {/* 4 Overview Spec Badges */}
          <View style={styles.specsRow}>
            <View style={styles.specItem}>
              <Ionicons name="water-outline" size={22} color={COLORS.goldPrimary} />
              <Text style={styles.specText}>Private Pool</Text>
            </View>
            <View style={styles.specDivider} />
            <View style={styles.specItem}>
              <Ionicons name="bed-outline" size={22} color={COLORS.goldPrimary} />
              <Text style={styles.specText}>{bedrooms} Bedrooms</Text>
            </View>
            <View style={styles.specDivider} />
            <View style={styles.specItem}>
              <Ionicons name="people-outline" size={22} color={COLORS.goldPrimary} />
              <Text style={styles.specText}>Up to {guestCapacity} Guests</Text>
            </View>
            <View style={styles.specDivider} />
            <View style={styles.specItem}>
              <Ionicons name="sunny-outline" size={22} color={COLORS.goldPrimary} />
              <Text style={styles.specText}>Scenic View</Text>
            </View>
          </View>

          {/* Description */}
          <Text style={styles.descriptionText} numberOfLines={descriptionExpanded ? undefined : 3}>
            {description}{' '}
            <Text style={styles.readMoreText} onPress={() => setDescriptionExpanded((expanded) => !expanded)}>{descriptionExpanded ? 'Read Less' : 'Read More'}</Text>
          </Text>

          {/* "What You'll Love" Section */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>What You'll Love</Text>
            <TouchableOpacity onPress={showAmenities} accessibilityRole="button">
              <Text style={styles.seeAllText}>See All Amenities ›</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.amenitiesScroll}>
            {amenities.slice(0, 6).map((label, i) => (
              <View key={i} style={styles.amenityBox}>
                <View style={styles.amenityIconCircle}>
                  <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.goldPrimary} />
                </View>
                <Text style={styles.amenityLabel} numberOfLines={2}>{label}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Room Highlights Card */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Room Highlights</Text>
            <TouchableOpacity onPress={showRoomDetails} accessibilityRole="button">
              <Text style={styles.seeAllText}>See Room Details ›</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.roomCard} activeOpacity={0.8} onPress={showRoomDetails} accessibilityRole="button" accessibilityLabel="Show room details">
            <Image 
              source={{ uri: getImageUri(1) }} 
              style={styles.roomImage} 
              resizeMode="cover"
              onError={() => {
                setFailedPhotoIndices(prev => ({ ...prev, 1: true }));
              }}
            />
            <View style={styles.roomInfo}>
              <Text style={styles.roomName}>Master Suite</Text>
              <Text style={styles.roomSub}>King bed, mountain view terrace, en-suite bathroom, walk-in closet</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          {/* Guest Reviews Card */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Guest Reviews</Text>
            <TouchableOpacity onPress={showReviewSummary} accessibilityRole="button">
              <Text style={styles.seeAllText}>See All Reviews ›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.reviewCard}>
            <View style={styles.reviewerRow}>
              <Image 
                source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200' }} 
                style={styles.reviewerAvatar} 
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.reviewerName}>Priya Mehta</Text>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.goldPrimary} style={{ marginLeft: 4 }} />
                </View>
                <View style={{ flexDirection: 'row', marginTop: 2 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons key={s} name="star" size={12} color={COLORS.goldPrimary} />
                  ))}
                </View>
              </View>
              <Text style={styles.reviewTime}>2 weeks ago</Text>
            </View>
            <Text style={styles.reviewBody}>
              “Absolutely magical! The villa was even more beautiful in person. Stunning views, exceptional service, and every detail was perfect.”
            </Text>
          </View>

        </View>
      </ScrollView>

      {/* Floating Bottom Booking Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View>
          <Text style={styles.pricePerNight}>
            <Text style={styles.priceAmount}>₹ {price.toLocaleString()}</Text> / night
          </Text>
          <Text style={styles.taxLabel}>Includes taxes & fees</Text>
        </View>

        <TouchableOpacity 
          style={styles.reserveBtn} 
          activeOpacity={0.88}
          onPress={() => {
            navigation.navigate('StayDetails', { villa });
          }}
        >
          <Text style={styles.reserveBtnText}>Reserve Now</Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.actionText} style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (COLORS, mode = 'light') => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgMain },
  scrollContent: { paddingBottom: 110 },
  heroContainer: { width: '100%', height: 320, position: 'relative', backgroundColor: COLORS.bgCardElevated },
  heroImage: { width: '100%', height: '100%', backgroundColor: COLORS.bgCardElevated },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  topRightIcons: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: mode === 'dark' ? 'rgba(7, 21, 17, 0.85)' : '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : '#E2E7E2',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  photoBadge: {
    position: 'absolute',
    bottom: 14,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(7, 21, 17, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  photoBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  thumbnailRow: { paddingHorizontal: 16, paddingVertical: 12 },
  thumbnailWrap: {
    width: 68,
    height: 52,
    borderRadius: 10,
    marginRight: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: COLORS.bgCardElevated,
  },
  thumbnailWrapActive: { 
    borderColor: COLORS.goldPrimary,
  },
  thumbnail: { 
    width: 68, 
    height: 52,
  },
  contentPad: { paddingHorizontal: 18 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  villaTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  titleGold: { color: COLORS.goldPrimary },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  ratingText: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 4,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  locationText: { color: COLORS.textSecondary, fontSize: 14, marginLeft: 4, fontWeight: '500' },
  reviewsCount: { color: COLORS.textMuted, fontSize: 13, marginLeft: 8 },
  specsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginTop: 18,
    borderWidth: 1,
    borderColor: COLORS.borderGold,
  },
  specItem: { alignItems: 'center', flex: 1 },
  specDivider: { width: 1, height: 26, backgroundColor: COLORS.borderLight },
  specText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  descriptionText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 16,
  },
  readMoreText: { color: COLORS.goldPrimary, fontWeight: '700' },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  seeAllText: { color: COLORS.goldPrimary, fontSize: 13, fontWeight: '600' },
  amenitiesScroll: { paddingVertical: 4 },
  amenityBox: { alignItems: 'center', marginRight: 18, width: 72 },
  amenityIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.borderGold,
    marginBottom: 8,
  },
  amenityLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 15,
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  roomImage: { width: 75, height: 65, borderRadius: 10 },
  roomInfo: { flex: 1, marginLeft: 12 },
  roomName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  roomSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 16 },
  reviewCard: {
    backgroundColor: COLORS.bgCard,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  reviewerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  reviewerAvatar: { width: 40, height: 40, borderRadius: 20 },
  reviewerName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  reviewTime: { color: COLORS.textMuted, fontSize: 12 },
  reviewBody: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, fontStyle: 'italic' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.bgCard,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 12,
  },
  pricePerNight: { fontSize: 12, color: COLORS.textMuted },
  priceAmount: { fontSize: 20, fontWeight: 'bold', color: COLORS.goldPrimary },
  taxLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  reserveBtn: {
    backgroundColor: COLORS.goldPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  reserveBtnText: { color: COLORS.actionText, fontSize: 15, fontWeight: 'bold' },
});
