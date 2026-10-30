import { useAppTheme } from '../../context/ThemeContext';
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  Image 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BrandLogo from '../../components/BrandLogo';
import { AuthContext } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { resolveVillaPhoto, getStableVillaFallback } from '../../utils/media';

export default function BookingScreen({ navigation }) {
  const { colors: COLORS, mode, toggleTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const { user } = useContext(AuthContext);

  const [filterTab, setFilterTab] = useState('upcoming'); // 'upcoming' | 'completed' | 'cancelled'
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failedPhotoIds, setFailedPhotoIds] = useState({});

  const fetchBookings = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await apiClient.get('/bookings/my-bookings');
      const list = Array.isArray(res.data) ? res.data : (res.data.bookings || []);
      setBookings(list);
    } catch (err) {
      console.log('Error fetching user bookings:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  // Filter bookings based on status/tab
  const filteredBookings = bookings.filter((b) => {
    const status = (b.status || 'confirmed').toLowerCase();
    if (filterTab === 'upcoming') return status === 'confirmed' || status === 'pending';
    if (filterTab === 'completed') return status === 'completed';
    if (filterTab === 'cancelled') return status === 'cancelled';
    return true;
  });

  // State 1: User is not logged in
  if (!user) {
    return (
      <View style={styles.container}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={{ width: 32 }} />
          <View style={styles.headerCenter}>
            <BrandLogo size={20} color={COLORS.goldLight} />
            <Text style={styles.brandSub}>MY RESERVATIONS</Text>
          </View>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.centerContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed-outline" size={36} color={COLORS.goldPrimary} />
          </View>
          <Text style={styles.emptyTitle}>Sign in to view your bookings</Text>
          <Text style={styles.emptySub}>
            Access your active trips, reservation history, and villa check-in guides anytime.
          </Text>
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.88}
          >
            <Text style={styles.actionBtnText}>Sign In / Login with OTP →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // State 2: Loading
  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.goldPrimary} />
          <Text style={styles.loadingText}>Fetching your luxury stays...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={{ width: 32 }} />
        <View style={styles.headerCenter}>
          <BrandLogo size={20} color={COLORS.goldLight} />
          <Text style={styles.brandSub}>RESERVATIONS</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {/* Tabs Row */}
      <View style={styles.tabsRow}>
        <TouchableOpacity 
          style={[styles.tabChip, filterTab === 'upcoming' && styles.tabChipActive]}
          onPress={() => setFilterTab('upcoming')}
        >
          <Text style={[styles.tabChipText, filterTab === 'upcoming' && styles.tabChipTextActive]}>
            Upcoming ({bookings.filter(b => (b.status || 'confirmed').toLowerCase() !== 'cancelled' && (b.status || 'confirmed').toLowerCase() !== 'completed').length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabChip, filterTab === 'completed' && styles.tabChipActive]}
          onPress={() => setFilterTab('completed')}
        >
          <Text style={[styles.tabChipText, filterTab === 'completed' && styles.tabChipTextActive]}>
            Completed ({bookings.filter(b => (b.status || '').toLowerCase() === 'completed').length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabChip, filterTab === 'cancelled' && styles.tabChipActive]}
          onPress={() => setFilterTab('cancelled')}
        >
          <Text style={[styles.tabChipText, filterTab === 'cancelled' && styles.tabChipTextActive]}>
            Cancelled ({bookings.filter(b => (b.status || '').toLowerCase() === 'cancelled').length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredBookings}
        keyExtractor={(item, index) => item._id || item.id || index.toString()}
        renderItem={({ item }) => {
          const villaName = item.property?.name || item.villaName || item.propertyName || 'The Horizon Luxury Villa';
          const total = item.totalAmount || item.paidAmount || item.pricing?.total || 143360;
          const status = item.status || 'Confirmed';
          const city = item.property?.location?.city || item.city || 'Goa, India';
          const photo = failedPhotoIds[item._id]
            ? getStableVillaFallback(item._id || villaName, 0)
            : resolveVillaPhoto(item.property?.photos?.[0] || item.property?.images?.[0] || item.photo, item._id || villaName, 0);

          const checkInStr = item.checkIn ? new Date(item.checkIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '12 Nov 2025';
          const checkOutStr = item.checkOut ? new Date(item.checkOut).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '16 Nov 2025';

          return (
            <View style={styles.bookingCard}>
              <Image 
                source={{ uri: photo }} 
                style={styles.cardImage} 
                resizeMode="cover"
                onError={() => {
                  setFailedPhotoIds(prev => ({ ...prev, [item._id]: true }));
                }}
              />

              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.villaTitle} numberOfLines={1}>{villaName}</Text>
                    <View style={styles.locRow}>
                      <Ionicons name="location" size={12} color={COLORS.goldPrimary} />
                      <Text style={styles.locText}>{city}</Text>
                    </View>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{status.toUpperCase()}</Text>
                  </View>
                </View>

                {/* Dates Row */}
                <View style={styles.datesBox}>
                  <View style={styles.dateCol}>
                    <Text style={styles.dateLabel}>CHECK-IN</Text>
                    <Text style={styles.dateVal}>{checkInStr}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={14} color={COLORS.textMuted} />
                  <View style={styles.dateCol}>
                    <Text style={styles.dateLabel}>CHECK-OUT</Text>
                    <Text style={styles.dateVal}>{checkOutStr}</Text>
                  </View>
                </View>

                {/* Footer Strip */}
                <View style={styles.footerRow}>
                  <View>
                    <Text style={styles.amountLabel}>TOTAL PAID</Text>
                    <Text style={styles.amountText}>₹{Number(total).toLocaleString()}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.detailsBtn}
                    onPress={() => navigation.navigate('BookingConfirmed', { 
                      villa: item.property, 
                      bookingId: item.bookingId || `BMV-${item._id?.slice(-5)}`,
                      checkIn: checkInStr,
                      checkOut: checkOutStr,
                      grandTotal: total,
                      nights: item.nights || 3,
                      guest: item.guest || {},
                    })}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.detailsBtnText}>View Voucher</Text>
                    <Ionicons name="chevron-forward" size={14} color={COLORS.actionText} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.goldPrimary} colors={[COLORS.goldPrimary]} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="bed-outline" size={36} color={COLORS.goldPrimary} />
            </View>
            <Text style={styles.emptyTitle}>No {filterTab} Stays Found</Text>
            <Text style={styles.emptySub}>
              You have no {filterTab} villa reservations. Discover curated luxury stays for your next gateway.
            </Text>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => navigation.navigate('Explore')}
              activeOpacity={0.88}
            >
              <Text style={styles.actionBtnText}>Explore Luxury Villas →</Text>
            </TouchableOpacity>
          </View>
        }
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: COLORS.bgDeep,
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

  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: COLORS.bgDeep,
  },
  tabChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.bgCardElevated,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  tabChipActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: COLORS.goldPrimary,
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabChipTextActive: {
    color: COLORS.goldPrimary,
    fontWeight: '700',
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    marginTop: 30,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: COLORS.textPrimary, 
    textAlign: 'center' 
  },
  emptySub: { 
    fontSize: 13, 
    color: COLORS.textMuted, 
    textAlign: 'center', 
    marginTop: 6, 
    marginBottom: 20, 
    lineHeight: 19 
  },
  actionBtn: {
    backgroundColor: COLORS.goldPrimary,
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 10,
  },
  actionBtnText: { 
    color: COLORS.actionText, 
    fontSize: 13, 
    fontWeight: '700' 
  },
  loadingText: { 
    marginTop: 12, 
    fontSize: 14, 
    color: COLORS.textMuted 
  },

  bookingCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  cardImage: {
    width: '100%',
    height: 140,
    backgroundColor: COLORS.bgDeep,
  },
  cardBody: {
    padding: 14,
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start' 
  },
  villaTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: COLORS.textPrimary 
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
  statusBadge: {
    backgroundColor: 'rgba(76, 217, 100, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(76, 217, 100, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: { 
    fontSize: 10, 
    fontWeight: '700', 
    color: COLORS.statusGreen, 
    letterSpacing: 0.5 
  },

  datesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bgDeep,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  dateCol: { alignItems: 'center' },
  dateLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.goldPrimary,
    letterSpacing: 0.8,
  },
  dateVal: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 2,
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
  amountLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
  },
  amountText: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: COLORS.goldLight 
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.goldPrimary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  detailsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.actionText,
  },
});
