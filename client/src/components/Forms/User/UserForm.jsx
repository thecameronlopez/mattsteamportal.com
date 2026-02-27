import styles from "./UserForm.module.css";
import React, { useState } from "react";
import { ROLES, DEPARTMENTS } from "../../../utils/Enums";
import { renderObjects } from "../../../utils/Helpers";
import toast from "react-hot-toast";

const UserForm = ({ onNewUser }) => {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    phone_number: "",
    role: "",
    department: "",
    password: "",
    check_password: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password.trim() !== formData.check_password.trim()) {
      toast.error("Passwords do not match, please check inputs and try again");
      return;
    }
    if (!confirm("Submit data?")) return;

    try {
      const response = await fetch("/api/auth/admin/register", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      toast.success(data.message);
      if (onNewUser) {
        onNewUser(data.user);
      }
      setFormData({
        first_name: "",
        last_name: "",
        username: "",
        email: "",
        phone_number: "",
        role: "",
        department: "",
        password: "",
        check_password: "",
      });
    } catch (error) {
      console.error("[REGISTRATION ERROR]: ", error);
      toast.error(error.message);
    }
  };

  return (
    <form className={styles.newUserForm} onSubmit={handleSubmit}>
      <h2 style={{ alignSelf: "flex-start" }}>Add New User</h2>
      <div>
        <label htmlFor="first_name">First Name</label>
        <input
          type="text"
          name="first_name"
          value={formData.first_name}
          onChange={handleChange}
        />
      </div>
      <div>
        <label htmlFor="last_name">Last Name</label>
        <input
          type="text"
          name="last_name"
          value={formData.last_name}
          onChange={handleChange}
        />
      </div>
      <div>
        <label htmlFor="username">Username</label>
        <input
          type="text"
          name="username"
          value={formData.username}
          onChange={handleChange}
        />
      </div>
      <div>
        <label htmlFor="email">Email</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
        />
      </div>
      <div>
        <label htmlFor="phone_number">Phone Number</label>
        <input
          type="tel"
          name="phone_number"
          pattern="[\d\s()+-]+"
          placeholder="5551234567"
          inputMode="tel"
          value={formData.phone_number}
          onChange={handleChange}
        />
      </div>
      <div>
        <label htmlFor="role">Role</label>
        <select name="role" value={formData.role} onChange={handleChange}>
          <option value="">--select user role--</option>
          {renderObjects(ROLES)}
        </select>
      </div>
      <div>
        <label htmlFor="department">Department</label>
        <select
          name="department"
          value={formData.department}
          onChange={handleChange}
        >
          <option value="">--select department--</option>
          {renderObjects(DEPARTMENTS)}
        </select>
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
        />
      </div>
      <div>
        <label htmlFor="check_password">Re-enter Password</label>
        <input
          type="password"
          name="check_password"
          value={formData.check_password}
          onChange={handleChange}
        />
      </div>
      <button type="submit">Submit</button>
    </form>
  );
};

export default UserForm;
