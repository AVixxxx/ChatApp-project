import { useNavigate } from "react-router-dom";
import facebookIcon from "../assets/icons/facebook.png";
import googleIcon from "../assets/icons/google.png";
import appleIcon from "../assets/icons/apple.png";
import "./OnboardingPage.css";

function OnboardingPage() {
  const navigate = useNavigate();

  return (
    <div className="onboarding-page">
      <img src="/Logo%202.png" alt="Chatbox" className="onboarding-logo-top" />

      <section className="onboarding-left">
        <div className="onboarding-left-inner">
          <h1>Connect friends easily &amp; quickly</h1>
          <p>
            Our chat app is the perfect way to stay connected with friends and
            family.
          </p>
        </div>
      </section>

      <section className="onboarding-right">
        <div className="onboarding-right-inner">
          <h2>
            Make account
            <br />
            Make friend
          </h2>

          <div className="onboarding-socials">
            <button type="button" className="social-circle" aria-label="Facebook">
              <img src={facebookIcon} alt="Facebook" className="social-icon" />
            </button>
            <button type="button" className="social-circle" aria-label="Google">
              <img src={googleIcon} alt="Google" className="social-icon" />
            </button>
            <button type="button" className="social-circle" aria-label="Apple">
              <img src={appleIcon} alt="Apple" className="social-icon" />
            </button>
          </div>

          <div className="onboarding-divider">
            <span />
            <strong>OR</strong>
            <span />
          </div>

          <button
            type="button"
            className="signup-mail-btn"
            onClick={() => navigate("/register")}
          >
            Sign up with mail
          </button>

          <p className="login-text">
            Existing account?{" "}
            <button type="button" onClick={() => navigate("/login")}>
              Log in
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}

export default OnboardingPage;
