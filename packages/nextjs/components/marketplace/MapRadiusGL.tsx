"use client";

import { useEffect, useMemo, useRef } from "react";
// @ts-ignore - turf types via exports can be finicky in some setups
import { bbox as turfBbox, circle as turfCircle } from "@turf/turf";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Map, { Layer, MapLayerMouseEvent, MapRef, Marker, Source } from "react-map-gl/maplibre";

type Props = {
  lat: number;
  lng: number;
  radiusMiles: number;
  onMove: (lat: number, lng: number) => void;
};

export default function MapRadiusGL({ lat, lng, radiusMiles, onMove }: Props) {
  const mapRef = useRef<MapRef | null>(null);
  const cartoPositron = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

  const circleGeoJson = useMemo(() => {
    try {
      const poly = turfCircle([lng, lat], radiusMiles, { units: "miles", steps: 64 });
      return poly as any;
    } catch {
      return null;
    }
  }, [lat, lng, radiusMiles]);

  const onMapClick = (e: MapLayerMouseEvent) => {
    if (!e.lngLat) return;
    onMove(e.lngLat.lat, e.lngLat.lng);
  };

  useEffect(() => {
    const m = mapRef.current?.getMap?.();
    if (m && circleGeoJson) {
      try {
        const [minX, minY, maxX, maxY] = turfBbox(circleGeoJson as any);
        m.fitBounds(
          [
            [minX, minY],
            [maxX, maxY],
          ],
          { padding: 48, duration: 500 },
        );
      } catch {}
    }
  }, [circleGeoJson]);

  return (
    <Map
      reuseMaps
      mapLib={maplibregl as any}
      initialViewState={{ latitude: lat, longitude: lng, zoom: 10 }}
      ref={mapRef}
      onMove={() => {}}
      onClick={onMapClick}
      style={{ height: 300, width: "100%" }}
      mapStyle={cartoPositron as any}
    >
      {circleGeoJson && (
        <Source id="radius" type="geojson" data={circleGeoJson as any}>
          <Layer id="radius-fill" type="fill" paint={{ "fill-color": "#22c55e", "fill-opacity": 0.25 }} />
          <Layer id="radius-stroke" type="line" paint={{ "line-color": "#16a34a", "line-width": 2 }} />
        </Source>
      )}
      <Marker
        latitude={lat}
        longitude={lng}
        draggable
        onDragEnd={e => {
          const ll = e.lngLat;
          onMove(ll.lat, ll.lng);
        }}
      />
    </Map>
  );
}
