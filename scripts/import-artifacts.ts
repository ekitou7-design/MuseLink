import fs from "fs/promises";
import path from "path";
import {
  executeArtifactImport,
  getArtifactImportTemplate,
} from "../backend/artifact-importer";

async function main() {
  const targetPath = process.argv[2];

  if (!targetPath) {
    console.log("请传入一个导入任务 JSON 文件路径。");
    console.log("示例: npm run import:artifacts -- ./imports/national-job.json");
    console.log("");
    console.log("模板如下:");
    console.log(JSON.stringify(getArtifactImportTemplate(), null, 2));
    process.exit(1);
  }

  const absolutePath = path.isAbsolute(targetPath)
    ? targetPath
    : path.join(process.cwd(), targetPath);

  const file = await fs.readFile(absolutePath, "utf-8");
  const job = JSON.parse(file);
  const result = await executeArtifactImport({ job });

  console.log("导入完成");
  console.log(`来源: ${result.sourceName}`);
  console.log(`原始记录: ${result.totalRecords}`);
  console.log(`有效文物: ${result.validRecords}`);
  console.log(`跳过记录: ${result.skippedRecords}`);
  console.log(`已写入本地库: ${result.fileStoreCount}`);
  console.log(`涉及博物馆: ${result.museums.join("、")}`);

  if (result.skipped.length > 0) {
    console.log("");
    console.log("部分跳过记录:");
    result.skipped.forEach((item) => {
      console.log(`- 第 ${item.index + 1} 条: ${item.reason}`);
    });
  }
}

main().catch((error) => {
  console.error("导入失败:", error);
  process.exit(1);
});
