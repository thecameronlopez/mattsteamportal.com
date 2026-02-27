import styles from "./Login.module.css";
import React, { useState } from "react";
import { useAuth } from "../../../Context/AuthContext";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";

const Login = () => {
  const { setUser, setLoading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      setLoading(false);
      setUser(data.user);
      toast.success(data.message);
      navigate("/");
    } catch (error) {
      console.error("[LOGIN ERROR]: ", error);
      toast.error(error.message);
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginBlock}>
      <form className={styles.loginForm} onSubmit={handleSubmit}>
        <div>
          <label htmlFor="username">Username</label>
          <input
            type="text"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Login</button>
      </form>
      <Link className={styles.forgotLink} to={"/forgot-password"}>
        Forgot Password?
      </Link>
    </div>
  );
};

export default Login;
