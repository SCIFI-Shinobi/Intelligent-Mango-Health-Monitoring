export function exportToCSV(data) {
  const csvRows = [
    ["Day", "Stability"],
    ...data.map((value, index) => [`Day ${index + 1}`, value])
  ];

  const csvContent =
    "data:text/csv;charset=utf-8," +
    csvRows.map(row => row.join(",")).join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "mangoguard_data.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportDetectionLogs(records, headers) {
  const headerRow = headers.join(",");
  const rows = records.map(r => {
    const values = [
      r.timestamp ? `"${new Date(r.timestamp).toISOString()}"` : '',
      `"${r.disease_type || ''}"`,
      `"${r.source === 'web_app' ? 'Web/App' : 'Gateway'}"`,
      r.confidence_score != null ? (r.confidence_score * 100).toFixed(1) : '',
      r.temperature != null ? r.temperature.toFixed(1) : '',
      r.humidity != null ? r.humidity.toFixed(1) : ''
    ];
    return values.join(",");
  });

  const csv = [headerRow, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `mangoguard_detection_logs_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
