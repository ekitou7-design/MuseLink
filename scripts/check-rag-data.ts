import { checkAiRagData } from "../backend/ai-rag-data";

async function main() {
  const result = await checkAiRagData();
  console.log(`主文物库：${result.artifactCount}`);
  console.log(`AI-ready 文档：${result.aiReadyCount}`);
  console.log(`RAG 文档：${result.ragDocumentCount}`);
  console.log(`缺失 AI 文档：${result.missingAiArtifactIds.length}`);
  if (result.missingAiArtifactIds.length > 0) {
    console.log(`缺失 AI 文物 ID：${result.missingAiArtifactIds.join(", ")}`);
  }
  console.log(`缺失 RAG 文档：${result.missingRagArtifactIds.length}`);
  if (result.missingRagArtifactIds.length > 0) {
    console.log(`缺失 RAG 文物 ID：${result.missingRagArtifactIds.join(", ")}`);
  }
  console.log(`孤立 RAG 文档：${result.orphanRagArtifactIds.length}`);
  if (result.orphanRagArtifactIds.length > 0) {
    console.log(`孤立 RAG 文物 ID：${result.orphanRagArtifactIds.join(", ")}`);
  }
  console.log(`关系候选：${result.relationCount}`);
}

main().catch((error) => {
  console.error("RAG 数据检查失败:", error);
  process.exit(1);
});
