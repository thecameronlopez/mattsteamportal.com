import { useParams } from "react-router-dom";
import styles from "./EditUser.module.css";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../../../Context/AuthContext";
import { DEPARTMENTS, ROLES } from "../../../utils/Enums";
import { renderObjects } from "../../../utils/Helpers";

const EditUser = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    username: "",
  });
  const [adminFields, setAdminFields] = useState({
    role: "",
    department: "",
  });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      const response = await fetch(`/api/read/user/${id}?full=true`);
      const data = await response.json();
      if (data.success) {
        setFormData({
          first_name: data.user.first_name,
          last_name: data.user.last_name,
          email: data.user.email,
          phone_number: data.user.phone_number || "",
          username: data.user.username || "",
        });
        setAdminFields({
          role: data.user.role || "",
          department: data.user.department || "",
        });
      } else {
        // Handle error (e.g., user not found)
        console.error(data.message);
        toast.error(data.message);
      }
    };

    fetchUserData();
  }, [id, editing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!confirm("Are you sure you want to save changes?")) {
      return;
    }
    const updateData = { ...formData };
    if (user.role === "admin") {
      updateData.role = adminFields.role;
      updateData.department = adminFields.department;
    }
    const response = await fetch(`/api/update/user/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateData),
    });
    const data = await response.json();
    if (data.success) {
      toast.success(data.message);
      setEditing(false);
    } else {
      toast.error(data.message);
    }
  };

  return (
    <div className={styles.editUserBlock}>
      <form className={styles.editUserForm} onSubmit={handleSubmit}>
        <div>
          <label>First Name:</label>
          {editing ? (
            <input
              type="text"
              value={formData.first_name}
              onChange={(e) =>
                setFormData({ ...formData, first_name: e.target.value })
              }
            />
          ) : (
            <span>{formData.first_name}</span>
          )}
        </div>
        <div>
          <label>Last Name:</label>
          {editing ? (
            <input
              type="text"
              value={formData.last_name}
              onChange={(e) =>
                setFormData({ ...formData, last_name: e.target.value })
              }
            />
          ) : (
            <span>{formData.last_name}</span>
          )}
        </div>
        <div>
          <label>Email:</label>
          {editing ? (
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          ) : (
            <span>{formData.email}</span>
          )}
        </div>
        <div>
          <label>Phone Number:</label>
          {editing ? (
            <input
              type="text"
              value={formData.phone_number}
              onChange={(e) =>
                setFormData({ ...formData, phone_number: e.target.value })
              }
            />
          ) : (
            <span>{formData.phone_number}</span>
          )}
        </div>
        <div>
          <label>Username:</label>
          {editing ? (
            <input
              type="text"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
            />
          ) : (
            <span>{formData.username}</span>
          )}
        </div>
        {/* Admin-only fields */}
        {user.role === "admin" && (
          <>
            <div>
              <label>Role:</label>
              {editing ? (
                <select
                  value={adminFields.role}
                  onChange={(e) =>
                    setAdminFields({ ...adminFields, role: e.target.value })
                  }
                >
                  {renderObjects(ROLES)}
                </select>
              ) : (
                <span>{adminFields.role}</span>
              )}
            </div>
            <div>
              <label>Department:</label>
              {editing ? (
                <select
                  value={adminFields.department}
                  onChange={(e) =>
                    setAdminFields({
                      ...adminFields,
                      department: e.target.value,
                    })
                  }
                >
                  {renderObjects(DEPARTMENTS)}
                </select>
              ) : (
                <span>{adminFields.department}</span>
              )}
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className={styles.setEditingButton}
        >
          {editing ? "Cancel" : "Edit"}
        </button>
        {editing && <button type="submit">Save</button>}
      </form>
    </div>
  );
};

export default EditUser;
