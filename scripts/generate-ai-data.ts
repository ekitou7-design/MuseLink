import { readImportedArtifactsForAiRag, syncAiRagForArtifacts } from "../backend/ai-rag-data";

async function main() {
  const artifacts = await readImportedArtifactsForAiRag();
  const result = await syncAiRagForArtifacts(artifacts);
  console.log(JSON.stringify({
    sourceArtifacts: result.artifactCount,
    aiReadyArtifacts: result.aiReadyCount,
    ragDocuments: result.ragDocumentCount,
    relationCandidates: result.relationCount,
    coverage: result.coverage,
  }, null, 2));
}

main().catch((error) => {
  console.error("AI/RAG 数据生成失败:", error);
  process.exit(1);
});
