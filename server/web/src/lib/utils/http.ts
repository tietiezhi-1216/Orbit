export async function apiGet<T>(path: string): Promise<T> {
	const response = await fetch(path, { headers: { Accept: 'application/json' } });
	if (!response.ok) {
		throw new Error(await response.text());
	}
	return (await response.json()) as T;
}

export async function apiSend<T>(path: string, method: string, body?: unknown): Promise<T> {
	const response = await fetch(path, {
		method,
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	if (!response.ok) {
		throw new Error(await response.text());
	}
	return (await response.json()) as T;
}

export function cleanupError(err: unknown): string {
	if (err instanceof Error) return err.message.trim();
	return String(err);
}
