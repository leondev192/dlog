import React from "react";
import { Upload, Button } from "antd";
import { UploadOutlined } from "@ant-design/icons";

const FileUploader = ({ selectedFiles, setSelectedFiles, resetState }) => {
  const handleFileChange = ({ fileList }) => {
    setSelectedFiles(fileList.map((file) => file.originFileObj));
  };

  const handleRemoveAll = () => {
    resetState();
  };

  return (
    <div>
      <Upload
        multiple
        accept=".pdf"
        onChange={handleFileChange}
        fileList={selectedFiles.map((file) => ({
          uid: file.uid || file.name,
          name: file.name,
          status: "done",
        }))}
        beforeUpload={() => false}
      >
        <Button icon={<UploadOutlined />}>Select PDF Files</Button>
      </Upload>
      <Button
        type="link"
        onClick={handleRemoveAll}
        disabled={!selectedFiles.length}
      >
        Remove All Files
      </Button>
    </div>
  );
};

export default FileUploader;
