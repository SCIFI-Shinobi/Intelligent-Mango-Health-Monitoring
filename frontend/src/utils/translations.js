const translations = {
  // ---- Navbar & Navigation ----
  nav: {
    dashboard: { en: 'Dashboard', am: 'ዳሽቦርድ' },
    analysis: { en: 'Analysis', am: 'ትንተና' },
    logs: { en: 'Logs', am: 'መዝገቦች' },
    settings: { en: 'Settings', am: 'ቅንብሮች' },
    home: { en: 'Home', am: 'መነሻ' },
    logout: { en: 'Logout', am: 'ውጣ' },
    notifications: { en: 'Notifications', am: 'ማሳወቂያዎች' },
    markAllRead: { en: 'Mark all read', am: 'ሁሉንም አንብብ' },
    noNotifications: { en: 'No notifications yet', am: 'ምንም ማሳወቂያ የለም' },
  },

  // ---- Login / Auth ----
  auth: {
    welcomeBack: { en: 'Welcome Back', am: 'እንኳን ደህና መጡ' },
    createAccount: { en: 'Create Account', am: 'መለያ ይፍጠሩ' },
    username: { en: 'Username', am: 'የተጠቃሚ ስም' },
    password: { en: 'Password', am: 'የይለፍ ቃል' },
    email: { en: 'Email', am: 'ኢሜይል' },
    enterUsername: { en: 'Enter your username', am: 'የተጠቃሚ ስምዎን ያስገቡ' },
    enterPassword: { en: 'Enter your password', am: 'የይለፍ ቃልዎን ያስገቡ' },
    enterEmail: { en: 'Enter your email for alerts', am: 'ለማንቂያ ኢሜይልዎን ያስገቡ' },
    signIn: { en: 'Sign In', am: 'ግባ' },
    signUp: { en: 'Sign Up', am: 'ተመዝገብ' },
    pleaseWait: { en: 'Please wait...', am: 'እባክዎ ይጠብቁ...' },
    noAccount: { en: "Don't have an account? ", am: 'መለያ የለዎትም? ' },
    hasAccount: { en: 'Already have an account? ', am: 'መለያ አለዎት? ' },
    subtitle: { en: 'Intelligent Plant Health Monitoring', am: 'ብልህ የእጽዋት ጤና ክትትል' },
    serverError: { en: 'Cannot connect to server. Is the backend running?', am: 'ከሰርቨር ጋር መገናኘት አልተቻለም።' },
    registrationFailed: { en: 'Registration failed', am: 'ምዝገባ አልተሳካም' },
    invalidCredentials: { en: 'Invalid credentials', am: 'የተሳሳተ መረጃ' },
  },

  // ---- User Profile ----
  profile: {
    title: { en: 'Your Profile', am: 'የእርስዎ መገለጫ' },
    viewProfile: { en: 'View Profile', am: 'መገለጫ ይመልከቱ' },
    editProfile: { en: 'Edit Profile', am: 'መገለጫ አርትዕ' },
    displayName: { en: 'Display Name', am: 'የማሳያ ስም' },
    enterDisplayName: { en: 'Enter your display name', am: 'የማሳያ ስምዎን ያስገቡ' },
    saveProfile: { en: 'Save Profile', am: 'መገለጫ አስቀምጥ' },
    profileSaved: { en: 'Profile saved successfully', am: 'መገለጫ በተሳካ ሁኔታ ተቀምጧል' },
    saveFailed: { en: 'Failed to save profile', am: 'መገለጫ ማስቀመጥ አልተሳካም' },
    noEmail: { en: 'No email set', am: 'ኢሜይል አልተዘጋጀም' },
    clickToUpload: { en: 'Click to upload photo', am: 'ፎቶ ለመጫን ይጫኑ' },
    invalidImageType: { en: 'Please select an image file', am: 'እባክዎ የምስል ፋይል ይምረጡ' },
    imageTooLarge: { en: 'Image must be less than 1MB', am: 'ምስሉ ከ1MB በታች መሆን አለበት' },
    changePassword: { en: 'Change Password', am: 'የይለፍ ቃል ይቀይሩ' },
    currentPassword: { en: 'Current Password', am: 'አሁን ያለው የይለፍ ቃል' },
    newPassword: { en: 'New Password', am: 'አዲስ የይለፍ ቃል' },
    confirmPassword: { en: 'Confirm Password', am: 'የይለፍ ቃል ያረጋግጡ' },
    updatePassword: { en: 'Update Password', am: 'የይለፍ ቃል አዘምን' },
    passwordChanged: { en: 'Password changed successfully', am: 'የይለፍ ቃል በተሳካ ሁኔታ ተቀይሯል' },
    passwordChangeFailed: { en: 'Failed to change password', am: 'የይለፍ ቃል መቀየር አልተሳካም' },
    passwordMismatch: { en: 'Passwords do not match', am: 'የይለፍ ቃሎች አይዛመዱም' },
    passwordTooShort: { en: 'Password must be at least 6 characters', am: 'የይለፍ ቃል ቢያንስ 6 ቁምፊዎች መሆን አለበት' },
    usernameCannotChange: { en: 'Username cannot be changed', am: 'የተጠቃሚ ስም መቀየር አይቻልም' },
  },

  // ---- Disease Status Card ----
  disease: {
    healthStatus: { en: 'Health Status', am: 'የጤና ሁኔታ' },
    diseaseStatus: { en: 'Disease Status', am: 'የበሽታ ሁኔታ' },
    noData: { en: 'No data available', am: 'ምንም መረጃ የለም' },
    confidence: { en: 'confidence', am: 'እምነት' },
    lastScan: { en: 'Last Scan:', am: 'የመጨረሻ ምርመራ:' },
    loading: { en: 'Loading...', am: 'እየጫነ ነው...' },
    healthy: { en: 'Healthy', am: 'ጤናማ' },
    anthracnose: { en: 'Anthracnose', am: 'አንትራክኖዝ' },
    powderyMildew: { en: 'Powdery Mildew', am: 'የዱቄት ሻጋታ' },
  },

  // ---- Sensor Cards ----
  sensor: {
    temperature: { en: 'Temperature', am: 'ሙቀት' },
    humidity: { en: 'Humidity', am: 'እርጥበት' },
    precipitation: { en: 'Precipitation', am: 'ዝናብ' },
  },

  // ---- Historical Chart ----
  chart: {
    title: { en: 'Historical Trends', am: 'ታሪካዊ አዝማሚያዎች' },
    noData: { en: 'No data available', am: 'ምንም መረጃ የለም' },
    loadingData: { en: 'Loading data...', am: 'መረጃ እየጫነ ነው...' },
    tempAxis: { en: 'Temp (°C) / Humidity (%)', am: 'ሙቀት (°C) / እርጥበት (%)' },
    precipAxis: { en: 'Precipitation (mm)', am: 'ዝናብ (ሚሜ)' },
    tempLabel: { en: 'Temperature (°C)', am: 'ሙቀት (°C)' },
    humidityLabel: { en: 'Humidity (%)', am: 'እርጥበት (%)' },
    precipLabel: { en: 'Precipitation (mm)', am: 'ዝናብ (ሚሜ)' },
  },

  // ---- Recommendations ----
  rec: {
    title: { en: 'Recommendations', am: 'ምክሮች' },
    loading: { en: 'Loading recommendations...', am: 'ምክሮችን እየጫነ ነው...' },
    tip: { en: 'Tip', am: 'ምክር' },
    tips: { en: 'Tips', am: 'ምክሮች' },
    allHealthy: { en: 'All Systems Healthy', am: 'ሁሉም ስርዓቶች ጤናማ ናቸው' },
    allHealthyDesc: {
      en: 'No active alerts. Continue monitoring and maintain regular maintenance.',
      am: 'ምንም ማንቂያዎች የሉም። መደበኛ ክትትልና ጽዳት ይቀጥሉ።',
    },
  },

  // ---- Forecast ----
  forecast: {
    title: { en: 'Disease Risk Forecast', am: 'የበሽታ ስጋት ትንበያ' },
    loading: { en: 'Loading forecast...', am: 'ትንበያ እየጫነ ነው...' },
    noData: { en: 'No forecast data available', am: 'ምንም የትንበያ መረጃ የለም' },
    season: { en: 'Season', am: 'ወቅት' },
    precipitation: { en: 'Precipitation', am: 'ዝናብ' },
    tomorrow: { en: 'Tomorrow', am: 'ነገ' },
    stable: { en: 'Stable', am: 'የተረጋጋ' },
    anthracnoseRisk: { en: 'Anthracnose Risk', am: 'የአንትራክኖዝ ስጋት' },
    mildewRisk: { en: 'Mildew Risk', am: 'የሻጋታ ስጋት' },
    source: { en: 'Generated on-device (ESP32 XGBoost)', am: 'በመሳሪያ ላይ የተፈጠረ (ESP32 XGBoost)' },
    bega: { en: 'Dry Season', am: 'በጋ ወቅት' },
    belg: { en: 'Short Rains', am: 'በልግ ወቅት' },
    kiremt: { en: 'Main Rainy Season', am: 'ክረምት ወቅት' },
  },

  // ---- Logs Page ----
  logs: {
    title: { en: 'Detection History', am: 'የምርመራ ታሪክ' },
    loading: { en: 'Loading detection history...', am: 'የምርመራ ታሪክ እየጫነ ነው...' },
    empty: { en: 'No detection history available', am: 'ምንም የምርመራ ታሪክ የለም' },
    timestamp: { en: 'Timestamp', am: 'ጊዜ' },
    diseaseClass: { en: 'Disease Class', am: 'የበሽታ ዓይነት' },
    confidence: { en: 'Confidence', am: 'እምነት' },
    temperature: { en: 'Temperature', am: 'ሙቀት' },
    humidity: { en: 'Humidity', am: 'እርጥበት' },
    precipitation: { en: 'Precipitation', am: 'ዝናብ' },
    previous: { en: '← Previous', am: '← ቀዳሚ' },
    next: { en: 'Next →', am: 'ቀጣይ →' },
    pageOf: { en: 'Page', am: 'ገጽ' },
    of: { en: 'of', am: 'ከ' },
    total: { en: 'total', am: 'ጠቅላላ' },
    exportCSV: { en: 'Export CSV', am: 'CSV አውርድ' },
  },

  // ---- Settings Page ----
  settings: {
    alertThresholds: { en: 'Alert Thresholds', am: 'የማንቂያ ወሰኖች' },
    minTemp: { en: 'Minimum Temperature (°C)', am: 'ዝቅተኛ ሙቀት (°C)' },
    maxTemp: { en: 'Maximum Temperature (°C)', am: 'ከፍተኛ ሙቀት (°C)' },
    minHumidity: { en: 'Minimum Humidity (%)', am: 'ዝቅተኛ እርጥበት (%)' },
    maxHumidity: { en: 'Maximum Humidity (%)', am: 'ከፍተኛ እርጥበት (%)' },
    notifications: { en: 'Notifications', am: 'ማሳወቂያዎች' },
    enablePush: { en: 'Enable Push Notifications', am: 'ማሳወቂያዎችን አንቃ' },
    confidenceThreshold: { en: 'Disease Alert Confidence Threshold', am: 'የበሽታ ማንቂያ እምነት ወሰን' },
    confidenceHint: { en: 'Only notify when disease detection confidence exceeds this level', am: 'የበሽታ ግኝት እምነት ከዚህ ደረጃ ሲበልጥ ብቻ አሳውቅ' },
    systemInfo: { en: 'System Information', am: 'የስርዓት መረጃ' },
    deviceId: { en: 'Device ID:', am: 'የመሳሪያ ኮድ:' },
    firmware: { en: 'Firmware Version:', am: 'የስርዓት ስሪት:' },
    lastSync: { en: 'Last Sync (EAT):', am: 'የመጨረሻ ማመሳሰል:' },
    save: { en: 'Save Settings', am: 'ቅንብሮችን አስቀምጥ' },
    saved: { en: 'Settings saved', am: 'ቅንብሮች ተቀምጠዋል' },
    deviceConnection: { en: 'Device Connection', am: 'የመሳሪያ ግንኙነት' },
    apiEndpoint: { en: 'API Endpoint', am: 'API መንገድ' },
    noDevices: { en: 'No devices connected yet. Generate a key to link your ESP32.', am: 'ምንም መሳሪያ አልተገናኘም። ESP32ን ለማገናኘት ቁልፍ ይፍጠሩ።' },
    generateKey: { en: 'Generate Device Key', am: 'የመሳሪያ ቁልፍ ፍጠር' },
    deviceApiKey: { en: 'Device API Key', am: 'የመሳሪያ API ቁልፍ' },
    connected: { en: 'Connected', am: 'ተገናኝቷል' },
    neverConnected: { en: 'Never connected', am: 'በጭራሽ አልተገናኘም' },
    lastSeen: { en: 'Last seen', am: 'ለመጨረሻ ጊዜ የታየ' },
    esp32Config: { en: 'ESP32 Config.h', am: 'ESP32 Config.h' },
    regenerateKey: { en: 'Regenerate', am: 'ቁልፍ ቀይር' },
    removeDevice: { en: 'Remove', am: 'አስወግድ' },
    addAnother: { en: 'Add Another Device', am: 'ሌላ መሳሪያ ጨምር' },
  },

  // ---- Analysis Page ----
  analysis: {
    title: { en: 'Advanced Analysis', am: 'የተራቀቀ ትንተና' },
    diseasePatterns: { en: 'Disease Patterns', am: 'የበሽታ ዘይቤዎች' },
    diseasePatternsDesc: { en: 'Historical disease occurrence patterns and seasonal trends', am: 'ታሪካዊ የበሽታ ክስተት ዘይቤዎች እና ወቅታዊ አዝማሚያዎች' },
    envCorrelations: { en: 'Environmental Correlations', am: 'የአካባቢ ግንኙነቶች' },
    envCorrelationsDesc: { en: 'Relationships between environmental conditions and disease detection', am: 'በአካባቢ ሁኔታዎች እና በሽታ ግኝት መካከል ያለው ግንኙነት' },
    riskAssessment: { en: 'Risk Assessment', am: 'የአደጋ ግምገማ' },
    riskAssessmentDesc: { en: 'Long-term risk evaluation based on historical data', am: 'በታሪካዊ መረጃ ላይ የተመሰረተ የረጅም ጊዜ ግምገማ' },
    recSummary: { en: 'Recommendations Summary', am: 'የምክሮች ማጠቃለያ' },
    recSummaryDesc: { en: 'Aggregate view of all recommendations provided over time', am: 'በጊዜ ሂደት የተሰጡ ምክሮች ማጠቃለያ' },
    comingSoon: { en: 'Detailed analytics dashboard coming soon. Use the Logs page to review detection history.', am: 'ዝርዝር ትንተና ዳሽቦርድ በቅርቡ ይመጣል። የምርመራ ታሪክን ለመመልከት የመዝገቦች ገጽን ይጠቀሙ።' },
  },

  // ---- Footer ----
  footer: {
    text: {
      en: '© 2025 MangoGuard - Intelligent Plant Health Monitoring. Ethiopian Time (EAT).',
      am: '© 2025 MangoGuard - ብልህ የእጽዋት ጤና ክትትል። የኢትዮጵያ ሰዓት።',
    },
  },

  // ---- Common ----
  common: {
    loading: { en: 'Loading...', am: 'እየጫነ ነው...' },
    error: { en: 'Error', am: 'ስህተት' },
    retry: { en: 'Retry', am: 'ድገም' },
    errorLoading: { en: 'Error loading dashboard:', am: 'ዳሽቦርድ መጫን አልተሳካም:' },
  },
};

export default translations;
