"use client";

interface FeatureCardProps {
  title: string;
  description: string;
  color?: string;
  icon?: React.ReactNode;
  className?: string;
}

const FeatureCard = ({ title, description, color = '#3b82f6', icon, className = '' }: FeatureCardProps) => {
  return (
    <div
      className={`feature-card ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        textAlign: 'center',
        padding: '24px',
        minHeight: '120px',
        width: '100%',
        maxWidth: '320px',
        borderRadius: '16px',
        color: 'white',
        cursor: 'pointer',
        transition: 'all 400ms cubic-bezier(0.23, 1, 0.32, 1)',
        background: `linear-gradient(135deg, ${color}22, ${color}11)`,
        border: `1px solid ${color}33`,
        backdropFilter: 'blur(10px)',
      }}
    >
      {icon && <div style={{ marginBottom: '12px', fontSize: '28px' }}>{icon}</div>}
      <p style={{ fontSize: '1.1em', fontWeight: 700, marginBottom: '4px' }}>{title}</p>
      <p style={{ fontSize: '0.8em', opacity: 0.7 }}>{description}</p>
    </div>
  );
};

export default FeatureCard;
