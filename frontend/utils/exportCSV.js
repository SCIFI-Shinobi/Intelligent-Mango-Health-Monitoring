export function exportToCSV(data, options = {}) {
  const filename = options.filename || "mangoguard_data.csv";

  // Helper to build CSV text from rows
  const rowsToText = rows => rows.map(r => r.map(cell => {
    if (cell === null || cell === undefined) return "";
    const str = String(cell);
    // Escape double quotes
    return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str.replace(/"/g, '""')}"` : str;
  }).join(",")).join("\n");

  let csvSections = [];

  // If data is an array assume simple Day,Stability mapping (backwards compatible)
  if (Array.isArray(data)) {
    const csvRows = [
      ["Day", "Stability"],
      ...data.map((value, index) => [`Day ${index + 1}`, value])
    ];
    csvSections.push(rowsToText(csvRows));
  } else if (data && typeof data === "object") {
    // Summary section
    const now = options.timestamp || new Date().toISOString();
    const summaryRows = [
      ["Dashboard Snapshot", ""],
      ["Exported At", now],
      ["Temperature", data.temperature ?? ""],
      ["Humidity", data.humidity ?? ""],
      ["Moisture", data.moisture ?? ""],
      ["MangoGuard Health Status", data.healthStatus ?? ""],
      ["System Integrity", data.systemIntegrity ?? ""],
    ];
    csvSections.push(rowsToText(summaryRows));

    // Stability series
    if (Array.isArray(data.stabilitySeries)) {
      const stabilityRows = [["Day", "Stability"]].concat(
        data.stabilitySeries.map((value, index) => [`Day ${index + 1}`, value])
      );
      csvSections.push(rowsToText(stabilityRows));
    }

    // Forecast section (array of { day, predicted, historicalMean })
    if (Array.isArray(data.forecast)) {
      const forecastRows = [["Day", "Predicted (%)", "Historical Mean (%)"]].concat(
        data.forecast.map(item => [item.day ?? "", item.predicted ?? "", item.historicalMean ?? ""]) 
      );
      csvSections.push(rowsToText(forecastRows));
    }

    // Recommendations
    if (Array.isArray(data.recommendations)) {
      const recRows = [["Title", "Description", "Severity"]].concat(
        data.recommendations.map(r => [r.title ?? "", r.description ?? "", r.severity ?? ""])
      );
      csvSections.push(rowsToText(recRows));
    }
  } else {
    // Fallback: empty file
    csvSections.push("No data available");
  }

  const csvContent = "data:text/csv;charset=utf-8," + csvSections.join("\n\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
