import type { Metadata } from 'next';

export function buildPageMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
  };
}