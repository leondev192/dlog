import axios from "axios";
import * as pdfjsLib from "pdfjs-dist";
import ExcelJS from "exceljs";
import { message } from "antd";

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

// Create AI prompt
export const createPrompt = (text) => `
Extract the following information from the text provided, formatting each detail on a new line and omitting unnecessary information:

1. Vận đơn chính (M-B/L): Example PLN00203022
2. Bill of Lading No.: Example HCMBKK029112022
3. Description of Goods (extract only the description): Example FABRIC 100 PCT. POLYESTER W: 114 CM
4. Consignor/Shipper (include only company name and address): Example MAC NELS SHIPPING VIETNAM CO., LTD, 29 PHO DỌC CHINH STR, DIST 1, HOCHIMINH CITY, VIETNAM
5. Consignee/Consigned to Order of (include only company name and address): Example TO THE ORDER OF THE HOLDER SURRENDERED BBL NO. 1/DKK 290439 TO BE ISSUED BY MAC - NELS CONTAINER LINES
6. Notify Party (include only company name and address): Example PRO LOG CO., LTD, 191/14 CTL TOWEL, 28TH FLOOR, RATCHADAPISE RD., KLONG TOEY BANGKOK 10110 THAILAND
7. Port of Loading: Example VNCLI
8. Port of Discharge: Example THBKK
9. Đến cảng (Terminal): Example BANGKOK
10. Number of Packages: Example 1
11. Kind of Packages: Example CT
12. Container No.: Example CSLU2082865
13. Seal No.: Example 21567932
14. Gross Weight: Example 1,899.58
15. CBM/Volume: Example 1.000
16. Place and Date of Issue: Example 01/12/2022

${text}`;

// Parse AI response into structured data
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
  for (const [key, regex] of Object.entries(patterns)) {
    const match = response.match(regex);
    data[key] = match ? match[1].trim() : "Not Available";
  }
  return data;
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

    // Tiêu đề chính
    worksheet.mergeCells("A1:H1");
    const mainTitle = worksheet.getCell("A1");
    mainTitle.value = "DANH SÁCH VẬN ĐƠN GOM HÀNG";
    mainTitle.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    mainTitle.alignment = { horizontal: "center", vertical: "middle" };
    mainTitle.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "0070C0" },
    };

    // Tiêu đề phụ
    worksheet.mergeCells("A2:H2");
    const subTitle = worksheet.getCell("A2");
    subTitle.value = "List of House Bill of Lading";
    subTitle.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    subTitle.alignment = { horizontal: "center", vertical: "middle" };
    subTitle.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "0070C0" },
    };

    // Thêm tiêu đề cột
    const columnHeaders = [
      "STT (*)",
      "Số hồ sơ",
      "Năm đăng ký hồ sơ",
      "Chức năng của chứng từ",
      "Người gửi hàng",
      "Người nhận hàng",
      "Người được thông báo 1",
      "Người được thông báo 2",
      "Mã Cảng chuyển tải/quá cảnh",
      "Mã Cảng giao hàng/cảng đích",
      "Mã Cảng xếp hàng",
      "Mã Cảng dỡ hàng",
      "Địa điểm giao hàng",
      "Loại hàng",
      "Số vận đơn",
      "Ngày phát hành vận đơn",
      "Số vận đơn gốc",
      "Ngày phát hành vận đơn gốc",
      "Ngày khởi hành",
      "Tổng số kiện",
      "Loại kiện",
      "Tổng trọng lượng",
      "Đơn vị tính tổng trọng lượng",
      "Ghi chú",
    ];

    // Thêm hàng tiêu đề
    const headerRow = worksheet.addRow(columnHeaders);
    // Tiêu đề bảng 2 (B6 - G6)
    // Tiêu đề bảng 2 (B6 - G6)
    const secondHeader = [
      "Mã hàng\nHS code if avail", // B6
      "Mô tả hàng hóa*\nDescription of Goods", // C6
      "Tổng trọng lượng*\nGross weight", // D6
      "Kích thước/thể tích *\nDimension/tonnage", // E6
      "Số hiệu cont\nCont. number", // F6
      "Số seal cont\nSeal number", // G6
    ];

    // Đảm bảo dòng 6 được định dạng chính xác
    worksheet.spliceRows(6, 1); // Xóa dòng cũ tại vị trí 6 (nếu có) để đảm bảo không có xung đột

    // Thêm tiêu đề bảng 2
    const secondHeaderRow = worksheet.addRow(secondHeader);

    // Định dạng tiêu đề bảng 2
    secondHeaderRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 }; // Font trắng, chữ in đậm
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true, // Tự động xuống dòng nếu quá dài
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "0070C0" }, // Màu nền xanh
      };

      // Tạo viền xung quanh ô
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };

      // Đặt độ rộng cột
      worksheet.getColumn(colNumber + 2).width = 25; // Độ rộng tương ứng với cột (thêm 2 vì cột B bắt đầu ở index 2)
    });

    // Định dạng tiêu đề cột
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "4F81BD" },
      };
    });

    // Tùy chỉnh độ rộng cột
    worksheet.columns = columnHeaders.map((header) => ({
      header: header,
      width: Math.max(header.length, 35),
    }));

    // Điền dữ liệu lấy từ AI vào các ô tương ứng
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
      {
        position: "C7",
        key: "Description of Goods",
        header: "Description of Goods",
      },
      { position: "E4", key: "Consignor/Shipper", header: "Consignor/Shipper" },
      {
        position: "F4",
        key: "Consigned to Order of",
        header: "Consigned to Order of",
      },
      { position: "K4", key: "Port of Loading", header: "Port of Loading" },
      { position: "L4", key: "Port of Discharge", header: "Port of Discharge" },
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
      { position: "F7", key: "Container No.", header: "Container No." },
      { position: "G7", key: "Seal No.", header: "Seal No." },
      { position: "D7", key: "Gross Weight", header: "Gross Weight" },
      { position: "E7", key: "CBM/Volume", header: "CBM/Volume" },
      {
        position: "P4",
        key: "Place and Date of Issue",
        header: "Place and Date of Issue",
      },
      { position: "D4", key: "Gross Weight", header: "Gross Weight" },
      { position: "V4", key: "Gross Weight", header: "Gross Weight" },
      {
        position: "S4",
        key: "Place and Date of Issue",
        header: "Place and Date of Issue",
      },
      {
        position: "R4",
        key: "Place and Date of Issue",
        header: "Place and Date of Issue",
      },
      {
        position: "P4",
        key: "Place and Date of Issue",
        header: "Place and Date of Issue",
      },
      { position: "J4", key: "Port of Discharge", header: "Port of Discharge" },
      { position: "G4", key: "Notify Party", header: "Notify Party" },
    ];

    fieldsMapping.forEach(({ position, key, header }) => {
      const value = aiResponse[key] || "Not Available"; // Thay 'Not Available' bằng dữ liệu mặc định của bạn nếu có
      worksheet.getCell(position).value = value;
      worksheet.getCell(position).font = {
        bold: true,
        color: { argb: "FF000000" },
      };
      worksheet.getCell(position).alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      worksheet.getCell(position).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "E7E6E6" },
      };
    });

    // Các trường dữ liệu bổ sung
    const additionalFields = [
      { position: "A4", value: "1", header: "STT (*)" },
      { position: "B4", value: "không cần điền", header: "Số hồ sơ" },
      { position: "C4", value: "2024", header: "Năm đăng ký hồ sơ" },
      { position: "D4", value: "CN01", header: "Chức năng của chứng từ" },
      { position: "H4", value: "không điền", header: "Người được thông báo 2" },
      {
        position: "I4",
        value: "không điền",
        header: "Mã Cảng chuyển tải/quá cảnh",
      },
      { position: "N4", value: "CFS-CFS", header: "Loại hàng" },
      {
        position: "R4",
        value: "Place and Date of Issue",
        header: "Ngày phát hành vận đơn gốc",
      },
      { position: "S4", value: "không điền", header: "Ngày khởi hành" },
      { position: "W4", value: "KGM", header: "Đơn vị tính tổng trọng lượng" },
      { position: "X4", value: "không điền", header: "Ghi chú" },
    ];

    additionalFields.forEach(({ position, value, header }) => {
      worksheet.getCell(position).value = value;
      worksheet.getCell(position).font = {
        bold: true,
        color: { argb: "FF000000" },
      };
      worksheet.getCell(position).alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      worksheet.getCell(position).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "E7E6E6" },
      };
    });

    // Lưu file Excel
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Danh_Sach_Van_Don_Gom_Hang.xlsx";
    link.click();
  } catch (error) {
    console.error("Error exporting Excel file:", error);
  }
};
