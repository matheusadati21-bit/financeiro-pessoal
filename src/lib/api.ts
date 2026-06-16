export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const parse = async (response: Response) => {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new ApiError(data?.message || 'Erro na requisição.', response.status);
  return data;
};

export const api = {
  get: <T>(url: string) => fetch(url, { credentials: 'include' }).then(parse) as Promise<T>,
  post: <T>(url: string, body?: unknown) => fetch(url, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  }).then(parse) as Promise<T>,
  put: <T>(url: string, body?: unknown) => fetch(url, {
    method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  }).then(parse) as Promise<T>,
  delete: <T>(url: string) => fetch(url, { method: 'DELETE', credentials: 'include' }).then(parse) as Promise<T>
};

export const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatMonth = (month: string) => {
  const [year, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(new Date(year, m - 1, 2));
};

export const today = () => new Date().toISOString().slice(0, 10);
export const currentMonth = () => new Date().toISOString().slice(0, 7);
