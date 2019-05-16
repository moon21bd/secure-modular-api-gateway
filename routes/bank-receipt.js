"use strict";

const express = require("express");
const async = require("async");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v1: uuidv1 } = require("uuid");
const jimp = require("jimp");
const cfg = require("../config");
const resGen = require("../lib/result.codes");
const common = require("../components/common");
const callback = common.callback;
exports.callback = callback;
const db = require("../resources/database.connection");
const dbErrorHandler = require("../lib/dbErrorHandler");

const router = express.Router();

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const MAX_FILE_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

// Allowed extensions
const allowedExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".wbmp",
  ".webp",
  ".tiff",
  ".svg",
  ".heic",
  ".heif",
];

const getFormattedDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const ensureDirectoryExists = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
      // console.log(`Directory created: ${dirPath}`);

      // Verify the directory was created successfully
      if (fs.existsSync(dirPath)) {
        // console.log(`Directory verification: ${dirPath} exists`);

        // Check write permissions
        const testFile = path.join(dirPath, `test_${Date.now()}.tmp`);
        try {
          fs.writeFileSync(testFile, "test");
          fs.unlinkSync(testFile);
          // console.log(`Write permissions verified for: ${dirPath}`);
        } catch (writeError) {
          // console.error(`No write permissions in: ${dirPath}`, writeError);
          throw new Error(`No write permissions in directory: ${dirPath}`);
        }
      } else {
        throw new Error(`Failed to create directory: ${dirPath}`);
      }
    } else {
      // console.log(`Directory already exists: ${dirPath}`);
    }
    return true;
  } catch (error) {
    console.error("Error creating directory:", error);
    throw error;
  }
};

const getBaseUploadPath = () => {
  const basePath = cfg.sales.depositImagePath;
  return basePath;
};

const getRiaBaseUploadPath = () => {
  const basePath = path.join(process.cwd(), "public", "images", "partnerC");

  // Forcefully create directory if it doesn't exist
  ensureDirectoryExists(basePath);

  console.log(`Using PARTNER_C base upload path: ${basePath}`);
  return basePath;
};

// Multer configuration for bank receipts
const bankReceiptStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const directoryName = getFormattedDate();
      const basePath = getBaseUploadPath();
      const targetUploadDir = path.join(basePath, directoryName);

      ensureDirectoryExists(targetUploadDir);

      cb(null, targetUploadDir);
    } catch (error) {
      console.error("Error in multer destination:", error);
      cb(error);
    }
  },

  filename: (req, file, cb) => {
    const fileId = uuidv1().replace(/-/g, "");
    const extension = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      return cb(
        new Error("Invalid file type. Allowed: " + allowedExtensions.join(", "))
      );
    }

    const filename = fileId + extension;
    cb(null, filename);
  },
});

// Multer configuration for PARTNER_C cash-in receipts
const riaReceiptStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const directoryName = getFormattedDate();
      const basePath = getRiaBaseUploadPath();
      const targetUploadDir = path.join(basePath, directoryName);

      ensureDirectoryExists(targetUploadDir);

      cb(null, targetUploadDir);
    } catch (error) {
      console.error("Error in PARTNER_C multer destination:", error);
      cb(error);
    }
  },

  filename: (req, file, cb) => {
    const fileId = uuidv1().replace(/-/g, "");
    const extension = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      return cb(
        new Error("Invalid file type. Allowed: " + allowedExtensions.join(", "))
      );
    }

    const filename = fileId + extension;
    cb(null, filename);
  },
});

const uploadBankReceipt = multer({
  storage: bankReceiptStorage,
  limits: {
    fileSize: MAX_FILE_UPLOAD_SIZE,
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(extension)) {
      cb(null, true);
    } else {
      cb(
        new Error(`Invalid file type. Allowed: ${allowedExtensions.join(", ")}`)
      );
    }
  },
}).single("receiptFile");

const uploadRiaReceipt = multer({
  storage: riaReceiptStorage,
  limits: {
    fileSize: MAX_FILE_UPLOAD_SIZE,
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(extension)) {
      cb(null, true);
    } else {
      cb(
        new Error(`Invalid file type. Allowed: ${allowedExtensions.join(", ")}`)
      );
    }
  },
}).single("receiptFile");


const getExistingInvoiceImagePath = async (historyId) => {
  try {
    const results = await queryAsync(
      `SELECT invoice_image FROM platform_ria_cico_cashin_histories WHERE id = ?`,
      [historyId]
    );
    return results.length > 0 ? results[0].invoice_image : null;
  } catch (error) {
    console.error("Error getting existing invoice image path:", error);
    return null;
  }
};

const deleteFileIfExists = (filePath) => {
  return new Promise((resolve) => {
    if (!filePath) {
      return resolve(false);
    }

    // Convert relative path to absolute path
    const absolutePath = path.join(process.cwd(), 'public', filePath);
    
    if (fs.existsSync(absolutePath)) {
      fs.unlink(absolutePath, (err) => {
        if (err) {
          console.error("Error deleting file:", err);
          resolve(false);
        } else {
          console.log("File deleted successfully:", absolutePath);
          resolve(true);
        }
      });
    } else {
      console.log("File does not exist, skipping deletion:", absolutePath);
      resolve(false);
    }
  });
};

const deleteUploadedFile = (filePath) => {
  return new Promise((resolve) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return resolve(false);
    }

    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting uploaded file:", err);
        resolve(false);
      } else {
        console.log("Uploaded file deleted:", filePath);
        resolve(true);
      }
    });
  });
};

// Database query helper
function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.mysql.query(sql, params, (err, results, fields) => {
      if (err) {
        console.error("Database query error:", err);
        const dbError = dbErrorHandler.handleDatabaseError(err);
        return reject(dbError);
      }
      resolve(results);
    });
  });
}

function insertDepositHistory() {
  return `INSERT INTO platform_sales_deposit_history 
    (deposit_for, amount, bank_name, deposit_date, image, deposit_type, comment, status, created_by, created_at, agent_id) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
}

function checkHistoryIdExists() {
  return `SELECT id FROM platform_ria_cico_cashin_histories WHERE id = ?`;
}

function updateInvoiceImageInCicoHistory() {
  return `UPDATE platform_ria_cico_cashin_histories SET invoice_image = ?, updated_at = NOW() WHERE id = ?`;
}

async function executeUploadBankReceipt(input, file, data) {
  try {
    const directoryName = getFormattedDate();

    const fileInfo = {
      filename: file.filename,
      originalname: file.originalname,
      path: `images/${directoryName}/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date().toISOString(),
    };

    // Prepare data for database
    const depositData = {
      deposit_for: input.depositFor || null,
      amount: parseFloat(input.amount),
      bank_name: input.bankName,
      deposit_date: input.depositDate,
      image: fileInfo.path,
      deposit_type: 0,
      comment: input.comment || "",
      status: "Submitted",
      created_by: input.userId,
      created_at: new Date(),
      agent_id: input.userId,
    };

    // Insert into database
    const results = await queryAsync(insertDepositHistory(), [
      depositData.deposit_for,
      depositData.amount,
      depositData.bank_name,
      depositData.deposit_date,
      depositData.image,
      depositData.deposit_type,
      depositData.comment,
      depositData.status,
      depositData.created_by,
      depositData.created_at,
      depositData.agent_id,
    ]);

    data.upload_result = {
      deposit_id: results.insertId,
      status: "Submitted",
      deposit_date: input.depositDate,
    };

    return null;
  } catch (error) {
    console.error("Error in executeUploadBankReceipt:", error);

    const structuredError = {
      status: 500,
      code: "5",
      title: "Database error",
      details: "Failed to save deposit information",
      timestamp: Math.floor(Date.now() / 1000),
      originalError: error.message,
    };

    return structuredError;
  }
}

async function executeInvoiceImageSavingInDB(input, file, data) {
  let existingImagePath = null;
  let shouldDeleteNewFile = false;

  try {
    const checkResults = await queryAsync(checkHistoryIdExists(), [
      input.historyId,
    ]);

    if (checkResults.length === 0) {
      shouldDeleteNewFile = true; // Mark for deletion since historyId is invalid
      const structuredError = {
        status: 404,
        code: "4",
        title: "Not Found",
        details: "Invalid historyId. Cash-in record not found.",
        timestamp: Math.floor(Date.now() / 1000),
      };
      return structuredError;
    }

    existingImagePath = await getExistingInvoiceImagePath(input.historyId);

    const directoryName = getFormattedDate();

    const fileInfo = {
      filename: file.filename,
      originalname: file.originalname,
      path: `images/partnerC/${directoryName}/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date().toISOString(),
    };

    const results = await queryAsync(updateInvoiceImageInCicoHistory(), [
      fileInfo.path,
      input.historyId,
    ]);

    // Delete old image file if it exists
    if (existingImagePath) {
      await deleteFileIfExists(existingImagePath);
    }

    data.upload_result = {
      status: "Success",
      historyId: input.historyId,
      path: fileInfo.path,
    };

    return null;
  } catch (error) {
    console.error("Error in executeInvoiceImageSavingInDB:", error);
    shouldDeleteNewFile = true; // Mark for deletion on error

    const structuredError = {
      status: 500,
      code: "5",
      title: "Database error",
      details: "Failed to save invoice image information",
      timestamp: Math.floor(Date.now() / 1000),
      originalError: error.message,
    };

    return structuredError;
  } finally {
    if (shouldDeleteNewFile && file && file.path) {
      await deleteUploadedFile(file.path);
    }
  }
}

function processSingleImageWithJIMP(file, callback) {
  const extension = path
    .extname(file.originalname)
    .toLowerCase()
    .replace(".", "");
  const filePath = file.path;

  // Check if file exists before processing
  if (!fs.existsSync(filePath)) {
    // console.error(`File not found for processing: ${filePath}`);
    return callback(new Error("File not found for processing"), null);
  }

  jimp
    .read(filePath)
    .then(function (image) {
      const originalWidth = image.bitmap.width;
      const MAX_WIDTH = 1300;

      // Resize if image is too wide
      if (originalWidth > MAX_WIDTH) {
        const newHeight = Math.round(
          image.bitmap.height * (MAX_WIDTH / originalWidth)
        );
        image.resize(MAX_WIDTH, newHeight);
      }

      // Set quality based on format
      let quality = 80;
      if (extension === "png") {
        quality = 9; // PNG compression level (0-9)
      }

      // Overwrite the original file with processed version
      return image.quality(quality).writeAsync(filePath);
    })
    .then(function () {
      return new Promise(function (resolve, reject) {
        fs.stat(filePath, function (err, stats) {
          if (err) return reject(err);
          resolve(stats);
        });
      });
    })
    .then(function (stats) {
      if (stats.size > MAX_FILE_SIZE) {
        return jimp.read(filePath).then(function (recompressedImage) {
          const reducedQuality = extension === "png" ? 6 : 60;
          return recompressedImage.quality(reducedQuality).writeAsync(filePath);
        });
      }
    })
    .then(function () {
      return new Promise(function (resolve, reject) {
        fs.stat(filePath, function (err, finalStats) {
          if (err) return reject(err);

          resolve({
            path: filePath,
            size: finalStats.size,
            filename: path.basename(filePath),
          });
        });
      });
    })
    .then(function (result) {
      callback(null, result);
    })
    .catch(function (error) {
      console.error("JIMP processing failed:", error);
      // Fallback: keep original file
      callback(
        {
          error: "IMAGE_PROCESSING_ERROR",
          details: error.message,
        },
        {
          path: filePath,
          size: file.size,
          filename: path.basename(filePath),
        }
      );
    });
}

const debugPath = (pathToCheck) => {
  console.log(`=== DEBUGGING PATH: ${pathToCheck} ===`);

  try {
    console.log(`Path exists: ${fs.existsSync(pathToCheck)}`);

    if (fs.existsSync(pathToCheck)) {
      const stats = fs.statSync(pathToCheck);
      console.log(`Is directory: ${stats.isDirectory()}`);
      console.log(`Is file: ${stats.isFile()}`);
      console.log(`Permissions: ${stats.mode.toString(8)}`); // Octal permissions
      console.log(`Owner: ${stats.uid}`);
      console.log(`Group: ${stats.gid}`);

      if (stats.isDirectory()) {
        console.log("Directory contents:");
        try {
          const files = fs.readdirSync(pathToCheck);
          files.forEach((file) => {
            const filePath = path.join(pathToCheck, file);
            const fileStats = fs.statSync(filePath);
            console.log(
              `  ${file} (${fileStats.size} bytes, ${fileStats.mtime})`
            );
          });
        } catch (readError) {
          console.log(`Cannot read directory: ${readError.message}`);
        }
      }
    }

    // Check parent directory
    const parentDir = path.dirname(pathToCheck);
    console.log(`\nParent directory: ${parentDir}`);
    console.log(`Parent exists: ${fs.existsSync(parentDir)}`);

    if (fs.existsSync(parentDir)) {
      const parentStats = fs.statSync(parentDir);
      console.log(`Parent is directory: ${parentStats.isDirectory()}`);
      console.log(`Parent permissions: ${parentStats.mode.toString(8)}`);
    }
  } catch (error) {
    console.log(`Error debugging path: ${error.message}`);
  }

  console.log("=== END DEBUG ===\n");
};

// Main upload route for bank receipts (existing API)
router.post("/upload-bank-receipt", function (req, res) {
  let data = {};

  const basePath = getBaseUploadPath();

  if (!fs.existsSync(basePath)) {
    console.log(`Base path does not exist, creating: ${basePath}`);
    ensureDirectoryExists(basePath);
  }

  async.series(
    [
      (callback) => {
        uploadBankReceipt(req, res, (err) => {
          if (err) {
            let errorMessage = "File upload failed.";

            if (err.code === "LIMIT_FILE_SIZE") {
              errorMessage = "File too large. Maximum 10MB allowed.";
            } else if (err.message) {
              errorMessage = err.message;
            }

            console.error("Upload error:", errorMessage);

            // Create structured error response instead of using resGen
            const structuredError = {
              status: 400,
              code: "3",
              title: "Required parameters missing",
              details: errorMessage,
              timestamp: Math.floor(Date.now() / 1000),
            };
            return callback(structuredError);
          }

          // Check if file was uploaded
          if (!req.file) {
            console.error("No file uploaded");

            // Create the specific error response
            const structuredError = {
              status: 400,
              code: "3",
              title: "Required parameters missing",
              details: "Please select a file to upload",
              timestamp: Math.floor(Date.now() / 1000),
            };
            return callback(structuredError);
          }

          callback();
        });
      },
      (callback) => {
        const {
          bankName,
          amount,
          comment,
          userId,
          sessionId,
          depositFor,
          depositDate,
        } = req.body;

        // console.log("Request body:", JSON.stringify(req.body));

        // Validate required fields
        if (!bankName || !amount || !userId || !sessionId || !depositFor) {
          // Clean up uploaded file if validation fails
          if (req.file && req.file.path) {
            fs.unlink(req.file.path, (unlinkErr) => {
              if (unlinkErr)
                console.error("Failed to cleanup file:", unlinkErr);
            });
          }

          const structuredError = {
            status: 400,
            code: "3",
            title: "Required parameters missing",
            details:
              "Missing userId or sessionId or depositFor or bankName or amount parameters",
            timestamp: Math.floor(Date.now() / 1000),
          };
          return callback(structuredError);
        }

        data.file = req.file;

        // Deposit date validation
        const isValidDate = (dateString) => {
          const regex = /^\d{4}-\d{2}-\d{2}$/;
          if (!regex.test(dateString)) return false;

          const date = new Date(dateString);
          return (
            !isNaN(date.getTime()) &&
            dateString === date.toISOString().split("T")[0]
          );
        };

        let depositDateValue;
        if (depositDate) {
          if (!isValidDate(depositDate)) {
            // Clean up uploaded file if validation fails
            if (req.file && req.file.path) {
              fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr)
                  console.error("Failed to cleanup file:", unlinkErr);
              });
            }

            const structuredError = {
              status: 400,
              code: "3",
              title: "Required parameters missing",
              details:
                "Invalid depositDate format. Please use YYYY-MM-DD format.",
              timestamp: Math.floor(Date.now() / 1000),
            };
            return callback(structuredError);
          }
          depositDateValue = depositDate;
        } else {
          depositDateValue = new Date().toISOString().split("T")[0];
        }

        data.formData = {
          bankName,
          amount,
          comment,
          userId,
          sessionId,
          depositFor,
          depositDate: depositDateValue,
        };
        callback();
      },
      (callback) => {
        common.verifySession(
          data.formData.userId,
          data.formData.sessionId,
          callback,
          undefined,
          req.headers.referer
        );
      },
      (callback) => {
        const imageExtensions = [
          ".jpg",
          ".jpeg",
          ".png",
          ".gif",
          ".bmp",
          ".wbmp",
          ".webp",
          ".tiff",
        ];
        const fileExtension = path
          .extname(data.file.originalname)
          .toLowerCase();

        if (imageExtensions.includes(fileExtension)) {
          processSingleImageWithJIMP(
            {
              path: data.file.path,
              originalname: data.file.originalname,
              size: data.file.size,
            },
            (processErr, processedFile) => {
              if (processErr) {
                console.error(
                  "Image processing failed, using original:",
                  processErr
                );
                return callback(); // Continue with original file
              }

              // Update to processed file
              data.file.path = processedFile.path;
              data.file.filename = processedFile.filename;
              data.file.size = processedFile.size;
              data.file.processed = true;
              callback();
            }
          );
        } else {
          // Not an image, skip processing
          callback();
        }
      },
      (callback) => {
        executeUploadBankReceipt(
          {
            bankName: data.formData.bankName,
            amount: data.formData.amount,
            comment: data.formData.comment,
            userId: data.formData.userId,
            depositFor: data.formData.depositFor,
            depositDate: data.formData.depositDate,
          },
          data.file,
          data
        )
          .then((error) => {
            if (error) {
              return callback(error); // Pass structured error from executeUploadBankReceipt
            }
            callback(); // Success
          })
          .catch((error) => {
            console.error(
              `Business logic execution failed: ${JSON.stringify(error)}`
            );

            // Convert to structured error
            const structuredError = {
              status: 500,
              code: "6",
              title: "Server error",
              details: "Failed to process upload request",
              timestamp: Math.floor(Date.now() / 1000),
              originalError: error.message,
            };
            return res.status(structuredError.status).json(structuredError);
          });
      },
    ],
    (err) => {
      // Remove temporary file if an error occurred
      if (err && data.file && data.file.path && fs.existsSync(data.file.path)) {
        fs.unlink(data.file.path, (unlinkErr) => {
          if (unlinkErr) console.error("Failed to cleanup file:", unlinkErr);
        });
      }

      if (err) {
        console.error(`Error in upload process: ${JSON.stringify(err)}`);
        if (err.status && err.code && err.title) {
          return res.status(err.status).json(err);
        } else if (err.errorCode) {
          const structuredError = {
            status: 400,
            code: err.errorCode.toString(),
            title: "Request error",
            details: err.errorMessage || "An error occurred",
            timestamp: Math.floor(Date.now() / 1000),
          };
          return res.status(400).json(structuredError);
        } else {
          const genericError = {
            status: 500,
            code: "0",
            title: "Internal server error",
            details: "An unexpected error occurred",
            timestamp: Math.floor(Date.now() / 1000),
          };
          return res.status(500).json(genericError);
        }
      }

      // Success response
      const successResp = {
        status: 200,
        code: "0",
        title: "Success",
        details: "Upload successful.",
        timestamp: Math.floor(Date.now() / 1000),
        data: {
          message:
            "Congratulations! Your receipt upload was successful. Our team will validate it within 24 hours.",
          info: data.upload_result,
        },
      };
      return res.status(successResp.status).json(successResp);
    }
  );
});

// PARTNER_C Cash-in receipt upload route
router.post("/partnerC/upload-cashin-receipt/disabled", function (req, res) {
  let data = {};

  async.series(
    [
      (callback) => {
        uploadRiaReceipt(req, res, (err) => {
          if (err) {
            let errorMessage = "File upload failed.";

            if (err.code === "LIMIT_FILE_SIZE") {
              errorMessage = "File too large. Maximum 10MB allowed.";
            } else if (err.message) {
              errorMessage = err.message;
            }

            console.error("PARTNER_C Upload error:", errorMessage);

            const structuredError = {
              status: 400,
              code: "3",
              title: "Required parameters missing",
              details: errorMessage,
              timestamp: Math.floor(Date.now() / 1000),
            };
            return callback(structuredError);
          }

          // Check if file was uploaded
          if (!req.file) {
            console.error("No file uploaded for PARTNER_C receipt");

            const structuredError = {
              status: 400,
              code: "3",
              title: "Required parameters missing",
              details: "Please select a file to upload",
              timestamp: Math.floor(Date.now() / 1000),
            };
            return callback(structuredError);
          }

          callback();
        });
      },
      (callback) => {
        const { userId, sessionId, historyId } = req.body;

        console.log(
          "PARTNER_C Receipt Upload Request body:",
          JSON.stringify(req.body)
        );

        // Validate required fields
        if (!historyId || !userId || !sessionId) {
          // Clean up uploaded file if validation fails
          if (req.file && req.file.path) {
            fs.unlink(req.file.path, (unlinkErr) => {
              if (unlinkErr)
                console.error("Failed to cleanup PARTNER_C file:", unlinkErr);
            });
          }

          const structuredError = {
            status: 400,
            code: "3",
            title: "Required parameters missing",
            details: "Missing historyId or userId or sessionId parameters",
            timestamp: Math.floor(Date.now() / 1000),
          };
          return callback(structuredError);
        }

        data.file = req.file;
        data.formData = {
          historyId: historyId,
          userId: userId,
          sessionId: sessionId,
        };
        callback();
      },
      (callback) => {
        common.verifySession(
          data.formData.userId,
          data.formData.sessionId,
          callback,
          undefined,
          req.headers.referer
        );
      },
      (callback) => {
        executeInvoiceImageSavingInDB(
          {
            historyId: data.formData.historyId,
            userId: data.formData.userId,
          },
          data.file,
          data
        )
          .then((error) => {
            if (error) {
              return callback(error);
            }
            callback(); // Success
          })
          .catch((error) => {
            console.error(
              `PARTNER_C Image saving data execution failed: ${JSON.stringify(error)}`
            );

            const structuredError = {
              status: 500,
              code: "6",
              title: "Server error",
              details: "Failed to process PARTNER_C Invoice upload request",
              timestamp: Math.floor(Date.now() / 1000),
              originalError: error.message,
            };
            return callback(structuredError);
          });
      },
    ],
    (err) => {
      // Remove temporary file if an error occurred (additional safety)
      if (err && data.file && data.file.path && fs.existsSync(data.file.path)) {
        fs.unlink(data.file.path, (unlinkErr) => {
          if (unlinkErr) {
            console.error("Failed to cleanup PARTNER_C file:", unlinkErr);
          } else {
            console.log("Cleaned up PARTNER_C file after error:", data.file.path);
          }
        });
      }

      if (err) {
        console.error(`Error in PARTNER_C upload process: ${JSON.stringify(err)}`);
        if (err.status && err.code && err.title) {
          return res.status(err.status).json(err);
        } else if (err.errorCode) {
          const structuredError = {
            status: 400,
            code: err.errorCode.toString(),
            title: "Request error",
            details: err.errorMessage || "An error occurred",
            timestamp: Math.floor(Date.now() / 1000),
          };
          return res.status(400).json(structuredError);
        } else {
          const genericError = {
            status: 500,
            code: "0",
            title: "Internal server error",
            details: "An unexpected error occurred",
            timestamp: Math.floor(Date.now() / 1000),
          };
          return res.status(500).json(genericError);
        }
      }

      // Success response
      const successResp = {
        status: 200,
        code: 0,
        title: "Success",
        details: "PARTNER_C receipt upload successful.",
        timestamp: Math.floor(Date.now() / 1000),
        data: {
          message: "PARTNER_C cash-in receipt uploaded successfully.",
          info: data.upload_result,
        },
      };
      return res.status(successResp.status).json(successResp);
    }
  );
});

module.exports = router;
