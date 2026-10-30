import { useAppTheme } from '../context/ThemeContext';
import React, { useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFavorites } from '../context/FavoritesContext';
import { resolveVillaPhoto, getStableVillaFallback } from '../utils/media';

export default function VillaCard({ villa, onPress }) {
  const { colors: COLORS, mode } = useAppTheme();
  const isDark = mode === 'dark';
  const styles = useMemo(() => createStyles(COLORS, mode), [COLORS, mode]);
  const { isFavorite, toggleFavorite } = useFavorites();
  const villaId = villa._id || villa.id;
  const isSaved = isFavorite(villaId);

  const [imgError, setImgError] = useState(false);
  const rawPhoto = (villa.photos && villa.photos[0]) || 
                   (villa.images && villa.images[0]) || 
                   villa.featuredImage;
  const imageUrl = imgError 
    ? getStableVillaFallback(villaId || villa.name, 0) 
    : resolveVillaPhoto(rawPhoto, villaId || villa.name, 0);

  const price = villa.pricing?.basePrice || villa.pricePerNight || villa.price || 38500;
  const location = (typeof villa.location === 'string' && villa.location.trim()) 
    ? villa.location.trim() 
    : (villa.location?.city || villa.city || villa.address || 'Maharashtra, India');
  const rating = villa.rating ? Number(villa.rating).toFixed(1) : '4.9';
  const reviewsCount = villa.reviewsCount || villa.reviews?.length || 128;

  // Key specs
  const bedrooms = villa.bedrooms || villa.listingData?.bedrooms || villa.specs?.bedrooms || 4;
  const guests = villa.maxGuests || villa.listingData?.maxGuests || villa.specs?.maxGuests || 8;

  const handleShare = async (event) => {
    if (event?.stopPropagation) event.stopPropagation();
    const id = villa._id || villa.id;
    const webUrl = `https://bookmyvilla.online/property/${encodeURIComponent(id)}`;
    const villaName = villa.name || 'Luxury Villa';
    const formattedPrice = `₹${Number(price).toLocaleString('en-IN')}`;

    try {
      await Share.share({
        title: `${villaName} | BookMyVilla`,
        message: `✨ Experience luxury at ${villaName} in ${location} (${formattedPrice}/night).\n\nExplore photos, amenities & book online:\n${webUrl}`,
        url: webUrl,
      });
    } catch (err) {
      console.log('Share error:', err);
    }
  };

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
      {/* Villa Image Container */}
      <View style={styles.imageContainer}>
        <Image 
          key={imageUrl}
          source={{ uri: imageUrl }} 
          style={styles.image} 
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
        
        {/* Dark subtle gradient overlay at bottom of image */}
        <View style={styles.imageOverlay} />

        {/* Top Badges */}
        <View style={styles.topBadgesRow}>
          <View style={styles.luxuryPill}>
            <Ionicons name="sparkles" size={10} color={COLORS.goldPrimary} />
            <Text style={styles.luxuryPillText}>LUXURY COLLECTION</Text>
          </View>

          <View style={styles.topRightActions}>
            <TouchableOpacity 
              style={[styles.actionBtn, isDark ? styles.actionBtnDark : styles.actionBtnLight]} 
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Share ${villa.name || 'stay'}`}
              onPress={handleShare}
            >
              <Ionicons 
                name="share-social-outline" 
                size={16} 
                color={isDark ? '#FFFFFF' : '#1D2924'} 
              />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionBtn, isDark ? styles.actionBtnDark : styles.actionBtnLight, { marginLeft: 8 }]} 
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isSaved ? `Remove ${villa.name} from saved stays` : `Save ${villa.name}`}
              onPress={(event) => {
                event.stopPropagation();
                toggleFavorite(villa);
              }}
            >
              <Ionicons 
                name={isSaved ? "heart" : "heart-outline"} 
                size={17} 
                color={isSaved ? "#FF4B6E" : (isDark ? "#FFFFFF" : "#1D2924")} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Rating Floating Chip */}
        <View style={styles.floatingRating}>
          <Ionicons name="star" size={12} color={COLORS.goldPrimary} />
          <Text style={styles.floatingRatingText}>{rating}</Text>
          <Text style={styles.reviewsText}>({reviewsCount})</Text>
        </View>
      </View>
      
      {/* Content Section */}
      <View style={styles.content}>
        {/* Villa Name & Location */}
        <Text style={styles.name} numberOfLines={1}>{villa.name || 'The Horizon Luxury Villa'}</Text>

        <View style={styles.locationRow}>
          <Ionicons name="location" size={13} color={COLORS.goldPrimary} />
          <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
        </View>

        {/* Specs Pill Strip */}
        <View style={styles.specsRow}>
          <View style={styles.specItem}>
            <Ionicons name="bed-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.specText}>{bedrooms} Beds</Text>
          </View>
          <Text style={styles.specDot}>•</Text>
          <View style={styles.specItem}>
            <Ionicons name="people-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.specText}>Up to {guests} Guests</Text>
          </View>
          <Text style={styles.specDot}>•</Text>
          <View style={styles.specItem}>
            <Ionicons name="water-outline" size={12} color={COLORS.textMuted} />
            <Text style={styles.specText}>Private Pool</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Footer Pricing & CTA */}
        <View style={styles.footerRow}>
          <View>
            <Text style={styles.pricePrefix}>STARTING FROM</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={styles.priceAmount}>₹{Number(price).toLocaleString('en-IN')}</Text>
              <Text style={styles.perNight}> / night</Text>
            </View>
          </View>

          <View style={styles.reservePill}>
            <Text style={styles.reservePillText}>Reserve</Text>
            <Ionicons name="arrow-forward" size={12} color={COLORS.actionText} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (COLORS, mode) => StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard, // Deep emerald #0F2620
    borderRadius: 18,
    marginHorizontal: 16,
    marginVertical: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 210,
    backgroundColor: COLORS.bgDeep,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(7, 21, 17, 0.5)',
  },
  topBadgesRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  luxuryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(7, 21, 17, 0.85)',
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  luxuryPillText: {
    color: COLORS.goldLight,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
  actionBtnLight: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E7E2',
    shadowColor: '#000000',
  },
  actionBtnDark: {
    backgroundColor: 'rgba(7, 21, 17, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    shadowColor: '#000000',
  },
  floatingRating: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(7, 21, 17, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    gap: 4,
  },
  floatingRatingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  reviewsText: {
    color: '#DCE7E2',
    fontSize: 10,
  },

  content: {
    padding: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },

  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  specText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  specDot: {
    color: 'rgba(255, 255, 255, 0.2)',
    fontSize: 10,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.bgCardElevated,
    marginVertical: 12,
  },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pricePrefix: {
    fontSize: 8,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.goldLight,
  },
  perNight: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },

  reservePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.goldPrimary,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
    gap: 4,
  },
  reservePillText: {
    color: COLORS.actionText,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
