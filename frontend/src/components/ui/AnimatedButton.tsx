"use client";
import './AnimatedButton.css';

interface AnimatedButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'go-back';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

const AnimatedButton = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = 'button' }: AnimatedButtonProps) => {
  if (variant === 'go-back') {
    return (
      <button
        className={`go-back-btn ${className}`}
        type={type}
        onClick={onClick}
        disabled={disabled}
      >
        <div className="go-back-btn__bg">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" height="25px" width="25px">
            <path d="M224 480h640a32 32 0 1 1 0 64H224a32 32 0 0 1 0-64z" fill="#000000" />
            <path d="m237.248 512 265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z" fill="#000000" />
          </svg>
        </div>
        <p className="go-back-btn__text">{children}</p>
      </button>
    );
  }

  return (
    <button
      className={`submit-btn ${className}`}
      type={type}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="submit-btn__text">{children}</span>
      <span className="submit-btn__icon">→</span>
    </button>
  );
};

export default AnimatedButton;
