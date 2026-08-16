import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { DOCUMENTS } from "@/lib/knowledge/corpus";
import { runGoldenEvals } from "@/lib/knowledge/evals";
import { groundedGenerate } from "@/lib/knowledge/generate";
import {
  extraChunksFromUploads,
  filterVisibleDocuments,
  hybridRetrieve,
  tokenize,
} from "@/lib/knowledge/retrieve";
import {
  ACCESS_LEVELS,
  DEPARTMENTS,
  ROLE_META,
  USER_ROLES,
  type AccessLevel,
  type Department,
  type Profile,
  type QueryResult,
  type UserRole,
} from "@/lib/knowledge/types";
import { canAccess } from "@/lib/knowledge/permissions";

function isRole(v: string): v is UserRole {
  return (USER_ROLES as readonly string[]).includes(v);
}
function isDept(v: string): v is Department {
  return (DEPARTMENTS as readonly string[]).includes(v);
}
function isAccess(v: string): v is AccessLevel {
  return (ACCESS_LEVELS as readonly string[]).includes(v);
}

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadProfile(userId: string): Promise<Profile> {
  const sql = await getSql();
  const rows = await sql<{ user_id: string; role: string; department: string }>`
    select user_id, role, department from user_profiles where user_id = ${userId}
  `;
  const row = rows[0];
  if (row && isRole(row.role) && isDept(row.department)) {
    return { userId, role: row.role, department: row.department, displayName: null };
  }
  await sql`
    insert into user_profiles (user_id, role, department)
    values (${userId}, ${"field_engineer"}, ${"logistics"})
  `;
  return {
    userId,
    role: "field_engineer",
    department: "logistics",
    displayName: null,
  };
}

export const getProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return loadProfile(context.userId);
  });

export const setRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { role: string }) => input)
  .handler(async ({ context, data }) => {
    if (!isRole(data.role)) throw new Error("Invalid role");
    const department = ROLE_META[data.role].department;
    const sql = await getSql();
    await sql`
      insert into user_profiles (user_id, role, department, updated_at)
      values (${context.userId}, ${data.role}, ${department}, now())
      on conflict (user_id) do update set
        role = excluded.role,
        department = excluded.department,
        updated_at = now()
    `;
    return { userId: context.userId, role: data.role, department, displayName: null } satisfies Profile;
  });

export const askKnowledge = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { query: string }) => input)
  .handler(async ({ context, data }): Promise<QueryResult> => {
    const started = Date.now();
    const query = data.query.trim().slice(0, 1000);
    if (query.length < 3) throw new Error("Query too short");

    const profile = await loadProfile(context.userId);
    const sql = await getSql();

    const uploads = await sql<{
      id: string;
      title: string;
      content: string;
      department: string;
      access_level: string;
      allowed_roles: string;
    }>`
      select id, title, content, department, access_level, allowed_roles
      from uploaded_docs
      order by created_at desc
      limit 40
    `;

    const extra = extraChunksFromUploads(
      uploads
        .filter((u) => isDept(u.department) && isAccess(u.access_level))
        .map((u) => ({
          id: u.id,
          title: u.title,
          content: u.content,
          department: u.department as Department,
          accessLevel: u.access_level as AccessLevel,
          allowedRoles: u.allowed_roles.split(",").filter(isRole),
        })),
      profile.role,
      profile.department,
    );

    // Temporarily consider uploads by concatenating into retrieve via a local copy
    const base = hybridRetrieve(query, profile.role, profile.department, 8);
    const qTokens = tokenize(query);
    const uploadHits = extra
      .map((chunk) => {
        const body = `${chunk.content} ${chunk.headingPath.join(" ")}`.toLowerCase();
        let score = 0;
        for (const t of qTokens) {
          if (body.includes(t)) score += 1.6;
        }
        return {
          chunk,
          score,
          citation: {
            chunkId: chunk.id,
            documentId: chunk.documentId,
            documentTitle: chunk.headingPath[0] ?? "Upload",
            page: 1,
            section: "Uploaded",
            headingPath: chunk.headingPath,
            score,
            snippet: chunk.content.slice(0, 180),
          },
        };
      })
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const merged = [...base, ...uploadHits]
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    const generated = await groundedGenerate(query, merged, profile.role);
    const latencyMs = Date.now() - started;
    const auditId = newId("aud");
    const docIds = [...new Set(generated.citations.map((c) => c.documentId))];

    await sql`
      insert into audit_logs (
        id, user_id, user_role, action, query_text, retrieved_chunk_ids,
        document_ids_accessed, answer_preview, latency_ms, success, escalate, model_used
      ) values (
        ${auditId},
        ${context.userId},
        ${profile.role},
        ${"query"},
        ${query},
        ${JSON.stringify(merged.map((m) => m.chunk.id))},
        ${JSON.stringify(docIds)},
        ${generated.answer.slice(0, 480)},
        ${latencyMs},
        ${true},
        ${generated.escalate},
        ${generated.modelUsed}
      )
    `;

    return {
      ...generated,
      retrievedChunkIds: merged.map((m) => m.chunk.id),
      latencyMs,
      permissionFiltered: true,
      auditId,
    };
  });

export const listLibrary = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await loadProfile(context.userId);
    const visible = filterVisibleDocuments(profile.role, profile.department);
    const sql = await getSql();
    const uploads = await sql<{
      id: string;
      title: string;
      department: string;
      access_level: string;
      allowed_roles: string;
      created_at: string;
    }>`
      select id, title, department, access_level, allowed_roles, created_at
      from uploaded_docs
      order by created_at desc
    `;
    const extra = uploads
      .filter((u) => isDept(u.department) && isAccess(u.access_level))
      .filter((u) =>
        canAccess({
          role: profile.role,
          department: profile.department,
          accessLevel: u.access_level as AccessLevel,
          allowedRoles: u.allowed_roles.split(",").filter(isRole),
          docDepartment: u.department as Department,
        }),
      )
      .map((u) => ({
        id: u.id,
        title: u.title,
        sourceType: "sop" as const,
        department: u.department as Department,
        allowedRoles: u.allowed_roles.split(",").filter(isRole),
        accessLevel: u.access_level as AccessLevel,
        language: "en" as const,
        version: "upload",
        updatedAt: String(u.created_at).slice(0, 10),
        summary: "Uploaded by a knowledge admin.",
        uploaded: true,
      }));

    return {
      profile,
      documents: [
        ...visible.map((d) => ({ ...d, uploaded: false })),
        ...extra,
      ],
    };
  });

export const getDocument = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const profile = await loadProfile(context.userId);
    const doc = DOCUMENTS.find((d) => d.id === data.id);
    if (doc) {
      const allowed = canAccess({
        role: profile.role,
        department: profile.department,
        accessLevel: doc.accessLevel,
        allowedRoles: doc.allowedRoles,
        docDepartment: doc.department,
      });
      if (!allowed) throw new Error("Not authorized for this document");
      const { CHUNKS } = await import("@/lib/knowledge/corpus");
      return {
        document: doc,
        chunks: CHUNKS.filter((c) => c.documentId === doc.id),
      };
    }
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      title: string;
      content: string;
      department: string;
      access_level: string;
      allowed_roles: string;
    }>`
      select id, title, content, department, access_level, allowed_roles
      from uploaded_docs where id = ${data.id}
    `;
    const u = rows[0];
    if (!u) throw new Error("Document not found");
    const allowed = canAccess({
      role: profile.role,
      department: profile.department,
      accessLevel: u.access_level as AccessLevel,
      allowedRoles: u.allowed_roles.split(",").filter(isRole),
      docDepartment: u.department as Department,
    });
    if (!allowed) throw new Error("Not authorized for this document");
    return {
      document: {
        id: u.id,
        title: u.title,
        sourceType: "sop" as const,
        department: u.department as Department,
        allowedRoles: u.allowed_roles.split(",").filter(isRole),
        accessLevel: u.access_level as AccessLevel,
        language: "en" as const,
        version: "upload",
        updatedAt: "",
        summary: "",
      },
      chunks: [
        {
          id: `upl_${u.id}_0`,
          documentId: u.id,
          content: u.content,
          page: 1,
          section: "Uploaded",
          headingPath: [u.title],
          chunkIndex: 0,
          department: u.department as Department,
          allowedRoles: u.allowed_roles.split(",").filter(isRole),
          accessLevel: u.access_level as AccessLevel,
          language: "en" as const,
          hasTable: false,
        },
      ],
    };
  });

export const listAudit = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await loadProfile(context.userId);
    const sql = await getSql();
    const isAdmin =
      profile.role === "knowledge_admin" || profile.role === "security_admin";
    const rows = isAdmin
      ? await sql<{
          id: string;
          user_id: string;
          user_role: string;
          query_text: string | null;
          retrieved_chunk_ids: string | null;
          document_ids_accessed: string | null;
          answer_preview: string | null;
          latency_ms: number | null;
          success: boolean;
          escalate: boolean;
          model_used: string | null;
          created_at: string;
        }>`
          select id, user_id, user_role, query_text, retrieved_chunk_ids,
                 document_ids_accessed, answer_preview, latency_ms, success,
                 escalate, model_used, created_at
          from audit_logs
          order by created_at desc
          limit 80
        `
      : await sql<{
          id: string;
          user_id: string;
          user_role: string;
          query_text: string | null;
          retrieved_chunk_ids: string | null;
          document_ids_accessed: string | null;
          answer_preview: string | null;
          latency_ms: number | null;
          success: boolean;
          escalate: boolean;
          model_used: string | null;
          created_at: string;
        }>`
          select id, user_id, user_role, query_text, retrieved_chunk_ids,
                 document_ids_accessed, answer_preview, latency_ms, success,
                 escalate, model_used, created_at
          from audit_logs
          where user_id = ${context.userId}
          order by created_at desc
          limit 80
        `;
    return { profile, rows };
  });

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { auditId: string; rating: "up" | "down"; comment?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into query_feedback (id, audit_id, user_id, rating, comment)
      values (${newId("fb")}, ${data.auditId}, ${context.userId}, ${data.rating}, ${data.comment ?? null})
    `;
    return { ok: true };
  });

export const uploadDocument = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      title: string;
      content: string;
      department: string;
      accessLevel: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const profile = await loadProfile(context.userId);
    if (profile.role !== "knowledge_admin" && profile.role !== "security_admin") {
      throw new Error("Only knowledge or security admins can upload");
    }
    if (!isDept(data.department) || !isAccess(data.accessLevel)) {
      throw new Error("Invalid ACL");
    }
    const title = data.title.trim().slice(0, 160);
    const content = data.content.trim().slice(0, 8000);
    if (title.length < 3 || content.length < 20) throw new Error("Title or body too short");
    const sql = await getSql();
    const id = newId("doc");
    const roles = USER_ROLES.join(",");
    await sql`
      insert into uploaded_docs (id, user_id, title, content, department, access_level, allowed_roles)
      values (${id}, ${context.userId}, ${title}, ${content}, ${data.department}, ${data.accessLevel}, ${roles})
    `;
    return { id };
  });

export const getEvalReport = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const profile = await loadProfile(context.userId);
    const evals = runGoldenEvals();
    const sql = await getSql();
    const stats = await sql<{
      n: number;
      avg_lat: number | null;
      esc: number;
    }>`
      select count(*)::int as n,
             coalesce(avg(latency_ms), 0)::int as avg_lat,
             coalesce(sum(case when escalate then 1 else 0 end), 0)::int as esc
      from audit_logs
    `;
    const fb = await sql<{ ups: number; downs: number }>`
      select
        coalesce(sum(case when rating = 'up' then 1 else 0 end), 0)::int as ups,
        coalesce(sum(case when rating = 'down' then 1 else 0 end), 0)::int as downs
      from query_feedback
    `;
    return {
      profile,
      evals,
      live: {
        queries: stats[0]?.n ?? 0,
        avgLatency: stats[0]?.avg_lat ?? 0,
        escalateRate:
          stats[0]?.n && stats[0].n > 0 ? Number(((stats[0].esc ?? 0) / stats[0].n).toFixed(2)) : 0,
        thumbsUp: fb[0]?.ups ?? 0,
        thumbsDown: fb[0]?.downs ?? 0,
      },
    };
  });
