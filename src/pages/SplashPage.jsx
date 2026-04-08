import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./SplashPage.css";

function SplashPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      navigate("/onboarding", { replace: true });
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="splash-page">
      <div className="splash-center">
        <img src="/Logo%201.png" alt="Chatbox logo" className="splash-logo" />
        <h1 className="splash-title">Chatbox</h1>
      </div>
    </div>
  );
}

export default SplashPage;
