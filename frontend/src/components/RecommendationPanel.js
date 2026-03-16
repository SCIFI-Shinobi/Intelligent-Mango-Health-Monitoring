import React from "react";

export default function RecommendationPanel({ items }) {
  return (
    <div className="recommendations">
      <h3>BASEY Recommendations</h3>
      {items.map((item, index) => (
        <div key={index} className="recommendation">
          {item}
        </div>
      ))}
    </div>
  );
}
