import re

with open('frontend/src/components/HistoricalChart.js', 'r') as f:
    text = f.read()

replacement = """
  const labels = data.map((d) => {
    const date = new Date(d.timestamp);
    if (settings.timeFormat === 'relative') {
      // For charts, relative doesn't make as much sense on multiple points, but let's honor the spirit:
      // Actually standardizing to EAT options:
      return date.toLocaleTimeString(lang === 'am' ? 'am-ET' : 'en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Addis_Ababa' });
    }
    // Absolute could include date or just standard time:
    return date.toLocaleTimeString(lang === 'am' ? 'am-ET' : 'en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Addis_Ababa' });
  });
"""

text = re.sub(r"  const labels = data\.map\(\(d\) => \{\n    const date = new Date\(d\.timestamp\);\n    return date\.toLocaleTimeString\('en-US', \{ hour: '2-digit', minute: '2-digit' \}\);\n  \}\);", replacement.strip(), text, count=1)

with open('frontend/src/components/HistoricalChart.js', 'w') as f:
    f.write(text)
