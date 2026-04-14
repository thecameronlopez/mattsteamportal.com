/**
 * @typedef {Object} ReceiptConfig
 * @property {string} receiptEmail
 * @property {string} driveFolderId
 * @property {string} sheetId
 * @property {string} sheetName
 * @property {string} processedLabel
 * @property {string} duplicateLabel
 * @property {string} errorLabel
 * @property {string} webhookToken
 * @property {string} gmailQuery
 */

/**
 * @typedef {Object} ReceiptEmailData
 * @property {string} receiptDbId
 * @property {string} receiptUuid
 * @property {string} employee
 * @property {string} amount
 * @property {string} purchaseDate
 * @property {string} vendor
 * @property {string} missingReceipt
 */

/** @type {ReceiptConfig} */
const CONFIG = {
  receiptEmail: "receipts@mattsappliancesla.net",
  driveFolderId: "11tIH0jg-w8aHO_AuAkDS1fbgWA5JdTfN",
  sheetId: "1iu06stEJ2jThb-7cogppETzW2ZHFLDgtA9IzP3bF-Hk",
  sheetName: "log",
  processedLabel: "receipt-processed",
  duplicateLabel: "receipt-duplicate",
  errorLabel: "receipt-error",
  webhookToken: "2600wegotwhatyouneed",
  gmailQuery:
    'to:receipts@mattsappliancesla.net subject:"Receipt Submission |" ' +
    "-label:receipt-processed -label:receipt-error",
};

/**
 * Poll receipt emails, save attachments to Drive, and append lookup rows to Sheets.
 * @return {void}
 */
function processReceiptEmails() {
  /** @type {GoogleAppsScript.Drive.Folder} */
  const folder = DriveApp.getFolderById(CONFIG.driveFolderId);

  /** @type {GoogleAppsScript.Spreadsheet.Sheet} */
  const sheet = SpreadsheetApp.openById(CONFIG.sheetId).getSheetByName(
    CONFIG.sheetName,
  );

  if (!sheet) {
    throw new Error(`Sheet "${CONFIG.sheetName}" was not found.`);
  }

  ensureReceiptSheetHeader_(sheet);

  /** @type {GoogleAppsScript.Gmail.GmailLabel} */
  const processedLabel = getOrCreateLabel_(CONFIG.processedLabel);

  /** @type {GoogleAppsScript.Gmail.GmailLabel} */
  const duplicateLabel = getOrCreateLabel_(CONFIG.duplicateLabel);

  /** @type {GoogleAppsScript.Gmail.GmailLabel} */
  const errorLabel = getOrCreateLabel_(CONFIG.errorLabel);

  /** @type {GoogleAppsScript.Gmail.GmailThread[]} */
  const threads = GmailApp.search(CONFIG.gmailQuery);

  threads.forEach((thread) => {
    /** @type {GoogleAppsScript.Gmail.GmailMessage[]} */
    const messages = thread.getMessages();

    messages.forEach((message) => {
      try {
        /** @type {string} */
        const messageId = message.getId();

        if (sheetHasMessageId_(sheet, messageId)) {
          thread.addLabel(processedLabel);
          thread.removeLabel(errorLabel);
          return;
        }

        /** @type {ReceiptEmailData} */
        const receipt = extractReceiptData_(message);

        if (sheetHasReceiptDbId_(sheet, receipt.receiptDbId)) {
          thread.addLabel(duplicateLabel);
          thread.addLabel(processedLabel);
          thread.removeLabel(errorLabel);

          console.warn(
            `Skipping duplicate receipt DB ID ${receipt.receiptDbId} for Gmail message ${messageId}`,
          );
          return;
        }

        /** @type {GoogleAppsScript.Base.Blob[]} */
        const attachments = message.getAttachments({
          includeInlineImages: false,
        });

        let driveFileUrl = "";
        let driveFileId = "";

        if (attachments.length > 0) {
          /** @type {GoogleAppsScript.Base.Blob} */
          const attachment = attachments[0];

          /** @type {GoogleAppsScript.Drive.File} */
          const savedFile = folder.createFile(attachment.copyBlob());

          savedFile.setName(buildDriveFileName_(receipt, attachment.getName()));

          driveFileUrl = savedFile.getUrl();
          driveFileId = savedFile.getId();
        }

        sheet.appendRow([
          receipt.receiptDbId,
          receipt.receiptUuid,
          receipt.employee,
          receipt.amount,
          receipt.purchaseDate,
          receipt.vendor,
          receipt.missingReceipt,
          driveFileUrl,
          driveFileId,
          new Date(),
          messageId,
        ]);

        thread.addLabel(processedLabel);
        thread.removeLabel(errorLabel);
        message.markRead();
      } catch (error) {
        thread.addLabel(errorLabel);
        thread.removeLabel(processedLabel);

        const messageText =
          error instanceof Error ? error.message : String(error);
        console.error(
          `Receipt processing failed for message ${message.getId()} (${message.getSubject()}): ${messageText}`,
        );
      }
    });
  });
}

/**
 * Receive signed cleanup requests from the Flask app.
 * Deploy this Apps Script as a web app for server-to-server receipt cleanup.
 * @param {GoogleAppsScript.Events.DoPost} e
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  try {
    /** @type {{ token?: string, action?: string, receipt_id?: number|string }} */
    const payload = JSON.parse(e.postData?.contents || "{}");

    if (payload.token !== CONFIG.webhookToken) {
      return jsonResponse_({
        success: false,
        message: "Unauthorized receipt cleanup request.",
      });
    }

    if (payload.action === "delete_receipt_artifacts") {
      const result = deleteReceiptArtifacts_(String(payload.receipt_id || ""));
      return jsonResponse_({
        success: true,
        message: "Receipt Google artifacts deleted successfully.",
        ...result,
      });
    }

    return jsonResponse_({
      success: false,
      message: "Unsupported receipt automation action.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return jsonResponse_({
      success: false,
      message,
    });
  }
}

/**
 * Pull receipt metadata out of the Gmail subject/body.
 * @param {GoogleAppsScript.Gmail.GmailMessage} message
 * @return {ReceiptEmailData}
 */
function extractReceiptData_(message) {
  /** @type {string} */
  const subject = message.getSubject();

  /** @type {string} */
  const body = message.getPlainBody();

  /** @type {Object.<string, string>} */
  const fields = parseBodyFields_(body);

  const subjectMatch = subject.match(
    /^Receipt Submission \| ID: (\d+) \| UUID: ([a-f0-9-]+) \| Vendor: (.+)$/i,
  );

  /** @type {ReceiptEmailData} */
  const receipt = {
    receiptDbId: subjectMatch ? subjectMatch[1] : fields["Receipt DB ID"] || "",
    receiptUuid: subjectMatch ? subjectMatch[2] : fields["Receipt UUID"] || "",
    employee: fields["Employee"] || "",
    amount: fields["Amount"] || "",
    purchaseDate: fields["Purchase Date"] || "",
    vendor: fields["Vendor"] || (subjectMatch ? subjectMatch[3] : ""),
    missingReceipt: fields["Missing Receipt"] || "No",
  };

  if (!receipt.receiptDbId || !receipt.receiptUuid) {
    throw new Error("Could not parse receipt ID and UUID from email.");
  }

  return receipt;
}

/**
 * Convert `Key: Value` lines from the email body into an object.
 * @param {string} body
 * @return {Object.<string, string>}
 */
function parseBodyFields_(body) {
  /** @type {Object.<string, string>} */
  const result = {};

  body.split(/\r?\n/).forEach((line) => {
    const colonIndex = line.indexOf(":");

    if (colonIndex === -1) {
      return;
    }

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    result[key] = value;
  });

  return result;
}

/**
 * Build a stable Drive filename from receipt metadata.
 * @param {ReceiptEmailData} receipt
 * @param {string} originalName
 * @return {string}
 */
function buildDriveFileName_(receipt, originalName) {
  return `${receipt.receiptDbId}_${receipt.receiptUuid}_${originalName}`;
}

/**
 * Delete the Google-side artifacts for one receipt by DB id.
 * @param {string} receiptDbId
 * @return {{deletedSheetRow: number, deletedDriveFileId: string, foundSheetRow: boolean}}
 */
function deleteReceiptArtifacts_(receiptDbId) {
  if (!receiptDbId) {
    throw new Error("Receipt DB ID is required for cleanup.");
  }

  /** @type {GoogleAppsScript.Spreadsheet.Sheet} */
  const sheet = SpreadsheetApp.openById(CONFIG.sheetId).getSheetByName(
    CONFIG.sheetName,
  );

  if (!sheet) {
    throw new Error(`Sheet "${CONFIG.sheetName}" was not found.`);
  }

  const targetRow = findReceiptRowByDbId_(sheet, receiptDbId);
  if (!targetRow) {
    return {
      deletedSheetRow: 0,
      deletedDriveFileId: "",
      foundSheetRow: false,
    };
  }

  /** @type {string[]} */
  const rowValues = /** @type {string[]} */ (
    sheet.getRange(targetRow, 1, 1, 11).getValues()[0].map(String)
  );

  const driveFileId = rowValues[8] || "";

  if (driveFileId) {
    try {
      DriveApp.getFileById(driveFileId).setTrashed(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not delete Drive file ${driveFileId}: ${message}`);
    }
  }

  sheet.deleteRow(targetRow);

  return {
    deletedSheetRow: targetRow,
    deletedDriveFileId: driveFileId,
    foundSheetRow: true,
  };
}

/**
 * Make sure the receipt sheet has the expected headers.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @return {void}
 */
function ensureReceiptSheetHeader_(sheet) {
  /** @type {string[]} */
  const headers = [
    "Receipt DB ID",
    "Receipt UUID",
    "Employee",
    "Amount",
    "Purchase Date",
    "Vendor",
    "Missing Receipt?",
    "Drive File URL",
    "Drive File ID",
    "Processed At",
    "Gmail Message ID",
  ];

  /** @type {string[]} */
  const existingHeaders = /** @type {string[]} */ (
    sheet.getRange(1, 1, 1, headers.length).getValues()[0].map(String)
  );

  const headersMatch = headers.every((header, index) => {
    return existingHeaders[index] === header;
  });

  if (!headersMatch) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  if (sheet.getFrozenRows() !== 1) {
    sheet.setFrozenRows(1);
  }
}

/**
 * Check whether the sheet already contains the Gmail message id.
 * Column 11 is expected to be Gmail Message ID.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} messageId
 * @return {boolean}
 */
function sheetHasMessageId_(sheet, messageId) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return false;
  }

  /** @type {string[][]} */
  const values = /** @type {string[][]} */ (
    sheet.getRange(2, 11, lastRow - 1, 1).getValues()
  );

  /** @type {string[]} */
  const ids = values.flat().map(String);

  return ids.includes(messageId);
}

/**
 * Check whether the sheet already contains the receipt DB id.
 * Column 1 is expected to be Receipt DB ID.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} receiptDbId
 * @return {boolean}
 */
function sheetHasReceiptDbId_(sheet, receiptDbId) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return false;
  }

  /** @type {string[][]} */
  const values = /** @type {string[][]} */ (
    sheet.getRange(2, 1, lastRow - 1, 1).getValues()
  );

  /** @type {string[]} */
  const ids = values.flat().map(String);

  return ids.includes(String(receiptDbId));
}

/**
 * Find the sheet row number for a receipt DB id.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} receiptDbId
 * @return {number}
 */
function findReceiptRowByDbId_(sheet, receiptDbId) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return 0;
  }

  /** @type {string[][]} */
  const values = /** @type {string[][]} */ (
    sheet.getRange(2, 1, lastRow - 1, 1).getValues()
  );

  const target = String(receiptDbId);
  const rowIndex = values.findIndex((row) => String(row[0]) === target);

  return rowIndex === -1 ? 0 : rowIndex + 2;
}

/**
 * Find an existing Gmail label or create it.
 * @param {string} name
 * @return {GoogleAppsScript.Gmail.GmailLabel}
 */
function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

/**
 * Return a JSON response for the Apps Script web app.
 * @param {Object} payload
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/**
 * Create a recurring trigger for the receipt polling job.
 * @return {void}
 */
function setupReceiptProcessingTrigger() {
  /** @type {GoogleAppsScript.Script.Trigger[]} */
  const triggers = ScriptApp.getProjectTriggers();

  triggers
    .filter(
      (trigger) => trigger.getHandlerFunction() === "processReceiptEmails",
    )
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger("processReceiptEmails")
    .timeBased()
    .everyMinutes(5)
    .create();
}
