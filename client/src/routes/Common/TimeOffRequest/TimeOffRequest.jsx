import styles from "./TimeOffRequest.module.css";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../Context/AuthContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faList } from "@fortawesome/free-solid-svg-icons";

const TimeOffRequest = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    start_date: "",
    end_date: "",
    reason: "",
    other_reason: "",
    is_pto: false,
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
    if (formData.reason.trim() === "") {
      toast.error("A reason is required");
      return;
    }
    if (!confirm("Submit time off request?")) return;

    const payload = {
      start_date: formData.start_date,
      end_date: formData.end_date,
      reason:
        formData.reason === "other" ? formData.other_reason : formData.reason,
      is_pto: formData.is_pto,
    };

    try {
      const response = await fetch("/api/create/time_off_request", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message);
      }
      toast.success(data.message);
      navigate("/");
    } catch (error) {
      console.error("[TIME OFF REQUEST ERROR]: ", error);
      toast.error(error.message);
    }
  };
  return (
    <div className={styles.timeOffRequestMasterBlock}>
      {user.role === "admin" && (
        <Link className={styles.viewRequests} to={"/time-off-status-update"}>
          <FontAwesomeIcon icon={faList} /> View Requests
        </Link>
      )}
      <h1>Time Off Request</h1>
      <form className={styles.requestForm} onSubmit={handleSubmit}>
        <div className={styles.dateGrid}>
          <div className={styles.field}>
            <label htmlFor="start_date">Start Date</label>
            <input
              type="date"
              name="start_date"
              value={formData.start_date}
              onChange={handleChange}
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="end_date">End Date</label>
            <input
              type="date"
              name="end_date"
              value={formData.end_date}
              onChange={handleChange}
              required
            />
          </div>
        </div>
        <div className={styles.ptoBlock}>
          <label htmlFor="is_pto">Using PTO</label>
          <input
            type="checkbox"
            name="is_pto"
            checked={formData.is_pto}
            onChange={(e) =>
              setFormData({ ...formData, is_pto: e.target.checked })
            }
            className={styles.isPto}
          />
        </div>
        {/* RADIO REASON SWITCHES */}
        <h3 className={styles.reasonHeader}>Reason</h3>
        <div className={styles.reasonRadio}>
          <label htmlFor="reason-vacation" className={styles.reasonOption}>
            <input
              id="reason-vacation"
              type="radio"
              name="reason"
              value="vacation"
              checked={formData.reason === "vacation"}
              onChange={handleChange}
            />
            Vacation
          </label>
          <label htmlFor="reason-personal" className={styles.reasonOption}>
            <input
              id="reason-personal"
              type="radio"
              name="reason"
              value="personal"
              checked={formData.reason === "personal"}
              onChange={handleChange}
            />
            Personal Leave
          </label>
          <label htmlFor="reason-funeral" className={styles.reasonOption}>
            <input
              id="reason-funeral"
              type="radio"
              name="reason"
              value="funeral"
              checked={formData.reason === "funeral"}
              onChange={handleChange}
            />
            Funeral/Bereavement
          </label>
          <label htmlFor="reason-jury-duty" className={styles.reasonOption}>
            <input
              id="reason-jury-duty"
              type="radio"
              name="reason"
              value="jury-duty"
              checked={formData.reason === "jury-duty"}
              onChange={handleChange}
            />
            Jury Duty
          </label>
          <label htmlFor="reason-family" className={styles.reasonOption}>
            <input
              id="reason-family"
              type="radio"
              name="reason"
              value="family"
              checked={formData.reason === "family"}
              onChange={handleChange}
            />
            Family Reasons
          </label>
          <label htmlFor="reason-medical" className={styles.reasonOption}>
            <input
              id="reason-medical"
              type="radio"
              name="reason"
              value="medical"
              checked={formData.reason === "medical"}
              onChange={handleChange}
            />
            Medical Leave
          </label>
          <label htmlFor="reason-voting" className={styles.reasonOption}>
            <input
              id="reason-voting"
              type="radio"
              name="reason"
              value="voting"
              checked={formData.reason === "voting"}
              onChange={handleChange}
            />
            Voting
          </label>
          <label htmlFor="reason-other" className={styles.reasonOption}>
            <input
              id="reason-other"
              type="radio"
              name="reason"
              value="other"
              checked={formData.reason === "other"}
              onChange={handleChange}
            />
            Other
          </label>
          {formData.reason === "other" && (
            <textarea
              className={styles.otherReason}
              name="other_reason"
              value={formData.other_reason}
              onChange={handleChange}
              placeholder="Please describe..."
            ></textarea>
          )}
        </div>
        <button className={styles.submitBtn} type="submit">
          Submit Time Off Request
        </button>
      </form>
    </div>
  );
};

export default TimeOffRequest;
