import re

with open('frontend/src/utils/translations.js', 'r', encoding='utf-8') as f:
    text = f.read()

# I need to add keys to the settings object:
# general: General Settings / አጠቃላይ ቅንብሮች
# language: Language / ቋንቋ
# displayPreferences: Display Preferences / የማሳያ ምርጫዎች
# temperatureUnit: Temperature Unit / የሙቀት መለኪያ
# timeFormat: Time Format / የሰዓት አቀራረብ
# timeFormatHint: How timestamps are displayed on charts and logs. / የጊዜ ምልክቶች በቻርትና ሎግ ላይ እንዴት እንደሚታዩ.
# dataSync: Data Synchronization / የውሂብ ማመሳሰል
# autoRefresh: Dashboard Auto-Refresh Interval / ዳሽቦርድ በራስ ሰር የማደሻ ጊዜ
# autoRefreshHint: How often the dashboard should automatically pull new sensor data. / ዳሽቦርዱ አዲስ የሴንሰር መረጃዎችን ምን ያህል ጊዜ በራስ-ሰር ማሳየት እንዳለበት.

insert = """
    save: { en: 'Save Settings', am: 'ቅንብሮችን አስቀምጥ' },
    general: { en: 'General Settings', am: 'አጠቃላይ ቅንብሮች' },
    language: { en: 'Language', am: 'ቋንቋ' },
    displayPreferences: { en: 'Display Preferences', am: 'የማሳያ ምርጫዎች' },
    temperatureUnit: { en: 'Temperature Unit', am: 'የሙቀት መለኪያ' },
    timeFormat: { en: 'Time Format', am: 'የሰዓት አቀራረብ' },
    timeFormatHint: { en: 'How timestamps are displayed on charts and logs.', am: 'የጊዜ ምልክቶች በቻርትና ሎግ ላይ እንዴት እንደሚታዩ።' },
    dataSync: { en: 'Data Synchronization', am: 'የውሂብ ማመሳሰል' },
    autoRefresh: { en: 'Dashboard Auto-Refresh Interval', am: 'ዳሽቦርድ በራስ ሰር የማደሻ ጊዜ' },
    autoRefreshHint: { en: 'How often the dashboard should automatically pull new sensor data.', am: 'ዳሽቦርዱ አዲስ የሴንሰር መረጃዎችን ምን ያህል ጊዜ በራስ-ሰር ማሳየት እንዳለበት።' },
"""

# Find "save: { en: 'Save Settings', am: 'ቅንብሮችን አስቀምጥ' }," and replace it with the bulk insertion.
text = text.replace("    save: { en: 'Save Settings', am: 'ቅንብሮችን አስቀምጥ' },", insert)

with open('frontend/src/utils/translations.js', 'w', encoding='utf-8') as f:
    f.write(text)

