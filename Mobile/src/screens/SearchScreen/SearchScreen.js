import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  FlatList, 
  ScrollView,
  TouchableOpacity, 
  ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../context/ThemeContext';
import apiClient from '../../api/client';
import VillaCard from '../../components/VillaCard';
import BrandLogo from '../../components/BrandLogo';

const CATEGORY_TAGS = ['Villas', 'Resorts', 'Homestays', 'Beachfront'];
const FILTER_TAGS = ['All', ...CATEGORY_TAGS, 'Pool', 'WiFi', 'Beach', 'AC', 'Under ₹20k'];

const TAG_ICONS = {
  All: 'grid-outline',
  Villas: 'home-outline',
  Resorts: 'business-outline',
  Homestays: 'bed-outline',
  Beachfront: 'water-outline',
  Pool: 'water-outline',
  WiFi: 'wifi-outline',
  Beach: 'sunny-outline',
  AC: 'snow-outline',
  'Under ₹20k': 'pricetag-outline',
};

const CURATED_EXPLORE_FALLBACKS = [];

export default function SearchScreen({ navigation, route }) {
  const { colors: COLORS, mode } = useAppTheme();
  const styles = useMemo(() => createStyles(COLORS, mode), [COLORS, mode]);
  const insets = useSafeAreaInsets();
  const [allVillas, setAllVillas] = useState([]);
  const [filteredVillas, setFilteredVillas] = useState([]);
  const [searchQuery, setSearchQuery] = useState(route?.params?.initialQuery || '');
  const [selectedTag, setSelectedTag] = useState('All');
  const [loading, setLoading] = useState(true);

  // Sync with navigation params if user searches from HomeScreen
  useEffect(() => {
    if (route?.params?.initialQuery !== undefined) {
      setSearchQuery(route.params.initialQuery);
    }
    if (route?.params?.initialCategory !== undefined) {
      const cat = String(route.params.initialCategory || '').trim().toLowerCase();
      const matched = FILTER_TAGS.find(t => t.toLowerCase() === cat);
      setSelectedTag(matched || 'All');
    }
  }, [route?.params?.initialQuery, route?.params?.initialCategory]);

  // Fetch all villas once on mount (supplementing with curated catalog for reliability)
  useEffect(() => {
    const fetchVillas = async () => {
      try {
        const res = await apiClient.get('/properties/all');
        const list = Array.isArray(res.data) ? res.data : (res.data.properties || []);
        
        if (list && list.length > 0) {
          setAllVillas(list);
          setFilteredVillas(list);
        } else {
          setAllVillas(CURATED_EXPLORE_FALLBACKS);
          setFilteredVillas(CURATED_EXPLORE_FALLBACKS);
        }
      } catch (err) {
        console.log('Search fetch error:', err.message);
        setAllVillas(CURATED_EXPLORE_FALLBACKS);
        setFilteredVillas(CURATED_EXPLORE_FALLBACKS);
      } finally {
        setLoading(false);
      }
    };
    fetchVillas();
  }, []);

  // Filter villas when query or tag changes
  useEffect(() => {
    let result = allVillas;

    // Filter by search query (name or location/city)
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter((villa) => {
        const searchable = [
          villa.name,
          villa.description,
          villa.location?.city,
          villa.city,
          villa.address,
          ...(Array.isArray(villa.amenities) ? villa.amenities : []),
        ].join(' ').toLowerCase();
        return searchable.includes(q);
      });
    }

    // Filter by tag
    if (selectedTag === 'Under ₹20k') {
      result = result.filter((villa) => {
        const price = villa.pricing?.basePrice || villa.pricePerNight || villa.price || 0;
        return price <= 20000;
      });
    } else if (CATEGORY_TAGS.includes(selectedTag)) {
      const categoryTerms = {
        Villas: ['villa'],
        Resorts: ['resort'],
        Homestays: ['homestay', 'home stay', 'guest house'],
        Beachfront: ['beachfront', 'beach front', 'beach', 'coastal', 'seaside'],
      }[selectedTag];

      result = result.filter((villa) => {
        const type = (villa.type || '').toLowerCase();
        const searchable = [
          villa.name,
          villa.description,
          villa.location?.city,
          villa.city,
          villa.address,
          ...(Array.isArray(villa.amenities) ? villa.amenities : []),
        ].join(' ').toLowerCase();

        if (selectedTag === 'Villas' && !type) return true;
        return categoryTerms.some((term) => type.includes(term) || searchable.includes(term));
      });
    } else if (selectedTag === 'AC' || selectedTag === 'Air Conditioning') {
      result = result.filter((villa) => {
        const text = `${villa.name || ''} ${villa.description || ''} ${(villa.amenities || []).join(' ')}`.toLowerCase();
        return (Array.isArray(villa.amenities) && villa.amenities.some(a => /^(ac|air conditioning|air conditioner)$/i.test(a.trim()))) ||
               /\b(ac|air conditioning|air conditioned)\b/i.test(text);
      });
    } else if (selectedTag !== 'All') {
      result = result.filter((villa) => {
        const desc = `${villa.name || ''} ${villa.description || ''} ${(villa.amenities || []).join(' ')}`.toLowerCase();
        return desc.includes(selectedTag.toLowerCase());
      });
    }

    setFilteredVillas(result);
  }, [searchQuery, selectedTag, allVillas]);

  const isDark = mode === 'dark';

  return (
    <View style={styles.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Top Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={{ width: 32 }} />
        <View style={styles.headerCenter}>
          <BrandLogo size={20} color={COLORS.goldLight} />
          <Text style={styles.brandSub}>FIND YOUR RETREAT</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {/* Search Input Bar with Integrated Filters Button */}
      <View style={styles.searchBarContainer}>
        <Ionicons name="search" size={19} color={COLORS.goldPrimary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search destination, city, or villa name..."
          placeholderTextColor={isDark ? '#8A9E95' : '#6B7A73'}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="never"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity 
            onPress={() => setSearchQuery('')}
            style={styles.searchClearBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={isDark ? '#8A9E95' : '#6B7A73'} />
          </TouchableOpacity>
        )}

        {/* Embedded Filters Indicator / Badge */}
        <View style={styles.searchBarDivider} />
        <TouchableOpacity 
          style={[styles.searchFilterBadge, selectedTag !== 'All' && styles.searchFilterBadgeActive]}
          activeOpacity={0.7}
          onPress={() => {
            if (selectedTag !== 'All') {
              setSelectedTag('All');
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={`Filter: ${selectedTag}`}
        >
          <Ionicons 
            name="options-outline" 
            size={14} 
            color={selectedTag !== 'All' ? (isDark ? '#071511' : '#FFFFFF') : (isDark ? '#ECC86B' : COLORS.goldPrimary)} 
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.searchFilterBadgeText, selectedTag !== 'All' && styles.searchFilterBadgeTextActive]}>
            {selectedTag !== 'All' ? selectedTag : 'Filters'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Section Header Row */}
      <View style={styles.filterSectionHeader}>
        <View style={styles.filterSectionLeft}>
          <Ionicons 
            name="funnel" 
            size={13} 
            color={isDark ? '#ECC86B' : COLORS.goldPrimary} 
          />
          <Text style={styles.filterSectionLabel}>FILTER BY:</Text>
          {selectedTag !== 'All' && (
            <View style={styles.activeFilterPill}>
              <Text style={styles.activeFilterPillText}>{selectedTag}</Text>
            </View>
          )}
        </View>
        {selectedTag !== 'All' && (
          <TouchableOpacity 
            onPress={() => setSelectedTag('All')}
            style={styles.filterResetBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.filterResetText}>Reset Filter</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Quick Filter Chips (Horizontal Single-Row Scroll with Fixed-Height Wrapper) */}
      <View style={styles.tagScrollWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.tagScrollView}
          contentContainerStyle={styles.tagScroll}
        >
          {FILTER_TAGS.map((tag) => {
            const isSelected = selectedTag === tag;
            const iconName = TAG_ICONS[tag] || 'ellipse-outline';
            return (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tagChip, 
                  isSelected ? styles.tagChipActive : styles.tagChipInactive
                ]}
                onPress={() => setSelectedTag(tag)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={iconName}
                  size={15}
                  color={
                    isSelected 
                      ? (isDark ? '#0A1C16' : '#FFFFFF') 
                      : (isDark ? '#ECC86B' : COLORS.goldPrimary)
                  }
                  style={styles.tagIcon}
                />
                <Text 
                  numberOfLines={1}
                  style={[
                    styles.tagText, 
                    isSelected ? styles.tagTextActive : styles.tagTextInactive
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Search Results Summary */}
      <View style={styles.resultsInfoRow}>
        <Text style={styles.resultsCount}>
          {filteredVillas.length} {filteredVillas.length === 1 ? 'STAY FOUND' : 'STAYS FOUND'}
        </Text>
      </View>

      {/* Content List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.goldPrimary} />
          <Text style={styles.loadingText}>Searching available villas...</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filteredVillas}
          keyExtractor={(item, index) => item._id || item.id || index.toString()}
          renderItem={({ item }) => (
            <VillaCard
              villa={item}
              onPress={() => {
                navigation.navigate('VillaDetail', { villa: item });
              }}
            />
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Ionicons name="compass-outline" size={44} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No Luxury Stays Found</Text>
              <Text style={styles.emptySub}>
                Try adjusting your search query or selecting "All" to view all villas.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (COLORS, mode) => {
  const isDark = mode === 'dark';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.bgMain,
    },
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
    searchBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.bgDeep,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 6,
      paddingLeft: 12,
      paddingRight: 8,
      paddingVertical: 7,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : '#D0D8CF',
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 13.5,
      fontWeight: '500',
      color: isDark ? '#FFFFFF' : '#111A16',
      paddingVertical: 4,
    },
    searchClearBtn: {
      paddingHorizontal: 4,
    },
    searchBarDivider: {
      width: 1,
      height: 22,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : '#D0D8CF',
      marginHorizontal: 6,
    },
    searchFilterBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.16)' : 'rgba(152, 112, 15, 0.10)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(212, 175, 55, 0.40)' : 'rgba(152, 112, 15, 0.28)',
    },
    searchFilterBadgeActive: {
      backgroundColor: COLORS.goldPrimary,
      borderColor: COLORS.goldPrimary,
    },
    searchFilterBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? '#ECC86B' : COLORS.goldPrimary,
      letterSpacing: 0.3,
    },
    searchFilterBadgeTextActive: {
      color: isDark ? '#071511' : '#FFFFFF',
    },
    filterSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      marginTop: 4,
      marginBottom: 6,
    },
    filterSectionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    filterSectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: isDark ? '#ECC86B' : COLORS.goldPrimary,
      letterSpacing: 1.2,
      marginLeft: 5,
    },
    activeFilterPill: {
      backgroundColor: isDark ? 'rgba(212, 175, 55, 0.2)' : 'rgba(152, 112, 15, 0.14)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      marginLeft: 8,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(212, 175, 55, 0.45)' : 'rgba(152, 112, 15, 0.3)',
    },
    activeFilterPillText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: isDark ? '#ECC86B' : COLORS.goldPrimary,
    },
    filterResetBtn: {
      paddingVertical: 2,
      paddingHorizontal: 6,
    },
    filterResetText: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#DCE7E2' : '#394640',
      textDecorationLine: 'underline',
    },
    tagScrollWrapper: {
      height: 44,
      minHeight: 44,
      maxHeight: 44,
      marginVertical: 4,
    },
    tagScrollView: {
      height: 44,
      flexGrow: 0,
    },
    tagScroll: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      height: 44,
    },
    tagChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 38,
      minHeight: 38,
      paddingHorizontal: 16,
      borderRadius: 19,
      marginRight: 9,
      flexShrink: 0,
    },
    tagChipInactive: {
      backgroundColor: isDark ? '#112A22' : '#EFF3EC',
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.22)' : '#CAD3C9',
    },
    tagChipActive: {
      backgroundColor: isDark ? '#D4AF37' : '#98700F',
      borderWidth: 1.5,
      borderColor: isDark ? '#ECC86B' : '#85620D',
      shadowColor: COLORS.goldPrimary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 3,
    },
    tagIcon: {
      marginRight: 6,
    },
    tagText: {
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 18,
      paddingRight: 3,
    },
    tagTextInactive: {
      color: isDark ? '#FFFFFF' : '#111A16',
    },
    tagTextActive: {
      color: isDark ? '#0A1C16' : '#FFFFFF',
    },
    resultsInfoRow: {
      paddingHorizontal: 18,
      paddingVertical: 8,
    },
    resultsCount: {
      fontSize: 10.5,
      fontWeight: '800',
      color: COLORS.goldPrimary,
      letterSpacing: 1.2,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 30,
      marginTop: 40,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 13,
      color: COLORS.goldLight,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginTop: 14,
    },
    emptySub: {
      fontSize: 12,
      color: COLORS.textMuted,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 18,
    },
  });
};
