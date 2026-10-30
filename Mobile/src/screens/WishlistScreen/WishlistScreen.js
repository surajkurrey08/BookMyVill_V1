import { useAppTheme } from '../../context/ThemeContext';
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFavorites } from '../../context/FavoritesContext';
import BrandLogo from '../../components/BrandLogo';
import { resolveVillaPhoto, getStableVillaFallback } from '../../utils/media';

function WishlistCard({ item, navigation, toggleFavorite, COLORS, styles }) {
  const [imgError, setImgError] = useState(false);
  const price = item.pricing?.basePrice || item.pricePerNight || item.price || 0;
  const location = item.location?.city || item.city || item.address || 'Location not listed';
  const rating = item.rating ? Number(item.rating).toFixed(1) : '4.9';
  const image = imgError 
    ? getStableVillaFallback(item._id || item.name, 0)
    : resolveVillaPhoto(item.photos?.[0] || item.images?.[0] || item.featuredImage, item._id || item.name, 0);

  return (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.9}
      onPress={() => navigation.navigate('VillaDetail', { villa: item })}
    >
      <Image 
        source={{ uri: image }} 
        style={styles.cardImg} 
        resizeMode="cover"
        onError={() => setImgError(true)}
      />
      <TouchableOpacity 
        style={styles.heartBtn} 
        activeOpacity={0.8} 
        onPress={(event) => { event.stopPropagation(); toggleFavorite(item); }} 
        accessibilityRole="button" 
        accessibilityLabel={`Remove ${item.name} from saved stays`}
      >
        <Ionicons name="heart" size={18} color="#FF4B6E" />
      </TouchableOpacity>

      <View style={styles.cardBody}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.villaName}>{item.name}</Text>
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color={COLORS.goldPrimary} />
            <Text style={styles.ratingText}>{rating}</Text>
          </View>
        </View>

        <View style={styles.locRow}>
          <Ionicons name="location" size={12} color={COLORS.goldPrimary} />
          <Text style={styles.locText}>{location}</Text>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.priceText}>
            ₹{Number(price).toLocaleString('en-IN')} <Text style={styles.perNight}>/ night</Text>
          </Text>
          <TouchableOpacity 
            style={styles.reserveBtn} 
            onPress={(event) => { event.stopPropagation(); navigation.navigate('StayDetails', { villa: item }); }} 
            accessibilityRole="button" 
            accessibilityLabel={`Reserve ${item.name}`}
          >
            <Text style={styles.reserveText}>Reserve</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function WishlistScreen({ navigation }) {
  const { colors: COLORS, mode } = useAppTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const { favorites: savedVillas, toggleFavorite } = useFavorites();

  return (
    <View style={styles.container}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ width: 32 }} />
        <View style={styles.headerCenter}>
          <BrandLogo size={20} color={COLORS.goldLight} />
          <Text style={styles.brandSub}>YOUR SAVED SANCTUARIES</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={savedVillas}
        keyExtractor={(item, index) => item._id || item.id || index.toString()}
        contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
        ListHeaderComponent={
          <View style={styles.titleWrap}>
            <Text style={styles.headingTitle}>Wishlist ({savedVillas.length})</Text>
            <Text style={styles.headingSub}>Your handpicked luxury villa escapes saved for future trips.</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={38} color={COLORS.goldPrimary} />
            <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
            <Text style={styles.emptyText}>Save villas you love and they’ll appear here.</Text>
            <TouchableOpacity style={styles.exploreButton} onPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })} accessibilityRole="button">
              <Text style={styles.exploreButtonText}>Explore villas</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <WishlistCard 
            item={item} 
            navigation={navigation} 
            toggleFavorite={toggleFavorite} 
            COLORS={COLORS} 
            styles={styles} 
          />
        )}
      />
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
  headerCenter: { alignItems: 'center' },
  brandTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 1.5,
  },
  brandSub: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.goldPrimary,
    letterSpacing: 2,
    marginTop: 2,
  },
  titleWrap: {
    marginBottom: 16,
  },
  headingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headingSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cardImg: {
    width: '100%',
    height: 180,
  },
  heartBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(7, 21, 17, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  villaName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  locText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.goldLight,
  },
  perNight: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '400',
  },
  reserveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.goldPrimary,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
  },
  emptyState: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700', marginTop: 12 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', marginTop: 6 },
  exploreButton: { backgroundColor: COLORS.goldPrimary, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 11, marginTop: 18 },
  exploreButtonText: { color: COLORS.actionText, fontSize: 13, fontWeight: '700' },
  reserveText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.actionText,
  },
});

