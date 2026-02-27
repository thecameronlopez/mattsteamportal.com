import React from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuth } from "../Context/AuthContext";
import toast from "react-hot-toast";
import LOGO from "../assets/portal-logo.png";
import LoadingScreen from "../components/Common/LoadingScreen";

const RootLayout = () => {
  const { user, setUser, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const logout = async () => {
    const response = await fetch("/api/auth/logout");
    const data = await response.json();
    if (data.success) {
      setUser(null);
      toast.success(data.message);
      navigate("/login");
    } else {
      toast.error("Something went wrong.");
    }
  };

  const path = location.pathname;
  const hideLink = path.startsWith("/review") || path.startsWith("/thank-you");

  if (loading) return <LoadingScreen title="Starting Team Portal..." />;

  return (
    <>
      <header>
        <h1>
          {!hideLink ? (
            <Link to={"/"}>
              <img src={LOGO} />
            </Link>
          ) : (
            <img src={LOGO} />
          )}
        </h1>
      </header>
      <div id="container">
        <Outlet />
      </div>
      <Toaster position="bottom-right" reverseOrder={false} />
      <footer>
        {user && <button onClick={logout}>Logout</button>}

        <p>© 2025 Matt's Appliances</p>
      </footer>
    </>
  );
};

export default RootLayout;
