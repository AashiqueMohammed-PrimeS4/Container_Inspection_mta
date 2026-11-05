// The only place the page talks to the service.
import { $ } from "../lib/dom";

/** OData error body: { error: { message, code, target, details[] } }. */
export type ApiErrorDetail = { message: string; code?: string; target?: string };
export type ApiError = ApiErrorDetail & { details?: ApiErrorDetail[] };

/** POST to an unbound action on /public. */
export async function call<T = unknown>(action: string, body: unknown): Promise<T> {
  const res = await fetch(`/public/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw (data.error ?? {
      message: `Request failed (${res.status})`,
    }) as ApiError;
  return data as T;
}

/** Fills a ui5-select with one ui5-option per row of a code list (code, name). */
export async function fillSelect(id: string, path: string): Promise<void> {
  const res = await fetch(path, {
    headers: { Accept: "application/json" },
  });
  const { value = [] } = (await res.json().catch(() => ({}))) as {
    value?: { code: string; name: string }[];
  };
  for (const row of value) {
    const opt = document.createElement("ui5-option") as HTMLElement & {
      value: string;
    };
    opt.value = row.code;
    opt.textContent = row.name;
    $(id).appendChild(opt);
  }
}
