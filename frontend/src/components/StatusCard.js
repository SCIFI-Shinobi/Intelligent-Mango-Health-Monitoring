import React from "react";

export default function StatusCard({ title, value }) {
  return (
    <div className="card">
      <h4>{title}</h4>
      <p>{value}</p>
    </div>
  );
}
