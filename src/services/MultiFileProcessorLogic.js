import axios from "axios";
import * as pdfjsLib from "pdfjs-dist";
import ExcelJS from "exceljs";

// Constants
const GOOGLE_VISION_API_KEY = "AIzaSyBQpg9s-125r-xeyOG5N3dqNDY9mdkLIQw";
const GEMINI_API_KEY = "AIzaSyBYJaNHLRJsPIPv0ZaJF6d1FEh_jzHN_Oo";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

// Extract text from PDF using Vision API
export const extractPdfText = async (file, setProgress) => {
  const pdfData = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  let fileText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;

    const imageBase64 = canvas
      .toDataURL("image/png")
      .replace(/^data:image\/png;base64,/, "");

    try {
      const response = await axios.post(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
        {
          requests: [
            {
              image: { content: imageBase64 },
              features: [{ type: "TEXT_DETECTION" }],
            },
          ],
        }
      );

      const textAnnotations = response.data.responses[0]?.textAnnotations;
      fileText += `\n--- Page ${i} ---\n${
        textAnnotations ? textAnnotations[0].description : "No text found"
      }\n`;
    } catch (error) {
      console.error(`Error processing page ${i}:`, error);
      fileText += `\n--- Page ${i} ---\nError processing page.\n`;
    }
    setProgress((prev) => prev + Math.round(100 / pdf.numPages));
  }

  return fileText;
};

// Send combined text to Gemini API
export const sendToGemini = async (combinedText) => {
  const prompt = createPrompt(combinedText);

  try {
    const response = await axios.post(
      GEMINI_API_URL,
      { contents: [{ parts: [{ text: prompt }] }] },
      { headers: { "Content-Type": "application/json" } }
    );

    if (
      response.data &&
      response.data.candidates &&
      response.data.candidates.length > 0
    ) {
      return response.data.candidates[0].content.parts[0].text.trim();
    }
    throw new Error("No response from Gemini.");
  } catch (error) {
    console.error("Error communicating with Gemini API:", error);
    throw new Error(`Gemini API error: ${error.message}`);
  }
};
export const createPrompt = (text) => `
Extract the following information from the text provided, formatting each detail on a new line and omitting unnecessary information (such as telephone and fax numbers unless specifically requested). Use the examples for clarity:

1. Vận đơn chính (M-B/L): …(example PLN00203022)
2. Bill of Lading No.: …(example HCMBKK029112022)
3. Description of Goods (extract only the description): …(example FABRIC 100 PCT. POLYESTER W: 114 CM)
4. Consignor/Shipper (include only company name and address): …(example MAC NELS SHIPPING VIETNAM CO., LTD, 29 PHO DỌC CHINH STR, DIST 1, HOCHIMINH CITY, VIETNAM)
5. Consignee/Consigned to Order of (include only company name and address): …(example TO THE ORDER OF THE HOLDER SURRENDERED BBL NO. 1/DKK 290439 TO BE ISSUED BY MAC - NELS CONTAINER LINES )
6. Notify Party (include only company name and address): …(example PRO LOG CO., LTD, 191/14 CTL TOWEL, 28TH FLOOR, RATCHADAPISE RD., KLONG TOEY BANGKOK 10110 THAILAND)
7. Port of Loading (convert to port code using the table below if matched): …(example VNCLI)
8. Port of Discharge (convert to port code using the table below if matched): …(example THBKK)
9. Đến cảng (Terminal): …(example BANGKOK)
10. Number of Packages (extract only the quantity): …(example 1)
11. Kind of Packages (convert to code using the table below if matched): …(example CT)
12. Container No. (Extract only the container number from the contain of which file contains the information "Consignor” or “Shipper"): …(example CSLU2082865)
13. Seal No. (Extract only the seal number from the contain of which file contains the information "Consignor” or “Shipper"):  …(example 21567932)
14. Gross Weight (extract only the number): …(example 1,899.58)
15. CBM/Volume (extract only the number): …(example 1.000)
16. Place and Date of Issue (extract only the date and format as dd/mm/yyyy): …(example 01/12/2022).

Use the following codes to convert ports of loading and discharge:
- YOKOHAMA => JPYOK
- HO CHI MINH => VNCLI
- CAT LAI => VNCLI
- CAI MEP => VNCMT
- BANGKOK => THBKK
- TAICHUNG => TWTXG

Use the following codes to convert kinds of packages:
- CTNS S.T.C => CT
- PALS S.T.C => PL
- ROLS S.T.C => RL
- PKGS S.T.C => PK

Please extract these details from the provided data, ensuring that both "Port of Loading" and "Port of Discharge" fields are replaced with the corresponding codes where applicable, that "Kind of Packages" is replaced with its corresponding code, and that both "Number and Kind of Packages, Description of Goods" and "Container & Seal No." are divided into separate fields as specified. Additionally, only extract the "Container No." if the text contains the "Consignor/Shipper" section.

If mandatory fields are missing, respond with:
"Thiếu thông tin quan trọng: [List of Missing Fields]. Vui lòng kiểm tra và tải lên file có đầy đủ các trường dữ liệu yêu cầu."

If all fields are missing, respond with:
"Không đủ dữ liệu để hoàn tất một bản khai sơ lược hàng hóa! Vui lòng tải lên file chứng từ chính xác hơn."

Text input:
${text}
`;

export const parseAIResponse = (response) => {
  if (typeof response !== "string") {
    throw new Error("Invalid AI response format. Expected a string.");
  }

  const patterns = {
    "Vận đơn chính (M-B/L)": /Vận đơn chính \(M-B\/L\): (.+)/,
    "Bill of Lading No.": /Bill of Lading No.: (.+)/,
    "Description of Goods": /Description of Goods: (.+)/,
    "Consignor/Shipper": /Consignor\/Shipper: (.+)/,
    "Consigned to Order of": /Consigned to Order of: (.+)/,
    "Notify Party": /Notify Party: (.+)/,
    "Port of Loading": /Port of Loading: (.+)/,
    "Port of Discharge": /Port of Discharge: (.+)/,
    "Đến cảng (Terminal)": /Đến cảng \(Terminal\): (.+)/,
    "Number of Packages": /Number of Packages: (.+)/,
    "Kind of Packages": /Kind of Packages: (.+)/,
    "Container No.": /Container No.: (.+)/,
    "Seal No.": /Seal No.: (.+)/,
    "Gross Weight": /Gross Weight: (.+)/,
    "CBM/Volume": /CBM\/Volume: (.+)/,
    "Place and Date of Issue": /Place and Date of Issue: (.+)/,
  };

  const data = {};
  const missingFields = []; // Track missing fields

  for (const [key, regex] of Object.entries(patterns)) {
    const match = response.match(regex);
    if (match) {
      data[key] = match[1].trim();
    } else {
      missingFields.push(key); // Add missing field to the list
    }
  }

  // If all fields are missing, return with a custom message
  if (missingFields.length === Object.keys(patterns).length) {
    return {
      "Thông báo":
        "Không đủ dữ liệu để hoàn tất một bản khai sơ lược hàng hóa! Vui lòng tải lên file chứng từ chính xác hơn.",
    };
  }

  // If some fields are missing, notify the user with the missing fields
  if (missingFields.length > 0) {
    data["Thông báo"] = `Thiếu thông tin quan trọng: ${missingFields.join(
      ", "
    )}. Vui lòng kiểm tra và tải lên file có đầy đủ các trường dữ liệu yêu cầu.`;
  }

  return data; // Return the data including missing field notifications if applicable
};

// Merge existing and new AI data
export const mergeData = (existingData, newData) => {
  if (!existingData) return newData;

  const isConsistent = Object.keys(existingData).every(
    (key) =>
      existingData[key] === newData[key] || newData[key] === "Not Available"
  );

  if (!isConsistent) {
    throw new Error("Inconsistent data detected across pages.");
  }

  return { ...existingData, ...newData };
};
// Export AI data to Excel
export const exportToExcel = async (aiResponse) => {
  if (!aiResponse) {
    console.error("No data available for export.");
    return;
  }

  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Danh Sách Vận Đơn Gom Hàng");

    // Main Title
    worksheet.mergeCells("A1:H1");
    const mainTitle = worksheet.getCell("A1");
    mainTitle.value = "DANH SÁCH VẬN ĐƠN GOM HÀNG";
    mainTitle.font = { size: 16, color: { argb: "FF000000" } }; // Black color
    mainTitle.alignment = { horizontal: "center", vertical: "middle" };
    mainTitle.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF00B0F0" }, // Light blue background
    };
    mainTitle.border = {
      top: { style: "medium", color: { argb: "FF000000" } }, // Black border
      left: { style: "medium", color: { argb: "FF000000" } },
      bottom: { style: "medium", color: { argb: "FF000000" } },
      right: { style: "medium", color: { argb: "FF000000" } },
    };

    // Subtitle
    worksheet.mergeCells("A2:H2");
    const subTitle = worksheet.getCell("A2");
    subTitle.value = "(List of House Bill of Lading)";
    subTitle.font = { size: 14, color: { argb: "FF000000" } }; // Black color
    subTitle.alignment = { horizontal: "center", vertical: "middle" };
    subTitle.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF00B0F0" }, // Light blue background
    };
    subTitle.border = {
      top: { style: "medium", color: { argb: "FF000000" } }, // Black border
      left: { style: "medium", color: { argb: "FF000000" } },
      bottom: { style: "medium", color: { argb: "FF000000" } },
      right: { style: "medium", color: { argb: "FF000000" } },
    };

    // === Table 1 ===
    const table1Headers = [
      "STT (*)\nNo",
      "Số hồ sơ\nDocument's No",
      "Năm đăng ký hồ sơ\nDocument's Year",
      "Chức năng của chứng từ\nDocument's function",
      "Người gửi hàng*\nShipper",
      "Người nhận hàng*\nConsignee",
      "Người được thông báo 1\nNotify Party 1",
      "Danh sách vận đơn gom hàng\nNotify Party 2",
      "Mã Cảng chuyển tải/quá cảnh\nCode of Port of transhipment/transit",
      "Mã Cảng giao hàng/cảng đích\nFinal destination",
      "Mã Cảng xếp hàng\nCode of Port of Loading",
      "Mã Cảng dỡ hàng\nPort of unloading/discharging",
      "Địa điểm giao hàng*\nPlace of Delivery",
      "Loại hàng*\nCargo Type/Terms of Shipment",
      "Số vận đơn *\nBill of lading number",
      "Ngày phát hành vận đơn*\nDate of house bill of lading",
      "Số vận đơn gốc*\nMaster bill of lading number",
      "Ngày phát hành vận đơn gốc*\nDate of master bill of lading",
      "Ngày khởi hành*\nDeparture date",
      "Tổng số kiện*\nNumber of packages",
      "Loại kiện*\nKind of packages",
      "Tổng trọng lượng*\nTotal gross weight",
      "Đơn vị tính tổng trọng lượng*\nTotal gross weight unit",
      "Ghi chú\nRemark",
    ];

    // Add Table 1 Headers
    const table1HeaderRow = worksheet.addRow(table1Headers);
    table1HeaderRow.height = 30; // Set a taller height for Table 1 header
    // Add Table 1 Headers with color formatting
    table1Headers.forEach((header, index) => {
      const cell = worksheet.getCell(3, index + 1); // Assuming headers start at row 3
      const [vietnamese, english] = header.split("\n"); // Split header into Vietnamese and English parts

      cell.value = {
        richText: [
          {
            text: vietnamese,
            font: { color: { argb: "FFFF0000" }, bold: true }, // Red for Vietnamese
          },
          { text: "\n" }, // Line break
          { text: english, font: { color: { argb: "FF000000" } } }, // Black for English
        ],
      };

      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true, // Enable text wrapping for multi-line headers
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDCEBF7" }, // Light blue background (#dcebf7)
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Auto-adjust column widths for Table 1
    // Auto-adjust column widths for Table 1
    table1Headers.forEach((_, index) => {
      const column = worksheet.getColumn(index + 1);
      column.width = 20;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const textLength = String(cell.value || "").length;
        if (textLength > column.width) {
          column.width = textLength + 2;
        }
      });
    });

    // Adjust Row Height and Background Color for Table 1
    const startRowTable1 = 4; // Content starts from row 4
    const endRowTable1 = worksheet.lastRow.number;

    for (let rowIndex = startRowTable1; rowIndex <= endRowTable1; rowIndex++) {
      const row = worksheet.getRow(rowIndex);
      row.height = 25; // Adjust row height
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFACD" }, // Light Yellow Background
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    }

    // Add AI-Populated Data for Table 1
    const fieldsMapping = [
      {
        position: "Q4",
        key: "Vận đơn chính (M-B/L)",
        header: "Vận đơn chính (M-B/L)",
      },
      {
        position: "O4",
        key: "Bill of Lading No.",
        header: "Bill of Lading No.",
      },
      { position: "E4", key: "Consignor/Shipper", header: "Consignor/Shipper" },
      {
        position: "F4",
        key: "Consigned to Order of",
        header: "Consigned to Order of",
      },
      { position: "K4", key: "Port of Loading", header: "Port of Loading" },
      { position: "L4", key: "Port of Discharge", header: "Port of Discharge" },
      { position: "J4", key: "Port of Discharge", header: "Port of Discharge" },
      {
        position: "M4",
        key: "Đến cảng (Terminal)",
        header: "Đến cảng (Terminal)",
      },
      {
        position: "T4",
        key: "Number of Packages",
        header: "Number of Packages",
      },
      { position: "U4", key: "Kind of Packages", header: "Kind of Packages" },
      {
        position: "P4",
        key: "Place and Date of Issue",
        header: "Place and Date of Issue",
      },
      {
        position: "R4",
        key: "Place and Date of Issue",
        header: "Place and Date of Issue",
      },
      {
        position: "S4",
        key: "Place and Date of Issue",
        header: "Place and Date of Issue",
      },
      { position: "G4", key: "Notify Party", header: "Notify Party" },
      { position: "V4", key: "Gross Weight", header: "Gross Weight" },
    ];

    fieldsMapping.forEach(({ position, key }) => {
      const cell = worksheet.getCell(position);
      cell.value = aiResponse[key] || "Not Available";
      cell.font = { color: { argb: "FF000000" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      //   cell.fill = {
      //     type: "pattern",
      //     pattern: "solid",
      //     fgColor: { argb: "E7E6E6" },
      //   };
    });

    // Add Predefined Sample Data for Table 1
    const additionalFields = [
      { position: "A4", value: "1", header: "STT (*)" },
      { position: "B4", value: " ", header: "Số hồ sơ" },
      { position: "C4", value: "2024", header: "Năm đăng ký hồ sơ" },
      { position: "D4", value: "CN01", header: "Chức năng của chứng từ" },
      { position: "H4", value: " ", header: "Danh sách vận đơn gom hàng" },
      { position: "I4", value: " ", header: "Mã Cảng chuyển tải/quá cảnh" },
      { position: "N4", value: "CFS-CFS", header: "Loại hàng" },
      {
        position: "R4",
        value: "Place and Date of Issue",
        header: "Ngày phát hành vận đơn gốc",
      },
      { position: "W4", value: "KGM", header: "Đơn vị tính tổng trọng lượng" },
      { position: "X4", value: " ", header: "Ghi chú" },
    ];

    additionalFields.forEach(({ position, value }) => {
      const cell = worksheet.getCell(position);
      cell.value = value;
      cell.font = { color: { argb: "FF000000" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      //   cell.fill = {
      //     type: "pattern",
      //     pattern: "solid",
      //     fgColor: { argb: "E7E6E6" },
      //   };
    });

    // Add spacing between tables

    worksheet.addRow([]); // Add a blank row
    worksheet.getRow(worksheet.lastRow.number).height = 15; // Set height for the spacer row

    // === Table 2 ===
    const table2Headers = [
      "Mã hàng\nHS code if avail",
      "Mô tả hàng hóa*\nDescription of Goods",
      "Tổng trọng lượng*\nGross weight",
      "Kích thước/thể tích *\nDimension/tonnage",
      "Số hiệu cont\nCont. number",
      "Số seal cont\nSeal number",
    ];

    // Add Table 2 Headers
    // Add Table 2 Headers starting from column B
    const table2HeaderRow = worksheet.addRow([]);
    worksheet.getRow(table2HeaderRow.number).getCell(2).value =
      "Mã hàng\nHS code if avail";
    worksheet.getRow(table2HeaderRow.number).getCell(3).value =
      "Mô tả hàng hóa*\nDescription of Goods";
    worksheet.getRow(table2HeaderRow.number).getCell(4).value =
      "Tổng trọng lượng*\nGross weight";
    worksheet.getRow(table2HeaderRow.number).getCell(5).value =
      "Kích thước/thể tích *\nDimension/tonnage";
    worksheet.getRow(table2HeaderRow.number).getCell(6).value =
      "Số hiệu cont\nCont. number";
    worksheet.getRow(table2HeaderRow.number).getCell(7).value =
      "Số seal cont\nSeal number";
    table2HeaderRow.height = 25; // Set a taller height for Table 2 header
    // Add Table 2 Headers with color formatting starting from row 6 and column B
    table2Headers.forEach((header, index) => {
      const cell = worksheet.getCell(6, index + 2); // Headers start at row 6, column B
      const [vietnamese, english] = header.split("\n"); // Split header into Vietnamese and English parts

      cell.value = {
        richText: [
          {
            text: vietnamese,
            font: { color: { argb: "FFFF0000" }, bold: true }, // Red for Vietnamese
          },
          { text: "\n" }, // Line break
          { text: english, font: { color: { argb: "FF000000" } } }, // Black for English
        ],
      };

      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true, // Enable text wrapping for multi-line headers
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDCEBF7" }, // Light blue background (#dcebf7)
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Auto-adjust column width based on content
    table2Headers.forEach((_, index) => {
      const column = worksheet.getColumn(index + 2); // Columns start from B (index + 2)
      column.width = 20; // Default width to start with
      column.eachCell({ includeEmpty: true }, (cell) => {
        const textLength = String(cell.value || "").length;
        if (textLength > column.width) {
          column.width = textLength + 2; // Adjust width based on content, add padding
        }
      });
    });

    // Add Table 2 Data
    // Add Table 2 Data directly below headers
    const table2Fields = [
      { position: "B7", key: "HS Code", header: "Mã hàng" }, // Updated to ensure it starts at B7
      {
        position: "C7",
        key: "Description of Goods",
        header: "Description of Goods",
      },
      { position: "D7", key: "Gross Weight", header: "Gross Weight" },
      { position: "E7", key: "CBM/Volume", header: "Dimension/Tonnage" },
      { position: "F7", key: "Container No.", header: "Cont. number" },
      { position: "G7", key: "Seal No.", header: "Seal number" },
    ];

    // Table 2 Fields Content
    table2Fields.forEach(({ position, key }) => {
      const cell = worksheet.getCell(position);
      cell.value = aiResponse[key] || " ";

      // Font settings
      cell.font = { color: { argb: "FF000000" } }; // Black text

      // Alignment
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true, // Enable text wrapping
      };

      // Background color (yellow)
      //   cell.fill = {
      //     type: "pattern",
      //     pattern: "solid",
      //     fgColor: { argb: "FFFFFACD" }, // Light Yellow Background (#FFFACD)
      //   };
    });

    // Adjust Row Height for Table 2
    const startRowTable2 = 7; // Assuming Table 2 content starts from row 7
    const endRowTable2 = worksheet.lastRow.number; // Automatically adjust to the last row of Table 2

    for (let rowIndex = startRowTable2; rowIndex <= endRowTable2; rowIndex++) {
      const row = worksheet.getRow(rowIndex);
      row.height = 25; // Dynamically increase row height
      row.eachCell({ includeEmpty: true }, (cell) => {
        // Additional alignment for content
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true, // Enable text wrapping for multi-line content
        };
        // Ensure consistent yellow background for all content cells
        // cell.fill = {
        //   type: "pattern",
        //   pattern: "solid",
        //   fgColor: { argb: "FFFFFACD" }, // Light Yellow Background (#FFFACD)
        // };
      });
    }

    // Save File
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "MANIFEST.xlsx";
    link.click();
  } catch (error) {
    console.error("Error exporting Excel file:", error);
  }
};
