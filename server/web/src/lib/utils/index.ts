import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

export function formatDate(value: string | number | null | undefined): string {
	if (!value) return '从未';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return String(value);
	return date.toLocaleString();
}

export function formatBytes(value: number): string {
	if (value < 1024) return `${value} B`;
	if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
	return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function listToText(value: string[] | null | undefined): string {
	return (value ?? []).join('\n');
}

export function textToList(value: string): string[] {
	return value
		.split(/[\n,]/)
		.map((item) => item.trim())
		.filter(Boolean);
}

export function textToIntList(value: string): number[] {
	return value
		.split(/[\n,]/)
		.map((item) => Number.parseInt(item.trim(), 10))
		.filter((item) => Number.isFinite(item));
}

export function secretForPatch(value: string): string | undefined {
	const trimmed = value.trim();
	if (!trimmed || trimmed.includes('****')) return undefined;
	return value;
}

export function pruneUndefined(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(pruneUndefined);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value)
				.filter(([, item]) => item !== undefined)
				.map(([key, item]) => [key, pruneUndefined(item)])
		);
	}
	return value;
}
