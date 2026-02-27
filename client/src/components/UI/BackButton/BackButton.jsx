import React from "react";
import styles from "./BackButton.module.css";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";

const BackButton = ({ fallback = "/", className = "" }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    const historyIndex = window.history?.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      navigate(-1);
      return;
    }
    navigate(fallback);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`${styles.backButton} ${className}`.trim()}
      aria-label="Go back"
    >
      <FontAwesomeIcon icon={faChevronLeft} />
    </button>
  );
};

export default BackButton;
