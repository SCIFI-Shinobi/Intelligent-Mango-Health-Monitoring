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
