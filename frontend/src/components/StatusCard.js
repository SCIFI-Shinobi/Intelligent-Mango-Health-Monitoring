import React from "react";
import { MdCheckCircle, MdShield } from "react-icons/md";

export default function StatusCard({ title, value, status = "optimal" }) {
  const getStatusIcon = () => {
    switch (status) {
      case "optimal":
        return <MdShield className="status-icon status-icon-optimal" />;
      case "warning":
        return <MdCheckCircle className="status-icon status-icon-warning" />;
      case "critical":
        return <MdCheckCircle className="status-icon status-icon-critical" />;
      default:
        return <MdCheckCircle className="status-icon" />;
    }
  };

  return (
    <div className={`status-card status-${status}`}>
      <div className="status-content">
        <div className="status-text">
          <h4 className="status-title">{title}</h4>
          <p className="status-value">{value}</p>
        </div>
        <div className="status-icon-wrapper">
          {getStatusIcon()}
          <div className="status-checkmark">
            <MdCheckCircle className="checkmark-icon" />
          </div>
        </div>
      </div>
    </div>
  );
}
