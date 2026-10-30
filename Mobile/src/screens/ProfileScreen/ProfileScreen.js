import { useAppTheme } from '../../context/ThemeContext';
import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../../context/AuthContext';
import BrandLogo from '../../components/BrandLogo';

const RESEND_COOLDOWN_SECONDS = 30;

export default function ProfileScreen({ navigation }) {
  const { colors: COLORS, mode, toggleTheme } = useAppTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const { 
    user, 
    login, 
    register, 
    sendPhoneOtp, 
    verifyPhoneOtp, 
    loginWithPhoneOtp, 
    loginWithPhonePassword, 
    registerWithPhone, 
    logout,
    deleteAccount
  } = useContext(AuthContext);

  // Tab: 'login' | 'register'
  const [activeTab, setActiveTab] = useState('login');

  // Login options
  const [loginMethod, setLoginMethod] = useState('phone'); // 'phone' | 'email'
  const [phoneLoginType, setPhoneLoginType] = useState('otp'); // 'otp' | 'password'

  // Register steps: 'phone' | 'otp' | 'details'
  const [registerStep, setRegisterStep] = useState('phone');

  // Input states
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Per-field errors (shown dynamically on blur)
  const [fieldErrors, setFieldErrors] = useState({});

  // General server / feedback states
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const timerRef = useRef(null);
  const scrollViewRef = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Keyboard listener to ensure smooth sliding and prevent hidden buttons
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const h = e?.endCoordinates?.height || 260;
      setKeyboardHeight(h);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (cooldown > 0) {
      timerRef.current = setTimeout(() => setCooldown((c) => c - 1), 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [cooldown]);

  const startCooldown = () => setCooldown(RESEND_COOLDOWN_SECONDS);

  // --- 1. DYNAMIC ON-BLUR FIELD VALIDATION ---
  const validateField = (fieldName) => {
    setFieldErrors((prev) => {
      const next = { ...prev };

      if (fieldName === 'phone') {
        const cleanPhone = phone.trim();
        if (!cleanPhone) {
          next.phone = 'Please enter your 10-digit mobile number.';
        } else if (!['6', '7', '8', '9'].includes(cleanPhone[0])) {
          next.phone = 'Mobile number must start with 6, 7, 8, or 9.';
        } else if (cleanPhone.length < 10) {
          next.phone = `Mobile number must be 10 digits (${cleanPhone.length}/10 entered).`;
        } else {
          delete next.phone;
        }
      }

      if (fieldName === 'otp') {
        if (!otp.trim()) {
          next.otp = 'Please enter the 6-digit OTP code.';
        } else if (otp.length < 6) {
          next.otp = `OTP must be 6 digits (${otp.length}/6 entered).`;
        } else {
          delete next.otp;
        }
      }

      if (fieldName === 'name') {
        const cleanName = name.trim();
        if (!cleanName) {
          next.name = 'Please enter your full name.';
        } else if (cleanName.length < 3) {
          next.name = 'Full name must have at least 3 letters.';
        } else if (/\d/.test(name)) {
          next.name = 'Name cannot contain numbers. Letters only.';
        } else {
          delete next.name;
        }
      }

      if (fieldName === 'email') {
        const cleanEmail = email.trim();
        if (loginMethod === 'email') {
          if (!cleanEmail) {
            next.email = 'Please enter your email address.';
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            next.email = 'Please enter a valid email address (e.g. name@example.com).';
          } else {
            delete next.email;
          }
        } else if (activeTab === 'register' && cleanEmail) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            next.email = 'Please enter a valid email address or leave it blank.';
          } else {
            delete next.email;
          }
        } else {
          delete next.email;
        }
      }

      if (fieldName === 'password') {
        if (!password) {
          next.password = 'Please enter your password.';
        } else if (password.length < 6) {
          next.password = 'Password must be at least 6 characters long.';
        } else {
          delete next.password;
        }
      }

      if (fieldName === 'confirmPassword') {
        if (!confirmPassword) {
          next.confirmPassword = 'Please confirm your password.';
        } else if (confirmPassword !== password) {
          next.confirmPassword = 'Passwords do not match. Please re-enter.';
        } else {
          delete next.confirmPassword;
        }
      }

      return next;
    });
  };

  // Real-time input handlers with instant error clearing
  const handlePhoneChange = (val) => {
    const digitsOnly = val.replace(/\D/g, '').slice(0, 10);
    setPhone(digitsOnly);
    setGeneralError('');
    if (fieldErrors.phone && /^[6-9]\d{9}$/.test(digitsOnly)) {
      setFieldErrors((prev) => ({ ...prev, phone: null }));
    }
  };

  // Helper for auto-verifying 6-digit OTP on login
  const autoVerifyLoginOtp = async (codeToVerify) => {
    const cleanPhone = phone.trim();
    if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) return;
    setGeneralError('');
    setLoading(true);
    const res = await loginWithPhoneOtp(cleanPhone, codeToVerify);
    setLoading(false);
    if (!res.success) {
      setGeneralError(res.error || 'Invalid OTP. Please check the code.');
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 120);
    }
  };

  // Helper for auto-verifying 6-digit OTP on registration
  const autoVerifyRegisterOtp = async (codeToVerify) => {
    const cleanPhone = phone.trim();
    if (!cleanPhone) return;
    setGeneralError('');
    setLoading(true);
    const res = await verifyPhoneOtp(cleanPhone, codeToVerify);
    setLoading(false);
    if (res.success) {
      setSuccessMsg('Mobile number verified! Please complete your details.');
      setRegisterStep('details');
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 120);
    } else {
      setGeneralError(res.error || 'Invalid or expired OTP.');
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 120);
    }
  };

  const handleOtpChange = (val) => {
    const digitsOnly = val.replace(/\D/g, '').slice(0, 6);
    setOtp(digitsOnly);
    setGeneralError('');
    if (fieldErrors.otp && digitsOnly.length === 6) {
      setFieldErrors((prev) => ({ ...prev, otp: null }));
    }

    // Auto-advance & auto-verify as soon as user finishes entering 6 digits
    if (digitsOnly.length === 6) {
      Keyboard.dismiss();
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

      if (activeTab === 'login' && phoneLoginType === 'otp') {
        autoVerifyLoginOtp(digitsOnly);
      } else if (activeTab === 'register' && registerStep === 'otp') {
        autoVerifyRegisterOtp(digitsOnly);
      }
    }
  };

  const handleNameChange = (val) => {
    const filtered = val.replace(/[^A-Za-z\s.'-]/g, '');
    setName(filtered);
    setGeneralError('');
    if (val !== filtered) {
      setFieldErrors((prev) => ({ ...prev, name: 'Full name cannot contain numbers or special symbols.' }));
    } else if (fieldErrors.name && filtered.trim().length >= 3) {
      setFieldErrors((prev) => ({ ...prev, name: null }));
    }
  };

  const handleEmailChange = (val) => {
    setEmail(val);
    setGeneralError('');
    if (fieldErrors.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
      setFieldErrors((prev) => ({ ...prev, email: null }));
    }
  };

  const handlePasswordChange = (val) => {
    setPassword(val);
    setGeneralError('');
    if (fieldErrors.password && val.length >= 6) {
      setFieldErrors((prev) => ({ ...prev, password: null }));
    }
  };

  const handleConfirmPasswordChange = (val) => {
    setConfirmPassword(val);
    setGeneralError('');
    if (fieldErrors.confirmPassword && val === password) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: null }));
    }
  };

  const resetAllFormStates = () => {
    setPhone('');
    setOtp('');
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setGeneralError('');
    setFieldErrors({});
    setSuccessMsg('');
    setOtpSent(false);
    setRegisterStep('phone');
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    resetAllFormStates();
  };

  // --- 2. SEND OTP ---
  const handleSendOtp = async (purpose = 'login') => {
    const phoneTrimmed = phone.trim();
    if (!phoneTrimmed) {
      setFieldErrors((prev) => ({ ...prev, phone: 'Please enter your 10-digit mobile number.' }));
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phoneTrimmed)) {
      setFieldErrors((prev) => ({ ...prev, phone: 'Mobile number must start with 6, 7, 8, or 9 and have 10 digits.' }));
      return;
    }

    setGeneralError('');
    setSuccessMsg('');
    setLoading(true);

    const res = await sendPhoneOtp(phoneTrimmed, purpose);
    setLoading(false);

    if (res.success) {
      setOtpSent(true);
      setSuccessMsg(`OTP sent to +91 ${phoneTrimmed}. Valid for 5 minutes.`);
      startCooldown();
      if (purpose === 'register') {
        setRegisterStep('otp');
      }
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    } else {
      setGeneralError(res.error || 'Could not send OTP. Please check the number.');
    }
  };

  // --- 3. LOGIN SUBMIT ---
  const handleLoginSubmit = async () => {
    setGeneralError('');
    setSuccessMsg('');

    // A) Email Login
    if (loginMethod === 'email') {
      validateField('email');
      validateField('password');
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) {
        return;
      }

      setLoading(true);
      const res = await login(email.trim(), password);
      setLoading(false);
      if (!res.success) {
        setGeneralError(res.error || 'Invalid email or password.');
      }
      return;
    }

    // B) Phone Login with OTP
    if (phoneLoginType === 'otp') {
      validateField('phone');
      if (!phone.trim() || !/^[6-9]\d{9}$/.test(phone.trim())) {
        return;
      }
      
      if (!otpSent) {
        return handleSendOtp('login');
      }

      validateField('otp');
      if (otp.length !== 6) {
        return;
      }

      setLoading(true);
      const res = await loginWithPhoneOtp(phone.trim(), otp);
      setLoading(false);
      if (!res.success) {
        setGeneralError(res.error || 'Invalid OTP. Please check the code.');
      }
      return;
    }

    // C) Phone Login with Password
    if (phoneLoginType === 'password') {
      validateField('phone');
      validateField('password');
      if (!phone.trim() || !password) {
        return;
      }

      setLoading(true);
      const res = await loginWithPhonePassword(phone.trim(), password);
      setLoading(false);
      if (!res.success) {
        setGeneralError(res.error || 'Incorrect mobile number or password.');
      }
    }
  };

  // --- 4. REGISTER STEP 2: VERIFY OTP ---
  const handleVerifyRegisterOtp = async () => {
    validateField('otp');
    if (otp.length !== 6) {
      return;
    }
    setGeneralError('');
    setLoading(true);
    const res = await verifyPhoneOtp(phone.trim(), otp);
    setLoading(false);

    if (res.success) {
      setSuccessMsg('Mobile number verified! Please complete your details.');
      setRegisterStep('details');
    } else {
      setGeneralError(res.error || 'Invalid or expired OTP.');
    }
  };

  // --- 5. REGISTER STEP 3: SUBMIT DETAILS ---
  const handleRegisterSubmit = async () => {
    setGeneralError('');
    validateField('name');
    validateField('password');
    validateField('confirmPassword');
    validateField('email');

    if (!name.trim() || name.trim().length < 3 || /\d/.test(name)) return;
    if (!password || password.length < 6) return;
    if (password !== confirmPassword) return;
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return;

    setLoading(true);
    const res = await registerWithPhone({
      phone: phone.trim(),
      otp,
      name: name.trim(),
      password,
      email: email.trim(),
    });
    setLoading(false);

    if (!res.success) {
      setGeneralError(res.error || 'Could not create account. Please try again.');
    }
  };

  // --- 6. LOGOUT CONFIRMATION ---
  const confirmLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to log out of BookMyVilla?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  // --- 7. DELETE ACCOUNT CONFIRMATION (Google Play & Privacy Policy Compliance) ---
  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your BookMyVilla account?\n\nThis action cannot be undone. All your profile information, booking history, saved villas, and loyalty rewards will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setDeleteLoading(true);
            try {
              const res = await deleteAccount();
              if (res.success) {
                Alert.alert(
                  'Account Deleted',
                  'Your BookMyVilla account and all associated personal data have been permanently removed.'
                );
              } else {
                Alert.alert('Notice', res.error || 'Unable to delete account. Please try again.');
              }
            } catch (err) {
              Alert.alert('Notice', 'Unable to complete deletion request. Please contact support@bookmyvilla.online.');
            } finally {
              setDeleteLoading(false);
            }
          },
        },
      ]
    );
  };

  // =========================================================================
  // VIEW: LOGGED-IN USER PROFILE (Screenshot #5 Luxury Emerald Aesthetic)
  // =========================================================================
  if (user) {
    const userInitial = ((user.name || user.email || 'G')[0] || 'G').toUpperCase();

    return (
      <View style={styles.container}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />

        {/* Top Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={{ width: 44 }} />
          <View style={styles.headerCenter}>
            <BrandLogo size={20} color={COLORS.goldLight} />
            <Text style={styles.brandSub}>LUXURY PROFILE</Text>
          </View>
          <TouchableOpacity
            style={styles.themeToggle}
            onPress={toggleTheme}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}
          >
            <Ionicons name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={17} color={COLORS.goldPrimary} />
            <Text style={styles.themeToggleText}>{mode === 'dark' ? 'Light' : 'Dark'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 60 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Member Card */}
          <View style={styles.memberCard}>
            <View style={styles.memberTop}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarLetter}>{userInitial}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={styles.tierPill}>
                  <Ionicons name="sparkles" size={11} color={COLORS.goldPrimary} />
                  <Text style={styles.tierPillText}>GOLD MEMBER</Text>
                </View>
                <Text style={styles.memberName}>{user.name || 'Valued Guest'}</Text>
                <Text style={styles.memberContact}>{user.phone ? `+91 ${user.phone}` : user.email}</Text>
              </View>
            </View>

            {/* Loyalty & Rewards Strip */}
            <View style={styles.rewardsStrip}>
              <View style={styles.rewardCol}>
                <Text style={styles.rewardVal}>1,250</Text>
                <Text style={styles.rewardLabel}>LOYALTY PTS</Text>
              </View>
              <View style={styles.rewardDivider} />
              <View style={styles.rewardCol}>
                <Text style={styles.rewardVal}>3</Text>
                <Text style={styles.rewardLabel}>RESERVED</Text>
              </View>
              <View style={styles.rewardDivider} />
              <View style={styles.rewardCol}>
                <Text style={styles.rewardVal}>VIP</Text>
                <Text style={styles.rewardLabel}>TIER ACCESS</Text>
              </View>
            </View>
          </View>

          {/* Quick Menu */}
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionHeading}>YOUR TRAVEL DESK</Text>

            <TouchableOpacity 
              style={styles.menuItem} 
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Bookings')}
            >
              <View style={styles.menuIconWrap}>
                <Ionicons name="calendar-outline" size={20} color={COLORS.goldPrimary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.menuTitle}>My Bookings</Text>
                <Text style={styles.menuSub}>View upcoming, completed & canceled stays</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Wishlist')}
            >
              <View style={styles.menuIconWrap}>
                <Ionicons name="heart-outline" size={20} color={COLORS.goldPrimary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.menuTitle}>Saved Villas</Text>
                <Text style={styles.menuSub}>Explore your luxury wishlist</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem} 
              activeOpacity={0.8}
              onPress={() => Alert.alert('Private Concierge', 'Call 24/7 VIP Concierge at +91 800-BOOK-MY-VILLA or email vip@bookmyvilla.online')}
            >
              <View style={styles.menuIconWrap}>
                <Ionicons name="headset-outline" size={20} color={COLORS.goldPrimary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.menuTitle}>VIP Concierge & Helpdesk</Text>
                <Text style={styles.menuSub}>24/7 dedicated trip assistance</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Account Actions & Privacy (Google Play Compliance) */}
          <View style={styles.accountActionSection}>
            {/* Log Out Button */}
            <TouchableOpacity 
              style={styles.logoutBtn} 
              activeOpacity={0.85}
              onPress={confirmLogout}
            >
              <Ionicons name="log-out-outline" size={19} color="#FF6B6B" />
              <Text style={styles.logoutBtnText}>Log Out from Account</Text>
            </TouchableOpacity>

            {/* Delete Account Option */}
            <TouchableOpacity 
              style={styles.deleteAccountBtn} 
              activeOpacity={0.85}
              onPress={confirmDeleteAccount}
              disabled={deleteLoading}
            >
              {deleteLoading ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  <Text style={styles.deleteAccountBtnText}>Delete Account</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.deleteAccountDisclaimer}>
              Permanently erases your personal profile, saved properties, and reservation history in compliance with Google Play data safety policies.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // =========================================================================
  // VIEW: GUEST AUTHENTICATION (LOGIN / OTP / REGISTER)
  // =========================================================================
  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={{ width: 44 }} />
        <View style={styles.headerCenter}>
          <BrandLogo size={20} color={COLORS.goldLight} />
          <Text style={styles.brandSub}>LUXURY GUEST ACCESS</Text>
        </View>
        <TouchableOpacity
          style={styles.themeToggle}
          onPress={toggleTheme}
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}
        >
          <Ionicons name={mode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={17} color={COLORS.goldPrimary} />
          <Text style={styles.themeToggleText}>{mode === 'dark' ? 'Light' : 'Dark'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingBottom: (keyboardHeight > 0 ? keyboardHeight + 35 : 60) + insets.bottom }
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Welcome Tag */}
        <View style={styles.welcomeBanner}>
          <Text style={styles.welcomeTitle}>
            {activeTab === 'login' ? 'Welcome Back' : 'Create Your Guest Account'}
          </Text>
          <Text style={styles.welcomeSub}>
            {activeTab === 'login' 
              ? 'Log in to manage bookings, track upcoming stays & earn rewards.' 
              : 'Sign up in seconds with your mobile number to unlock exclusive villas.'}
          </Text>
        </View>

        {/* Primary Tab Switch: Log In vs Create Account */}
        <View style={styles.tabSwitchContainer}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'login' && styles.tabBtnActive]} 
            onPress={() => switchTab('login')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabBtnText, activeTab === 'login' && styles.tabBtnTextActive]}>
              Log In
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'register' && styles.tabBtnActive]} 
            onPress={() => switchTab('register')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabBtnText, activeTab === 'register' && styles.tabBtnTextActive]}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>

        {/* General Alert / Error Banner */}
        {generalError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#FF6B6B" />
            <Text style={styles.errorText}>{generalError}</Text>
          </View>
        ) : null}

        {/* Success Banner */}
        {successMsg ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.statusGreen} />
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        ) : null}

        {/* ----------------------------------------------------------------- */}
        {/* TAB 1: LOG IN                                                     */}
        {/* ----------------------------------------------------------------- */}
        {activeTab === 'login' && (
          <View style={styles.formCard}>
            {/* Login Method Toggle: Mobile vs Email */}
            <View style={styles.methodToggleRow}>
              <TouchableOpacity 
                style={[styles.methodPill, loginMethod === 'phone' && styles.methodPillActive]}
                onPress={() => { setLoginMethod('phone'); setGeneralError(''); setFieldErrors({}); }}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name="phone-portrait-outline" 
                  size={15} 
                  color={loginMethod === 'phone' ? COLORS.actionText : COLORS.textMuted} 
                />
                <Text style={[styles.methodPillText, loginMethod === 'phone' && styles.methodPillTextActive]}>
                  Mobile Number
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.methodPill, loginMethod === 'email' && styles.methodPillActive]}
                onPress={() => { setLoginMethod('email'); setGeneralError(''); setFieldErrors({}); }}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name="mail-outline" 
                  size={15} 
                  color={loginMethod === 'email' ? COLORS.actionText : COLORS.textMuted} 
                />
                <Text style={[styles.methodPillText, loginMethod === 'email' && styles.methodPillTextActive]}>
                  Email Address
                </Text>
              </TouchableOpacity>
            </View>

            {/* A) PHONE LOGIN */}
            {loginMethod === 'phone' && (
              <>
                {/* Mobile Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>MOBILE NUMBER</Text>
                  <View style={[
                    styles.phoneInputRow,
                    fieldErrors.phone && styles.inputErrorBorder
                  ]}>
                    <View style={styles.countryCodeBox}>
                      <Text style={styles.flagEmoji}>🇮🇳</Text>
                      <Text style={styles.countryCodeText}>+91</Text>
                    </View>
                    <TextInput
                      style={styles.phoneTextInput}
                      placeholder="98765 43210"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="number-pad"
                      maxLength={10}
                      value={phone}
                      onChangeText={handlePhoneChange}
                      onBlur={() => validateField('phone')}
                      editable={!otpSent}
                    />
                    {otpSent && (
                      <TouchableOpacity 
                        onPress={() => { setOtpSent(false); setOtp(''); setFieldErrors({}); }}
                        style={styles.changePhoneBtn}
                      >
                        <Text style={styles.changePhoneText}>Change</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {fieldErrors.phone ? (
                    <View style={styles.inlineErrorRow}>
                      <Ionicons name="alert-circle-outline" size={13} color="#FF6B6B" />
                      <Text style={styles.inlineErrorText}>{fieldErrors.phone}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Sub-toggle: OTP vs Password */}
                <View style={styles.subToggleRow}>
                  <TouchableOpacity 
                    style={[styles.subToggleBtn, phoneLoginType === 'otp' && styles.subToggleBtnActive]}
                    onPress={() => { setPhoneLoginType('otp'); setGeneralError(''); setFieldErrors({}); }}
                  >
                    <Ionicons 
                      name="chatbubble-ellipses-outline" 
                      size={14} 
                      color={phoneLoginType === 'otp' ? COLORS.goldPrimary : COLORS.textMuted} 
                    />
                    <Text style={[styles.subToggleText, phoneLoginType === 'otp' && styles.subToggleTextActive]}>
                      Login with OTP
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.subToggleBtn, phoneLoginType === 'password' && styles.subToggleBtnActive]}
                    onPress={() => { setPhoneLoginType('password'); setGeneralError(''); setFieldErrors({}); }}
                  >
                    <Ionicons 
                      name="lock-closed-outline" 
                      size={14} 
                      color={phoneLoginType === 'password' ? COLORS.goldPrimary : COLORS.textMuted} 
                    />
                    <Text style={[styles.subToggleText, phoneLoginType === 'password' && styles.subToggleTextActive]}>
                      Password
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* OTP Mode Fields */}
                {phoneLoginType === 'otp' && otpSent && (
                  <>
                    {/* OTP 6-Digit Field */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>ENTER 6-DIGIT OTP</Text>
                      <TextInput
                        style={[styles.otpInput, fieldErrors.otp && styles.inputErrorBorder]}
                        placeholder="• • • • • •"
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otp}
                        onChangeText={handleOtpChange}
                        onFocus={() => {
                          setTimeout(() => {
                            scrollViewRef.current?.scrollToEnd({ animated: true });
                          }, 150);
                        }}
                        onBlur={() => validateField('otp')}
                      />
                      {fieldErrors.otp ? (
                        <View style={styles.inlineErrorRow}>
                          <Ionicons name="alert-circle-outline" size={13} color="#FF6B6B" />
                          <Text style={styles.inlineErrorText}>{fieldErrors.otp}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Resend Cooldown */}
                    <View style={styles.resendRow}>
                      <TouchableOpacity 
                        disabled={cooldown > 0 || loading} 
                        onPress={() => handleSendOtp('login')}
                      >
                        <Text style={[styles.resendText, cooldown > 0 && { color: COLORS.textMuted }]}>
                          {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend Verification Code'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {/* Password Mode Field */}
                {phoneLoginType === 'password' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>YOUR PASSWORD</Text>
                    <View style={[styles.passwordRow, fieldErrors.password && styles.inputErrorBorder]}>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder="Enter your password"
                        placeholderTextColor={COLORS.textMuted}
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={handlePasswordChange}
                        onBlur={() => validateField('password')}
                      />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                        <Ionicons 
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                          size={18} 
                          color={COLORS.textMuted} 
                        />
                      </TouchableOpacity>
                    </View>
                    {fieldErrors.password ? (
                      <View style={styles.inlineErrorRow}>
                        <Ionicons name="alert-circle-outline" size={13} color="#FF6B6B" />
                        <Text style={styles.inlineErrorText}>{fieldErrors.password}</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </>
            )}

            {/* B) EMAIL LOGIN */}
            {loginMethod === 'email' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                  <TextInput
                    style={[styles.standardInput, fieldErrors.email && styles.inputErrorBorder]}
                    placeholder="guest@example.com"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={handleEmailChange}
                    onBlur={() => validateField('email')}
                  />
                  {fieldErrors.email ? (
                    <View style={styles.inlineErrorRow}>
                      <Ionicons name="alert-circle-outline" size={13} color="#FF6B6B" />
                      <Text style={styles.inlineErrorText}>{fieldErrors.email}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>PASSWORD</Text>
                  <View style={[styles.passwordRow, fieldErrors.password && styles.inputErrorBorder]}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Enter your password"
                      placeholderTextColor={COLORS.textMuted}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={handlePasswordChange}
                      onBlur={() => validateField('password')}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                      <Ionicons 
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                        size={18} 
                        color={COLORS.textMuted} 
                      />
                    </TouchableOpacity>
                  </View>
                  {fieldErrors.password ? (
                    <View style={styles.inlineErrorRow}>
                      <Ionicons name="alert-circle-outline" size={13} color="#FF6B6B" />
                      <Text style={styles.inlineErrorText}>{fieldErrors.password}</Text>
                    </View>
                  ) : null}
                </View>
              </>
            )}

            {/* Primary Action Button */}
            <TouchableOpacity 
              style={styles.submitBtn} 
              activeOpacity={0.88}
              onPress={handleLoginSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.actionText} />
              ) : (
                <Text style={styles.submitBtnText}>
                  {loginMethod === 'phone' && phoneLoginType === 'otp'
                    ? (otpSent ? 'Verify OTP & Continue →' : 'Send 6-Digit OTP →')
                    : 'Log In →'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.switchPromptBtn}
              onPress={() => switchTab('register')}
            >
              <Text style={styles.switchPromptText}>
                New guest to BookMyVilla? <Text style={styles.switchHighlight}>Create an Account</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* TAB 2: CREATE ACCOUNT (STEPPER: 1. Mobile ➔ 2. OTP ➔ 3. Details)   */}
        {/* ----------------------------------------------------------------- */}
        {activeTab === 'register' && (
          <View style={styles.formCard}>
            {/* Progress Stepper */}
            <View style={styles.stepperWrap}>
              <View style={[styles.stepItem, registerStep === 'phone' && styles.stepItemActive, (registerStep === 'otp' || registerStep === 'details') && styles.stepItemDone]}>
                <Text style={styles.stepNum}>1</Text>
                <Text style={styles.stepTitle}>Mobile</Text>
              </View>
              <View style={styles.stepLine} />
              <View style={[styles.stepItem, registerStep === 'otp' && styles.stepItemActive, registerStep === 'details' && styles.stepItemDone]}>
                <Text style={styles.stepNum}>2</Text>
                <Text style={styles.stepTitle}>OTP</Text>
              </View>
              <View style={styles.stepLine} />
              <View style={[styles.stepItem, registerStep === 'details' && styles.stepItemActive]}>
                <Text style={styles.stepNum}>3</Text>
                <Text style={styles.stepTitle}>Details</Text>
              </View>
            </View>

            {/* STEP 1: MOBILE INPUT */}
            {registerStep === 'phone' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>YOUR MOBILE NUMBER</Text>
                  <View style={[
                    styles.phoneInputRow,
                    fieldErrors.phone && styles.inputErrorBorder
                  ]}>
                    <View style={styles.countryCodeBox}>
                      <Text style={styles.flagEmoji}>🇮🇳</Text>
                      <Text style={styles.countryCodeText}>+91</Text>
                    </View>
                    <TextInput
                      style={styles.phoneTextInput}
                      placeholder="98765 43210"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="number-pad"
                      maxLength={10}
                      value={phone}
                      onChangeText={handlePhoneChange}
                      onBlur={() => validateField('phone')}
                    />
                  </View>
                  {fieldErrors.phone ? (
                    <View style={styles.inlineErrorRow}>
                      <Ionicons name="alert-circle-outline" size={13} color="#FF6B6B" />
                      <Text style={styles.inlineErrorText}>{fieldErrors.phone}</Text>
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity 
                  style={styles.submitBtn} 
                  activeOpacity={0.88}
                  onPress={() => handleSendOtp('register')}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.actionText} />
                  ) : (
                    <Text style={styles.submitBtnText}>Send Verification OTP →</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* STEP 2: ENTER OTP */}
            {registerStep === 'otp' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>VERIFICATION CODE (SENT TO +91 {phone})</Text>
                  <TextInput
                    style={[styles.otpInput, fieldErrors.otp && styles.inputErrorBorder]}
                    placeholder="• • • • • •"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otp}
                    onChangeText={handleOtpChange}
                    onFocus={() => {
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 150);
                    }}
                    onBlur={() => validateField('otp')}
                  />
                  {fieldErrors.otp ? (
                    <View style={styles.inlineErrorRow}>
                      <Ionicons name="alert-circle-outline" size={13} color="#FF6B6B" />
                      <Text style={styles.inlineErrorText}>{fieldErrors.otp}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.resendRow}>
                  <TouchableOpacity 
                    disabled={cooldown > 0 || loading} 
                    onPress={() => handleSendOtp('register')}
                  >
                    <Text style={[styles.resendText, cooldown > 0 && { color: COLORS.textMuted }]}>
                      {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend Verification Code'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => { setRegisterStep('phone'); setOtp(''); setFieldErrors({}); }}>
                    <Text style={styles.changePhoneText}>Change Mobile</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={styles.submitBtn} 
                  activeOpacity={0.88}
                  onPress={handleVerifyRegisterOtp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.actionText} />
                  ) : (
                    <Text style={styles.submitBtnText}>Verify OTP & Continue →</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* STEP 3: FULL DETAILS */}
            {registerStep === 'details' && (
              <>
                <View style={styles.verifiedPhoneBadge}>
                  <Ionicons name="shield-checkmark" size={16} color={COLORS.statusGreen} />
                  <Text style={styles.verifiedPhoneText}>Mobile Verified: +91 {phone}</Text>
                </View>

                {/* Full Name */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>FULL NAME (LETTERS ONLY)</Text>
                  <TextInput
                    style={[styles.standardInput, fieldErrors.name && styles.inputErrorBorder]}
                    placeholder="Enter your full name"
                    placeholderTextColor={COLORS.textMuted}
                    value={name}
                    onChangeText={handleNameChange}
                    onBlur={() => validateField('name')}
                  />
                  {fieldErrors.name ? (
                    <View style={styles.inlineErrorRow}>
                      <Ionicons name="alert-circle-outline" size={13} color="#FF6B6B" />
                      <Text style={styles.inlineErrorText}>{fieldErrors.name}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Email (Optional) */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>EMAIL ADDRESS (OPTIONAL)</Text>
                  <TextInput
                    style={[styles.standardInput, fieldErrors.email && styles.inputErrorBorder]}
                    placeholder="rahul@example.com"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={handleEmailChange}
                    onBlur={() => validateField('email')}
                  />
                  {fieldErrors.email ? (
                    <View style={styles.inlineErrorRow}>
                      <Ionicons name="alert-circle-outline" size={13} color="#FF6B6B" />
                      <Text style={styles.inlineErrorText}>{fieldErrors.email}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>CREATE PASSWORD (MIN 6 CHARACTERS)</Text>
                  <View style={[styles.passwordRow, fieldErrors.password && styles.inputErrorBorder]}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="At least 6 characters"
                      placeholderTextColor={COLORS.textMuted}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={handlePasswordChange}
                      onBlur={() => validateField('password')}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                      <Ionicons 
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                        size={18} 
                        color={COLORS.textMuted} 
                      />
                    </TouchableOpacity>
                  </View>
                  {fieldErrors.password ? (
                    <View style={styles.inlineErrorRow}>
                      <Ionicons name="alert-circle-outline" size={13} color="#FF6B6B" />
                      <Text style={styles.inlineErrorText}>{fieldErrors.password}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Confirm Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
                  <TextInput
                    style={[styles.standardInput, fieldErrors.confirmPassword && styles.inputErrorBorder]}
                    placeholder="Re-enter password"
                    placeholderTextColor={COLORS.textMuted}
                    secureTextEntry={!showPassword}
                    value={confirmPassword}
                    onChangeText={handleConfirmPasswordChange}
                    onBlur={() => validateField('confirmPassword')}
                  />
                  {fieldErrors.confirmPassword ? (
                    <View style={styles.inlineErrorRow}>
                      <Ionicons name="alert-circle-outline" size={13} color="#FF6B6B" />
                      <Text style={styles.inlineErrorText}>{fieldErrors.confirmPassword}</Text>
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity 
                  style={styles.submitBtn} 
                  activeOpacity={0.88}
                  onPress={handleRegisterSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.actionText} />
                  ) : (
                    <Text style={styles.submitBtnText}>Complete Sign Up →</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity 
              style={styles.switchPromptBtn}
              onPress={() => switchTab('login')}
            >
              <Text style={styles.switchPromptText}>
                Already registered? <Text style={styles.switchHighlight}>Log In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.bgMain 
  },
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
  themeToggle: {
    minWidth: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingVertical: 6,
  },
  themeToggleText: { color: COLORS.goldPrimary, fontSize: 11, fontWeight: '700' },
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
  scrollContent: {
    padding: 16,
  },

  // Logged In Profile
  memberCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    padding: 18,
    marginBottom: 20,
  },
  memberTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.bgCardElevated,
    borderWidth: 2,
    borderColor: COLORS.goldPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.goldPrimary,
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    marginBottom: 4,
    gap: 4,
  },
  tierPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.goldPrimary,
    letterSpacing: 1,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  memberContact: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  rewardsStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bgDeep,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  rewardCol: { alignItems: 'center', flex: 1 },
  rewardVal: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.goldLight,
  },
  rewardLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 3,
    letterSpacing: 0.8,
  },
  rewardDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionWrap: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.goldPrimary,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  menuSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  accountActionSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 12,
    gap: 8,
  },
  deleteAccountBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 0.2,
  },
  deleteAccountDisclaimer: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
    paddingHorizontal: 16,
  },

  // Guest Auth State
  welcomeBanner: {
    alignItems: 'center',
    marginVertical: 12,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  welcomeSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  tabSwitchContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgDeep,
    borderRadius: 12,
    padding: 4,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: COLORS.bgCardElevated,
    borderWidth: 1,
    borderColor: COLORS.borderGold,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabBtnTextActive: {
    color: COLORS.goldPrimary,
    fontWeight: '700',
  },

  formCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 18,
  },

  methodToggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgDeep,
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  methodPill: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  methodPillActive: {
    backgroundColor: COLORS.goldPrimary,
  },
  methodPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  methodPillTextActive: {
    color: COLORS.actionText,
    fontWeight: '700',
  },

  subToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  subToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.bgCardElevated,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    gap: 6,
  },
  subToggleBtnActive: {
    borderColor: COLORS.goldPrimary,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  subToggleText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  subToggleTextActive: {
    color: COLORS.goldPrimary,
    fontWeight: '600',
  },

  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.goldLight,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgDeep,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    overflow: 'hidden',
  },
  countryCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.bgCardElevated,
    borderRightWidth: 1,
    borderRightColor: COLORS.borderLight,
    gap: 6,
  },
  flagEmoji: { fontSize: 16 },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  phoneTextInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontWeight: '500',
  },
  changePhoneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 6,
  },
  changePhoneText: {
    fontSize: 12,
    color: COLORS.goldPrimary,
    fontWeight: '600',
  },

  standardInput: {
    backgroundColor: COLORS.bgDeep,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgDeep,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    paddingVertical: 12,
  },
  eyeBtn: {
    padding: 6,
  },

  otpInput: {
    backgroundColor: COLORS.bgDeep,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderGold,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.goldLight,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 10,
    textAlign: 'center',
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  resendText: {
    fontSize: 12,
    color: COLORS.goldPrimary,
    fontWeight: '600',
  },

  // Error border applied to inputs
  inputErrorBorder: {
    borderColor: '#FF6B6B',
    borderWidth: 1.5,
  },
  inlineErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 5,
    paddingLeft: 2,
  },
  inlineErrorText: {
    fontSize: 11,
    color: '#FF6B6B',
    fontWeight: '500',
  },

  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  stepItemActive: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.goldPrimary,
    paddingBottom: 2,
  },
  stepItemDone: {},
  stepLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 8,
  },

  verifiedPhoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 217, 100, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(76, 217, 100, 0.3)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
    gap: 8,
  },
  verifiedPhoneText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.statusGreen,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.35)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '500',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 217, 100, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(76, 217, 100, 0.35)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    gap: 8,
  },
  successText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.statusGreen,
    fontWeight: '500',
  },

  submitBtn: {
    backgroundColor: COLORS.goldPrimary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  submitBtnText: {
    color: COLORS.actionText,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  switchPromptBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchPromptText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  switchHighlight: {
    color: COLORS.goldPrimary,
    fontWeight: '700',
  },
});
