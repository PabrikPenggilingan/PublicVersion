import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api'
import { User, Users } from 'lucide-react'

const containerStyle = {
  width: '100%',
  height: '100%'
}

// Center around Karawang for example
const center = {
  lat: -6.3023,
  lng: 107.2974
}

// Map styles to hide buildings and landmarks
const mapStyles = [
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'transit',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'all',
    stylers: [{ visibility: 'off' }]
  }
]

export interface LocationEntity {
  id: string
  name: string
  type: 'person' | 'community'
  lat: number
  lng: number
  distance: string
  details: string
}

export const mockLocations: LocationEntity[] = [
  { id: '1', name: 'Person A', type: 'person', lat: -6.302, lng: 107.29, distance: '1km', details: 'Petani padi dengan pengalaman 10 tahun.' },
  { id: '2', name: 'Person B', type: 'person', lat: -6.305, lng: 107.295, distance: '3km', details: 'Pemilik penggilingan padi lokal.' },
  { id: '3', name: 'Komunitas A', type: 'community', lat: -6.303, lng: 107.292, distance: '1.5km', details: 'Grup petani organik.' },
  { id: '4', name: 'Person C', type: 'person', lat: -6.298, lng: 107.295, distance: '2km', details: 'Distributor benih padi.' },
  { id: '5', name: 'Person D', type: 'person', lat: -6.301, lng: 107.301, distance: '4km', details: 'Penyedia transportasi gabah.' },
  { id: '6', name: 'Komunitas B', type: 'community', lat: -6.306, lng: 107.305, distance: '5km', details: 'Koperasi unit desa Karawang.' },
]

export default function MapArea({ 
    selectedLocation, 
    setSelectedLocation 
}: { 
    selectedLocation: LocationEntity | null, 
    setSelectedLocation: (loc: LocationEntity | null) => void 
}) {
    // In a real app, API key should come from env. For mock/dev, using an empty key or a placeholder.
    // We will rely on Google's development mode warning if no key is present.
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: '' // Intentionally empty for Option B mock
    })

    return (
        <div className="flex-1 flex flex-col h-full bg-stone-100 overflow-hidden relative">
            <div className="flex-1 relative">
                {isLoaded ? (
                    <GoogleMap
                        mapContainerStyle={containerStyle}
                        center={center}
                        zoom={14}
                        options={{
                            styles: mapStyles,
                            disableDefaultUI: true,
                            zoomControl: true,
                        }}
                        onClick={() => setSelectedLocation(null)}
                    >
                        {mockLocations.map((loc) => (
                            <Marker
                                key={loc.id}
                                position={{ lat: loc.lat, lng: loc.lng }}
                                onClick={() => setSelectedLocation(loc)}
                                icon={{
                                    path: typeof window !== 'undefined' && window.google ? window.google.maps.SymbolPath.CIRCLE : 0,
                                    scale: 12,
                                    fillColor: '#EF4444', // red-500 equivalent
                                    fillOpacity: 1,
                                    strokeColor: '#FFFFFF',
                                    strokeWeight: 2,
                                }}
                                label={{
                                    text: loc.name,
                                    className: "text-xs font-semibold bg-white/90 px-1.5 py-0.5 rounded shadow-sm",
                                    color: "#1e293b", // stone-200
                                }}
                            />
                        ))}
                    </GoogleMap>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-stone-200 text-stone-600">
                        <div className="spinner mb-4"></div>
                        <p>Memuat peta...</p>
                    </div>
                )}
            </div>

            {/* Bottom Details Panel */}
            {selectedLocation && (
                <div className="h-48 bg-stone-200 border-t border-stone-300 shrink-0 p-6 flex flex-col justify-between shadow-2xl z-10 transition-all">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-brand-light-green/20 text-brand-light-green flex items-center justify-center border border-brand-light-green/30 shrink-0">
                            {selectedLocation.type === 'community' ? <Users size={24} /> : <User size={24} />}
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-stone-900 mb-1">{selectedLocation.name}</h2>
                            <p className="text-sm text-stone-600">{selectedLocation.details}</p>
                            <div className="mt-2 text-xs font-medium bg-stone-300 text-stone-700 inline-block px-2 py-1 rounded">
                                Jarak: {selectedLocation.distance}
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button className="px-6 py-2.5 bg-brand-light-green hover:bg-brand-light-green/80 text-stone-900 font-medium rounded-lg transition-colors shadow-lg shadow-brand-light-green/25">
                            Kirim pesan
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
