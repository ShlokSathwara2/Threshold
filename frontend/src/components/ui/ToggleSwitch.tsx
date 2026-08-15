"use client";
import { useState } from 'react';
import './ToggleSwitch.css';

interface ToggleSwitchProps {
  label?: string;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
}

const ToggleSwitch = ({ label = 'Toggle', defaultChecked = false, onChange, className = '' }: ToggleSwitchProps) => {
  const [checked, setChecked] = useState(defaultChecked);

  const handleChange = () => {
    const next = !checked;
    setChecked(next);
    onChange?.(next);
  };

  return (
    <div className={`toggle-container ${className}`}>
      <div className="toggle-wrap">
        <input
          type="checkbox"
          className="toggle-input"
          checked={checked}
          onChange={handleChange}
        />
        <div className="toggle-track">
          <div className="track-lines">
            <div className="track-line" />
          </div>
          <div className="toggle-thumb">
            <div className="thumb-core" />
            <div className="thumb-inner" />
            <div className="thumb-scan" />
            <div className="thumb-particles">
              <div className="thumb-particle" />
              <div className="thumb-particle" />
              <div className="thumb-particle" />
              <div className="thumb-particle" />
              <div className="thumb-particle" />
            </div>
          </div>
          <div className="toggle-data">
            <span className="data-text off">OFF</span>
            <span className="data-text on">ON</span>
          </div>
          <div className="status-indicator off" />
          <div className="status-indicator on" />
          <div className="energy-rings">
            <div className="energy-ring" />
            <div className="energy-ring" />
            <div className="energy-ring" />
          </div>
          <div className="interface-lines">
            <div className="interface-line" />
            <div className="interface-line" />
            <div className="interface-line" />
            <div className="interface-line" />
            <div className="interface-line" />
            <div className="interface-line" />
          </div>
          <div className="toggle-reflection" />
          <div className="holo-glow" />
        </div>
      </div>
      <div className="toggle-label">{label}</div>
    </div>
  );
};

export default ToggleSwitch;
