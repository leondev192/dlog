// import React, { useState } from "react";
// import axios from "axios";
// import * as pdfjsLib from "pdfjs-dist";
// import {
//   Spin,
//   Card,
//   Button,
//   Typography,
//   message,
//   Divider,
//   Upload,
//   Progress,
// } from "antd";
// import { UploadOutlined, LoadingOutlined } from "@ant-design/icons";
// import ExcelJS from "exceljs";
// import "pdfjs-dist/build/pdf.worker.entry";
// import "../assets/css/MultiFileProcessor.css";

// const GOOGLE_VISION_API_KEY = "AIzaSyBQpg9s-125r-xeyOG5N3dqNDY9mdkLIQw";
// const GEMINI_API_KEY = "AIzaSyBYJaNHLRJsPIPv0ZaJF6d1FEh_jzHN_Oo";
// const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
// const { Title, Paragraph } = Typography;

// const MultiFileProcessor = () => {
//   const [selectedFiles, setSelectedFiles] = useState([]);
//   const [aiResponse, setAiResponse] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [progress, setProgress] = useState(0);

//   const handleFileChange = ({ fileList }) => {
//     setSelectedFiles(fileList.map((file) => file.originFileObj));
//     setAiResponse("");
//   };

//   const handleFileUpload = async () => {
//     if (selectedFiles.length === 0) {
//       message.error("Please select PDF files.");
//       return;
//     }

//     setLoading(true);
//     setProgress(0);
//     const results = [];

//     for (const file of selectedFiles) {
//       const reader = new FileReader();
//       reader.onloadend = async () => {
//         const pdfData = new Uint8Array(reader.result);
//         const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
//         let fileText = "";

//         for (let i = 1; i <= pdf.numPages; i++) {
//           const page = await pdf.getPage(i);
//           const viewport = page.getViewport({ scale: 2 });
//           const canvas = document.createElement("canvas");
//           const context = canvas.getContext("2d");
//           canvas.width = viewport.width;
//           canvas.height = viewport.height;

//           await page.render({ canvasContext: context, viewport }).promise;

//           const imageBase64 = canvas
//             .toDataURL("image/png")
//             .replace(/^data:image\/png;base64,/, "");

//           try {
//             const response = await axios.post(
//               `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
//               {
//                 requests: [
//                   {
//                     image: { content: imageBase64 },
//                     features: [{ type: "TEXT_DETECTION" }],
//                   },
//                 ],
//               }
//             );

//             const textAnnotations = response.data.responses[0].textAnnotations;
//             fileText += `\n--- Page ${i} ---\n${
//               textAnnotations ? textAnnotations[0].description : "No text found"
//             }\n`;
//           } catch (error) {
//             console.error(
//               `Error processing page ${i} of file ${file.name}:`,
//               error
//             );
//             fileText += `\n--- Page ${i} ---\nError processing page.\n`;
//           }
//           setProgress(
//             Math.round(((i / pdf.numPages) * 100) / selectedFiles.length)
//           );
//         }

//         results.push(fileText);

//         if (results.length === selectedFiles.length) {
//           await handleAskAI(results.join("\n\n"));
//           setLoading(false);
//         }
//       };
//       reader.readAsArrayBuffer(file);
//     }
//   };

//   const handleAskAI = async (combinedText) => {
//     // Step 1: Create a prompt from the input text
//     const prompt = createPrompt(combinedText);

//     try {
//       // Step 2: Send a request to the AI API
//       const response = await axios.post(
//         GEMINI_API_URL,
//         {
//           contents: [
//             {
//               parts: [{ text: prompt }], // Prompt is embedded here
//             },
//           ],
//         },
//         {
//           headers: {
//             "Content-Type": "application/json",
//           },
//         }
//       );

//       // Step 3: Check if we received a valid response from the AI
//       if (
//         response.data &&
//         response.data.candidates &&
//         response.data.candidates.length > 0
//       ) {
//         // Extract the raw AI response text
//         const rawText =
//           response.data.candidates[0].content.parts[0].text.trim();
//         console.log("Raw AI response text:", rawText); // Log for debugging

//         // Step 4: Parse the raw text using `parseAIResponse`
//         const pageData = parseAIResponse(rawText);

//         // Step 5: Merge the parsed data with existing AI response data (if any)
//         try {
//           const mergedData = mergeData(aiResponse, pageData); // Use `mergeData` for consistency
//           console.log("Merged AI response data:", mergedData); // Debugging output
//           setAiResponse(mergedData); // Save the merged data to state
//         } catch (error) {
//           // Handle inconsistencies in the data merge
//           message.error(error.message);
//           setLoading(false);
//           return;
//         }
//       } else {
//         // If no candidates are returned, throw an error
//         throw new Error("No response from Gemini AI.");
//       }
//     } catch (error) {
//       // Step 6: Log and show an error message if the request fails
//       console.error("Error communicating with Gemini API:", error);
//       message.error("Error from AI API. Please try again later.");
//     }
//   };

//   const createPrompt = (text) => {
//     return `Extract the following information from the text provided, formatting each detail on a new line and omitting unnecessary information (such as telephone and fax numbers unless specifically requested). Use the examples for clarity:

// 1. Vận đơn chính (M-B/L): …(example PLN00203022)
// 2. Bill of Lading No.: …(example HCMBKK029112022)
// 3. Description of Goods (extract only the description): …(example FABRIC 100 PCT. POLYESTER W: 114 CM)
// 4. Consignor/Shipper (include only company name and address): …(example MAC NELS SHIPPING VIETNAM CO., LTD, 29 PHO DỌC CHINH STR, DIST 1, HOCHIMINH CITY, VIETNAM)
// 5. Consignee/Consigned to Order of (include only company name and address): …(example TO THE ORDER OF THE HOLDER SURRENDERED BBL NO. 1/DKK 290439 TO BE ISSUED BY MAC - NELS CONTAINER LINES )
// 6. Notify Party (include only company name and address): …(example PRO LOG CO., LTD, 191/14 CTL TOWEL, 28TH FLOOR, RATCHADAPISE RD., KLONG TOEY BANGKOK 10110 THAILAND)
// 7. Port of Loading (convert to port code using the table below if matched): …(example VNCLI)
// 8. Port of Discharge (convert to port code using the table below if matched): …(example THBKK)
// 9. Đến cảng (Terminal): …(example BANGKOK)
// 10. Number of Packages (extract only the quantity): …(example 1)
// 11. Kind of Packages (convert to code using the table below if matched): …(example CT)
// 12. Container No. (Extract only the container number from the contain of which file contains the information "Consignor” or “Shipper"): …(example CSLU2082865)
// 13. Seal No. (Extract only the seal number from the contain of which file contains the information "Consignor” or “Shipper"):  …(example 21567932)
// 14. Gross Weight (extract the numeric value exactly as it appears, retaining commas and periods. Remove any units like "kgs". For example, "1,899.58 kgs" should become "1,899.58"): …(example 1,899.58)
// 15. CBM/Volume (extract only the number): …(example 1.000)
// 16. Place and Date of Issue (extract only the date and format as dd/mm/yyyy): …(example 01/12/2022).

// Use the following codes to convert ports of loading and discharge:
// - YOKOHAMA => JPYOK
// - HO CHI MINH => VNCLI
// - CAT LAI => VNCLI
// - CAI MEP => VNCMT
// - BANGKOK => THBKK
// - TAICHUNG => TWTXG

// Use the following codes to convert kinds of packages:
// - CTNS S.T.C => CT
// - PALS S.T.C => PL
// - ROLS S.T.C => RL
// - PKGS S.T.C => PK

// Please extract these details from the provided data, ensuring that both "Port of Loading" and "Port of Discharge" fields are replaced with the corresponding codes where applicable, that "Kind of Packages" is replaced with its corresponding code, and that both "Number and Kind of Packages, Description of Goods" and "Container & Seal No." are divided into separate fields as specified. Additionally, only extract the "Container No." if the text contains the "Consignor/Shipper" section.
// ${text}`;
//   };
//   const fillExcelTemplate = async () => {
//     if (!aiResponse) {
//       message.error(
//         "No data available for export. Please run AI processing first."
//       );
//       return;
//     }

//     try {
//       // Create a new workbook and worksheet
//       const workbook = new ExcelJS.Workbook();
//       const worksheet = workbook.addWorksheet("Danh Sách Vận Đơn Gom Hàng");

//       // Title row
//       worksheet.mergeCells("A1:P1");
//       const titleCell = worksheet.getCell("A1");
//       titleCell.value =
//         "DANH SÁCH VẬN ĐƠN GOM HÀNG (List of House bill of lading)";
//       titleCell.font = { bold: true, size: 14 };
//       titleCell.alignment = { vertical: "middle", horizontal: "center" };
//       titleCell.fill = {
//         type: "pattern",
//         pattern: "solid",
//         fgColor: { argb: "FF4CAF50" }, // Green background
//       };

//       // Define headers
//       const headers = [
//         "Vận đơn chính (M-B/L)",
//         "Bill of Lading No.",
//         "Description of Goods",
//         "Consignor/Shipper",
//         "Consigned to Order of",
//         "Notify Party",
//         "Port of Loading",
//         "Port of Discharge",
//         "Đến cảng (Terminal)",
//         "Number of Packages",
//         "Kind of Packages",
//         "Container No.",
//         "Seal No.",
//         "Gross Weight",
//         "CBM/Volume",
//         "Place and Date of Issue",
//       ];

//       // Add header row with styling
//       const headerRow = worksheet.addRow(headers);
//       headerRow.eachCell((cell, colNumber) => {
//         cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
//         cell.fill = {
//           type: "pattern",
//           pattern: "solid",
//           fgColor: { argb: "FF2196F3" }, // Blue background
//         };
//         cell.alignment = { vertical: "middle", horizontal: "center" };
//         cell.border = {
//           top: { style: "thin" },
//           left: { style: "thin" },
//           bottom: { style: "thin" },
//           right: { style: "thin" },
//         };
//       });

//       // Extract AI response data and add it as a row
//       const dataRow = headers.map((header) => {
//         // Match headers with corresponding fields in aiResponse
//         return aiResponse[header] || "Not Available"; // Use "Not Available" if the field is missing
//       });

//       const contentRow = worksheet.addRow(dataRow);

//       // Style content row
//       contentRow.eachCell((cell, colNumber) => {
//         cell.alignment = { vertical: "middle", horizontal: "left" };
//         cell.border = {
//           top: { style: "thin" },
//           left: { style: "thin" },
//           bottom: { style: "thin" },
//           right: { style: "thin" },
//         };
//         if (colNumber % 2 === 0) {
//           cell.fill = {
//             type: "pattern",
//             pattern: "solid",
//             fgColor: { argb: "FFF5F5F5" }, // Light gray for alternate columns
//           };
//         }
//       });

//       // Adjust column widths
//       worksheet.columns.forEach((column, index) => {
//         column.width = Math.max(
//           headers[index]?.length || 10,
//           Math.min(30, (dataRow[index]?.toString().length || 10) + 2)
//         );
//       });

//       // Save and download the file
//       const buffer = await workbook.xlsx.writeBuffer();
//       const blob = new Blob([buffer], {
//         type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
//       });

//       const link = document.createElement("a");
//       link.href = URL.createObjectURL(blob);
//       link.download = "Danh_Sach_Van_Don_Gom_Hang.xlsx";
//       link.click();
//     } catch (error) {
//       console.error("Error creating Excel file:", error);
//       message.error("Error exporting the Excel file.");
//     }
//   };

//   // Merge new AI data with existing data
//   const mergeData = (existingData, newData) => {
//     if (!existingData) return newData; // If there's no existing data, just return the new data.

//     // Ensure consistency between existing and new data
//     const isConsistent = Object.keys(existingData).every(
//       (key) =>
//         existingData[key] === newData[key] || newData[key] === "Not Available"
//     );

//     if (!isConsistent) {
//       throw new Error(
//         "Inconsistent data detected across pages. Please verify."
//       );
//     }

//     return { ...existingData, ...newData };
//   };

//   const parseAIResponse = (response) => {
//     if (typeof response !== "string") {
//       console.error(
//         "parseAIResponse expects a string, but got:",
//         typeof response
//       );
//       throw new Error("Invalid AI response format. Expected a string.");
//     }

//     const patterns = {
//       "Vận đơn chính (M-B/L)": /Vận đơn chính \(M-B\/L\): (.+)/,
//       "Bill of Lading No.": /Bill of Lading No.: (.+)/,
//       "Description of Goods": /Description of Goods: (.+)/,
//       "Consignor/Shipper": /Consignor\/Shipper: (.+)/,
//       "Consigned to Order of": /Consigned to Order of: (.+)/,
//       "Notify Party": /Notify Party: (.+)/,
//       "Port of Loading": /Port of Loading: (.+)/,
//       "Port of Discharge": /Port of Discharge: (.+)/,
//       "Đến cảng (Terminal)": /Đến cảng \(Terminal\): (.+)/,
//       "Number of Packages": /Number of Packages: (.+)/,
//       "Kind of Packages": /Kind of Packages: (.+)/,
//       "Container No.": /Container No.: (.+)/,
//       "Seal No.": /Seal No.: (.+)/,
//       "Gross Weight": /Gross Weight: (.+)/,
//       "CBM/Volume": /CBM\/Volume: (.+)/,
//       "Place and Date of Issue": /Place and Date of Issue: (.+)/,
//     };

//     const data = {};
//     for (const [key, regex] of Object.entries(patterns)) {
//       const match = response.match(regex);
//       data[key] = match ? match[1].trim() : "Not Available";
//     }
//     return data;
//   };

//   return (
//     <div className="multi-file-processor">
//       <Card title="Multi PDF Upload and AI Data Processor" bordered={false}>
//         <Title level={4}>Upload and Analyze Multiple PDFs</Title>
//         <Upload
//           multiple
//           accept=".pdf"
//           onChange={handleFileChange}
//           onRemove={(file) => {
//             const updatedFiles = selectedFiles.filter(
//               (selectedFile) => selectedFile.uid !== file.uid
//             );
//             setSelectedFiles(updatedFiles);
//             setAiResponse("");
//             setProgress(0);

//             if (updatedFiles.length === 0) {
//               message.info("No files selected. Ready for new upload.");
//             }
//           }}
//           fileList={selectedFiles
//             .filter((file) => file) // Bỏ qua các file bị undefined/null
//             .map((file, index) => ({
//               uid: index.toString(),
//               name: file.name || `Unnamed File ${index + 1}`, // Đảm bảo có tên mặc định nếu `name` undefined
//               status: "done",
//             }))}
//           beforeUpload={() => false}
//         >
//           <Button icon={<UploadOutlined />}>Select PDF Files</Button>
//         </Upload>

//         <Divider />
//         <Button type="primary" onClick={handleFileUpload} disabled={loading}>
//           {loading ? (
//             <Spin indicator={<LoadingOutlined spin />} />
//           ) : (
//             "Upload, Extract, and Process"
//           )}
//         </Button>
//         {loading && <Progress percent={progress} />}
//         {aiResponse && (
//           <Card title="AI Extracted Information" bordered>
//             <Paragraph style={{ whiteSpace: "pre-line" }}>
//               {Object.entries(aiResponse)
//                 .map(([key, value]) => `${key}: ${value}`)
//                 .join("\n")}
//             </Paragraph>

//             <Button type="primary" onClick={fillExcelTemplate}>
//               Export to Excel Template
//             </Button>
//           </Card>
//         )}
//       </Card>
//     </div>
//   );
// };

// export default MultiFileProcessor;
