import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Home } from '../../domain/types';
import type { ListItem } from '../../domain/views';
import { formatShortDate } from '../../domain/dates';
import { ActivityCard } from '../components/ActivityCard';

const UTRECHT: L.LatLngTuple = [52.0907, 5.1214];

interface Place {
  key: string;
  lat: number;
  lon: number;
  name: string;
  items: ListItem[];
}

/** Groepeer activiteiten per plek (afgerond op ~10 m), zodat één podium één speldje is. */
function groupPlaces(items: ListItem[]): { places: Place[]; noLocation: number } {
  const map = new Map<string, Place>();
  let noLocation = 0;
  for (const i of items) {
    const v = i.activity.venue;
    if (v.lat === undefined || v.lon === undefined) {
      noLocation++;
      continue;
    }
    const key = `${v.lat.toFixed(4)},${v.lon.toFixed(4)}`;
    const p = map.get(key) ?? { key, lat: v.lat, lon: v.lon, name: v.name, items: [] };
    p.items.push(i);
    map.set(key, p);
  }
  return { places: [...map.values()], noLocation };
}

export function MapView({ items, home, onOpen, empty }: { items: ListItem[]; home?: Home; onOpen: (i: ListItem) => void; empty: string }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const { places, noLocation } = useMemo(() => groupPlaces(items), [items]);
  const sel = places.find((p) => p.key === selected);

  // Kaart één keer aanmaken
  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView(UTRECHT, 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Speldjes bijwerken bij een andere selectie
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: L.LatLngTuple[] = [];
    for (const p of places) {
      const n = p.items.length;
      const icon = L.divIcon({
        className: 'map-pin-wrap',
        html: `<span class="map-pin${p.key === selected ? ' is-on' : ''}">${n > 1 ? `<b style="transform:rotate(45deg)">${n}</b>` : ''}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      L.marker([p.lat, p.lon], { icon, title: p.name, keyboard: true })
        .on('click', () => setSelected(p.key))
        .addTo(layer);
      bounds.push([p.lat, p.lon]);
    }
    if (home) {
      L.marker([home.lat, home.lon], {
        icon: L.divIcon({ className: 'map-pin-wrap', html: '<span class="map-home" title="Thuis"></span>', iconSize: [16, 16], iconAnchor: [8, 8] }),
        interactive: false,
      }).addTo(layer);
    }
    if (bounds.length && !selected) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, selected, home]);

  useEffect(() => setSelected(null), [items]);
  // Na het tikken op een speldje de lijst eronder in beeld brengen.
  const selRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected) selRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selected]);

  return (
    <div className="map-view">
      <div ref={el} className="map-canvas" role="application" aria-label="Kaart met activiteiten" />
      {!places.length && <p className="empty">{empty}</p>}
      {noLocation > 0 && <p className="small muted">{noLocation} activiteit{noLocation === 1 ? '' : 'en'} zonder precieze locatie staan niet op de kaart.</p>}
      {sel ? (
        <section className="map-selection" ref={selRef}>
          <h2 className="day-head">{sel.name}</h2>
          <ul className="card-list">
            {sel.items.map((i) => (
              <li key={i.activity.id}>
                <span className="small muted map-day">{formatShortDate(i.day)}</span>
                <ActivityCard item={i} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        places.length > 0 && <p className="small muted">Tik op een speldje om te zien wat er op die plek is.</p>
      )}
    </div>
  );
}
