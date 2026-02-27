import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../Context/AuthContext";
import LoadingScreen from "../components/Common/LoadingScreen";

const ProtectedLayout = () => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen title="Checking session..." />;
  if (!user) return <Navigate to={"/login"} />;
  return <Outlet />;
};

export default ProtectedLayout;
