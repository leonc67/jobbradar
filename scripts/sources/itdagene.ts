import type { RawJob } from '../../shared/types.ts';
import { request } from '../http.ts';
import { toIsoDate } from '../../shared/text.ts';

/**
 * itDAGENE sin nettside er open source (github.com/itdagene-ntnu/itdagene-webapp)
 * og henter stillinger fra et offentlig GraphQL-API. Vi bruker samme spørring.
 */
const ENDPOINTS = ['https://itdagene.no/graphql', 'https://itdagene.no/api/graphql'];

const QUERY = `
  query Joblistings($cursor: String) {
    joblistings(first: 100, after: $cursor) {
      edges {
        node {
          slug
          title
          type
          deadline
          fromGrade
          toGrade
          isActive
          description
          towns { name }
          company { name }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export interface ItdageneNode {
  slug: string;
  title: string;
  type: 'SI' | 'PP' | 'OT' | string;
  deadline: string | null;
  fromGrade: number;
  toGrade: number;
  isActive: boolean;
  description?: string | null;
  towns: { name: string }[];
  company: { name: string };
}

interface GqlResponse {
  data?: {
    joblistings: {
      edges: { node: ItdageneNode }[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
  errors?: { message: string }[];
}

const TYPE_HINT: Record<string, string> = { SI: 'summer_job', PP: 'full_time', OT: 'other' };

export function parseItdagene(nodes: ItdageneNode[]): RawJob[] {
  return nodes
    .filter((n) => n.isActive)
    .map((n) => ({
      source: 'itdagene',
      sourceId: n.slug,
      url: `https://itdagene.no/jobb/${n.slug}`,
      company: n.company.name.trim(),
      title: n.title.trim(),
      typeHint: TYPE_HINT[n.type] ?? n.type,
      locations: n.towns.map((t) => t.name),
      deadline: toIsoDate(n.deadline),
      rolling: !n.deadline,
      fromYear: n.fromGrade,
      toYear: n.toGrade,
      text: n.description ?? undefined,
    }));
}

async function query(endpoint: string, cursor: string | null): Promise<GqlResponse> {
  const res = await request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { cursor } }),
  });
  if (!res.ok) throw new Error(`${res.status} fra ${endpoint}`);
  return (await res.json()) as GqlResponse;
}

export async function fetchItdagene(): Promise<RawJob[]> {
  let lastError: unknown;
  for (const endpoint of ENDPOINTS) {
    try {
      const nodes: ItdageneNode[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < 10; page++) {
        const body = await query(endpoint, cursor);
        if (body.errors?.length || !body.data) {
          throw new Error(body.errors?.[0]?.message ?? 'Tomt svar fra itDAGENE');
        }
        const { edges, pageInfo } = body.data.joblistings;
        nodes.push(...edges.map((e) => e.node));
        if (!pageInfo.hasNextPage) break;
        cursor = pageInfo.endCursor;
      }
      return parseItdagene(nodes);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
