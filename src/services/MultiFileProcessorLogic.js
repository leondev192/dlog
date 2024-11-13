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
    message.error("No data available for export.");
    return;
  }

  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Danh Sách Vận Đơn Gom Hàng");

    const headers = [
      "Vận đơn chính (M-B/L)",
      "Bill of Lading No.",
      "Description of Goods",
      "Consignor/Shipper",
      "Consigned to Order of",
      "Notify Party",
      "Port of Loading",
      "Port of Discharge",
      "Đến cảng (Terminal)",
      "Number of Packages",
      "Kind of Packages",
      "Container No.",
      "Seal No.",
      "Gross Weight",
      "CBM/Volume",
      "Place and Date of Issue",
    ];

    worksheet.addRow(headers);

    const dataRow = headers.map(
      (header) => aiResponse[header] || "Not Available"
    );
    worksheet.addRow(dataRow);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Danh_Sach_Van_Don_Gom_Hang.xlsx";
    link.click();
  } catch (error) {
    console.error("Error exporting Excel:", error);
    message.error("Error exporting the Excel file.");
  }
};
