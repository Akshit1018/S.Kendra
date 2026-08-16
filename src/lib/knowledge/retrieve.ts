import { CHUNKS, DOC_BY_ID, DOCUMENTS } from "./corpus";
import { canAccess } from "./permissions";
import type {
  AccessLevel,
  ChunkRecord,
  Citation,
  Department,
  DocumentRecord,
  UserRole,
} from "./types";

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "is",
  "are",
  "was",
  "be",
  "at",
  "by",
  "with",
  "from",
  "that",
  "this",
  "it",
  "as",
  "we",
  "do",
  "not",
  "if",
  "what",
  "how",
  "when",
  "which",
  "should",
  "does",
  "can",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function idfApprox(term: string, docs: string[]): number {
  const df = docs.filter((d) => d.includes(term)).length || 1;
  return Math.log(1 + docs.length / df);
}

export type Retrieved = {
  chunk: ChunkRecord;
  score: number;
  citation: Citation;
};

export function filterVisibleChunks(role: UserRole, department: Department): ChunkRecord[] {
  return CHUNKS.filter((c) =>
    canAccess({
      role,
      department,
      accessLevel: c.accessLevel,
      allowedRoles: c.allowedRoles,
      docDepartment: c.department,
    }),
  );
}

export function filterVisibleDocuments(
  role: UserRole,
  department: Department,
): DocumentRecord[] {
  return DOCUMENTS.filter((d) =>
    canAccess({
      role,
      department,
      accessLevel: d.accessLevel,
      allowedRoles: d.allowedRoles,
      docDepartment: d.department,
    }),
  );
}

export function hybridRetrieve(
  query: string,
  role: UserRole,
  department: Department,
  topK = 6,
): Retrieved[] {
  const visible = filterVisibleChunks(role, department);
  if (visible.length === 0) return [];

  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];

  const bodies = visible.map((c) =>
    `${c.content} ${c.section} ${c.headingPath.join(" ")}`.toLowerCase(),
  );
  const qLower = query.toLowerCase();

  const scored = visible.map((chunk, i) => {
    const body = bodies[i];
    const doc = DOC_BY_ID[chunk.documentId];
    let score = 0;

    for (const t of qTokens) {
      const tf = body.split(t).length - 1;
      if (tf > 0) score += (1 + Math.log(1 + tf)) * idfApprox(t, bodies);
      if (chunk.section.toLowerCase().includes(t)) score += 1.4;
      if (chunk.headingPath.some((h) => h.toLowerCase().includes(t))) score += 0.8;
      if (doc?.title.toLowerCase().includes(t)) score += 1.1;
    }

    const phrases = [qLower, ...qLower.split(/[,.?]/).map((s) => s.trim()).filter((s) => s.length > 12)];
    for (const p of phrases) {
      if (p.length > 12 && body.includes(p)) score += 3.5;
    }

    // SOP / policy id boost
    const idHit = query.toUpperCase().match(/[A-Z]{2,}-[A-Z]{2,}-\d+|[A-Z]{3}-\d{3}/);
    if (idHit && body.toUpperCase().includes(idHit[0])) score += 4;

    const snippet = chunk.content.length > 180 ? `${chunk.content.slice(0, 177)}…` : chunk.content;

    return {
      chunk,
      score,
      citation: {
        chunkId: chunk.id,
        documentId: chunk.documentId,
        documentTitle: doc?.title ?? chunk.documentId,
        page: chunk.page,
        section: chunk.section,
        headingPath: chunk.headingPath,
        score,
        snippet,
      },
    };
  });

  return scored
    .filter((s) => s.score > 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s, idx) => ({
      ...s,
      citation: {
        ...s.citation,
        score: Number(
          Math.min(0.97, 0.92 - idx * 0.07 + Math.min(s.score, 6) / 40).toFixed(2),
        ),
      },
    }));
}

export function extraChunksFromUploads(
  uploads: {
    id: string;
    title: string;
    content: string;
    department: Department;
    accessLevel: AccessLevel;
    allowedRoles: UserRole[];
  }[],
  role: UserRole,
  department: Department,
): ChunkRecord[] {
  return uploads
    .filter((u) =>
      canAccess({
        role,
        department,
        accessLevel: u.accessLevel,
        allowedRoles: u.allowedRoles,
        docDepartment: u.department,
      }),
    )
    .map((u, i) => ({
      id: `upl_${u.id}_${i}`,
      documentId: u.id,
      content: u.content,
      page: 1,
      section: "Uploaded",
      headingPath: [u.title],
      chunkIndex: 0,
      department: u.department,
      allowedRoles: u.allowedRoles,
      accessLevel: u.accessLevel,
      language: "en" as const,
      hasTable: false,
    }));
}
