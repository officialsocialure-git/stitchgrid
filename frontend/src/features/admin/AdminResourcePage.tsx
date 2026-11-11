"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Search, RefreshCw, ChevronLeft, ChevronRight, LoaderCircle, Inbox } from "lucide-react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

type Column = { label: string; render: (row: any) => ReactNode; className?: string };
type Props = {
  title: string;
  description: string;
  fetcher: (params: URLSearchParams) => Promise<any>;
  columns: Column[];
  statuses?: { label: string; value: string }[];
  statusLabel?: string;
  actions?: (row: any, refresh: () => void) => ReactNode;
  searchPlaceholder?: string;
  realtimeTopics?: string[];
};

function Status({ value }: { value?: string }) {
  const text = value || "—";
  const normalized = text.toLowerCase();
  const tone = ["approved","active","open","success","completed","delivered","resolved","verified","in_production"].some(v => normalized.includes(v))
    ? "bg-lime-100 text-lime-800"
    : ["pending","review","requested","held"].some(v => normalized.includes(v))
      ? "bg-amber-100 text-amber-800"
      : ["rejected","cancelled","inactive","closed"].some(v => normalized.includes(v))
        ? "bg-rose-100 text-rose-700"
        : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{text.replaceAll("_"," ")}</span>;
}

export function AdminResourcePage({ title, description, fetcher, columns, statuses, statusLabel = "All Status", actions, searchPlaceholder = "Search records…", realtimeTopics = [] }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(v => v + 1), []);
  useRealtimeSync({ topics: realtimeTopics, onSync: refresh, pollIntervalMs: 30000, enabled: realtimeTopics.length > 0 });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true); setError("");
      const params = new URLSearchParams({ page: String(page), limit: "20", q, status });
      try {
        const result = await fetcher(params);
        if (!alive) return;
        setRows(result?.items || []);
        setTotal(result?.total || 0);
        setPages(Math.max(1, result?.pages || 1));
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Unable to load records.");
      } finally { if (alive) setLoading(false); }
    };
    load();
    return () => { alive = false; };
  }, [fetcher, page, q, status, refreshKey]);

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#101C2D] sm:text-[28px]">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={q} onChange={e => {setQ(e.target.value);setPage(1);}} placeholder={searchPlaceholder} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-[#A8D92D] focus:bg-white"/>
        </div>
        {statuses && <select value={status} onChange={e => {setStatus(e.target.value);setPage(1);}} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#A8D92D] sm:min-w-[170px]"><option value="ALL">{statusLabel}</option>{statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select>}
        <button onClick={refresh} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw size={15}/> Refresh</button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle size={18} className="animate-spin"/> Loading records…</div>
        : error ? <div className="p-8 text-center"><p className="text-sm font-semibold text-rose-700">{error}</p><button onClick={refresh} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Try again</button></div>
        : rows.length === 0 ? <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-slate-400"><Inbox size={28}/><p className="text-sm font-medium">No records found</p></div>
        : <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-[12px] font-bold text-slate-600"><tr>{columns.map(c => <th key={c.label} className={`px-5 py-4 ${c.className || ""}`}>{c.label}</th>)}{actions && <th className="px-5 py-4 text-right">Actions</th>}</tr></thead>
              <tbody className="divide-y divide-slate-100">{rows.map((row,i) => <tr key={row.id || row.userId || i} className="hover:bg-slate-50/70">{columns.map(c => <td key={c.label} className="px-5 py-4 align-middle text-slate-700">{c.render(row)}</td>)}{actions && <td className="px-5 py-4 text-right"><div className="flex justify-end gap-2">{actions(row,refresh)}</div></td>}</tr>)}</tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 md:hidden">{rows.map((row,i) => <article key={row.id || row.userId || i} className="space-y-3 p-4"><div className="grid grid-cols-2 gap-x-3 gap-y-3">{columns.map(c => <div key={c.label} className="min-w-0"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{c.label}</p><div className="break-words text-sm text-slate-700">{c.render(row)}</div></div>)}</div>{actions && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">{actions(row,refresh)}</div>}</article>)}</div>
        </>}
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Showing {rows.length ? (page-1)*20+1 : 0}–{Math.min(page*20,total)} of {total} records</span>
          <div className="flex items-center justify-end gap-2">
            <button disabled={page<=1 || loading} onClick={() => setPage(p=>p-1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronLeft size={16}/></button>
            <span className="px-2 font-semibold text-slate-700">Page {page} of {pages}</span>
            <button disabled={page>=pages || loading} onClick={() => setPage(p=>p+1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><ChevronRight size={16}/></button>
          </div>
        </div>
      </div>
    </section>
  );
}

export { Status };
