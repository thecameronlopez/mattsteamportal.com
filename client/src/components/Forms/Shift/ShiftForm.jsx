import styles from "./ShiftForm.module.css";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";

const ShiftForm = ({ onCreateShift, onUpdateShift, initialShift, onCancelEdit }) => {
  const [autoTitle, setAutoTitle] = useState(true);
  const [formData, setFormData] = useState({
    title: "",
    start_time: "",
    end_time: "",
  });

  const toDisplayTime = (value) => {
    if (!value || !value.includes(":")) return "";
    const [hRaw, mRaw] = value.split(":");
    const h = Number(hRaw);
    const m = Number(mRaw);
    if (Number.isNaN(h) || Number.isNaN(m)) return "";
    const suffix = h >= 12 ? "PM" : "AM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    const mm = String(m).padStart(2, "0");
    return `${hh}:${mm} ${suffix}`;
  };

  useEffect(() => {
    if (!initialShift) {
      setFormData({
        title: "",
        start_time: "",
        end_time: "",
      });
      setAutoTitle(true);
      return;
    }

    setFormData({
      title: initialShift.title ?? "",
      start_time: initialShift.start_time ?? "",
      end_time: initialShift.end_time ?? "",
    });

    const generatedTitle =
      initialShift.start_time && initialShift.end_time
        ? `${toDisplayTime(initialShift.start_time)} - ${toDisplayTime(initialShift.end_time)}`
        : "";

    setAutoTitle(generatedTitle === (initialShift.title ?? ""));
  }, [initialShift]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: value,
      };
      if (autoTitle && (name === "start_time" || name === "end_time")) {
        const start = name === "start_time" ? value : next.start_time;
        const end = name === "end_time" ? value : next.end_time;
        const startLabel = toDisplayTime(start);
        const endLabel = toDisplayTime(end);
        next.title = startLabel && endLabel ? `${startLabel} - ${endLabel}` : "";
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      title:
        autoTitle && formData.start_time && formData.end_time
          ? `${toDisplayTime(formData.start_time)} - ${toDisplayTime(formData.end_time)}`
          : formData.title,
    };

    if (!payload.title.trim()) {
      toast.error("Shift title is required");
      return;
    }
    const isEditing = Boolean(initialShift?.id);
    if (!confirm(isEditing ? "Update this shift?" : "Submit new shift?")) return;

    try {
      const response = await fetch(
        isEditing ? `/api/update/shift/${initialShift.id}` : "/api/create/shift",
        {
          method: isEditing ? "PUT" : "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      toast.success(data.message);

      if (isEditing) {
        if (onUpdateShift) {
          onUpdateShift(data.shift);
        }
      } else if (onCreateShift) {
        onCreateShift(data.shift);
      }

      setFormData({
        title: "",
        start_time: "",
        end_time: "",
      });
      setAutoTitle(true);

      if (isEditing && onCancelEdit) {
        onCancelEdit();
      }
    } catch (error) {
      console.error(
        isEditing ? "[SHIFT UPDATE ERROR]: " : "[SHIFT CREATION ERROR]: ",
        error,
      );
      toast.error(error.message);
    }
  };

  return (
    <form className={styles.shiftForm} onSubmit={handleSubmit}>
      <h2>{initialShift ? "Edit Shift" : "Add New Shift"}</h2>
      {initialShift && (
        <button type="button" className={styles.cancelEditBtn} onClick={onCancelEdit}>
          Cancel Edit
        </button>
      )}
      <label className={styles.autoTitleToggle}>
        <input
          type="checkbox"
          checked={autoTitle}
          onChange={(e) => setAutoTitle(e.target.checked)}
        />
        <span>Auto-title from time range</span>
      </label>
      <div>
        <label htmlFor="title">Title</label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          required
          disabled={autoTitle}
          placeholder="Manual shift title"
        />
      </div>
      <div>
        <label htmlFor="start_time">Start Time</label>
        <input
          type="time"
          name="start_time"
          value={formData.start_time}
          onChange={handleChange}
          required
        />
      </div>
      <div>
        <label htmlFor="end_time">End Time</label>
        <input
          type="time"
          name="end_time"
          value={formData.end_time}
          onChange={handleChange}
          required
        />
      </div>
      <button type="submit">{initialShift ? "Update Shift" : "Submit"}</button>
    </form>
  );
};

export default ShiftForm;
