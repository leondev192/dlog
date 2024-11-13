import React, { useState } from "react";
import axios from "axios";
import * as pdfjsLib from "pdfjs-dist";
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
import "pdfjs-dist/build/pdf.worker.entry";
import "../assets/css/MultiFileProcessor.css";

const GOOGLE_VISION_API_KEY = "AIzaSyBQpg9s-125r-xeyOG5N3dqNDY9mdkLIQw";
const GEMINI_API_KEY = "AIzaSyBYJaNHLRJsPIPv0ZaJF6d1FEh_jzHN_Oo";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
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
    const prompt = createPrompt(combinedText);

    try {
      const response = await axios.post(
        GEMINI_API_URL,
        {
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.candidates && response.data.candidates.length > 0) {
        const pageData = parseAIResponse(
          response.data.candidates[0].content.parts[0].text.trim()
        );

        try {
          const mergedData = mergeData(aiResponse, pageData);
          setAiResponse(mergedData);
        } catch (error) {
          message.error(error.message);
          setLoading(false);
          return;
        }
      } else {
        throw new Error("No response from Gemini AI.");
      }
    } catch (error) {
      console.error("Error communicating with Gemini API:", error);
      message.error("Error from AI API");
    }
  };

  const createPrompt = (text) => {
    return `Extract the following information from the text provided, formatting each detail on a new line and omitting unnecessary information (such as telephone and fax numbers unless specifically requested). Use the examples for clarity:

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
14. Gross Weight (extract only the numeric value, ensuring commas as thousand separators are removed and decimal points are retained for fractional values): …(example 1899.58)
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
${text}`;
  };
  const fillExcelTemplate = async () => {
    if (!aiResponse) {
      message.error("Please run AI processing to get the data.");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Danh Sách Vận Đơn Gom Hàng");

      worksheet.mergeCells("A1:X1");
      worksheet.getCell("A1").value =
        "DANH SÁCH VẬN ĐƠN GOM HÀNG (List of House bill of lading)";
      worksheet.getCell("A1").alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      worksheet.getCell("A1").font = { bold: true, size: 14 };

      const fieldMappings = {
        "Vận đơn chính (M-B/L)": "A2",
        "Bill of Lading No.": "B2",
        "Description of Goods": "C2",
        "Consignor/Shipper": "D2",
        "Consigned to Order of": "E2",
        "Notify Party": "F2",
        "Port of Loading": "G2",
        "Port of Discharge": "H2",
        "Đến cảng (Terminal)": "I2",
        "Number of Packages": "J2",
        "Kind of Packages": "K2",
        "Container No.": "L2",
        "Seal No.": "M2",
        "Gross Weight": "N2",
        "CBM/Volume": "O2",
        "Place and Date of Issue": "P2", // Đảm bảo tiêu đề đầy đủ
      };

      const extractedData = parseAIResponse(aiResponse);

      for (const [key, cellAddress] of Object.entries(fieldMappings)) {
        worksheet.getCell(cellAddress).value =
          extractedData[key] || "Not found";
      }

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
  const mergeData = (existingData, newData) => {
    if (!existingData) return newData;

    // Kiểm tra dữ liệu có khớp hay không
    const isConsistent = Object.keys(existingData).every(
      (key) =>
        existingData[key] === newData[key] || newData[key] === "Not found"
    );

    if (!isConsistent) {
      throw new Error(
        "Inconsistent data detected across pages. Please verify."
      );
    }

    return { ...existingData, ...newData };
  };

  const parseAIResponse = (response) => {
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
      data[key] = match ? match[1].trim() : null;
    }
    return data;
  };

  return (
    <div className="multi-file-processor">
      <Card title="Multi PDF Upload and AI Data Processor" bordered={false}>
        <Title level={4}>Upload and Analyze Multiple PDFs</Title>
        <Upload
          multiple
          accept=".pdf"
          onChange={handleFileChange}
          onRemove={(file) => {
            const updatedFiles = selectedFiles.filter(
              (selectedFile) => selectedFile.uid !== file.uid
            );
            setSelectedFiles(updatedFiles);
            setAiResponse("");
            setProgress(0);

            if (updatedFiles.length === 0) {
              message.info("No files selected. Ready for new upload.");
            }
          }}
          fileList={selectedFiles
            .filter((file) => file) // Bỏ qua các file bị undefined/null
            .map((file, index) => ({
              uid: index.toString(),
              name: file.name || `Unnamed File ${index + 1}`, // Đảm bảo có tên mặc định nếu `name` undefined
              status: "done",
            }))}
          beforeUpload={() => false}
        >
          <Button icon={<UploadOutlined />}>Select PDF Files</Button>
        </Upload>

        <Divider />
        <Button type="primary" onClick={handleFileUpload} disabled={loading}>
          {loading ? (
            <Spin indicator={<LoadingOutlined spin />} />
          ) : (
            "Upload, Extract, and Process"
          )}
        </Button>
        {loading && <Progress percent={progress} />}
        {aiResponse && (
          <Card title="AI Extracted Information" bordered>
            <Paragraph style={{ whiteSpace: "pre-line" }}>
              {Object.entries(aiResponse)
                .map(([key, value]) => `${key}: ${value}`)
                .join("\n")}
            </Paragraph>

            <Button type="primary" onClick={fillExcelTemplate}>
              Export to Excel Template
            </Button>
          </Card>
        )}
      </Card>
    </div>
  );
};

export default MultiFileProcessor;
