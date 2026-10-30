import { useAppTheme } from '../../context/ThemeContext';
import  { useState, useContext, useMemo } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../../context/AuthContext';
import BrandLogo from '../../components/BrandLogo';
import { resolveVillaPhoto, getStableVillaFallback } from '../../utils/media';

const ID_TYPES = [
  { label: 'Aadhaar Card', placeholder: '12-digit Aadhaar number', max: 12, numeric: true, hint: '12 digits' },
  { label: 'Passport', placeholder: '8-character Passport number', max: 8, numeric: false, hint: '8 characters' },
  { label: 'Driving Licence', placeholder: '15-16 character DL number', max: 16, numeric: false, hint: '15-16 characters' },
  { label: 'Voter ID', placeholder: '10-character Voter ID', max: 10, numeric: false, hint: '10 characters' },
];

const getFutureDateStr = (daysAhead) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function GuestDetailsScreen({ route, navigation }) {
  const { colors: COLORS, mode, toggleTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const { user } = useContext(AuthContext);
  const { 
    villa, 
    room, 
    grandTotal = 143360, 
    nights = 4, 
    checkIn = getFutureDateStr(1), 
    checkOut = getFutureDateStr(5) 
  } = route.params || {};

  // Form states (pre-populated if logged in)
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [idType, setIdType] = useState('Aadhaar Card');
  const [idNumber, setIdNumber] = useState('');
  const [arrivalTime, setArrivalTime] = useState('2:00 PM');
  const [specialRequests, setSpecialRequests] = useState('');
  const [paymentPlan, setPlan] = useState('full'); // 'full' or 'advance' (30%)

  // User-friendly feedback states
  const [errors, setErrors] = useState({});

  const currentIdConfig = ID_TYPES.find((t) => t.label === idType) || ID_TYPES[0];

  // Advance amount calculation (30% like website)
  const advanceAmount = Math.round(grandTotal * 0.3);
  const balanceAtVilla = grandTotal - advanceAmount;

  const [heroImgError, setHeroImgError] = useState(false);
  const rawHeroPhoto = (villa?.photos && villa.photos[0]) || (villa?.images && villa.images[0]) || villa?.featuredImage;
  const heroImage = heroImgError
    ? getStableVillaFallback(villa?._id || villa?.name, 0)
    : resolveVillaPhoto(rawHeroPhoto, villa?._id || villa?.name, 0);

  // 1. Full Name: Only alphabetic characters and spaces (No premature error while typing)
  const handleNameChange = (text) => {
    const onlyLetters = text.replace(/[^A-Za-z\s]/g, '');
    setName(onlyLetters);
    // Dismiss error while user is actively typing
    if (errors.name) {
      setErrors((prev) => ({ ...prev, name: null }));
    }
  };

  // 2. Mobile Number: Strictly numbers starting with 6, 7, 8, or 9 (No premature error while typing)
  const handlePhoneChange = (text) => {
    const onlyDigits = text.replace(/[^0-9]/g, '');

    // Prevent starting with invalid digits (0, 1, 2, 3, 4, 5)
    if (onlyDigits.length > 0 && !['6', '7', '8', '9'].includes(onlyDigits[0])) {
      return; // Disallow entering an invalid starting digit
    }

    const trimmed = onlyDigits.slice(0, 10);
    setPhone(trimmed);

    // Dismiss error while user is actively typing
    if (errors.phone) {
      setErrors((prev) => ({ ...prev, phone: null }));
    }
  };

  // 3. Email: Real-time update (No premature error while typing)
  const handleEmailChange = (text) => {
    const trimmed = text.trim();
    setEmail(trimmed);

    // Dismiss error while user is actively typing
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: null }));
    }
  };

  // 4. ID Number: Dynamic guidance per selected ID type (No premature error while typing)
  const handleIdNumberChange = (text) => {
    let cleanText = text;
    if (currentIdConfig.numeric) {
      cleanText = text.replace(/[^0-9]/g, '');
    } else {
      cleanText = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
    const finalVal = cleanText.slice(0, currentIdConfig.max);
    setIdNumber(finalVal);

    // Dismiss error while user is actively typing
    if (errors.idNumber) {
      setErrors((prev) => ({ ...prev, idNumber: null }));
    }
  };

  const handleIdTypeSelect = (selectedLabel) => {
    setIdType(selectedLabel);
    setIdNumber('');
    setErrors((prev) => ({ ...prev, idNumber: null }));
  };

  // Instant onBlur validation when user moves cursor to next field
  const handleBlur = (fieldName) => {
    if (fieldName === 'name') {
      if (!name.trim()) {
        setErrors((prev) => ({ ...prev, name: 'Please enter your full name as on your ID card.' }));
      } else if (name.trim().length < 3) {
        setErrors((prev) => ({ ...prev, name: 'Name must have at least 3 letters.' }));
      } else {
        setErrors((prev) => ({ ...prev, name: null }));
      }
    } else if (fieldName === 'phone') {
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phone.trim()) {
        setErrors((prev) => ({ ...prev, phone: 'Please enter your 10-digit mobile number.' }));
      } else if (!phoneRegex.test(phone.trim())) {
        setErrors((prev) => ({ ...prev, phone: 'Mobile number must start with 6, 7, 8, or 9 and be 10 digits.' }));
      } else {
        setErrors((prev) => ({ ...prev, phone: null }));
      }
    } else if (fieldName === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim()) {
        setErrors((prev) => ({ ...prev, email: 'Please enter your email for booking confirmation.' }));
      } else if (!emailRegex.test(email.trim())) {
        setErrors((prev) => ({ ...prev, email: 'Please enter a valid email address (e.g. name@example.com).' }));
      } else {
        setErrors((prev) => ({ ...prev, email: null }));
      }
    } else if (fieldName === 'idNumber') {
      if (!idNumber.trim()) {
        setErrors((prev) => ({ ...prev, idNumber: `Please enter your ${idType} number.` }));
      } else if (idNumber.trim().length < currentIdConfig.max) {
        setErrors((prev) => ({ ...prev, idNumber: `Please enter the full ${currentIdConfig.hint}.` }));
      } else {
        setErrors((prev) => ({ ...prev, idNumber: null }));
      }
    }
  };

  // Final Form Validation before continuing
  const validateForm = () => {
    const newErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Please enter your full name as on your ID card.';
    } else if (name.trim().length < 3) {
      newErrors.name = 'Name must have at least 3 letters.';
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phone) {
      newErrors.phone = 'Please provide your 10-digit mobile number.';
    } else if (!phoneRegex.test(phone)) {
      newErrors.phone = 'Mobile number must start with 6, 7, 8, or 9 and be 10 digits.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      newErrors.email = 'Please provide your email for booking confirmation.';
    } else if (!emailRegex.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!idNumber) {
      newErrors.idNumber = `Please enter your ${idType} number.`;
    } else if (idNumber.length < currentIdConfig.max) {
      newErrors.idNumber = `Incomplete ${idType}. Expected ${currentIdConfig.hint}.`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (!validateForm()) {
      Alert.alert(
        'Please Check Your Details',
        'One or more fields need your attention. Please check the highlighted messages.',
        [{ text: 'Got It' }]
      );
      return;
    }

    const guestData = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      idType,
      idNumber: idNumber.trim(),
      arrivalTime,
      specialRequests: specialRequests.trim(),
      paymentPlan,
    };

    navigation.navigate('Payment', {
      villa,
      room,
      grandTotal,
      payableNow: paymentPlan === 'advance' ? advanceAmount : grandTotal,
      balanceAtVilla: paymentPlan === 'advance' ? balanceAtVilla : 0,
      nights,
      checkIn,
      checkOut,
      guest: guestData,
    });
  };

  // Helper boolean flags for valid states
  const isNameValid = name.trim().length >= 3 && !errors.name;
  const isPhoneValid = /^[6-9]\d{9}$/.test(phone);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isIdValid = idNumber.length === currentIdConfig.max;

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
          <Text style={styles.mainTitle}>
            Guest <Text style={styles.titleGold}>Details</Text>
          </Text>
          <Text style={styles.pageSub}>Almost there! Tell us a bit about your stay.</Text>
        </View>

        {/* Selected Villa Summary Card */}
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
              <Text style={styles.metaText}>{villa?.location?.city || villa?.city || 'Uluwatu, Bali'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={12} color={COLORS.textMuted} />
              <Text style={styles.dateText}>{checkIn} - {checkOut}  |  2 Adults</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>₹{grandTotal.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {/* Lead Guest Details Card */}
        <Text style={styles.sectionHeaderLabel}>LEAD GUEST DETAILS</Text>
        <View style={styles.formCard}>
          
          {/* 1. Full Name */}
          <View style={styles.fieldHeader}>
            <Text style={styles.inputLabel}>Full Name (Lead Guest) <Text style={styles.req}>*</Text></Text>
            {isNameValid && (
              <View style={styles.validBadge}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.statusGreen} />
                <Text style={styles.validText}>Looks good</Text>
              </View>
            )}
          </View>

          <View style={[styles.inputWrap, errors.name && styles.inputWrapError, isNameValid && styles.inputWrapSuccess]}>
            <Ionicons 
              name="person-outline" 
              size={18} 
              color={errors.name ? '#FF6B6B' : (isNameValid ? COLORS.statusGreen : COLORS.textMuted)} 
              style={styles.inputIcon} 
            />
            <TextInput 
              style={styles.textInput} 
              value={name}
              onChangeText={handleNameChange}
              onFocus={() => setErrors((prev) => ({ ...prev, name: null }))}
              onBlur={() => handleBlur('name')}
              placeholder="Full name as on ID"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="words"
            />
          </View>
          {errors.name && (
            <View style={styles.msgRow}>
              <Ionicons name="information-circle" size={13} color="#FF6B6B" />
              <Text style={styles.errorText}>{errors.name}</Text>
            </View>
          )}

          {/* 2. Mobile Number (Strict 10 digits starting with 6,7,8,9) */}
          <View style={[styles.fieldHeader, { marginTop: 14 }]}>
            <Text style={styles.inputLabel}>Mobile Number <Text style={styles.req}>*</Text></Text>
            {isPhoneValid && (
              <View style={styles.validBadge}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.statusGreen} />
                <Text style={styles.validText}>Valid mobile</Text>
              </View>
            )}
          </View>

          <View style={styles.phoneRow}>
            <View style={styles.countryCodeBox}>
              <Text style={styles.countryCodeText}>+91</Text>
            </View>
            <View style={[
              styles.inputWrap, 
              { flex: 1, marginLeft: 8 }, 
              errors.phone && styles.inputWrapError,
              isPhoneValid && styles.inputWrapSuccess
            ]}>
              <Ionicons 
                name="call-outline" 
                size={18} 
                color={errors.phone ? '#FF6B6B' : (isPhoneValid ? COLORS.statusGreen : COLORS.textMuted)} 
                style={styles.inputIcon} 
              />
              <TextInput 
                style={styles.textInput} 
                value={phone}
                onChangeText={handlePhoneChange}
                onFocus={() => setErrors((prev) => ({ ...prev, phone: null }))}
                onBlur={() => handleBlur('phone')}
                keyboardType="numeric"
                maxLength={10}
                placeholder="Starting with 6, 7, 8 or 9"
                placeholderTextColor={COLORS.textMuted}
              />
              <Text style={styles.counterText}>{phone.length}/10</Text>
            </View>
          </View>
          {errors.phone && (
            <View style={styles.msgRow}>
              <Ionicons name="alert-circle" size={13} color="#FF6B6B" />
              <Text style={styles.errorText}>{errors.phone}</Text>
            </View>
          )}

          {/* 3. Email Address */}
          <View style={[styles.fieldHeader, { marginTop: 14 }]}>
            <Text style={styles.inputLabel}>Email Address <Text style={styles.req}>*</Text></Text>
            {isEmailValid && (
              <View style={styles.validBadge}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.statusGreen} />
                <Text style={styles.validText}>Valid email</Text>
              </View>
            )}
          </View>

          <View style={[styles.inputWrap, errors.email && styles.inputWrapError, isEmailValid && styles.inputWrapSuccess]}>
            <Ionicons 
              name="mail-outline" 
              size={18} 
              color={errors.email ? '#FF6B6B' : (isEmailValid ? COLORS.statusGreen : COLORS.textMuted)} 
              style={styles.inputIcon} 
            />
            <TextInput 
              style={styles.textInput} 
              value={email}
              onChangeText={handleEmailChange}
              onFocus={() => setErrors((prev) => ({ ...prev, email: null }))}
              onBlur={() => handleBlur('email')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="e.g. rahul@example.com"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>
          {errors.email && (
            <View style={styles.msgRow}>
              <Ionicons name="information-circle" size={13} color="#FF6B6B" />
              <Text style={styles.errorText}>{errors.email}</Text>
            </View>
          )}

          {/* 4. Government ID Selector */}
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Government ID Proof <Text style={styles.req}>*</Text></Text>
          <View style={styles.idTypeRow}>
            {ID_TYPES.map((t) => {
              const isSelected = idType === t.label;
              return (
                <TouchableOpacity 
                  key={t.label} 
                  activeOpacity={0.8}
                  style={[styles.idChip, isSelected && styles.idChipActive]}
                  onPress={() => handleIdTypeSelect(t.label)}
                >
                  <Text style={[styles.idChipText, isSelected && styles.idChipTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 5. ID Number */}
          <View style={styles.fieldHeader}>
            <Text style={styles.inputLabel}>{idType} Number <Text style={styles.req}>*</Text></Text>
            {isIdValid && (
              <View style={styles.validBadge}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.statusGreen} />
                <Text style={styles.validText}>Complete</Text>
              </View>
            )}
          </View>

          <View style={[styles.inputWrap, errors.idNumber && styles.inputWrapError, isIdValid && styles.inputWrapSuccess]}>
            <Ionicons 
              name="card-outline" 
              size={18} 
              color={errors.idNumber ? '#FF6B6B' : (isIdValid ? COLORS.statusGreen : COLORS.textMuted)} 
              style={styles.inputIcon} 
            />
            <TextInput 
              style={styles.textInput} 
              value={idNumber}
              onChangeText={handleIdNumberChange}
              onFocus={() => setErrors((prev) => ({ ...prev, idNumber: null }))}
              onBlur={() => handleBlur('idNumber')}
              placeholder={currentIdConfig.placeholder}
              placeholderTextColor={COLORS.textMuted}
              keyboardType={currentIdConfig.numeric ? 'numeric' : 'default'}
              maxLength={currentIdConfig.max}
              autoCapitalize="characters"
            />
            <Text style={styles.counterText}>{idNumber.length}/{currentIdConfig.max}</Text>
          </View>
          {errors.idNumber && (
            <View style={styles.msgRow}>
              <Ionicons name="information-circle" size={13} color="#FF6B6B" />
              <Text style={styles.errorText}>{errors.idNumber}</Text>
            </View>
          )}

          {/* 6. Expected Arrival Time */}
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Expected Arrival Time</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="time-outline" size={18} color={COLORS.textMuted} style={styles.inputIcon} />
            <TextInput 
              style={styles.textInput} 
              value={arrivalTime}
              onChangeText={setArrivalTime}
              placeholder="e.g. 2:00 PM"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          {/* 7. Special Requests */}
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Special Requests (Optional)</Text>
          <View style={styles.textAreaWrap}>
            <TextInput 
              style={styles.textArea} 
              multiline 
              numberOfLines={3}
              value={specialRequests}
              onChangeText={setSpecialRequests}
              maxLength={500}
              placeholder="e.g. early check-in, dietary preferences, extra pillows…"
              placeholderTextColor={COLORS.textMuted}
            />
            <Text style={styles.charCount}>{specialRequests.length}/500</Text>
          </View>
        </View>

        {/* Payment Plan Choice */}
        <Text style={[styles.sectionHeaderLabel, { marginTop: 18 }]}>PAYMENT OPTION</Text>
        <View style={styles.planCard}>
          <TouchableOpacity 
            style={[styles.planOption, paymentPlan === 'full' && styles.planOptionActive]} 
            onPress={() => setPlan('full')}
            activeOpacity={0.85}
          >
            <View style={[styles.radio, paymentPlan === 'full' && styles.radioActive]}>
              {paymentPlan === 'full' && <View style={styles.radioDot} />}
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.planTitle}>Pay Full Amount</Text>
              <Text style={styles.planSub}>₹{grandTotal.toLocaleString()} now · nothing at the villa</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.planDivider} />

          <TouchableOpacity 
            style={[styles.planOption, paymentPlan === 'advance' && styles.planOptionActive]} 
            onPress={() => setPlan('advance')}
            activeOpacity={0.85}
          >
            <View style={[styles.radio, paymentPlan === 'advance' && styles.radioActive]}>
              {paymentPlan === 'advance' && <View style={styles.radioDot} />}
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.planTitle}>Pay 30% Advance</Text>
              <Text style={styles.planSub}>₹{advanceAmount.toLocaleString()} now · ₹{balanceAtVilla.toLocaleString()} at the villa</Text>
            </View>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Floating Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View>
          <Text style={styles.bottomPriceLabel}>Payable Now</Text>
          <Text style={styles.bottomAmountText}>
            ₹{(paymentPlan === 'advance' ? advanceAmount : grandTotal).toLocaleString()}
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.continueBtn} 
          activeOpacity={0.88}
          onPress={handleContinue}
        >
          <Text style={styles.continueBtnText}>Continue to Payment</Text>
          <Ionicons name="arrow-forward" size={16} color={COLORS.actionText} style={{ marginLeft: 6 }} />
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
  titleGold: { color: COLORS.goldPrimary },
  pageSub: { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 20,
  },
  summaryImg: { width: 90, height: 90, borderRadius: 10 },
  summaryInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  summaryTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  metaText: { color: COLORS.textSecondary, fontSize: 12, marginLeft: 4 },
  dateText: { color: COLORS.textMuted, fontSize: 11, marginLeft: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  totalLabel: { color: COLORS.textMuted, fontSize: 11 },
  totalValue: { color: COLORS.goldPrimary, fontSize: 15, fontWeight: 'bold' },
  sectionHeaderLabel: { color: COLORS.goldPrimary, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  formCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  req: { color: '#FF6B6B' },
  validBadge: { flexDirection: 'row', alignItems: 'center' },
  validText: { color: COLORS.statusGreen, fontSize: 11, marginLeft: 4, fontWeight: '600' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 12,
    height: 46,
  },
  inputWrapError: {
    borderColor: '#FF6B6B',
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
  },
  inputWrapSuccess: {
    borderColor: 'rgba(76, 217, 100, 0.4)',
  },
  msgRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, marginLeft: 2 },
  errorText: {
    color: '#FF6B6B',
    fontSize: 11,

    marginLeft: 4,
    fontWeight: '500',
  },
  helperText: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 4,
    marginLeft: 2,
  },
  counterText: { color: COLORS.textMuted, fontSize: 11, marginLeft: 6 },
  inputIcon: { marginRight: 8 },
  textInput: { flex: 1, color: COLORS.textPrimary, fontSize: 14 },
  phoneRow: { flexDirection: 'row', alignItems: 'center' },
  countryCodeBox: {
    backgroundColor: COLORS.bgCardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 14,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  idTypeRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8, marginTop: 4 },
  idChip: {
    backgroundColor: COLORS.bgCardElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  idChipActive: { borderColor: COLORS.goldPrimary, backgroundColor: 'rgba(212, 175, 55, 0.15)' },
  idChipText: { color: COLORS.textSecondary, fontSize: 11 },
  idChipTextActive: { color: COLORS.goldPrimary, fontWeight: '700' },
  textAreaWrap: {
    backgroundColor: COLORS.bgCardElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 10,
    marginTop: 4,
  },
  textArea: { color: COLORS.textPrimary, fontSize: 13, height: 60, textAlignVertical: 'top' },
  charCount: { alignSelf: 'flex-end', color: COLORS.textMuted, fontSize: 10, marginTop: 4 },
  planCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginTop: 4,
  },
  planOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6 },
  planOptionActive: { backgroundColor: COLORS.bgCardElevated, borderRadius: 8 },
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
  planTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  planSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  planDivider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: 6 },
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomPriceLabel: { color: COLORS.textMuted, fontSize: 11 },
  bottomAmountText: { color: COLORS.goldPrimary, fontSize: 18, fontWeight: 'bold' },
  continueBtn: {
    backgroundColor: COLORS.goldPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 25,
  },
  continueBtnText: { color: COLORS.actionText, fontSize: 14, fontWeight: 'bold' },
});
