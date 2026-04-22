import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

export interface TripStop {
  name: string;
  lat: number;
  lon: number;
  date_start?: string;
  date_end?: string;
  note?: string;
  images?: string[];
}

export interface Trip {
  slug: string;
  title: string;
  date_start: string;
  date_end?: string;
  description?: string;
  cover?: string;
  stops: TripStop[];
}

const TRIPS_DIR = join(process.cwd(), 'trips');

export function loadTrip(slug: string): Trip {
  const yamlPath = join(TRIPS_DIR, slug, 'trip.yaml');
  const raw = readFileSync(yamlPath, 'utf-8');
  const data = yaml.load(raw) as Omit<Trip, 'slug'>;
  return { ...data, slug };
}

export function loadAllTrips(): Trip[] {
  if (!existsSync(TRIPS_DIR)) return [];
  return readdirSync(TRIPS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => loadTrip(d.name))
    .sort((a, b) => a.date_start.localeCompare(b.date_start));
}

// Derive all unique locations across all trips for the world globe
export interface WorldPoint {
  name: string;
  lat: number;
  lon: number;
  tripSlug: string;
  tripTitle: string;
}

export function worldPoints(trips: Trip[]): WorldPoint[] {
  const seen = new Set<string>();
  const points: WorldPoint[] = [];
  for (const trip of trips) {
    for (const stop of trip.stops) {
      const key = `${stop.lat},${stop.lon}`;
      if (!seen.has(key)) {
        seen.add(key);
        points.push({
          name: stop.name,
          lat: stop.lat,
          lon: stop.lon,
          tripSlug: trip.slug,
          tripTitle: trip.title,
        });
      }
    }
  }
  return points;
}
