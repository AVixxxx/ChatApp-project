import { useEffect, useMemo, useRef, useState } from "react";
import "./OtpModal.css";

const OTP_LENGTH = 6;

function OtpModal({
  isOpen,
  email,
  error,
  isVerifying,
  isResending,
  onClose,
  onConfirm,
  onResend
}) {
  const [otpValues, setOtpValues] = useState(Array(OTP_LENGTH).fill(""));
  const inputRefs = useRef([]);

  const otp = useMemo(() => otpValues.join(""), [otpValues]);

  useEffect(() => {
    if (!isOpen) return;

    setOtpValues(Array(OTP_LENGTH).fill(""));

    const timer = window.setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const updateOtpAtIndex = (index, value) => {
    setOtpValues((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleChange = (index, value) => {
    const numericValue = value.replace(/\D/g, "");

    if (!numericValue) {
      updateOtpAtIndex(index, "");
      return;
    }

    const digit = numericValue[numericValue.length - 1];
    updateOtpAtIndex(index, digit);

    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otpValues[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;

    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((digit, index) => {
      next[index] = digit;
    });

    setOtpValues(next);

    const focusIndex = Math.min(pasted.length, OTP_LENGTH) - 1;
    inputRefs.current[Math.max(focusIndex, 0)]?.focus();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (otp.length !== OTP_LENGTH || isVerifying) return;
    onConfirm(otp);
  };

  if (!isOpen) return null;

  return (
    <div className="otp-modal-overlay" role="dialog" aria-modal="true" aria-label="Xac thuc OTP">
      <div className="otp-modal-card">
        <button type="button" className="otp-close-btn" onClick={onClose} disabled={isVerifying || isResending}>
          x
        </button>

        <h3 className="otp-title">Xac thuc OTP</h3>
        <p className="otp-desc">Nhap ma OTP da gui den email {email}</p>

        <form onSubmit={handleSubmit}>
          <div className="otp-inputs" onPaste={handlePaste}>
            {otpValues.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                className="otp-input"
                value={digit}
                onChange={(event) => handleChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                disabled={isVerifying || isResending}
              />
            ))}
          </div>

          {error && <p className="otp-error">{error}</p>}

          <div className="otp-actions">
            <button
              type="button"
              className="otp-btn otp-resend"
              onClick={onResend}
              disabled={isVerifying || isResending}
            >
              {isResending ? "Dang gui..." : "Gui lai OTP"}
            </button>

            <button
              type="submit"
              className="otp-btn otp-confirm"
              disabled={isVerifying || isResending || otp.length !== OTP_LENGTH}
            >
              {isVerifying ? "Dang xac nhan..." : "Xac nhan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default OtpModal;
