import { useAppTheme } from '../../context/ThemeContext';
import React, { useState, useMemo, useContext, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Share, Alert, Linking, 
  Modal, TextInput, ActivityIndicator, Dimensions 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFavorites } from '../../context/FavoritesContext';
import { AuthContext } from '../../context/AuthContext';
import BrandLogo from '../../components/BrandLogo';
import { resolveVillaPhoto, getStableVillaFallback } from '../../utils/media';
import { formatVillaLocation } from '../../utils/location';
import apiClient, { PRODUCTION_API_URL } from '../../api/client';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const formatStayDate = (date) => new Intl.DateTimeFormat('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric',
}).format(date);

const getDayLabel = (date) => new Intl.DateTimeFormat('en-IN', {
  weekday: 'short', day: '2-digit', month: 'short'
}).format(date);

export default function StayDetailsScreen({ route, navigation }) {
  const { colors: COLORS, mode } = useAppTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const { villa } = route.params;
  const { user } = useContext(AuthContext);
  const { isFavorite, toggleFavorite } = useFavorites();
  const villaId = villa?._id || villa?.id;
  const isSaved = isFavorite(villaId);

  // Photo Carousel State
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [heroLayoutWidth, setHeroLayoutWidth] = useState(SCREEN_WIDTH - 32);

  const rawPhotos = useMemo(() => {
    let list = [];
    if (Array.isArray(villa?.photos) && villa.photos.length > 0) list = villa.photos;
    else if (Array.isArray(villa?.images) && villa.images.length > 0) list = villa.images;
    else if (villa?.featuredImage) list = [villa.featuredImage];
    if (list.length === 0) list = [getStableVillaFallback(villaId || villa?.name, 0)];
    return list.map((src, idx) => resolveVillaPhoto(src, villaId || villa?.name, idx));
  }, [villa, villaId]);

  // Dynamic Date & Guest State
  const [checkInDate, setCheckInDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [nights, setNights] = useState(2);
  const [adultsCount, setAdultsCount] = useState(2);
  const [childrenCount, setChildrenCount] = useState(0);
  const [dateModalVisible, setDateModalVisible] = useState(false);

  const checkOutDate = useMemo(() => {
    const out = new Date(checkInDate);
    out.setDate(out.getDate() + nights);
    return out;
  }, [checkInDate, nights]);

  const checkIn = useMemo(() => formatStayDate(checkInDate), [checkInDate]);
  const checkOut = useMemo(() => formatStayDate(checkOutDate), [checkOutDate]);

  // Enquiry Modal & Form State
  const [enquiryModalVisible, setEnquiryModalVisible] = useState(false);
  const [guestName, setGuestName] = useState(user?.name || '');
  const [guestPhone, setGuestPhone] = useState(user?.phone || '');
  const [guestEmail, setGuestEmail] = useState(user?.email || '');
  const [guestNotes, setGuestNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [enquiryError, setEnquiryError] = useState('');

  // Auto-fill cached guest details so user doesn't have to retype every time
  useEffect(() => {
    AsyncStorage.multiGet([
      '@bookmyvilla_guest_name',
      '@bookmyvilla_guest_phone',
      '@bookmyvilla_guest_email',
    ]).then((stores) => {
      const cachedName = stores[0][1];
      const cachedPhone = stores[1][1];
      const cachedEmail = stores[2][1];
      if (cachedName && !guestName) setGuestName(cachedName);
      if (cachedPhone && !guestPhone) setGuestPhone(cachedPhone);
      if (cachedEmail && !guestEmail) setGuestEmail(cachedEmail);
    }).catch(() => {});
  }, []);

  // Pre-generate 14 upcoming days for quick & easy date picking
  const upcomingDays = useMemo(() => {
    const days = [];
    for (let i = 1; i <= 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, []);

  const handleShare = async () => {
    const id = villa._id || villa.id;
    const webUrl = `https://bookmyvilla.online/property/${encodeURIComponent(id)}`;
    const villaName = villa.name || 'Luxury Villa';
    const locationName = villa.location?.city || villa.city || villa.location || 'Maharashtra';

    try {
      await Share.share({
        title: `${villaName} | BookMyVilla`,
        message: `✨ Experience luxury at ${villaName} in ${locationName}.\n\nExplore photos, amenities & enquire online:\n${webUrl}`,
        url: webUrl,
      });
    } catch (err) {
      console.log('Share error:', err);
    }
  };

  const bedroomsCount = villa?.bedrooms || 4;
  const maxGuestsCount = villa?.maxGuests || 8;

  // Save enquiry locally so user can track it in My Bookings / Enquiries tab
  const saveEnquiryLocally = async (villaName, locationName) => {
    try {
      const existingRaw = await AsyncStorage.getItem('@bookmyvilla_my_enquiries');
      const existingList = existingRaw ? JSON.parse(existingRaw) : [];
      const newEnquiry = {
        id: 'ENQ-' + Date.now(),
        villaId: villaId || villa?.name,
        villaName,
        city: locationName,
        photo: rawPhotos[0],
        checkIn,
        checkOut,
        nights,
        adultsCount,
        childrenCount,
        submittedAt: new Date().toISOString(),
        status: 'Enquiry Received',
      };
      const updatedList = [newEnquiry, ...existingList.filter((e) => e.id !== newEnquiry.id)].slice(0, 20);
      await AsyncStorage.setItem('@bookmyvilla_my_enquiries', JSON.stringify(updatedList));
      // Remember user details for future enquiries
      await AsyncStorage.setItem('@bookmyvilla_guest_name', guestName.trim());
      await AsyncStorage.setItem('@bookmyvilla_guest_phone', guestPhone.replace(/\D/g, ''));
      if (guestEmail.trim()) await AsyncStorage.setItem('@bookmyvilla_guest_email', guestEmail.trim());
    } catch (err) {
      console.log('Error caching inquiry locally:', err);
    }
  };

  // Direct Enquiry Submission to Admin Panel
  const handleSubmitEnquiry = async () => {
    if (!guestName.trim() || !guestPhone.trim()) {
      setEnquiryError('Please enter your full name and WhatsApp / mobile number.');
      return;
    }
    const cleanPhone = guestPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setEnquiryError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setSubmitting(true);
    setEnquiryError('');

    const villaName = villa?.name || 'Villa Stay';
    const locationName = formatVillaLocation(villa);
    const summaryMsg = `Customer Enquiry for ${villaName} (${locationName}). Stay: ${nights} night(s) (Check-in: ${checkIn}, Check-out: ${checkOut}) for ${adultsCount} adults, ${childrenCount} children. ${guestNotes ? 'Requirements: ' + guestNotes : ''}`.trim();

    const payload = {
      fullName: guestName.trim(),
      phone: cleanPhone,
      email: guestEmail.trim() || 'guest@bookmyvilla.online',
      propertyName: villaName,
      city: locationName,
      message: summaryMsg
    };

    try {
      // 1. Try via standard configured client
      await apiClient.post('/partner/inquiry', payload);
      await saveEnquiryLocally(villaName, locationName);
      setSubmitted(true);
    } catch (primaryErr) {
      console.log('Primary enquiry API attempt failed, trying fallback endpoints...', primaryErr?.message);
      try {
        // 2. Direct fallback to local backend or production host
        const fallbackUrls = [
          'http://10.0.2.2:2001/api/partner/inquiry',
          'http://localhost:2001/api/partner/inquiry',
          `${PRODUCTION_API_URL}/partner/inquiry`
        ];
        let ok = false;
        for (const url of fallbackUrls) {
          try {
            const resp = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (resp.ok) {
              ok = true;
              break;
            }
          } catch {
            // try next
          }
        }
        if (ok) {
          await saveEnquiryLocally(villaName, locationName);
          setSubmitted(true);
        } else {
          throw new Error('Could not submit enquiry. Please check internet connection.');
        }
      } catch (err) {
        setEnquiryError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openWhatsAppChat = () => {
    const villaName = villa?.name || 'Luxury Villa';
    const location = formatVillaLocation(villa);
    const namePart = guestName.trim() ? `My name is ${guestName.trim()}. ` : '';
    const text = encodeURIComponent(`Hi BookMyVilla, ${namePart}I would like to enquire and reserve ${villaName} in ${location} for ${nights} nights (${checkIn} to ${checkOut}) for ${adultsCount} adults${childrenCount > 0 ? ` and ${childrenCount} children` : ''}. Please share availability and booking confirmation details.`);
    Linking.openURL(`https://wa.me/919876543210?text=${text}`).catch(() => {
      Alert.alert('Contact Concierge', 'Please call or WhatsApp our concierge team at +91 98765 43210');
    });
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
        {/* Scrollable Villa Photos Carousel */}
        <View 
          style={styles.heroBox}
          onLayout={e => {
            const width = e.nativeEvent.layout.width;
            if (width > 0 && width !== heroLayoutWidth) setHeroLayoutWidth(width);
          }}
        >
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const contentOffset = e.nativeEvent.contentOffset.x;
              const viewSize = e.nativeEvent.layoutMeasurement.width;
              if (viewSize > 0) {
                const index = Math.round(contentOffset / viewSize);
                setActivePhotoIndex(index);
              }
            }}
            style={{ width: '100%', height: '100%' }}
          >
            {rawPhotos.map((photoUrl, index) => (
              <Image 
                key={photoUrl + index}
                source={{ uri: photoUrl }} 
                style={{ width: heroLayoutWidth, height: 210 }} 
                resizeMode="cover"
              />
            ))}
          </ScrollView>

          <View style={styles.bestsellerBadge}>
            <Ionicons name="ribbon-outline" size={13} color={COLORS.actionText} style={{ marginRight: 4 }} />
            <Text style={styles.bestsellerText}>Bestseller</Text>
          </View>

          <View style={styles.photoCountBadge}>
            <Ionicons name="images-outline" size={12} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.photoCountText}>{activePhotoIndex + 1} / {rawPhotos.length}</Text>
          </View>
        </View>

        {/* Villa Title & Meta */}
        <View style={styles.villaMeta}>
          <Text style={styles.villaName}>{villa.name || 'Royal Villa'}</Text>
          <View style={styles.locationRatingRow}>
            <Ionicons name="location" size={14} color={COLORS.goldPrimary} />
            <Text style={styles.locationText}>{formatVillaLocation(villa)}</Text>
            <Ionicons name="star" size={13} color={COLORS.goldPrimary} style={{ marginLeft: 10 }} />
            <Text style={styles.ratingText}>
              {villa?.rating ? Number(villa.rating).toFixed(1) : '4.9'} ({villa?.reviewsCount || villa?.reviews?.length || 128} reviews)
            </Text>
          </View>
        </View>

        {/* Date & Guest Info Card (Tappable to Edit) */}
        <TouchableOpacity 
          style={styles.datesCard} 
          activeOpacity={0.85}
          onPress={() => setDateModalVisible(true)}
        >
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
              <Text style={styles.dateVal}>{adultsCount} Adults</Text>
              <Text style={styles.dateLabel}>{childrenCount} Children</Text>
            </View>
          </View>

          <View style={styles.editBtn}>
            <Ionicons name="pencil-outline" size={14} color={COLORS.goldPrimary} />
            <Text style={styles.editBtnText}>Edit</Text>
          </View>
        </TouchableOpacity>

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
          <Image source={{ uri: rawPhotos[0] }} style={styles.roomThumb} />

          <View style={styles.roomInfoCol}>
            <View style={styles.roomTitleRow}>
              <Text style={styles.roomTitle}>Complete Villa</Text>
              <View style={styles.exclusivePill}>
                <Text style={styles.exclusivePillText}>Exclusive</Text>
              </View>
            </View>

            <Text style={styles.roomSub}>Private Pool • Entire Property & Grounds</Text>
            
            <View style={styles.roomSpecsRow}>
              <Text style={styles.roomSpec}>
                Up to {maxGuestsCount} Guests • {bedroomsCount} Bedrooms • 100% Privacy
              </Text>
            </View>
          </View>

          <View style={styles.roomPriceCol}>
            <View style={[styles.radioCircle, styles.radioCircleActive]}>
              <Ionicons name="checkmark" size={14} color={COLORS.goldPrimary} />
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

      </ScrollView>

      {/* Floating Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity 
          style={styles.bookBtn} 
          activeOpacity={0.88}
          onPress={() => {
            setEnquiryError('');
            setSubmitted(false);
            setEnquiryModalVisible(true);
          }}
        >
          <Text style={styles.bookBtnText}>Send Villa Enquiry</Text>
          <Ionicons name="logo-whatsapp" size={18} color={COLORS.actionText} style={{ marginLeft: 6 }} />
        </TouchableOpacity>

        <View style={styles.secureBadge}>
          <Ionicons name="chatbubble-ellipses-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.secureText}>Direct reservations enquiry · No booking fees</Text>
        </View>
      </View>

      {/* DYNAMIC DATE & GUESTS SELECTION MODAL */}
      <Modal
        visible={dateModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Stay Dates & Guests</Text>
              <TouchableOpacity onPress={() => setDateModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Check-in Date Picker */}
              <Text style={styles.modalSectionLabel}>1. Select Check-in Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {upcomingDays.map((d, index) => {
                  const isSelected = formatStayDate(d) === checkIn;
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.datePill, isSelected && styles.datePillActive]}
                      onPress={() => setCheckInDate(d)}
                    >
                      <Text style={[styles.datePillDay, isSelected && styles.datePillTextActive]}>
                        {index === 0 ? 'Tomorrow' : getDayLabel(d).split(' ')[0]}
                      </Text>
                      <Text style={[styles.datePillDate, isSelected && styles.datePillTextActive]}>
                        {formatStayDate(d).slice(0, 6)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Nights Duration Picker */}
              <Text style={styles.modalSectionLabel}>2. Stay Duration ({nights} Nights)</Text>
              <View style={styles.nightsRow}>
                {[1, 2, 3, 4, 7].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.nightPill, nights === n && styles.nightPillActive]}
                    onPress={() => setNights(n)}
                  >
                    <Text style={[styles.nightPillText, nights === n && styles.nightPillTextActive]}>
                      {n} {n === 1 ? 'Night' : 'Nights'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Guests Count Picker */}
              <Text style={styles.modalSectionLabel}>3. Number of Guests</Text>
              <View style={styles.guestCounterRow}>
                <View>
                  <Text style={styles.counterTitle}>Adults</Text>
                  <Text style={styles.counterSub}>Ages 12+</Text>
                </View>
                <View style={styles.counterControls}>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => setAdultsCount(Math.max(1, adultsCount - 1))}
                  >
                    <Text style={styles.counterBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterVal}>{adultsCount}</Text>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => setAdultsCount(Math.min(maxGuestsCount, adultsCount + 1))}
                  >
                    <Text style={styles.counterBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.guestCounterRow, { marginTop: 10 }]}>
                <View>
                  <Text style={styles.counterTitle}>Children</Text>
                  <Text style={styles.counterSub}>Ages 2-12</Text>
                </View>
                <View style={styles.counterControls}>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => setChildrenCount(Math.max(0, childrenCount - 1))}
                  >
                    <Text style={styles.counterBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterVal}>{childrenCount}</Text>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => setChildrenCount(Math.min(6, childrenCount + 1))}
                  >
                    <Text style={styles.counterBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Dynamic Summary Preview */}
              <View style={styles.modalSummaryBox}>
                <Text style={styles.modalSummaryText}>
                  Stay: <Text style={{ fontWeight: 'bold' }}>{checkIn}</Text> → <Text style={{ fontWeight: 'bold' }}>{checkOut}</Text> ({nights} Nights)
                </Text>
                <Text style={styles.modalSummaryText}>
                  Guests: <Text style={{ fontWeight: 'bold' }}>{adultsCount} Adults, {childrenCount} Children</Text>
                </Text>
              </View>

              <TouchableOpacity
                style={styles.confirmModalBtn}
                onPress={() => setDateModalVisible(false)}
              >
                <Text style={styles.confirmModalBtnText}>Confirm Dates & Guests</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* DIRECT VILLA ENQUIRY MODAL (POSTS TO ADMIN PANEL) */}
      <Modal
        visible={enquiryModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEnquiryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {submitted ? 'Enquiry Submitted!' : 'Send Villa Enquiry'}
              </Text>
              <TouchableOpacity onPress={() => setEnquiryModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            {submitted ? (
              <View style={styles.successBox}>
                <View style={styles.successIconCircle}>
                  <Ionicons name="checkmark" size={32} color="#fff" />
                </View>
                <Text style={styles.successTitle}>Enquiry Received!</Text>
                <Text style={styles.successSub}>
                  Thank you <Text style={{ fontWeight: 'bold' }}>{guestName}</Text>. Your enquiry for <Text style={{ fontWeight: 'bold' }}>{villa.name}</Text> for {nights} nights ({checkIn} to {checkOut}) has been sent directly to the BookMyVilla Admin Panel.
                </Text>
                <Text style={[styles.successSub, { marginTop: 6, color: '#166534', fontWeight: '600' }]}>
                  Our reservations manager will contact you via WhatsApp / Phone shortly with available dates and booking details.
                </Text>

                <TouchableOpacity style={styles.whatsappActionBtn} onPress={openWhatsAppChat}>
                  <Ionicons name="logo-whatsapp" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.whatsappActionBtnText}>Chat on WhatsApp Now</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.doneBtn} onPress={() => setEnquiryModalVisible(false)}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Stay Summary Card */}
                <View style={styles.formSummaryPill}>
                  <Text style={styles.formSummaryTitle}>{villa.name}</Text>
                  <Text style={styles.formSummaryDates}>
                    🗓️ {checkIn} → {checkOut} ({nights} Nights) • 👥 {adultsCount + childrenCount} Guests
                  </Text>
                </View>

                {/* Name */}
                <Text style={styles.formLabel}>Your Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor={COLORS.textMuted}
                  value={guestName}
                  onChangeText={setGuestName}
                />

                {/* WhatsApp / Phone */}
                <Text style={styles.formLabel}>WhatsApp / Mobile Number *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="phone-pad"
                  maxLength={15}
                  value={guestPhone}
                  onChangeText={setGuestPhone}
                />

                {/* Email */}
                <Text style={styles.formLabel}>Email Address (Optional)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. rahul@gmail.com"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={guestEmail}
                  onChangeText={setGuestEmail}
                />

                {/* Requirements / Notes */}
                <Text style={styles.formLabel}>Special Requirements / Notes (Optional)</Text>
                <TextInput
                  style={[styles.formInput, { height: 60, textAlignVertical: 'top' }]}
                  placeholder="Cook needed, private pool party, family gathering..."
                  placeholderTextColor={COLORS.textMuted}
                  multiline={true}
                  numberOfLines={2}
                  value={guestNotes}
                  onChangeText={setGuestNotes}
                />

                {enquiryError ? (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color="#dc2626" />
                    <Text style={styles.errorText}>{enquiryError}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.submitEnquiryBtn, submitting && { opacity: 0.7 }]}
                  onPress={handleSubmitEnquiry}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={COLORS.actionText} />
                  ) : (
                    <>
                      <Text style={styles.submitEnquiryBtnText}>Submit Enquiry to Admin</Text>
                      <Ionicons name="send" size={16} color={COLORS.actionText} style={{ marginLeft: 8 }} />
                    </>
                  )}
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 12 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: COLORS.borderLight }} />
                  <Text style={{ marginHorizontal: 10, fontSize: 11, color: COLORS.textMuted, fontWeight: '600' }}>OR CONNECT DIRECTLY</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: COLORS.borderLight }} />
                </View>

                <TouchableOpacity
                  style={[styles.whatsappActionBtn, { marginTop: 0, backgroundColor: '#25D366' }]}
                  onPress={openWhatsAppChat}
                  activeOpacity={0.88}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.whatsappActionBtnText}>Instant Booking Enquiry on WhatsApp</Text>
                </TouchableOpacity>

                <Text style={styles.formDisclaimer}>
                  🔒 We respect your privacy. No payment required.
                </Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

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

  // Hero carousel
  heroBox: { width: '100%', height: 210, borderRadius: 14, overflow: 'hidden', position: 'relative' },
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
  completeVillaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  completeVillaBadgeText: { color: COLORS.goldPrimary, fontSize: 11, fontWeight: '600', marginLeft: 4 },

  roomCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 16,
  },
  roomCardActive: { borderColor: COLORS.goldPrimary },
  roomThumb: { width: 75, height: 75, borderRadius: 8, backgroundColor: COLORS.bgDeep },
  roomInfoCol: { flex: 1, marginLeft: 12 },
  roomTitleRow: { flexDirection: 'row', alignItems: 'center' },
  roomTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  exclusivePill: {
    backgroundColor: COLORS.goldPrimary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  exclusivePillText: { color: COLORS.actionText, fontSize: 9, fontWeight: 'bold' },
  roomSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  roomSpecsRow: { marginTop: 6 },
  roomSpec: { color: COLORS.textMuted, fontSize: 11 },

  roomPriceCol: { alignItems: 'flex-end', justifyContent: 'space-between', paddingLeft: 6 },
  roomPrice: { color: COLORS.goldPrimary, fontSize: 14, fontWeight: '700' },
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
  radioCircleActive: { borderColor: COLORS.goldPrimary, backgroundColor: 'rgba(212, 175, 55, 0.15)' },

  benefitsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  benefitCard: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    padding: 12,
    marginRight: 6,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  benefitTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 6, marginBottom: 2 },
  benefitSub: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 15 },
  inclusionItem: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },

  breakdownCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 20,
  },
  breakdownHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  breakdownTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', marginLeft: 6 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  priceItemText: { color: COLORS.textSecondary, fontSize: 13 },
  priceValText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  totalRow: { borderTopWidth: 1, borderTopColor: COLORS.borderLight, marginTop: 8, paddingTop: 8 },
  totalLabel: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  totalVal: { color: COLORS.goldPrimary, fontSize: 15, fontWeight: '700' },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.bgDeep,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.goldPrimary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  bookBtnText: { color: COLORS.actionText, fontSize: 15, fontWeight: 'bold' },
  secureBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  secureText: { color: COLORS.textMuted, fontSize: 11, marginLeft: 4 },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    paddingBottom: 10,
  },
  modalTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
  modalCloseBtn: { padding: 4 },
  modalSectionLabel: { color: COLORS.goldPrimary, fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 6 },

  // Date picker pills
  datePill: {
    backgroundColor: COLORS.bgDeep,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  datePillActive: { borderColor: COLORS.goldPrimary, backgroundColor: 'rgba(212, 175, 55, 0.15)' },
  datePillDay: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  datePillDate: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 2 },
  datePillTextActive: { color: COLORS.goldPrimary },

  nightsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  nightPill: {
    backgroundColor: COLORS.bgDeep,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  nightPillActive: { borderColor: COLORS.goldPrimary, backgroundColor: 'rgba(212, 175, 55, 0.15)' },
  nightPillText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '600' },
  nightPillTextActive: { color: COLORS.goldPrimary },

  guestCounterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgDeep,
    padding: 10,
    borderRadius: 8,
  },
  counterTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  counterSub: { color: COLORS.textMuted, fontSize: 11 },
  counterControls: { flexDirection: 'row', alignItems: 'center' },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBtnText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: 'bold' },
  counterVal: { color: COLORS.goldPrimary, fontSize: 15, fontWeight: '700', marginHorizontal: 14 },

  modalSummaryBox: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
    marginBottom: 14,
  },
  modalSummaryText: { color: COLORS.textPrimary, fontSize: 12, lineHeight: 18 },
  confirmModalBtn: {
    backgroundColor: COLORS.goldPrimary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmModalBtnText: { color: COLORS.actionText, fontSize: 14, fontWeight: '700' },

  // Enquiry Form styles
  formSummaryPill: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  formSummaryTitle: { color: COLORS.goldPrimary, fontSize: 14, fontWeight: '700' },
  formSummaryDates: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  formLabel: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '600', marginBottom: 4, marginTop: 6 },
  formInput: {
    backgroundColor: COLORS.bgDeep,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    padding: 8,
    borderRadius: 6,
    marginTop: 10,
  },
  errorText: { color: '#dc2626', fontSize: 12, marginLeft: 6, flex: 1 },
  submitEnquiryBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.goldPrimary,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  submitEnquiryBtnText: { color: COLORS.actionText, fontSize: 14, fontWeight: '700' },
  formDisclaimer: {
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
  },

  // Success state in modal
  successBox: { alignItems: 'center', paddingVertical: 16 },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  successTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  successSub: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 10 },
  whatsappActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 18,
    width: '100%',
    justifyContent: 'center',
  },
  whatsappActionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  doneBtn: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 10,
    width: '100%',
    alignItems: 'center',
  },
  doneBtnText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
});
