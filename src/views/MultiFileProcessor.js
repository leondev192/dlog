// import React, { useState } from "react";
// import axios from "axios";
// import * as pdfjsLib from "pdfjs-dist";
// import { Spin, Card, Button, Typography, message, Divider, Upload } from "antd";
// import { UploadOutlined } from "@ant-design/icons";
// import ExcelJS from "exceljs";
// import "pdfjs-dist/build/pdf.worker.entry";
// import "../styles/MultiFileProcessor.css";

// const COHERE_API_KEY = "isNPQuOHFfylkkIHoThFtvQVTt79ZnQv4AwXOl2E";
// const GOOGLE_VISION_API_KEY = "AIzaSyBQpg9s-125r-xeyOG5N3dqNDY9mdkLIQw";
// const { Title, Paragraph } = Typography;

// const MultiFileProcessor = () => {
//   const [selectedFiles, setSelectedFiles] = useState([]);
//   const [aiResponse, setAiResponse] = useState("");
//   const [loading, setLoading] = useState(false);

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
//         }

//         results.push(fileText);

//         if (results.length === selectedFiles.length) {
//           await handleAskAI(results.join("\n\n")); // Trigger AI after all OCR is done
//           setLoading(false);
//         }
//       };
//       reader.readAsArrayBuffer(file);
//     }
//   };

//   const handleAskAI = async (combinedText) => {
//     try {
//       const response = await axios.post(
//         "https://api.cohere.ai/v1/generate",
//         {
//           model: "command-xlarge-nightly",
//           prompt: `Extract the following information from the text provided, formatting each detail on a new line and omitting unnecessary information (such as telephone and fax numbers unless specifically requested). Use the examples for clarity:\n

// 1. Vận đơn chính (M-B/L): …(example PLN00203022)
// 2. Bill of Lading No.: …(example HCMBKK029112022)
// 3. Description of Goods (extract only the description): …(example FABRIC 100 PCT. POLYESTER W: 114 CM)
// 4. Consignor/Shipper (include only company name and address): …(example PANALPINA WORLD TRANSPORT (VIETNAM) CO., LTD., 3/F HAI AU BUILDING 39B TRUONG SON ST, TAN BINH, HCMC, VIETNAM)
// 5. Consigned to Order of (include only company name and address): …(example PANALPINA WORLD TRANSPORT (VIETNAM), SIRINRAT BUILDING, 14TH FLOOR 3388/47-49 NAMA IV ROAD KLONGTON, KLONGTOEY BANGKOK 10110)
// 6. Notify Party (include only company name and address): …(example SAME AS ABOVE)
// 7. Port of Loading (convert to port code using the table below if matched): …(example VNCLI)
// 8. Port of Discharge (convert to port code using the table below if matched): …(example THBKK)
// 9. Place of Delivery: …(example BANGKOK CFS)
// 10. Number of Packages (extract only the quantity): …(example 1)
// 11. Kind of Packages (convert to code using the table below if matched): …(example CT)
// 12. Container No. (extract only the container number): …(example CSLU2082865)
// 13. Seal No. (extract only the seal number): …(example 21567932)
// 14. Gross Weight (extract only the number): …(example 64.64)
// 15. CBM/Volume (extract only the number): …(example 1.000)
// 16. Place and Date of Issue (include only the date of issue): …(example 01 DEC, 2022)\n\n

// Use the following codes to convert ports of loading and discharge:\n
// - YOKOHAMA => JPYOK
// - HO CHI MINH => VNCLI
// - CAT LAI => VNCLI
// - CAI MEP => VNCMT
// - BANGKOK => THBKK
// - TAICHUNG => TWTXG

// Use the following codes to convert kinds of packages:\n
// - CTNS S.T.C => CT
// - PALS S.T.C => PL
// - ROLS S.T.C => RL
// - PKGS S.T.C => PK

// Please extract these details from the provided data, ensuring that both "Port of Loading" and "Port of Discharge" fields are replaced with the corresponding codes where applicable, that "Kind of Packages" is replaced with its corresponding code, and that both "Number and Kind of Packages, Description of Goods" and "Container & Seal No." are divided into separate fields as specified:\n\n${combinedText}`,
//           max_tokens: 1000,
//           temperature: 0,
//         },
//         {
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${COHERE_API_KEY}`,
//           },
//         }
//       );

//       if (response.data && response.data.generations) {
//         setAiResponse(response.data.generations[0].text.trim());
//       } else {
//         throw new Error("No response from AI.");
//       }
//     } catch (error) {
//       message.error("Error from AI API");
//     }
//   };
//   const fillExcelTemplate = async () => {
//     if (!aiResponse) {
//       message.error("Please run AI processing to get the data.");
//       return;
//     }

//     try {
//       // Create a new workbook and worksheet
//       const workbook = new ExcelJS.Workbook();
//       const worksheet = workbook.addWorksheet("Danh Sách Vận Đơn Gom Hàng");

//       // Merge and format the main header
//       worksheet.mergeCells("A1:X1");
//       worksheet.getCell("A1").value =
//         "DANH SÁCH VẬN ĐƠN GOM HÀNG (List of House bill of lading)";
//       worksheet.getCell("A1").alignment = {
//         vertical: "middle",
//         horizontal: "center",
//       };
//       worksheet.getCell("A1").font = { bold: true, size: 14 };

//       // Define headers across rows 2 and 3 as per your template layout
//       const headersRow2 = [
//         "STT (*)",
//         "Số hồ sơ",
//         "Năm đăng ký hồ sơ",
//         "Chức năng của chứng từ",
//         "Người gửi hàng*",
//         "Người nhận hàng*",
//         "Người được thông báo 1",
//         "Người được thông báo 2",
//         "Mã Cảng chuyển tải/quá cảnh",
//         "Mã Cảng giao hàng/đến đích",
//         "Mã Cảng xếp hàng",
//         "Mã Cảng dỡ hàng",
//         "Địa điểm giao hàng*",
//         "Loại hàng*",
//         "Số vận đơn *",
//         "Ngày phát hành vận đơn *",
//         "Số vận đơn gốc*",
//         "Ngày phát hành vận đơn gốc*",
//         "Ngày khởi hành*",
//         "Tổng số kiện*",
//         "Loại kiện*",
//         "Tổng trọng lượng",
//         "Đơn vị tính tổng trọng lượng",
//         "Ghi chú",
//       ];

//       const headersRow3 = [
//         "No",
//         "Documents No",
//         "Documents Year",
//         "Document's function",
//         "Shipper",
//         "Consignee",
//         "Notify Party 1",
//         "Notify Party 2",
//         "Code of Port of transhipment/transit",
//         "Final destination",
//         "Code of Port of Loading",
//         "Port of unloading/discharging",
//         "Place of Delivery",
//         "Cargo Type/Terms of Shipment",
//         "Bill of lading number",
//         "Date of house bill of lading",
//         "Master bill of lading number",
//         "Date of master bill of lading",
//         "Departure date",
//         "Number of packages",
//         "Kind of packages",
//         "Total gross weight",
//         "Total gross weight unit",
//         "Remark",
//       ];

//       worksheet.getRow(2).values = headersRow2;
//       worksheet.getRow(3).values = headersRow3;

//       // Apply styling for header rows
//       [2, 3].forEach((rowNumber) => {
//         worksheet.getRow(rowNumber).eachCell((cell) => {
//           cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
//           cell.alignment = {
//             vertical: "middle",
//             horizontal: "center",
//             wrapText: true,
//           };
//           cell.fill = {
//             type: "pattern",
//             pattern: "solid",
//             fgColor: { argb: "FF4F81BD" },
//           };
//           cell.border = {
//             top: { style: "thin" },
//             left: { style: "thin" },
//             bottom: { style: "thin" },
//             right: { style: "thin" },
//           };
//         });
//       });

//       // Set row heights for header rows
//       worksheet.getRow(2).height = 25;
//       worksheet.getRow(3).height = 25;

//       // Map data fields to corresponding cells in the template
//       const fieldMappings = {
//         "Vận đơn chính (M-B/L)": "P6",
//         "Bill of Lading No.": "Q6",
//         "Description of Goods": "C6",
//         "Consignor/Shipper": "E6",
//         "Consigned to Order of": "F6",
//         "Notify Party": "G6",
//         "Port of Loading": "K6",
//         "Port of Discharge": "L6",
//         "Place of Delivery": "M6",
//         "Number of Packages": "T6",
//         "Kind of Packages": "U6",
//         "Container No.": "H6",
//         "Seal No.": "I6",
//         "Gross Weight": "V6",
//         "CBM/Volume": "W6",
//         "Place and Date of Issue": "R6",
//       };

//       // Extract data using regex patterns from AI response
//       const extractedData = {
//         "Vận đơn chính (M-B/L)":
//           aiResponse.match(/Vận đơn chính \(M-B\/L\):\s*(.*)/)?.[1] || "",
//         "Bill of Lading No.":
//           aiResponse.match(/Bill of Lading No\.\s*:\s*(.*)/)?.[1] || "",
//         "Description of Goods":
//           aiResponse.match(/Description of Goods\s*:\s*(.*)/)?.[1] || "",
//         "Consignor/Shipper":
//           aiResponse.match(/Consignor\/Shipper\s*:\s*(.*)/)?.[1] || "",
//         "Consigned to Order of":
//           aiResponse.match(/Consigned to Order of\s*:\s*(.*)/)?.[1] || "",
//         "Notify Party": aiResponse.match(/Notify Party\s*:\s*(.*)/)?.[1] || "",
//         "Port of Loading":
//           aiResponse.match(/Port of Loading\s*:\s*(.*)/)?.[1] || "",
//         "Port of Discharge":
//           aiResponse.match(/Port of Discharge\s*:\s*(.*)/)?.[1] || "",
//         "Place of Delivery":
//           aiResponse.match(/Place of Delivery\s*:\s*(.*)/)?.[1] || "",
//         "Number of Packages":
//           aiResponse.match(/Number of Packages\s*:\s*(\d+)/)?.[1] || "",
//         "Kind of Packages":
//           aiResponse.match(/Kind of Packages\s*:\s*(.*)/)?.[1] || "",
//         "Container No.":
//           aiResponse.match(/Container No\.\s*:\s*(.*)/)?.[1] || "",
//         "Seal No.": aiResponse.match(/Seal No\.\s*:\s*(.*)/)?.[1] || "",
//         "Gross Weight":
//           aiResponse.match(/Gross Weight\s*:\s*(\d+\.\d+)/)?.[1] || "",
//         "CBM/Volume":
//           aiResponse.match(/CBM\/Volume\s*:\s*(\d+\.\d+)/)?.[1] || "",
//         "Place and Date of Issue":
//           aiResponse.match(/Place and Date of Issue\s*:\s*(.*)/)?.[1] || "",
//       };

//       // Populate data into corresponding cells
//       for (const [field, cellAddress] of Object.entries(fieldMappings)) {
//         worksheet.getCell(cellAddress).value = extractedData[field];
//         worksheet.getCell(cellAddress).alignment = {
//           vertical: "middle",
//           horizontal: "center",
//           wrapText: true,
//         };
//         worksheet.getCell(cellAddress).border = {
//           top: { style: "thin" },
//           left: { style: "thin" },
//           bottom: { style: "thin" },
//           right: { style: "thin" },
//         };
//       }

//       // Adjust column widths to prevent text from getting cut off
//       worksheet.columns.forEach((column) => {
//         column.width = 20; // Set a standard width, adjust if necessary for specific columns
//       });

//       // Write the workbook to a buffer and export as a downloadable Excel file
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

//   return (
//     <div className="multi-file-processor">
//       <Card
//         title="Multi PDF Upload and AI Data Processor"
//         bordered={false}
//         className="main-card"
//       >
//         <Title level={4} className="title">
//           Upload and Analyze Multiple PDFs
//         </Title>

//         <Upload
//           multiple
//           accept=".pdf"
//           onChange={handleFileChange}
//           fileList={selectedFiles.map((file) => ({
//             uid: file.uid,
//             name: file.name,
//             status: "done",
//           }))}
//           beforeUpload={() => false}
//           className="upload-section"
//         >
//           <Button icon={<UploadOutlined />}>Select PDF Files</Button>
//         </Upload>

//         <Divider />

//         <Button
//           type="primary"
//           onClick={handleFileUpload}
//           disabled={loading}
//           className="process-button"
//         >
//           {loading ? <Spin /> : "Upload, Extract, and Process"}
//         </Button>

//         {aiResponse && (
//           <Card
//             title="AI Extracted Information"
//             bordered
//             className="ai-response-card"
//           >
//             <Paragraph style={{ whiteSpace: "pre-line" }}>
//               {aiResponse}
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

import React, { useState } from "react";
import axios from "axios";
import {
  Spin,
  Card,
  Button,
  Typography,
  message,
  Divider,
  Upload,
  Progress,
} from "antd";
import { UploadOutlined, LoadingOutlined } from "@ant-design/icons";
import ExcelJS from "exceljs";
import "../assets/css/MultiFileProcessor.css";
import * as pdfjsLib from "pdfjs-dist";

// Sử dụng CDN của phiên bản PDF.js 2.10.377 để tải worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js`;

const COHERE_API_KEY = "isNPQuOHFfylkkIHoThFtvQVTt79ZnQv4AwXOl2E";
const GOOGLE_VISION_API_KEY = "AIzaSyBQpg9s-125r-xeyOG5N3dqNDY9mdkLIQw";
const { Title, Paragraph } = Typography;

const MultiFileProcessor = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [aiResponse, setAiResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = ({ fileList }) => {
    setSelectedFiles(fileList.map((file) => file.originFileObj));
    setAiResponse("");
  };

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) {
      message.error("Please select PDF files.");
      return;
    }

    setLoading(true);
    setProgress(0);
    const results = [];

    for (const file of selectedFiles) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const pdfData = new Uint8Array(reader.result);
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

            const textAnnotations = response.data.responses[0].textAnnotations;
            fileText += `\n--- Page ${i} ---\n${
              textAnnotations ? textAnnotations[0].description : "No text found"
            }\n`;
          } catch (error) {
            console.error(
              `Error processing page ${i} of file ${file.name}:`,
              error
            );
            fileText += `\n--- Page ${i} ---\nError processing page.\n`;
          }
          setProgress(
            Math.round(((i / pdf.numPages) * 100) / selectedFiles.length)
          );
        }

        results.push(fileText);

        if (results.length === selectedFiles.length) {
          await handleAskAI(results.join("\n\n"));
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleAskAI = async (combinedText) => {
    try {
      const response = await axios.post(
        "https://api.cohere.ai/v1/generate",
        {
          model: "command-xlarge-nightly",
          prompt: `Extract the following information from the text provided, formatting each detail on a new line and omitting unnecessary information (such as telephone and fax numbers unless specifically requested). Use the examples for clarity:\n

        1. Vận đơn chính (M-B/L): …(example PLN00203022)
        2. Bill of Lading No.: …(example HCMBKK029112022)
        3. Description of Goods (extract only the description): …(example FABRIC 100 PCT. POLYESTER W: 114 CM)
        4. Consignor/Shipper (include only company name and address): …(example PANALPINA WORLD TRANSPORT (VIETNAM) CO., LTD., 3/F HAI AU BUILDING 39B TRUONG SON ST, TAN BINH, HCMC, VIETNAM)
        5. Consigned to Order of (include only company name and address): …(example PANALPINA WORLD TRANSPORT (VIETNAM), SIRINRAT BUILDING, 14TH FLOOR 3388/47-49 NAMA IV ROAD KLONGTON, KLONGTOEY BANGKOK 10110)
        6. Notify Party (include only company name and address): …(example SAME AS ABOVE)
        7. Port of Loading (convert to port code using the table below if matched): …(example VNCLI)
        8. Port of Discharge (convert to port code using the table below if matched): …(example THBKK)
        9. Place of Delivery: …(example BANGKOK CFS)
        10. Number of Packages (extract only the quantity): …(example 1)
        11. Kind of Packages (convert to code using the table below if matched): …(example CT)
        12. Container No. (extract only the container number): …(example CSLU2082865)
        13. Seal No. (extract only the seal number): …(example 21567932)
        14. Gross Weight (extract only the number): …(example 64.64)
        15. CBM/Volume (extract only the number): …(example 1.000)
        16. Place and Date of Issue (include only the date of issue): …(example 01 DEC, 2022)\n\n

        Use the following codes to convert ports of loading and discharge:\n
        - YOKOHAMA => JPYOK
        - HO CHI MINH => VNCLI
        - CAT LAI => VNCLI
        - CAI MEP => VNCMT
        - BANGKOK => THBKK
        - TAICHUNG => TWTXG

        Use the following codes to convert kinds of packages:\n
        - CTNS S.T.C => CT
        - PALS S.T.C => PL
        - ROLS S.T.C => RL
        - PKGS S.T.C => PK

        Please extract these details from the provided data, ensuring that both "Port of Loading" and "Port of Discharge" fields are replaced with the corresponding codes where applicable, that "Kind of Packages" is replaced with its corresponding code, and that both "Number and Kind of Packages, Description of Goods" and "Container & Seal No." are divided into separate fields as specified:\n\n${combinedText}`,
          max_tokens: 1000,
          temperature: 0,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${COHERE_API_KEY}`,
          },
        }
      );

      if (response.data && response.data.generations) {
        setAiResponse(response.data.generations[0].text.trim());
      } else {
        throw new Error("No response from AI.");
      }
    } catch (error) {
      message.error("Error from AI API");
    }
  };

  const fillExcelTemplate = async () => {
    if (!aiResponse) {
      message.error("Please run AI processing to get the data.");
      return;
    }

    try {
      // Create a new workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Danh Sách Vận Đơn Gom Hàng");

      // Merge and format the main header
      worksheet.mergeCells("A1:X1");
      worksheet.getCell("A1").value =
        "DANH SÁCH VẬN ĐƠN GOM HÀNG (List of House bill of lading)";
      worksheet.getCell("A1").alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      worksheet.getCell("A1").font = { bold: true, size: 14 };

      // Define headers across rows 2 and 3 as per your template layout
      const headersRow2 = [
        "STT (*)",
        "Số hồ sơ",
        "Năm đăng ký hồ sơ",
        "Chức năng của chứng từ",
        "Người gửi hàng*",
        "Người nhận hàng*",
        "Người được thông báo 1",
        "Người được thông báo 2",
        "Mã Cảng chuyển tải/quá cảnh",
        "Mã Cảng giao hàng/đến đích",
        "Mã Cảng xếp hàng",
        "Mã Cảng dỡ hàng",
        "Địa điểm giao hàng*",
        "Loại hàng*",
        "Số vận đơn *",
        "Ngày phát hành vận đơn *",
        "Số vận đơn gốc*",
        "Ngày phát hành vận đơn gốc*",
        "Ngày khởi hành*",
        "Tổng số kiện*",
        "Loại kiện*",
        "Tổng trọng lượng",
        "Đơn vị tính tổng trọng lượng",
        "Ghi chú",
      ];

      const headersRow3 = [
        "No",
        "Documents No",
        "Documents Year",
        "Document's function",
        "Shipper",
        "Consignee",
        "Notify Party 1",
        "Notify Party 2",
        "Code of Port of transhipment/transit",
        "Final destination",
        "Code of Port of Loading",
        "Port of unloading/discharging",
        "Place of Delivery",
        "Cargo Type/Terms of Shipment",
        "Bill of lading number",
        "Date of house bill of lading",
        "Master bill of lading number",
        "Date of master bill of lading",
        "Departure date",
        "Number of packages",
        "Kind of packages",
        "Total gross weight",
        "Total gross weight unit",
        "Remark",
      ];

      worksheet.getRow(2).values = headersRow2;
      worksheet.getRow(3).values = headersRow3;

      // Apply styling for header rows
      [2, 3].forEach((rowNumber) => {
        worksheet.getRow(rowNumber).eachCell((cell) => {
          cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          cell.alignment = {
            vertical: "middle",
            horizontal: "center",
            wrapText: true,
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF4F81BD" },
          };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });

      // Map data fields to corresponding cells in the template
      const fieldMappings = {
        "Vận đơn chính (M-B/L)": "P6",
        "Bill of Lading No.": "Q6",
        "Description of Goods": "C6",
        "Consignor/Shipper": "E6",
        "Consigned to Order of": "F6",
        "Notify Party": "G6",
        "Port of Loading": "K6",
        "Port of Discharge": "L6",
        "Place of Delivery": "M6",
        "Number of Packages": "T6",
        "Kind of Packages": "U6",
        "Container No.": "H6",
        "Seal No.": "I6",
        "Gross Weight": "V6",
        "CBM/Volume": "W6",
        "Place and Date of Issue": "R6",
      };

      // Extract data using regex patterns from AI response
      const extractedData = {
        "Vận đơn chính (M-B/L)":
          aiResponse.match(/Vận đơn chính \(M-B\/L\):\s*(.*)/)?.[1] || "",
        "Bill of Lading No.":
          aiResponse.match(/Bill of Lading No\.\s*:\s*(.*)/)?.[1] || "",
        "Description of Goods":
          aiResponse.match(/Description of Goods\s*:\s*(.*)/)?.[1] || "",
        "Consignor/Shipper":
          aiResponse.match(/Consignor\/Shipper\s*:\s*(.*)/)?.[1] || "",
        "Consigned to Order of":
          aiResponse.match(/Consigned to Order of\s*:\s*(.*)/)?.[1] || "",
        "Notify Party": aiResponse.match(/Notify Party\s*:\s*(.*)/)?.[1] || "",
        "Port of Loading":
          aiResponse.match(/Port of Loading\s*:\s*(.*)/)?.[1] || "",
        "Port of Discharge":
          aiResponse.match(/Port of Discharge\s*:\s*(.*)/)?.[1] || "",
        "Place of Delivery":
          aiResponse.match(/Place of Delivery\s*:\s*(.*)/)?.[1] || "",
        "Number of Packages":
          aiResponse.match(/Number of Packages\s*:\s*(\d+)/)?.[1] || "",
        "Kind of Packages":
          aiResponse.match(/Kind of Packages\s*:\s*(.*)/)?.[1] || "",
        "Container No.":
          aiResponse.match(/Container No\.\s*:\s*(.*)/)?.[1] || "",
        "Seal No.": aiResponse.match(/Seal No\.\s*:\s*(.*)/)?.[1] || "",
        "Gross Weight":
          aiResponse.match(/Gross Weight\s*:\s*(\d+\.\d+)/)?.[1] || "",
        "CBM/Volume":
          aiResponse.match(/CBM\/Volume\s*:\s*(\d+\.\d+)/)?.[1] || "",
        "Place and Date of Issue":
          aiResponse.match(/Place and Date of Issue\s*:\s*(.*)/)?.[1] || "",
      };

      // Populate data into corresponding cells
      for (const [field, cellAddress] of Object.entries(fieldMappings)) {
        worksheet.getCell(cellAddress).value = extractedData[field];
        worksheet.getCell(cellAddress).alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };
        worksheet.getCell(cellAddress).border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }

      // Adjust column widths to prevent text from getting cut off
      worksheet.columns.forEach((column) => {
        column.width = 20; // Set a standard width, adjust if necessary for specific columns
      });

      // Write the workbook to a buffer and export as a downloadable Excel file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "Danh_Sach_Van_Don_Gom_Hang.xlsx";
      link.click();
    } catch (error) {
      console.error("Error creating Excel file:", error);
      message.error("Error exporting the Excel file.");
    }
  };

  return (
    <div className="multi-file-processor">
      <Card
        title="Multi PDF Upload and AI Data Processor"
        bordered={false}
        className="main-card animate__animated animate__fadeIn"
      >
        <Title level={4} className="title">
          Upload and Analyze Multiple PDFs
        </Title>

        <Upload
          multiple
          accept=".pdf"
          onChange={handleFileChange}
          fileList={selectedFiles.map((file) => ({
            uid: file.uid,
            name: file.name,
            status: "done",
          }))}
          beforeUpload={() => false}
          className="upload-section"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Button
              icon={<UploadOutlined />}
              className="upload-button animate__animated animate__pulse animate__infinite"
            >
              Select PDF Files
            </Button>
          </div>
        </Upload>

        <Divider />

        <Button
          type="primary"
          onClick={handleFileUpload}
          disabled={loading}
          className="process-button animate__animated animate__bounceIn"
        >
          {loading ? (
            <Spin indicator={<LoadingOutlined spin />} />
          ) : (
            "Upload, Extract, and Process"
          )}
        </Button>

        {loading && (
          <Progress
            percent={progress}
            status="active"
            className="progress-bar animate__animated animate__fadeIn"
          />
        )}

        {aiResponse && (
          <Card
            title="AI Extracted Information"
            bordered
            className="ai-response-card animate__animated animate__fadeInUp"
          >
            <Paragraph style={{ whiteSpace: "pre-line" }}>
              {aiResponse}
            </Paragraph>
            <Button
              type="primary"
              onClick={fillExcelTemplate}
              className="export-button animate__animated animate__pulse animate__infinite"
            >
              Export to Excel Template
            </Button>
          </Card>
        )}
      </Card>
    </div>
  );
};

export default MultiFileProcessor;
