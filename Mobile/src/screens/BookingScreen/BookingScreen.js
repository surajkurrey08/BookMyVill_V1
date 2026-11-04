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
  Image,
  Linking,
  Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BrandLogo from '../../components/BrandLogo';
import { AuthContext } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { resolveVillaPhoto, getStableVillaFallback } from '../../utils/media';
import { formatVillaLocation } from '../../utils/location';

export default function BookingScreen({ navigation }) {
  const { colors: COLORS, mode } = useAppTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const { user } = useContext(AuthContext);

  const [filterTab, setFilterTab] = useState('upcoming'); // 'upcoming' | 'completed' | 'cancelled'
  const [bookings, setBookings] = useState([]);
  const [localEnquiries, setLocalEnquiries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failedPhotoIds, setFailedPhotoIds] = useState({});

  const fetchBookings = async () => {
    try {
      setLoading(true);
      // 1. Fetch locally cached enquiries submitted from this phone
      const rawEnquiries = await AsyncStorage.getItem('@bookmyvilla_my_enquiries');
      if (rawEnquiries) {
        setLocalEnquiries(JSON.parse(rawEnquiries));
      }

      // 2. Fetch server bookings if logged in
      if (user) {
        const res = await apiClient.get('/bookings/my-bookings');
        const list = Array.isArray(res.data) ? res.data : (res.data.bookings || []);
        setBookings(list);
      }
    } catch (err) {
      console.log('Error fetching user bookings/enquiries:', err.message);
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

  // Combined List: user enquiries (at top) + confirmed bookings
  const displayList = useMemo(() => {
    if (filterTab === 'upcoming') {
      const enqs = localEnquiries.map((e) => ({ ...e, isEnquiry: true }));
      const serverUpcoming = bookings.filter((b) => {
        const status = (b.status || 'confirmed').toLowerCase();
        return status === 'confirmed' || status === 'pending';
      });
      return [...enqs, ...serverUpcoming];
    }
    if (filterTab === 'completed') {
      return bookings.filter((b) => (b.status || '').toLowerCase() === 'completed');
    }
    if (filterTab === 'cancelled') {
      return bookings.filter((b) => (b.status || '').toLowerCase() === 'cancelled');
    }
    return [];
  }, [filterTab, localEnquiries, bookings]);

  // State 1: User has neither logged in nor made any enquiries
  if (!user && localEnquiries.length === 0 && !loading) {
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
            <Ionicons name="calendar-outline" size={36} color={COLORS.goldPrimary} />
          </View>
          <Text style={styles.emptyTitle}>No Stays or Enquiries Yet</Text>
          <Text style={styles.emptySub}>
            Discover luxury villas in Mahabaleshwar, select your preferred dates, and send an enquiry or book via WhatsApp with ease.
          </Text>
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.88}
          >
            <Text style={styles.actionBtnText}>Explore Luxury Villas →</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.borderLight, marginTop: 12 }]}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.88}
          >
            <Text style={[styles.actionBtnText, { color: COLORS.textPrimary }]}>Sign In with OTP</Text>
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
          <Text style={styles.loadingText}>Fetching your luxury stays & enquiries...</Text>
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
          <Text style={styles.brandSub}>MY STAYS & ENQUIRIES</Text>
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
            Active / Upcoming ({localEnquiries.length + bookings.filter(b => (b.status || 'confirmed').toLowerCase() !== 'cancelled' && (b.status || 'confirmed').toLowerCase() !== 'completed').length})
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
        data={displayList}
        keyExtractor={(item, index) => item._id || item.id || index.toString()}
        renderItem={({ item }) => {
          // 1. RENDER SUBMITTED VILLA ENQUIRY CARD
          if (item.isEnquiry) {
            const photoUrl = item.photo || getStableVillaFallback(item.villaId || item.villaName, 0);
            return (
              <View style={styles.bookingCard}>
                <Image 
                  source={{ uri: photoUrl }} 
                  style={styles.cardImage} 
                  resizeMode="cover"
                />

                <View style={styles.cardBody}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.villaTitle} numberOfLines={1}>{item.villaName}</Text>
                      <View style={styles.locRow}>
                        <Ionicons name="location" size={12} color={COLORS.goldPrimary} />
                        <Text style={styles.locText}>{item.city || 'Maharashtra'}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: 'rgba(217, 119, 6, 0.15)', borderColor: '#d97706', borderWidth: 1 }]}>
                      <Text style={[styles.statusText, { color: '#d97706' }]}>ENQUIRY SENT</Text>
                    </View>
                  </View>

                  {/* Dates Row */}
                  <View style={styles.datesBox}>
                    <View style={styles.dateCol}>
                      <Text style={styles.dateLabel}>CHECK-IN</Text>
                      <Text style={styles.dateVal}>{item.checkIn}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={14} color={COLORS.textMuted} />
                    <View style={styles.dateCol}>
                      <Text style={styles.dateLabel}>CHECK-OUT</Text>
                      <Text style={styles.dateVal}>{item.checkOut}</Text>
                    </View>
                  </View>

                  <Text style={{ fontSize: 12, color: COLORS.textMuted, marginVertical: 6 }}>
                    👥 {item.adultsCount} Adults{item.childrenCount > 0 ? `, ${item.childrenCount} Children` : ''} · {item.nights} Nights
                  </Text>

                  {/* Direct Actions: WhatsApp or Call Concierge */}
                  <View style={[styles.footerRow, { marginTop: 10, gap: 8 }]}>
                    <TouchableOpacity 
                      style={[styles.detailsBtn, { backgroundColor: '#25D366', flex: 1, justifyContent: 'center' }]}
                      onPress={() => {
                        const msg = encodeURIComponent(`Hi BookMyVilla, I'm following up on my enquiry (${item.id}) for ${item.villaName} (${item.checkIn} to ${item.checkOut}). Please let me know the booking confirmation and package details.`);
                        Linking.openURL(`https://wa.me/919876543210?text=${msg}`).catch(() => {});
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="logo-whatsapp" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={[styles.detailsBtnText, { color: '#FFFFFF' }]}>Chat on WhatsApp</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.detailsBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.goldPrimary, paddingHorizontal: 12 }]}
                      onPress={() => {
                        Linking.openURL('tel:+919876543210').catch(() => {});
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="call-outline" size={14} color={COLORS.goldPrimary} style={{ marginRight: 4 }} />
                      <Text style={[styles.detailsBtnText, { color: COLORS.goldPrimary }]}>Call</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }

          // 2. RENDER CONFIRMED SERVER BOOKING CARD
          const villaName = item.property?.name || item.villaName || item.propertyName || 'The Horizon Luxury Villa';
          const total = item.totalAmount || item.paidAmount || item.pricing?.total || 143360;
          const status = item.status || 'Confirmed';
          const city = formatVillaLocation(item.property || item);
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
                    <Text style={styles.amountLabel}>STATUS</Text>
                    <Text style={styles.amountText}>Confirmed</Text>
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
              You have no active villa enquiries or reservations. Discover curated luxury stays for your next getaway.
            </Text>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => navigation.navigate('Home')}
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
