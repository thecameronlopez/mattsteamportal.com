import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../Context/AuthContext";
import LoadingScreen from "../components/Common/LoadingScreen";
import BackButton from "../components/UI/BackButton/BackButton";
import styles from "./ProtectedLayout.module.css";

const ProtectedLayout = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen title="Checking session..." />;
  if (!user) return <Navigate to={"/login"} />;

  const showBackButton = location.pathname !== "/";

  return (
    <div className={styles.protectedLayout}>
      {showBackButton && <BackButton className={styles.globalBack} />}
      <Outlet />
    </div>
  );
};

export default ProtectedLayout;
