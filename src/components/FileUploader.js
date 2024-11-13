import React from "react";
import { Upload, Button } from "antd";
import { UploadOutlined } from "@ant-design/icons";

const FileUpload = ({ selectedFiles, handleFileChange }) => {
  return (
    <Upload
      multiple
      accept=".pdf"
      onChange={handleFileChange}
      fileList={selectedFiles.map((file, index) => ({
        uid: index.toString(),
        name: file.name,
        status: "done",
      }))}
      beforeUpload={() => false}
    >
      <Button icon={<UploadOutlined />}>Select PDF Files</Button>
    </Upload>
  );
};

export default FileUpload;
