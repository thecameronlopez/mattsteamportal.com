import React from "react";
import styles from "./LoadingScreen.module.css";
import LOGO from "../../assets/portal-logo.png";

const LoadingScreen = ({ title = "Loading Team Portal..." }) => {
  return (
    <div className={styles.loadingScreen}>
      <div className={styles.panel}>
        <img src={LOGO} alt="Team Portal Logo" className={styles.logo} />
        <div className={styles.spinner} aria-hidden="true" />
        <p className={styles.title}>{title}</p>
        <small className={styles.subtitle}>Please wait a moment</small>
      </div>
    </div>
  );
};

export default LoadingScreen;
