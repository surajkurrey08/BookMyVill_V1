import { useAppTheme } from '../../context/ThemeContext';
import React, { useState, useMemo } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Share, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BrandLogo from '../../components/BrandLogo';
import { resolveVillaPhoto, getStableVillaFallback } from '../../utils/media';

export default function BookingConfirmedScreen({ route, navigation }) {
  const { colors: COLORS, mode } = useAppTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const { 
    villa, 
    guest = {}, 
    bookingId = 'BMV-82451', 
    grandTotal = 68500, 
    nights = 4,
    checkIn = 'Tomorrow',
    checkOut = 'In 4 days',
  } = route.params || {};

  const [heroImgError, setHeroImgError] = useState(false);
  const rawHeroPhoto = (villa?.photos && villa.photos[0]) || (villa?.images && villa.images[0]) || villa?.featuredImage;
  const heroImage = heroImgError
    ? getStableVillaFallback(villa?._id || villa?.name, 0)
    : resolveVillaPhoto(rawHeroPhoto, villa?._id || villa?.name, 0);

  return (
    <View style={styles.container}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ width: 32 }} />
        <View style={styles.headerCenter}>
          <BrandLogo size={20} color={COLORS.goldLight} />
          <Text style={styles.brandSub}>PREMIUM VILLA STAYS</Text>
        </View>
        <TouchableOpacity 
          style={styles.closeBtn}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
          accessibilityRole="button"
          accessibilityLabel="Return to home"
        >
          <Ionicons name="close" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Celebration Badge */}
        <View style={styles.celebrationWrap}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={32} color={COLORS.actionText} />
          </View>
          <Text style={styles.congratsTitle}>Booking Confirmed!</Text>
          <Text style={styles.congratsSub}>
            Get ready for an unforgettable stay. Your villa experience is all set.
          </Text>

          {/* Booking ID Pill */}
          <View style={styles.bookingIdPill}>
            <Text style={styles.bookingIdLabel}>BOOKING ID </Text>
            <Text style={styles.bookingIdVal}>{bookingId}</Text>
            <Ionicons name="copy-outline" size={14} color={COLORS.goldPrimary} style={{ marginLeft: 6 }} />
          </View>
        </View>

        {/* Confirmed Villa Card */}
        <View style={styles.confirmedCard}>
          <Image 
            source={{ uri: heroImage }} 
            style={styles.cardImage} 
            resizeMode="cover"
            onError={() => setHeroImgError(true)}
          />
          <View style={styles.cardContent}>
            <Text style={styles.villaName}>{villa?.name || 'The Horizon Villa'}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={13} color={COLORS.goldPrimary} />
              <Text style={styles.locationText}>{villa?.location?.city || villa?.city || 'Uluwatu, Bali'}</Text>
            </View>

            <View style={styles.metaGrid}>
              <View style={styles.metaCell}>
                <Ionicons name="calendar-outline" size={14} color={COLORS.goldPrimary} />
                <Text style={styles.metaCellLabel}>CHECK-IN</Text>
                <Text style={styles.metaCellVal}>{checkIn}</Text>
              </View>
              <View style={styles.metaCell}>
                <Ionicons name="calendar" size={14} color={COLORS.goldPrimary} />
                <Text style={styles.metaCellLabel}>CHECK-OUT</Text>
                <Text style={styles.metaCellVal}>{checkOut}</Text>
              </View>
              <View style={styles.metaCell}>
                <Ionicons name="people-outline" size={14} color={COLORS.goldPrimary} />
                <Text style={styles.metaCellLabel}>GUESTS</Text>
                <Text style={styles.metaCellVal}>{guest.name ? guest.name.split(' ')[0] : 'All'} · {nights}N</Text>
              </View>
            </View>

            <View style={styles.paymentSummaryRow}>
              <View>
                <Text style={styles.paidLabel}>TOTAL PAID</Text>
                <Text style={styles.paidAmount}>₹{grandTotal.toLocaleString()}</Text>
              </View>
              <View style={styles.statusPill}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.statusGreen} />
                <Text style={styles.statusPillText}>Paid</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 5-Step Tracker */}
        <View style={styles.stepsCard}>
          {[
            { title: 'Pre Check-in', sub: 'Complete your pre check-in details' },
            { title: 'Upload ID', sub: 'Government ID for all guests' },
            { title: 'Arrival Time', sub: 'Share your expected arrival time' },
            { title: 'Directions', sub: 'Get location & travel guidance' },
            { title: 'Contact Host', sub: 'Reach out to your villa host' },
          ].map((step, idx) => (
            <TouchableOpacity key={idx} style={styles.stepRow} activeOpacity={0.8} onPress={() => Alert.alert(step.title, `${step.sub}. Contact the concierge if you need help completing this step.`)} accessibilityRole="button" accessibilityLabel={`${step.title}: ${step.sub}`}>
              <View style={styles.stepCheck}>
                <Ionicons name="checkmark" size={14} color={COLORS.actionText} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepSub}>{step.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Concierge Help Card */}
        <TouchableOpacity style={styles.helpCard} activeOpacity={0.85} onPress={() => Linking.openURL(`mailto:vip@bookmyvilla.online?subject=${encodeURIComponent(`Booking support: ${bookingId}`)}`).catch(() => Alert.alert('Private Concierge', 'Email vip@bookmyvilla.online for help with your booking.'))} accessibilityRole="button" accessibilityLabel="Contact booking support">
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200' }} 
            style={styles.helpAvatar} 
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.helpLabel}>NEED HELP?</Text>
            <Text style={styles.helpTitle}>We're here for you</Text>
            <Text style={styles.helpSub}>Get instant support for your booking.</Text>
          </View>
          <Ionicons name="chatbubbles-outline" size={20} color={COLORS.goldPrimary} />
        </TouchableOpacity>

      </ScrollView>

      {/* Floating Bottom Actions */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity 
          style={styles.viewBookingBtn} 
          activeOpacity={0.88}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Bookings' })}
        >
          <Text style={styles.viewBookingText}>View Booking →</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.invoiceBtn} 
          activeOpacity={0.85}
          onPress={() => Share.share({ title: 'BookMyVilla receipt', message: `Booking receipt\nBooking ID: ${bookingId}\nStay: ${villa?.name || 'Villa'}\nNights: ${nights}\nTotal paid: ₹${Number(grandTotal).toLocaleString('en-IN')}` })}
        >
          <Ionicons name="share-outline" size={16} color={COLORS.goldPrimary} style={{ marginRight: 6 }} />
          <Text style={styles.invoiceText}>Share Receipt</Text>
        </TouchableOpacity>
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
  headerCenter: { alignItems: 'center' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bgCard,
  },
  brandTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold' },
  brandSub: { color: COLORS.goldPrimary, fontSize: 9, letterSpacing: 1.5, marginTop: 2 },
  scrollContent: { padding: 16 },
  celebrationWrap: { alignItems: 'center', marginVertical: 14 },
  checkCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.goldPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  congratsTitle: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '700' },
  congratsSub: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 },
  bookingIdPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCardElevated,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    marginTop: 12,
  },
  bookingIdLabel: { color: COLORS.textMuted, fontSize: 11 },
  bookingIdVal: { color: COLORS.goldPrimary, fontSize: 12, fontWeight: 'bold' },
  confirmedCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginTop: 10,
  },
  cardImage: { width: '100%', height: 180 },
  cardContent: { padding: 14 },
  villaName: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  locationText: { color: COLORS.textSecondary, fontSize: 13, marginLeft: 4 },
  metaGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  metaCell: { alignItems: 'center', flex: 1 },
  metaCellLabel: { color: COLORS.textMuted, fontSize: 9, marginTop: 4, letterSpacing: 0.5 },
  metaCellVal: { color: COLORS.textPrimary, fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  paymentSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  paidLabel: { color: COLORS.textMuted, fontSize: 10 },
  paidAmount: { color: COLORS.goldPrimary, fontSize: 16, fontWeight: 'bold' },
  statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.statusGreenBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPillText: { color: COLORS.statusGreen, fontSize: 12, fontWeight: 'bold', marginLeft: 4 },
  stepsCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginTop: 14,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  stepCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.goldPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  stepSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginTop: 14,
  },
  helpAvatar: { width: 44, height: 44, borderRadius: 22 },
  helpLabel: { color: COLORS.goldPrimary, fontSize: 10, letterSpacing: 1 },
  helpTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  helpSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
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
  viewBookingBtn: {
    backgroundColor: COLORS.goldPrimary,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
  },
  viewBookingText: { color: COLORS.actionText, fontSize:
   15, fontWeight: 'bold' },
  invoiceBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 8,
  },
  invoiceText: { color: COLORS.goldPrimary, fontSize: 14, fontWeight: '600' },
});
