import React, { useEffect, useRef, useState } from 'react';
import {
  MapPin,
  AlertTriangle,
  Compass,
  Layers,
  Search,
  Filter,
  RefreshCw,
  Building2,
  Phone,
  Clock,
  ShieldAlert,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { DiagnosisRecord, Language } from '../types';
import { loadGoogleMaps, GMP_INTERNAL_ATTRIBUTION_ID } from '../mapsLoader';

interface OutbreakPoint {
  id: string;
  name: string;
  crop: string;
  disease: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  lat: number;
  lng: number;
  date: string;
  reportedCases: number;
  weatherFavorable: boolean;
  weatherNote: string;
  recommendedAction: string;
}

interface AgriCenter {
  id: string;
  name: string;
  type: 'extension' | 'soil_lab' | 'biocontrol';
  lat: number;
  lng: number;
  address: string;
  phone: string;
  services: string[];
  hours: string;
}

// Sample agricultural regional surveillance points
const REGIONAL_OUTBREAKS: OutbreakPoint[] = [
  {
    id: 'outbreak-1',
    name: 'Sector 4 Potato Cluster',
    crop: 'Potato',
    disease: 'Late Blight (Phytophthora infestans)',
    severity: 'critical',
    lat: 28.6448,
    lng: 77.2167,
    date: 'Today, 08:30 AM',
    reportedCases: 14,
    weatherFavorable: true,
    weatherNote: 'High humidity (82%) and 21°C creating optimal sporulation conditions.',
    recommendedAction: 'Apply preventative Cymoxanil + Mancozeb spray and halt overhead sprinkler irrigation.',
  },
  {
    id: 'outbreak-2',
    name: 'Basmati Rice Belt North',
    crop: 'Rice',
    disease: 'Rice Blast (Magnaporthe oryzae)',
    severity: 'high',
    lat: 28.7041,
    lng: 77.1025,
    date: 'Yesterday',
    reportedCases: 9,
    weatherFavorable: true,
    weatherNote: 'Persistent overnight leaf wetness and warm day temperatures.',
    recommendedAction: 'Apply Tricyclazole 75% WP early morning; split nitrogen fertilizer into 3 light dressings.',
  },
  {
    id: 'outbreak-3',
    name: 'Green Valley Tomato Farmland',
    crop: 'Tomato',
    disease: 'Early Blight (Alternaria solani)',
    severity: 'medium',
    lat: 28.5355,
    lng: 77.391,
    date: '2 days ago',
    reportedCases: 6,
    weatherFavorable: false,
    weatherNote: 'Moderate humidity; manageable pathogen progression.',
    recommendedAction: 'Prune lower yellowing canopy foliage to promote air circulation; apply copper oxychloride.',
  },
  {
    id: 'outbreak-4',
    name: 'Southern Maize Corridor',
    crop: 'Maize',
    disease: 'Maize Streak Virus (MSV)',
    severity: 'high',
    lat: 28.4595,
    lng: 77.0266,
    date: '3 days ago',
    reportedCases: 8,
    weatherFavorable: true,
    weatherNote: 'Cicadulina leafhopper vector population rising due to dry winds.',
    recommendedAction: 'Rogue infected stunted plants immediately; install yellow sticky traps at field margins.',
  },
  {
    id: 'outbreak-5',
    name: 'Cassava Seedling Nursery',
    crop: 'Cassava',
    disease: 'Cassava Mosaic Disease (CMD)',
    severity: 'medium',
    lat: 28.5921,
    lng: 77.046,
    date: '4 days ago',
    reportedCases: 4,
    weatherFavorable: false,
    weatherNote: 'Normal weather; monitor whitefly presence.',
    recommendedAction: 'Use certified virus-free cuttings and spray neem oil 0.5% for whitefly suppression.',
  },
];

const AGRI_CENTERS: AgriCenter[] = [
  {
    id: 'center-1',
    name: 'Krishi Vigyan Kendra (Agri Extension Center)',
    type: 'extension',
    lat: 28.6139,
    lng: 77.209,
    address: 'ICAR Complex, Regional Farm Station',
    phone: '+91 11 2584 3211',
    services: ['Free Agronomist Consultation', 'Disease Specimen Triage', 'Subsidized Biocontrols'],
    hours: 'Mon-Sat: 08:30 - 17:00',
  },
  {
    id: 'center-2',
    name: 'Agro-Chemical & Organic Input Depot',
    type: 'biocontrol',
    lat: 28.6692,
    lng: 77.1855,
    address: 'Mandi Gate No. 3, Wholesale Agri Market',
    phone: '+91 98110 44231',
    services: ['Trichoderma Viride', 'Pseudomonas Fluorescens', 'Certified Seed Stocks'],
    hours: 'Mon-Sun: 07:00 - 19:30',
  },
  {
    id: 'center-3',
    name: 'Govt. Soil Health & Pathology Laboratory',
    type: 'soil_lab',
    lat: 28.58,
    lng: 77.23,
    address: 'State Agri Directorate, Lab Block B',
    phone: '+91 11 2618 9002',
    services: ['Rapid Soil NPK Testing', 'Microbial Water Quality', 'Microscopic Fungus Culture'],
    hours: 'Mon-Fri: 09:00 - 16:30',
  },
];

const PRESET_LOCATIONS = [
  { name: 'Northern Grain & Potato Belt', lat: 28.6139, lng: 77.209, zoom: 11 },
  { name: 'East African Rift Valley (Nakuru)', lat: -0.3031, lng: 36.08, zoom: 11 },
  { name: 'Punjab Agricultural Corridor (Ludhiana)', lat: 30.901, lng: 75.8573, zoom: 11 },
  { name: 'California Central Valley (Fresno)', lat: 36.7468, lng: -119.7726, zoom: 11 },
];

interface FarmMapViewProps {
  currentLang: Language;
  diagnoses: DiagnosisRecord[];
}

export const FarmMapView: React.FC<FarmMapViewProps> = ({ currentLang, diagnoses }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedOutbreak, setSelectedOutbreak] = useState<OutbreakPoint | null>(null);
  const [selectedCenter, setSelectedCenter] = useState<AgriCenter | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium'>('all');
  const [showAgriCenters, setShowAgriCenters] = useState<boolean>(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenterName, setMapCenterName] = useState<string>('Northern Grain & Potato Belt');

  // Convert saved scans to map points if coordinates exist or jitter around center
  const userScanPoints: OutbreakPoint[] = diagnoses.slice(0, 5).map((scan, idx) => ({
    id: `user-scan-${scan.id}`,
    name: `Your Scan: ${scan.cropName}`,
    crop: scan.cropName,
    disease: scan.primaryDiagnosis,
    severity: scan.confidenceScore > 0.8 ? 'high' : 'medium',
    lat: 28.6139 + (idx === 0 ? 0.02 : -0.015 * idx),
    lng: 77.209 + (idx === 0 ? -0.015 : 0.02 * idx),
    date: new Date(scan.timestamp).toLocaleDateString(),
    reportedCases: 1,
    weatherFavorable: true,
    weatherNote: 'Directly logged from your LeafLens field diagnosis.',
    recommendedAction: 'Refer to treatment instructions in your scan history card.',
  }));

  const allOutbreaks = [...REGIONAL_OUTBREAKS, ...userScanPoints];

  // Initialize Map
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      try {
        setIsLoading(true);
        setLoadError(null);
        await loadGoogleMaps();

        if (!isMounted || !mapContainerRef.current) return;

        const { Map } = (await (window as any).google.maps.importLibrary('maps')) as {
          Map: typeof google.maps.Map;
        };

        const initialCenter = { lat: 28.6139, lng: 77.209 };

        // Mandatory solution tracking setting
        const map = new Map(mapContainerRef.current, {
          center: initialCenter,
          zoom: 11,
          renderingType: 'VECTOR' as any,
          internalUsageAttributionIds: [GMP_INTERNAL_ATTRIBUTION_ID],
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          styles: [
            {
              featureType: 'poi.business',
              stylers: [{ visibility: 'off' }],
            },
            {
              featureType: 'landscape.natural',
              elementType: 'geometry.fill',
              stylers: [{ color: '#f5f7f2' }],
            },
            {
              featureType: 'water',
              elementType: 'geometry.fill',
              stylers: [{ color: '#cce4f2' }],
            },
          ],
        });

        mapInstanceRef.current = map;
        setIsLoading(false);
      } catch (err: any) {
        console.error('Google Maps initialization error:', err);
        if (isMounted) {
          setLoadError(err?.message || 'Could not load Google Maps Platform');
          setIsLoading(false);
        }
      }
    }

    initMap();

    return () => {
      isMounted = false;
      // Clear markers
      markersRef.current.forEach((m) => m.setMap?.(null));
      markersRef.current = [];
    };
  }, []);

  // Update Markers whenever filters or map changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !(window as any).google?.maps) return;

    // Remove existing markers
    markersRef.current.forEach((m) => {
      if (m.setMap) m.setMap(null);
      if (m.map) m.map = null;
    });
    markersRef.current = [];

    // Filter Outbreaks
    const filteredOutbreaks = allOutbreaks.filter((item) => {
      if (severityFilter === 'all') return true;
      return item.severity === severityFilter;
    });

    // Add Outbreak Markers
    filteredOutbreaks.forEach((outbreak) => {
      const color =
        outbreak.severity === 'critical'
          ? '#e11d48'
          : outbreak.severity === 'high'
          ? '#ea580c'
          : '#f59e0b';

      const svgIcon = {
        path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
        fillColor: color,
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#ffffff',
        scale: 1.6,
        anchor: new (window as any).google.maps.Point(12, 22),
      };

      const marker = new (window as any).google.maps.Marker({
        position: { lat: outbreak.lat, lng: outbreak.lng },
        map,
        title: `${outbreak.disease} (${outbreak.crop})`,
        icon: svgIcon,
        animation: outbreak.severity === 'critical' ? (window as any).google.maps.Animation.DROP : undefined,
      });

      marker.addListener('click', () => {
        setSelectedOutbreak(outbreak);
        setSelectedCenter(null);
        map.panTo({ lat: outbreak.lat, lng: outbreak.lng });
      });

      markersRef.current.push(marker);

      // Add high alert perimeter circle for critical outbreaks
      if (outbreak.severity === 'critical') {
        const circle = new (window as any).google.maps.Circle({
          strokeColor: '#e11d48',
          strokeOpacity: 0.8,
          strokeWeight: 1.5,
          fillColor: '#f43f5e',
          fillOpacity: 0.15,
          map,
          center: { lat: outbreak.lat, lng: outbreak.lng },
          radius: 3500, // 3.5 km containment radius
        });
        markersRef.current.push(circle);
      }
    });

    // Add Agri Center Markers
    if (showAgriCenters) {
      AGRI_CENTERS.forEach((center) => {
        const svgIcon = {
          path: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
          fillColor: '#047857',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#ffffff',
          scale: 1.4,
          anchor: new (window as any).google.maps.Point(12, 12),
        };

        const marker = new (window as any).google.maps.Marker({
          position: { lat: center.lat, lng: center.lng },
          map,
          title: center.name,
          icon: svgIcon,
        });

        marker.addListener('click', () => {
          setSelectedCenter(center);
          setSelectedOutbreak(null);
          map.panTo({ lat: center.lat, lng: center.lng });
        });

        markersRef.current.push(marker);
      });
    }

    // Add user GPS marker if detected
    if (userLocation) {
      const userMarker = new (window as any).google.maps.Marker({
        position: userLocation,
        map,
        title: 'Your Current Farm Location',
        icon: {
          path: (window as any).google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#2563eb',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      });
      markersRef.current.push(userMarker);
    }
  }, [severityFilter, showAgriCenters, userLocation]);

  // Locate User Farm
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your device browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(coords);
          mapInstanceRef.current.setZoom(13);
        }
      },
      (err) => {
        console.warn('Geolocation failed:', err);
        alert('Could not determine your exact GPS location. Defaulting to regional farm zone.');
      }
    );
  };

  const handleSelectPreset = (preset: (typeof PRESET_LOCATIONS)[0]) => {
    setMapCenterName(preset.name);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat: preset.lat, lng: preset.lng });
      mapInstanceRef.current.setZoom(preset.zoom);
    }
  };

  return (
    <div className="w-full space-y-4 px-3 sm:px-4">
      {/* Header Section */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Compass className="w-4 h-4 text-emerald-800" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black font-['Outfit'] tracking-tight text-stone-900">
              Regional Crop Disease Radar
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 max-w-xl">
            Live geospatial surveillance powered by Google Maps. Track pathogen spore spreads, microclimate outbreak perimeters, and locate certified agricultural extension offices.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            id="btn-locate-farm"
            onClick={handleLocateMe}
            className="px-4 py-2.5 rounded-2xl bg-emerald-800 hover:bg-emerald-900 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition"
          >
            <MapPin className="w-4 h-4" />
            <span>Locate My Field</span>
          </button>

          <button
            id="btn-toggle-centers"
            onClick={() => setShowAgriCenters((prev) => !prev)}
            className={`px-4 py-2.5 rounded-2xl border font-bold text-xs flex items-center gap-2 transition active:scale-95 ${
              showAgriCenters
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
            }`}
          >
            <Building2 className="w-4 h-4 text-emerald-700" />
            <span>Agri Clinics ({AGRI_CENTERS.length})</span>
          </button>
        </div>
      </div>

      {/* Filter and Presets Toolbar */}
      <div className="bg-white rounded-2xl p-3 border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Severity Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-stone-500 font-bold mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Severity:
          </span>
          {(['all', 'critical', 'high', 'medium'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1 rounded-xl font-bold uppercase tracking-wider text-[11px] transition ${
                severityFilter === sev
                  ? sev === 'critical'
                    ? 'bg-rose-600 text-white'
                    : sev === 'high'
                    ? 'bg-amber-600 text-white'
                    : sev === 'medium'
                    ? 'bg-amber-500 text-white'
                    : 'bg-stone-800 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        {/* Regional Agricultural Hub Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-stone-500 font-bold">Region:</span>
          <select
            value={mapCenterName}
            onChange={(e) => {
              const preset = PRESET_LOCATIONS.find((p) => p.name === e.target.value);
              if (preset) handleSelectPreset(preset);
            }}
            className="bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {PRESET_LOCATIONS.map((preset) => (
              <option key={preset.name} value={preset.name}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div className="relative w-full h-[480px] sm:h-[550px] bg-stone-100 rounded-3xl overflow-hidden border border-stone-200 shadow-sm">
        {isLoading && (
          <div className="absolute inset-0 z-20 bg-stone-50/90 backdrop-blur-xs flex flex-col items-center justify-center p-4">
            <RefreshCw className="w-8 h-8 text-emerald-700 animate-spin mb-3" />
            <p className="font-['Outfit'] font-bold text-stone-800 text-sm">
              Initializing Google Maps Platform Vector Layer...
            </p>
            <p className="text-xs text-stone-500 mt-1">Grounding regional agricultural telemetry</p>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 z-20 bg-rose-50 flex flex-col items-center justify-center p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-rose-600 mb-2" />
            <h3 className="font-bold text-rose-900 text-base">Google Maps Display Unavailable</h3>
            <p className="text-xs text-rose-700 max-w-md mt-1">{loadError}</p>
          </div>
        )}

        {/* Map Container Ref */}
        <div id="google-farm-map" ref={mapContainerRef} className="w-full h-full" />

        {/* Overlay Legend */}
        <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-md rounded-2xl p-3 border border-stone-200/90 shadow-md text-xs space-y-1.5 pointer-events-auto max-w-[200px]">
          <div className="font-black text-[11px] text-stone-700 uppercase tracking-wider mb-1">
            Map Legend
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-600 shrink-0" />
            <span className="text-stone-700 font-medium">Critical Outbreak (3.5km zone)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500 shrink-0" />
            <span className="text-stone-700 font-medium">High Spore Threat</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
            <span className="text-stone-700 font-medium">Moderate Presence</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-700 shrink-0" />
            <span className="text-stone-700 font-medium">Agri Extension Clinic</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-600 shrink-0" />
            <span className="text-stone-700 font-medium">Your Farm GPS</span>
          </div>
        </div>

        {/* Slide-in Detail Drawer for Outbreak */}
        {selectedOutbreak && (
          <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-96 z-20 bg-white/95 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border-2 border-rose-300 shadow-xl space-y-3 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-rose-100 text-rose-800 border border-rose-200">
                  {selectedOutbreak.severity} • {selectedOutbreak.crop}
                </span>
                <h4 className="font-['Outfit'] font-black text-base text-stone-900 mt-1">
                  {selectedOutbreak.disease}
                </h4>
                <p className="text-xs text-stone-500 font-semibold">{selectedOutbreak.name}</p>
              </div>
              <button
                onClick={() => setSelectedOutbreak(null)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-rose-50 rounded-xl p-2.5 border border-rose-200 text-xs text-rose-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Microclimate Trigger Analysis</span>
              </div>
              <p className="text-[11px] text-rose-800/90 leading-snug">
                {selectedOutbreak.weatherNote}
              </p>
            </div>

            <div className="text-xs space-y-1">
              <span className="font-bold text-stone-700">Immediate Containment Action:</span>
              <p className="text-stone-600 text-[11px] leading-relaxed">
                {selectedOutbreak.recommendedAction}
              </p>
            </div>

            <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1 border-t border-stone-100">
              <span>Reported: {selectedOutbreak.date}</span>
              <span className="font-bold text-rose-700">
                {selectedOutbreak.reportedCases} field alerts confirmed
              </span>
            </div>
          </div>
        )}

        {/* Slide-in Detail Drawer for Agri Center */}
        {selectedCenter && (
          <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-96 z-20 bg-white/95 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border-2 border-emerald-300 shadow-xl space-y-3 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Certified Support Center
                </span>
                <h4 className="font-['Outfit'] font-black text-base text-stone-900 mt-1">
                  {selectedCenter.name}
                </h4>
                <p className="text-xs text-stone-500">{selectedCenter.address}</p>
              </div>
              <button
                onClick={() => setSelectedCenter(null)}
                className="w-7 h-7 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 text-xs text-stone-700">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-emerald-700" />
                <a href={`tel:${selectedCenter.phone}`} className="font-bold text-emerald-800 underline">
                  {selectedCenter.phone}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                <span>{selectedCenter.hours}</span>
              </div>
            </div>

            <div className="bg-emerald-50/70 rounded-xl p-2.5 border border-emerald-100 text-xs">
              <div className="font-bold text-emerald-950 mb-1">Available Services:</div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-emerald-900">
                {selectedCenter.services.map((svc, i) => (
                  <li key={i}>{svc}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Mandatory Attribution Requirements for Google Maps Skill */}
      <div className="text-center pt-2 pb-1">
        <p className="text-[11px] text-stone-400 font-medium">
          Mapping data & vector rendering services
        </p>
        <p className="text-xs font-bold text-stone-600 tracking-wider uppercase mt-0.5">
          Google Maps
        </p>
      </div>
    </div>
  );
};
