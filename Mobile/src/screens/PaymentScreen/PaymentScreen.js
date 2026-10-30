import { useAppTheme } from '../../context/ThemeContext';
import React, { useState, useMemo } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '../../api/client';
import BrandLogo from '../../components/BrandLogo';
import { resolveVillaPhoto, getStableVillaFallback } from '../../utils/media';

export default function PaymentScreen({ route, navigation }) {
  const { colors: COLORS, mode, toggleTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const { 
    villa, 
    room, 
    grandTotal = 143360, 
    payableNow = 143360, 
    balanceAtVilla = 0,
    nights = 3, 
    checkIn = 'Tomorrow',
    checkOut = 'In 3 days',
    guest = {} 
  } = route.params || {};

  // Payment states
  const [selectedMethod, setSelectedMethod] = useState('card'); // 'upi', 'card', 'netbanking', 'wallet', 'paylater'
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(2240);
  const [promoApplied, setPromoApplied] = useState(true);
  const [cardNumber, setCardNumber] = useState('1234 5678 9012 3456');
  const [cardHolder, setCardHolder] = useState(guest.name || '');
  const [expiry, setExpiry] = useState('12 / 28');
  const [cvv, setCvv] = useState('123');
  const [isProcessing, setIsProcessing] = useState(false);

  const roomCharges = Math.round(grandTotal / 1.12);
  const taxes = grandTotal - roomCharges;
  const welcomeBenefits = 4000;
  const finalPayable = Math.max(0, (payableNow || grandTotal) - (promoApplied ? discount : 0));

  const [heroImgError, setHeroImgError] = useState(false);
  const rawHeroPhoto = (villa?.photos && villa.photos[0]) || (villa?.images && villa.images[0]) || villa?.featuredImage;
  const heroImage = heroImgError
    ? getStableVillaFallback(villa?._id || villa?.name, 0)
    : resolveVillaPhoto(rawHeroPhoto, villa?._id || villa?.name, 0);

  const handleApplyPromo = () => {
    if (!promoCode.trim()) {
      Alert.alert('Promo Code', 'Please enter a valid coupon code.');
      return;
    }
    if (promoCode.trim().toUpperCase() === 'VILLA20' || promoCode.trim().toUpperCase() === 'GOLD') {
      setDiscount(2240);
      setPromoApplied(true);
      Alert.alert('Promo Applied! 🎉', 'You saved ₹2,240 on this booking.');
    } else {
      Alert.alert('Invalid Code', 'Coupon code not found or expired.');
    }
  };

  const handlePayment = async () => {
    try {
      setIsProcessing(true);

      // Simulate order processing or call backend
      const bookingPayload = {
        propertyId: villa?._id || villa?.id,
        villaName: villa?.name,
        guest,
        totalAmount: grandTotal,
        paidAmount: finalPayable,
        paymentMethod: selectedMethod,
        nights,
      };

      // Call backend if available
      try {
        await apiClient.post('/bookings', bookingPayload);
      } catch (e) {
        console.log('Backend sync note:', e.message);
      }

      // Generate simulated booking reference
      const bookingId = `BMV-${Math.floor(10000 + Math.random() * 90000)}`;

      // Navigate to Booking Confirmed Screen (Screenshot #3)
      navigation.navigate('BookingConfirmed', {
        villa,
        guest,
        bookingId,
        grandTotal: finalPayable,
        nights,
        checkIn,
        checkOut,
      });

    } catch (err) {
      Alert.alert('Payment Error', 'Could not process transaction. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

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
          <Text style={styles.brandSub}>PREMIUM VILLA STAYS</Text>
        </View>

        <View style={{ width: 32 }} />
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.pageHeader}>
          <Text style={styles.mainTitle}>Payment</Text>
          <Text style={styles.pageSub}>Secure your perfect getaway</Text>
        </View>

        {/* Selected Villa Card */}
        <View style={styles.summaryCard}>
          <Image 
            source={{ uri: heroImage }} 
            style={styles.summaryImg} 
            resizeMode="cover"
            onError={() => setHeroImgError(true)}
          />
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryTitle} numberOfLines={1}>{villa?.name || 'The Horizon Villa'}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="location" size={12} color={COLORS.goldPrimary} />
              <Text style={styles.metaText}>{villa?.location?.city || villa?.city || 'Udaipur, Rajasthan'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={12} color={COLORS.textMuted} />
              <Text style={styles.dateText}>{checkIn} - {checkOut}</Text>
            </View>
            <Text style={styles.nightSpec}>{nights} {nights === 1 ? 'Night' : 'Nights'}  •  Up to {villa?.maxGuests || villa?.details?.guestCapacity || 8} Guests</Text>
            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>₹{finalPayable.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Price Breakdown Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Price Breakdown</Text>
          
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Complete Villa ({nights} Nights)</Text>
            <Text style={styles.breakdownVal}>₹{roomCharges.toLocaleString()}</Text>
          </View>

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Taxes & Fees (18% GST)</Text>
            <Text style={styles.breakdownVal}>₹{taxes.toLocaleString()}</Text>
          </View>

          <View style={styles.breakdownRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.breakdownLabel}>Welcome Benefits</Text>
              <Ionicons name="information-circle-outline" size={13} color={COLORS.textMuted} style={{ marginLeft: 4 }} />
            </View>
            <Text style={styles.breakdownVal}>₹{welcomeBenefits.toLocaleString()}</Text>
          </View>

          {promoApplied && (
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: COLORS.statusGreen }]}>Promo Discount</Text>
              <Text style={[styles.breakdownVal, { color: COLORS.statusGreen }]}>- ₹{discount.toLocaleString()}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>Total Payable</Text>
            <Text style={styles.grandTotalVal}>₹{finalPayable.toLocaleString()}</Text>
          </View>

          {/* Promo Code Box */}
          <View style={styles.promoWrap}>
            <Ionicons name="pricetag-outline" size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
            <TextInput 
              style={styles.promoInput}
              placeholder="Enter promo code (e.g. GOLD)"
              placeholderTextColor={COLORS.textMuted}
              value={promoCode}
              onChangeText={setPromoCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.applyBtn} onPress={handleApplyPromo}>
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Payment Method Selector */}
        <Text style={[styles.sectionHeaderLabel, { marginTop: 18 }]}>Select Payment Method</Text>

        {/* 1. UPI */}
        <TouchableOpacity 
          style={[styles.methodCard, selectedMethod === 'upi' && styles.methodCardActive]}
          onPress={() => setSelectedMethod('upi')}
          activeOpacity={0.85}
        >
          <View style={styles.methodIconCircle}>
            <Ionicons name="flash-outline" size={20} color={COLORS.goldPrimary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.methodTitle}>UPI</Text>
            <Text style={styles.methodSub}>Google Pay, PhonePe, Paytm, etc.</Text>
          </View>
          <View style={[styles.radio, selectedMethod === 'upi' && styles.radioActive]}>
            {selectedMethod === 'upi' && <View style={styles.radioDot} />}
          </View>
        </TouchableOpacity>

        {/* 2. Credit / Debit Card (With accordion fields) */}
        <TouchableOpacity 
          style={[styles.methodCard, selectedMethod === 'card' && styles.methodCardActive, { flexDirection: 'column', alignItems: 'stretch' }]}
          onPress={() => setSelectedMethod('card')}
          activeOpacity={0.9}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.methodIconCircle}>
              <Ionicons name="card-outline" size={20} color={COLORS.goldPrimary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.methodTitle}>Credit / Debit Card</Text>
              <Text style={styles.methodSub}>Visa, Mastercard, Rupay, Amex</Text>
            </View>
            <View style={[styles.radio, selectedMethod === 'card' && styles.radioActive]}>
              {selectedMethod === 'card' && <View style={styles.radioDot} />}
            </View>
          </View>

          {/* Expanded Card Form */}
          {selectedMethod === 'card' && (
            <View style={styles.cardForm}>
              <Text style={styles.subInputLabel}>Card Number</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="card" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                <TextInput 
                  style={styles.textInput} 
                  value={cardNumber} 
                  onChangeText={setCardNumber}
                  keyboardType="numeric"
                  placeholder="1234 5678 9012 3456"
                  placeholderTextColor={COLORS.textMuted}
                />
                <Text style={styles.cardBrandBadge}>VISA</Text>
              </View>

              <Text style={[styles.subInputLabel, { marginTop: 10 }]}>Cardholder Name</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                <TextInput 
                  style={styles.textInput} 
                  value={cardHolder} 
                  onChangeText={setCardHolder}
                  placeholder="Name on card"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <View style={{ flexDirection: 'row', marginTop: 10 }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.subInputLabel}>Expiry Date</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="calendar-outline" size={16} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                    <TextInput 
                      style={styles.textInput} 
                      value={expiry} 
                      onChangeText={setExpiry}
                      placeholder="MM / YY"
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </View>
                </View>

                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.subInputLabel}>CVV</Text>
                  <View style={styles.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={16} color={COLORS.textMuted} style={{ marginRight: 6 }} />
                    <TextInput 
                      style={styles.textInput} 
                      value={cvv} 
                      onChangeText={setCvv}
                      keyboardType="numeric"
                      secureTextEntry
                      maxLength={4}
                      placeholder="123"
                      placeholderTextColor={COLORS.textMuted}
                    />
                  </View>
                </View>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* 3. Net Banking */}
        <TouchableOpacity 
          style={[styles.methodCard, selectedMethod === 'netbanking' && styles.methodCardActive]}
          onPress={() => setSelectedMethod('netbanking')}
          activeOpacity={0.85}
        >
          <View style={styles.methodIconCircle}>
            <Ionicons name="business-outline" size={20} color={COLORS.goldPrimary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.methodTitle}>Net Banking</Text>
            <Text style={styles.methodSub}>All major banks</Text>
          </View>
          <View style={[styles.radio, selectedMethod === 'netbanking' && styles.radioActive]}>
            {selectedMethod === 'netbanking' && <View style={styles.radioDot} />}
          </View>
        </TouchableOpacity>

        {/* 4. Wallets */}
        <TouchableOpacity 
          style={[styles.methodCard, selectedMethod === 'wallet' && styles.methodCardActive]}
          onPress={() => setSelectedMethod('wallet')}
          activeOpacity={0.85}
        >
          <View style={styles.methodIconCircle}>
            <Ionicons name="wallet-outline" size={20} color={COLORS.goldPrimary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.methodTitle}>Wallets</Text>
            <Text style={styles.methodSub}>Paytm, Amazon Pay, PhonePe, etc.</Text>
          </View>
          <View style={[styles.radio, selectedMethod === 'wallet' && styles.radioActive]}>
            {selectedMethod === 'wallet' && <View style={styles.radioDot} />}
          </View>
        </TouchableOpacity>

        {/* 5. Pay Later */}
        <TouchableOpacity 
          style={[styles.methodCard, selectedMethod === 'paylater' && styles.methodCardActive]}
          onPress={() => setSelectedMethod('paylater')}
          activeOpacity={0.85}
        >
          <View style={styles.methodIconCircle}>
            <Ionicons name="time-outline" size={20} color={COLORS.goldPrimary} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.methodTitle}>Pay Later</Text>
            <Text style={styles.methodSub}>Simpl, LazyPay, etc.</Text>
          </View>
          <View style={[styles.radio, selectedMethod === 'paylater' && styles.radioActive]}>
            {selectedMethod === 'paylater' && <View style={styles.radioDot} />}
          </View>
        </TouchableOpacity>

        {/* Security badge */}
        <View style={styles.securityFooter}>
          <Ionicons name="lock-closed" size={14} color={COLORS.goldPrimary} />
          <Text style={styles.securityText}>100% secure payment  •  Your data is encrypted and safe with us.</Text>
        </View>

      </ScrollView>

      {/* Floating Bottom Pay Button */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity 
          style={styles.payBtn} 
          activeOpacity={0.88}
          onPress={handlePayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={COLORS.actionText} />
          ) : (
            <>
              <Ionicons name="lock-closed" size={16} color={COLORS.actionText} style={{ marginRight: 6 }} />
              <Text style={styles.payBtnText}>Pay ₹{finalPayable.toLocaleString()} →</Text>
            </>
          )}
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
  backBtn: { padding: 4 },
  headerCenter: { alignItems: 'center' },
  brandTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold' },
  brandSub: { color: COLORS.goldPrimary, fontSize: 9, letterSpacing: 1.5, marginTop: 2 },
  scrollContent: { padding: 16 },
  pageHeader: { alignItems: 'center', marginVertical: 14 },
  mainTitle: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '700' },
  pageSub: { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 16,
  },
  summaryImg: { width: 90, height: 90, borderRadius: 10 },
  summaryInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  summaryTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  metaText: { color: COLORS.textSecondary, fontSize: 12, marginLeft: 4 },
  dateText: { color: COLORS.textMuted, fontSize: 11, marginLeft: 4 },
  nightSpec: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  totalLabel: { color: COLORS.textMuted, fontSize: 11 },
  totalValue: { color: COLORS.goldPrimary, fontSize: 15, fontWeight: 'bold' },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 14,
  },
  cardTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  breakdownLabel: { color: COLORS.textSecondary, fontSize: 13 },
  breakdownVal: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '500' },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 4 },
  grandTotalLabel: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  grandTotalVal: { color: COLORS.goldPrimary, fontSize: 18, fontWeight: 'bold' },
  promoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 12,
    height: 44,
    marginTop: 12,
  },
  promoInput: { flex: 1, color: COLORS.textPrimary, fontSize: 13 },
  applyBtn: {
    backgroundColor: COLORS.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.borderGold,
  },
  applyBtnText: { color: COLORS.goldPrimary, fontSize: 12, fontWeight: '700' },
  sectionHeaderLabel: { color: COLORS.goldPrimary, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10 },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 10,
  },
  methodCardActive: { borderColor: COLORS.goldPrimary, backgroundColor: COLORS.bgCardElevated },
  methodIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderGold,
  },
  methodTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  methodSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: { borderColor: COLORS.goldPrimary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.goldPrimary },
  cardForm: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  subInputLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 10,
    height: 42,
  },
  textInput: { flex: 1, color: COLORS.textPrimary, fontSize: 13 },
  cardBrandBadge: { color: COLORS.goldPrimary, fontSize: 11, fontWeight: 'bold' },
  securityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  securityText: { color: COLORS.textMuted, fontSize: 10, marginLeft: 6 },
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
  payBtn: {
    backgroundColor: COLORS.goldPrimary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 25,
  },
  payBtnText: { color: COLORS.actionText, fontSize: 16, fontWeight: 'bold' },
});

