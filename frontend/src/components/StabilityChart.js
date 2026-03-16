import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement
} from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement);

export default function StabilityChart({ data }) {
  const labels = data.map((_, i) => `Point ${i + 1}`);
  const chartData = {
    labels: labels.length > 0 ? labels : ["No data"],
    datasets: [
      {
        label: "Stability Index",
        data: data.length > 0 ? data : [0],
        borderColor: "#4CAF50",
        fill: false,
        tension: 0.4
      }
    ]
  };

  return (
    <div className="chart">
      <Line data={chartData} />
    </div>
  );
}
