import React, { useState, useEffect } from "react";
import {
  Upload,
  Button,
  Progress,
  Modal,
  Typography,
  message,
  Table,
  Card,
  Space,
  Timeline,
  Descriptions,
} from "antd";
import {
  UploadOutlined,
  LoadingOutlined,
  DeleteOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import {
  extractPdfText,
  sendToGemini,
  parseAIResponse,
  mergeData,
  exportToExcel,
} from "../services/MultiFileProcessorLogic";
import "../assets/css/MultiFileProcessor.css";

const { Title, Paragraph } = Typography;

const MultiFileProcessor = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [aiResponse, setAiResponse] = useState({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const typingText =
    "Hãy tải file PDF của bạn lên, sau đó nhấn nút để bắt đầu xử lý.";
  const [typedText, setTypedText] = useState("");
  const [typingIndex, setTypingIndex] = useState(0);

  useEffect(() => {
    if (typingIndex < typingText.length) {
      const timeout = setTimeout(() => {
        setTypedText((prev) => prev + typingText[typingIndex]);
        setTypingIndex((prev) => prev + 1);
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [typingIndex]);

  const handleFileChange = ({ fileList }) => {
    const newFileList = fileList.map((file) =>
      file.originFileObj ? file.originFileObj : file
    );
    setSelectedFiles(newFileList);
    setAiResponse({});
  };

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) {
      message.error("Vui lòng chọn ít nhất một file PDF!");
      return;
    }

    setLoading(true);
    setProgress(0);
    const results = [];

    try {
      for (const file of selectedFiles) {
        const fileText = await extractPdfText(file, (percent) =>
          setProgress((prev) => prev + percent / selectedFiles.length)
        );
        results.push(fileText);
      }

      const combinedText = results.join("\n\n");
      const rawAiResponse = await sendToGemini(combinedText);
      const parsedData = parseAIResponse(rawAiResponse);
      const mergedData = mergeData(aiResponse, parsedData);
      setAiResponse(mergedData);
      message.success("Xử lý AI hoàn tất!");
      setShowModal(true);
    } catch (error) {
      console.error("Error during processing:", error);
      message.error("Đã xảy ra lỗi. Vui lòng thử lại.");
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const handleExportToExcel = async () => {
    try {
      await exportToExcel(aiResponse);
      message.success("Xuất file Excel thành công!");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      message.error("Xuất file không thành công. Vui lòng thử lại.");
    }
  };

  const renderAiResponse = () => {
    const responseKeys = Object.keys(aiResponse);

    if (responseKeys.length === 0) {
      return <p>Không có dữ liệu để hiển thị.</p>;
    }

    return (
      <Descriptions bordered column={1} size="small">
        {responseKeys.map((key) => (
          <Descriptions.Item key={key} label={key}>
            {aiResponse[key]}
          </Descriptions.Item>
        ))}
      </Descriptions>
    );
  };

  return (
    <div className="multi-file-processor">
      <Card className="main-card" bordered>
        <Title level={2} className="title">
          Bộ Xử Lý PDF AI
        </Title>
        <Paragraph>{typedText}</Paragraph>

        <Card title="Tải File Lên" bordered style={{ marginBottom: "20px" }}>
          <Upload
            multiple
            accept=".pdf"
            onChange={handleFileChange}
            fileList={selectedFiles.map((file, index) => ({
              uid: index.toString(),
              name: file.name || `File không tên ${index + 1}`,
              status: "done",
            }))}
            beforeUpload={() => false}
          >
            <Button icon={<UploadOutlined />} className="upload-button">
              Chọn File PDF
            </Button>
          </Upload>
        </Card>

        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Button
            className="process-button"
            onClick={handleFileUpload}
            disabled={loading || selectedFiles.length === 0}
            style={{ width: "100%" }}
          >
            {loading ? (
              <>
                <LoadingOutlined spin /> Đang Xử Lý...
              </>
            ) : (
              "Xử Lý File"
            )}
          </Button>
          {loading && (
            <Progress percent={progress} showInfo style={{ width: "100%" }} />
          )}
        </Space>

        <Card
          title="Hướng Dẫn Sử Dụng"
          bordered
          style={{ marginTop: "20px" }}
          className="instructions-card"
        >
          <Timeline>
            <Timeline.Item
              dot={
                <UploadOutlined
                  style={{ fontSize: "20px", color: "#000000" }}
                />
              }
            >
              Tải file PDF lên bằng cách nhấn <strong>"Chọn File PDF"</strong>.
            </Timeline.Item>
            <Timeline.Item
              dot={
                <LoadingOutlined
                  style={{ fontSize: "20px", color: "#000000" }}
                />
              }
            >
              Nhấn nút <strong>"Xử Lý File"</strong> để hệ thống phân tích dữ
              liệu.
            </Timeline.Item>
            <Timeline.Item
              dot={
                <FileExcelOutlined
                  style={{ fontSize: "20px", color: "#000000" }}
                />
              }
            >
              Xem kết quả hoặc xuất file Excel để lưu trữ.
            </Timeline.Item>
          </Timeline>
        </Card>
      </Card>

      {Object.keys(aiResponse).length > 0 && (
        <Modal
          title={
            <div
              style={{
                textAlign: "center",
                fontSize: "20px",
                fontWeight: "bold",
              }}
            >
              <span
                style={{
                  background: "linear-gradient(90deg, #000000, #00f7ff)",
                  WebkitBackgroundClip: "text",

                  WebkitTextFillColor: "transparent",
                }}
              >
                Kết Quả Xử Lý
              </span>
            </div>
          }
          visible={showModal}
          onCancel={() => setShowModal(false)}
          footer={[
            <Button
              key="export"
              onClick={handleExportToExcel}
              className="upload-button"
            >
              Xuất File Excel
            </Button>,
          ]}
          centered
          width="90%"
          style={{
            borderRadius: "15px",
            maxWidth: "600px",
          }}
        >
          {renderAiResponse()}
        </Modal>
      )}
    </div>
  );
};

export default MultiFileProcessor;
