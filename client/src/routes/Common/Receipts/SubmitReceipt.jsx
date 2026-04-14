import styles from "./SubmitReceipt.module.css";
import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../../../Context/AuthContext";
import { submitReceipt } from "../../../utils/API";

const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);
const MAX_RECEIPT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const PAYMENT_METHODS = [
  "Company Card",
  "Personal Card",
  "Cash",
  "Check",
  "ACH",
  "Other",
];

const EXPENSE_CATEGORIES = [
  "Appliances",
  "Parts",
  "Supplies",
  "Fuel",
  "Meals",
  "Office",
  "Marketing",
  "Other",
];

const getInitialFormData = (employee = "") => ({
  employee,
  amount: "",
  method_used: "",
  purchase_date: "",
  vendor: "",
  business_reason: "",
  expense_category: "",
  po_required: false,
  po_number: "",
  work_order_number: "",
  missing_receipt: false,
  missing_receipt_reason: "",
});

const getStatusBannerTone = (emailDeliveryStatus) => {
  if (emailDeliveryStatus === "failed") {
    return "warning";
  }

  return "success";
};

const sanitizeAmount = (value) => {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");

  if (parts.length === 1) {
    return parts[0];
  }

  return `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
};

const formatCurrency = (value) => {
  if (!value) {
    return "";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return "";
  }

  return numericValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const SubmitReceipt = () => {
  const { user, setLoading } = useAuth();
  const employeeName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.username || "";

  const [formData, setFormData] = useState(getInitialFormData(employeeName));
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState("");
  const [submissionResult, setSubmissionResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setFormData((current) =>
      current.employee ? current : { ...current, employee: employeeName },
    );
  }, [employeeName]);

  useEffect(() => {
    if (!receiptFile) {
      setReceiptPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(receiptFile);
    setReceiptPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [receiptFile]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleAmountChange = (e) => {
    const sanitized = sanitizeAmount(e.target.value);

    setFormData((current) => ({
      ...current,
      amount: sanitized,
    }));
  };

  const handleAmountBlur = () => {
    setFormData((current) => ({
      ...current,
      amount: formatCurrency(sanitizeAmount(current.amount)),
    }));
  };

  const handleAmountFocus = () => {
    setFormData((current) => ({
      ...current,
      amount: sanitizeAmount(current.amount),
    }));
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0] || null;

    if (!selectedFile) {
      setReceiptFile(null);
      return;
    }

    if (!ALLOWED_FILE_TYPES.has(selectedFile.type)) {
      toast.error("Please choose a PDF, PNG, or JPG receipt file.");
      e.target.value = "";
      setReceiptFile(null);
      return;
    }

    if (selectedFile.size > MAX_RECEIPT_FILE_SIZE_BYTES) {
      toast.error("Receipt files must be 10 MB or smaller.");
      e.target.value = "";
      setReceiptFile(null);
      return;
    }

    setReceiptFile(selectedFile);
  };

  const clearFile = () => {
    setReceiptFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleBooleanChange = (e) => {
    const { name, checked } = e.target;

    setFormData((current) => {
      const nextData = {
        ...current,
        [name]: checked,
      };

      if (name === "missing_receipt") {
        if (checked) {
          clearFile();
        } else {
          nextData.missing_receipt_reason = "";
        }
      }

      if (name === "po_required" && !checked) {
        nextData.po_number = "";
      }

      return nextData;
    });
  };

  const resetForm = () => {
    setFormData(getInitialFormData(employeeName));
    clearFile();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!formData.employee.trim()) {
      toast.error("Employee is required");
      return;
    }

    if (!formData.amount.trim()) {
      toast.error("Amount is required");
      return;
    }

    if (!formData.method_used) {
      toast.error("Payment method is required");
      return;
    }

    if (!formData.purchase_date) {
      toast.error("Purchase date is required");
      return;
    }

    if (!formData.vendor.trim()) {
      toast.error("Vendor is required");
      return;
    }

    if (!formData.business_reason.trim()) {
      toast.error("Business reason is required");
      return;
    }

    if (formData.missing_receipt && !formData.missing_receipt_reason.trim()) {
      toast.error("Missing receipt reason is required");
      return;
    }

    if (!formData.missing_receipt && !receiptFile) {
      toast.error("Receipt file is required");
      return;
    }

    const payload = new FormData();
    payload.append("employee", formData.employee.trim());
    payload.append("amount", formData.amount.trim());
    payload.append("method_used", formData.method_used);
    payload.append("purchase_date", formData.purchase_date);
    payload.append("vendor", formData.vendor.trim());
    payload.append("business_reason", formData.business_reason.trim());
    payload.append("expense_category", formData.expense_category);
    payload.append("po_required", String(formData.po_required));
    payload.append("po_number", formData.po_number.trim());
    payload.append("work_order_number", formData.work_order_number.trim());
    payload.append("missing_receipt", String(formData.missing_receipt));

    if (formData.missing_receipt) {
      payload.append(
        "missing_receipt_reason",
        formData.missing_receipt_reason.trim(),
      );
    } else if (receiptFile) {
      payload.append("receipt", receiptFile);
    }

    try {
      setIsSubmitting(true);
      setLoading(true);
      setSubmissionResult(null);
      const result = await submitReceipt(payload);

      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success(result.message);
      if (result.warning) {
        toast.error(result.warning);
      }

      setSubmissionResult({
        message: result.message,
        warning: result.warning,
        receiptId: result.receiptId,
        emailDeliveryStatus: result.emailDeliveryStatus,
      });
      resetForm();
    } catch (error) {
      console.error("[SUBMIT RECEIPT ERROR]: ", error);
      setSubmissionResult(null);
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.siteHeader}>
        <p>Receipt submission form</p>
      </div>

      <main className={styles.pageShell}>
        <form className={styles.receiptForm} onSubmit={handleSubmit}>
          {submissionResult && (
            <section
              className={`${styles.statusBanner} ${
                getStatusBannerTone(submissionResult.emailDeliveryStatus) ===
                "warning"
                  ? styles.statusBannerWarning
                  : styles.statusBannerSuccess
              }`}
            >
              <p className={styles.statusBannerTitle}>
                {submissionResult.warning
                  ? "Receipt saved with follow-up needed"
                  : "Receipt submitted"}
              </p>
              <p>{submissionResult.message}</p>
              {submissionResult.receiptId && (
                <p>Receipt ID: {submissionResult.receiptId}</p>
              )}
              {submissionResult.warning && <p>{submissionResult.warning}</p>}
            </section>
          )}

          <fieldset className={styles.formSection}>
            <legend>Employee Data</legend>

            <div className={styles.field}>
              <label htmlFor="employee">Employee</label>
              <input
                id="employee"
                name="employee"
                type="text"
                value={formData.employee}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="purchase_date">Purchase Date</label>
              <input
                id="purchase_date"
                name="purchase_date"
                type="date"
                value={formData.purchase_date}
                onChange={handleChange}
                required
              />
            </div>
          </fieldset>

          <fieldset className={styles.formSection}>
            <legend>Purchase Data</legend>

            <div className={styles.field}>
              <label htmlFor="method_used">Payment Method</label>
              <select
                id="method_used"
                name="method_used"
                value={formData.method_used}
                onChange={handleChange}
                required
              >
                <option value="">--select payment method--</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="vendor">Vendor</label>
              <input
                id="vendor"
                name="vendor"
                type="text"
                value={formData.vendor}
                onChange={handleChange}
                placeholder="Where was the purchase made?"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="amount">Purchase Amount</label>
              <div className={styles.moneyInput}>
                <span className={styles.moneySymbol} aria-hidden="true">
                  $
                </span>
                <input
                  id="amount"
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={handleAmountChange}
                  onBlur={handleAmountBlur}
                  onFocus={handleAmountFocus}
                  required
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="expense_category">Expense Category</label>
              <select
                id="expense_category"
                name="expense_category"
                value={formData.expense_category}
                onChange={handleChange}
              >
                <option value="">--select expense category--</option>
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label htmlFor="business_reason">Business Reason</label>
              <textarea
                id="business_reason"
                name="business_reason"
                value={formData.business_reason}
                onChange={handleChange}
                placeholder="What was purchased and why was it needed?"
                required
              />
            </div>

            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.inlineToggle}>
                <input
                  type="checkbox"
                  name="po_required"
                  checked={formData.po_required}
                  onChange={handleBooleanChange}
                />
                <span>PO required for this purchase</span>
              </label>
            </div>

            {formData.po_required && (
              <div className={styles.field}>
                <label htmlFor="po_number">PO #</label>
                <input
                  id="po_number"
                  name="po_number"
                  type="text"
                  value={formData.po_number}
                  onChange={handleChange}
                  placeholder="Enter PO number"
                />
              </div>
            )}

            <div className={styles.field}>
              <label htmlFor="work_order_number">W/O #</label>
              <input
                id="work_order_number"
                name="work_order_number"
                type="text"
                value={formData.work_order_number}
                onChange={handleChange}
                placeholder="Optional"
              />
            </div>
          </fieldset>

          <fieldset className={styles.formSection}>
            <legend>Receipt</legend>

            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.inlineToggle}>
                <input
                  type="checkbox"
                  name="missing_receipt"
                  checked={formData.missing_receipt}
                  onChange={handleBooleanChange}
                />
                <span>I do not have the receipt</span>
              </label>
            </div>

            {!formData.missing_receipt ? (
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label htmlFor="receipt">Upload Receipt</label>
                <input
                  ref={fileInputRef}
                  className={styles.fileInput}
                  type="file"
                  name="receipt"
                  id="receipt"
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={handleFileChange}
                />
                <label className={styles.uploadDropzone} htmlFor="receipt">
                  <span className={styles.uploadIcon} aria-hidden="true">
                    +
                  </span>
                  <span className={styles.uploadTitle}>
                    {receiptFile
                      ? "Receipt file selected"
                      : "Choose a file to upload"}
                  </span>
                  <span className={styles.uploadCopy}>
                    {receiptFile?.name ||
                      "PDF or image files work best for receipts"}
                  </span>
                  <span className={styles.uploadButton}>Browse files</span>
                </label>
                {receiptFile && (
                  <div className={styles.previewPanel}>
                    <div className={styles.previewHeader}>
                      <div>
                        <p className={styles.previewTitle}>Receipt Preview</p>
                        <p className={styles.previewMeta}>
                          {receiptFile.name} ·{" "}
                          {(receiptFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        className={styles.previewRemoveButton}
                        type="button"
                        onClick={clearFile}
                      >
                        Remove file
                      </button>
                    </div>

                    {receiptPreviewUrl &&
                      receiptFile.type === "application/pdf" && (
                        <iframe
                          className={styles.previewFrame}
                          src={receiptPreviewUrl}
                          title="Receipt PDF preview"
                        />
                      )}

                    {receiptPreviewUrl &&
                      receiptFile.type.startsWith("image/") && (
                        <img
                          className={styles.previewImage}
                          src={receiptPreviewUrl}
                          alt="Selected receipt preview"
                        />
                      )}
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.fieldFull}>
                <section className={styles.affidavitSheet}>
                  <div className={styles.affidavitHeader}>
                    <h2>Missing Receipt Statement</h2>
                    <p>
                      The purchase details above will still be submitted. Add a
                      short explanation for why the receipt is unavailable.
                    </p>
                  </div>

                  <div className={styles.affidavitForm}>
                    <label className={styles.affidavitLine}>
                      <span>Reason for Missing Receipt</span>
                      <textarea
                        id="missing_receipt_reason"
                        name="missing_receipt_reason"
                        value={formData.missing_receipt_reason}
                        onChange={handleChange}
                        placeholder="Explain why the receipt is unavailable."
                        required={formData.missing_receipt}
                      />
                    </label>
                  </div>
                </section>
              </div>
            )}
          </fieldset>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Submitting..."
              : formData.missing_receipt
                ? "Submit Missing Receipt"
                : "Submit Receipt"}
          </button>
        </form>
      </main>
    </div>
  );
};

export default SubmitReceipt;
