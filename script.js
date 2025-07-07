// Initialize the map
//const map = L.map('map').setView([49.006889, 8.403653], 18); //Karlsruhe
const map = L.map('map').setView([48.82420, 8.41230], 15);  //Testsite with shelter fountain and bbq

// Define attribution
const attr_osm = '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const attr_overpass = 'POI via <a href="http://www.overpass-api.de/">Overpass API</a>';

// Add the OpenStreetMap tile layer
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: attr_osm
}).addTo(map);

// Add OpenTopoMap layer
const openTopoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map data: ' + attr_osm + ', <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
});

// Satellite
var googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3'],
    attribution: ['Google', attr_overpass].join(', ')
});

// Google 
var googleTerrain = L.tileLayer('http://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',{
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3'],
    attribution: ['Google', attr_overpass].join(', ')
});

// Define POI types
const poiTypes = [
    { name: 'BBQ Places', key: 'amenity', value: 'bbq', icon: 'img/BBQ.png' },
    { name: 'Fountains', key: 'amenity', value: 'drinking_water', icon: 'img/Fountain.png' },
    { name: 'Shelter', key: 'amenity', value: 'shelter', additionalTags: ['shelter_type~"basic_hut|lean_to|weather_shelter|rock_shelter|picnic_shelter"'], icon: 'img/Hut.png' },
    { name: 'Public Toilets', key: 'amenity', value: 'toilets', icon: 'img/toilet.png' },
    { name: 'Beach Volleyball', key: 'leisure', value: 'pitch', additionalTags: ['sport=beachvolleyball'], icon: 'img/volleyball.png' },
    { name: 'Second Hand Shops', key: 'shop', value: 'second_hand', icon: 'img/secondhand.png' },
    { name: 'Firepit', key: 'leisure', value: 'firepit', icon: 'img/firepit.png' },
    { name: 'Tankstellen', key: 'amenity', value: 'fuel', icon: 'img/fuel_station.png', showOpeningHours: true },
    { name: 'Graveyards', key: 'cemetery', value: 'combined', icon: 'img/grave.png', description: 'Required to have drinking water in Europe' }
];

// Add a counter to POIs displayed 
let totalPOICount = 0;
let globalMessageControl = null;
let displayedPOICount = 0;

// Add logging function
function logDebug(message, data = null) {
    const timestamp = new Date().toISOString().substr(11, 8);
    console.log(`[${timestamp}] ${message}`, data || '');
}
function showMessage(message) {
    logDebug(`Message: ${message}`);
}

function updateGlobalMessage() {
    const message = totalPOICount > 200 
        ? `Showing ${displayedPOICount} of ${totalPOICount} POIs. Zoom in to see more.`
        : totalPOICount > 0 
            ? `Showing ${displayedPOICount} POIs.`
            : null;
    
    logDebug(`Global message update: Total=${totalPOICount}, Displayed=${displayedPOICount}`);
    
    if (message) {
        showGlobalMessage(message);
    } else {
        hideGlobalMessage();
    }
}

// Function to parse and format opening hours
function formatOpeningHours(openingHours) {
    if (!openingHours) return 'Opening hours not available';
    
    // Handle 24/7 case
    if (openingHours === '24/7') return 'Open 24/7';
    
    // Simple parsing for common formats
    try {
        // Replace common abbreviations
        let formatted = openingHours
            .replace(/Mo/g, 'Mon')
            .replace(/Tu/g, 'Tue')
            .replace(/We/g, 'Wed')
            .replace(/Th/g, 'Thu')
            .replace(/Fr/g, 'Fri')
            .replace(/Sa/g, 'Sat')
            .replace(/Su/g, 'Sun')
            .replace(/-/g, ' - ')
            .replace(/;/g, '<br>');
        
        return formatted;
    } catch (e) {
        logDebug('Error formatting opening hours:', e);
        return openingHours; // Return raw data if parsing fails
    }
}

// Function to check if currently open (basic implementation)
function getCurrentStatus(openingHours) {
    if (!openingHours) return '';
    if (openingHours === '24/7') return '<span style="color: green;">● Currently Open</span>';
    
    // This is a simplified check - a full implementation would need a proper opening hours parser
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Basic heuristic: if it contains common business hours, assume open during day
    if (openingHours.includes('06:00') || openingHours.includes('07:00') || openingHours.includes('08:00')) {
        if (currentHour >= 6 && currentHour <= 22) {
            return '<span style="color: green;">● Likely Open</span>';
        } else {
            return '<span style="color: red;">● Likely Closed</span>';
        }
    }
    
    return '<span style="color: orange;">● Status Unknown</span>';
}

function showGlobalMessage(text) {
    if (!globalMessageControl) {
        globalMessageControl = L.control({position: 'bottomleft'});
        globalMessageControl.onAdd = function() {
            this._div = L.DomUtil.create('div', 'info');
            this.update(text);
            return this._div;
        };
        globalMessageControl.update = function(text) {
            this._div.innerHTML = `<span style="background-color: white; padding: 5px;">${text}</span>`;
        };
        globalMessageControl.addTo(map);
    } else {
        globalMessageControl.update(text);
    }
}

function hideGlobalMessage() {
    if (globalMessageControl) {
        map.removeControl(globalMessageControl);
        globalMessageControl = null;
    }
}

// Function to create a custom POI layer (updated)
function createPOILayer(poiType) {
    let layerGroup = L.layerGroup();
    let isActive = false;
    let localPOICount = 0;
    let currentRequest = null; // Track current request for cancellation
    let requestId = 0; // Unique ID for each request

    function updatePOIs() {
        if (!isActive) {
            logDebug(`${poiType.name}: Update skipped - layer not active`);
            return;
        }

        // Cancel previous request if still pending
        if (currentRequest) {
            logDebug(`${poiType.name}: Cancelling previous request`);
            currentRequest.cancelled = true;
        }

        const thisRequestId = ++requestId;
        currentRequest = { cancelled: false, id: thisRequestId };
        
        const bounds = map.getBounds();
        const zoom = map.getZoom();
        
        logDebug(`${poiType.name}: Starting update - Zoom: ${zoom}, Bounds: ${bounds.toString()}`);
        
        // Build query based on POI type
        let query;
        if (poiType.key === 'cemetery' && poiType.value === 'combined') {
            query = `
                [out:json][timeout:25];
                (
                  node["amenity"="grave_yard"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
                  way["amenity"="grave_yard"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
                  relation["amenity"="grave_yard"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
                  node["landuse"="cemetery"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
                  way["landuse"="cemetery"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
                  relation["landuse"="cemetery"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
                );
                out center;
            `;
        } else {
            let tagFilters = `["${poiType.key}"="${poiType.value}"]`;
            
            if (poiType.additionalTags) {
                tagFilters += poiType.additionalTags.map(tag => {
                    const [key, value] = tag.split(/[=~]/);
                    return `["${key}"${tag.includes('~') ? '~' : '='}${value}]`;
                }).join('');
            }
        
            query = `
                [out:json][timeout:25];
                (
                  node${tagFilters}(${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
                  way${tagFilters}(${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
                  relation${tagFilters}(${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
                );
                out center;
            `;
        }

        logDebug(`${poiType.name}: Sending query to Overpass API`, query.substring(0, 200) + '...');
    
        fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
            .then(response => {
                // Check if request was cancelled
                if (currentRequest.cancelled || currentRequest.id !== thisRequestId) {
                    logDebug(`${poiType.name}: Request ${thisRequestId} was cancelled`);
                    return null;
                }
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                logDebug(`${poiType.name}: Received response from Overpass API`);
                return response.json();
            })
            .then(data => {
                // Check if request was cancelled after response
                if (!data || currentRequest.cancelled || currentRequest.id !== thisRequestId) {
                    logDebug(`${poiType.name}: Processing cancelled for request ${thisRequestId}`);
                    return;
                }

                logDebug(`${poiType.name}: Processing ${data.elements.length} elements`);
                
                // Update counters
                totalPOICount -= localPOICount;
                displayedPOICount -= layerGroup.getLayers().length;
                
                // Clear existing markers
                layerGroup.clearLayers();
                
                localPOICount = data.elements.length;
                totalPOICount += localPOICount;
    
                const remainingSlots = Math.max(0, 200 - displayedPOICount);
                const limit = Math.min(localPOICount, remainingSlots);
                const elements = data.elements.slice(0, limit);

                logDebug(`${poiType.name}: Displaying ${elements.length} of ${localPOICount} elements (${remainingSlots} slots remaining)`);
    
                elements.forEach((e, index) => {
                    let lat = e.lat || e.center?.lat;
                    let lon = e.lon || e.center?.lon;
                    
                    if (!lat || !lon) {
                        logDebug(`${poiType.name}: Skipping element ${index} - missing coordinates`, e);
                        return;
                    }
                    
                    // Create popup content
                    let popupContent = `<strong>${poiType.name}</strong>`;
                    
                    // Add name if available
                    if (e.tags && e.tags.name) {
                        popupContent += `<br><strong>${e.tags.name}</strong>`;
                    }
                    
                    // Add brand if available (for gas stations)
                    if (e.tags && e.tags.brand) {
                        popupContent += `<br>Brand: ${e.tags.brand}`;
                    }
                    
                    // Add special description for graveyards/cemeteries
                    if (poiType.key === 'cemetery' || 
                        (e.tags && (e.tags.amenity === 'grave_yard' || e.tags.landuse === 'cemetery'))) {
                        popupContent += `<br><br><span style="color: #0066cc; font-style: italic;">💧 Maybe drinking water available</span>`;
                        
                        // Show which tag type was used
                        if (e.tags && e.tags.amenity === 'grave_yard') {
                            popupContent += `<br><span style="color: #666; font-size: 12px;">Tagged as: amenity=grave_yard</span>`;
                        } else if (e.tags && e.tags.landuse === 'cemetery') {
                            popupContent += `<br><span style="color: #666; font-size: 12px;">Tagged as: landuse=cemetery</span>`;
                        }
                        
                        // Add denomination if available
                        if (e.tags && e.tags.denomination) {
                            popupContent += `<br><strong>Denomination:</strong> ${e.tags.denomination}`;
                        }
                        
                        // Add religion if available
                        if (e.tags && e.tags.religion) {
                            popupContent += `<br><strong>Religion:</strong> ${e.tags.religion}`;
                        }
                    }
                    
                    // Add opening hours if this POI type should show them
                    if (poiType.showOpeningHours && e.tags && e.tags.opening_hours) {
                        const status = getCurrentStatus(e.tags.opening_hours);
                        const formattedHours = formatOpeningHours(e.tags.opening_hours);
                        popupContent += `<br><br>${status}<br><strong>Opening Hours:</strong><br>${formattedHours}`;
                    } else if (poiType.showOpeningHours) {
                        popupContent += `<br><br><span style="color: gray;">Opening hours not available</span>`;
                    }
                    
                    try {
                        let marker = L.marker([lat, lon], {
                            icon: L.icon({
                                iconUrl: poiType.icon,
                                iconSize: [32, 32],
                                iconAnchor: [16, 16], // Center the icon
                                popupAnchor: [0, -16] // Position popup above icon
                            })
                        }).bindPopup(popupContent);
                        layerGroup.addLayer(marker);
                    } catch (iconError) {
                        logDebug(`${poiType.name}: Error creating marker for element ${index}`, iconError);
                    }
                });
                
                displayedPOICount += layerGroup.getLayers().length;
                currentRequest = null; // Clear current request
                
                logDebug(`${poiType.name}: Update complete - Added ${layerGroup.getLayers().length} markers`);
                updateGlobalMessage();
            })
            .catch(error => {
                if (currentRequest && !currentRequest.cancelled) {
                    logDebug(`${poiType.name}: Error fetching data`, error);
                    showMessage(`Error fetching ${poiType.name}: ${error.message}`);
                    currentRequest = null;
                }
            });
    }

    // Debounce map moves to prevent too many requests
    let moveTimeout;
    function debouncedUpdate() {
        clearTimeout(moveTimeout);
        moveTimeout = setTimeout(updatePOIs, 300); // Wait 300ms after map stops moving
    }

    map.on('moveend', debouncedUpdate);

    return {
        layer: layerGroup,
        activate: function() {
            logDebug(`${poiType.name}: Activating layer`);
            isActive = true;
            updatePOIs();
        },
        deactivate: function() {
            logDebug(`${poiType.name}: Deactivating layer`);
            isActive = false;
            
            // Cancel any pending request
            if (currentRequest) {
                currentRequest.cancelled = true;
                currentRequest = null;
            }
            
            // Update counters
            totalPOICount -= localPOICount;
            displayedPOICount -= layerGroup.getLayers().length;
            localPOICount = 0;
            
            // Clear markers
            layerGroup.clearLayers();
            updateGlobalMessage();
        },
        // Add method to get current status
        getStatus: function() {
            return {
                active: isActive,
                markerCount: layerGroup.getLayers().length,
                localPOICount: localPOICount,
                hasActiveRequest: currentRequest !== null
            };
        }
    };
}

// Create POI layers
const poiLayers = poiTypes.map(type => ({
    ...type,
    layerControl: createPOILayer(type)
}));

// Create custom POI control
L.Control.PoiControl = L.Control.extend({
    onAdd: function(map) {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-poi');
        container.style.backgroundColor = 'white';
        container.style.padding = '10px';
        container.style.maxHeight = '300px';
        container.style.overflowY = 'auto';

        poiLayers.forEach(poi => {
            const item = L.DomUtil.create('div', 'poi-item', container);
            item.style.margin = '5px 0';
            
            const checkbox = L.DomUtil.create('input', '', item);
            checkbox.type = 'checkbox';
            checkbox.id = `poi-${poi.value}`;
            
            const label = L.DomUtil.create('label', '', item);
            label.htmlFor = `poi-${poi.value}`;
            label.innerHTML = `<img src="${poi.icon}" style="width:20px;height:20px;margin-right:5px;"> ${poi.name}`;
            
            L.DomEvent.on(checkbox, 'change', function() {
                if (this.checked) {
                    map.addLayer(poi.layerControl.layer);
                    poi.layerControl.activate();
                } else {
                    map.removeLayer(poi.layerControl.layer);
                    poi.layerControl.deactivate();
                }
            });
        });

        return container;
    }
});

// Add custom POI control
new L.Control.PoiControl({ position: 'topright' }).addTo(map);

// Define base maps
var baseMaps = {
    "OSM": osm,
    "Topo": openTopoMap,
    "Satellite": googleSat,
    "Google": googleTerrain
};


// Add layer control for base maps
var layerControl = L.control.layers(baseMaps).addTo(map);

// Add scale control
L.control.scale().addTo(map);

// Add geolocation functionality
let userLocationMarker = null;
let userLocationControl = null;

// Create custom geolocation control
L.Control.GeolocationControl = L.Control.extend({
    onAdd: function(map) {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-geolocation');
        
        const button = L.DomUtil.create('a', 'leaflet-control-geolocation-button', container);
        button.innerHTML = '📍';
        button.href = '#';
        button.title = 'Find my location';
        button.setAttribute('role', 'button');
        button.setAttribute('aria-label', 'Find my location');
        
        button.style.width = '30px';
        button.style.height = '30px';
        button.style.lineHeight = '30px';
        button.style.textAlign = 'center';
        button.style.textDecoration = 'none';
        button.style.color = '#000';
        button.style.backgroundColor = 'white';
        button.style.border = '2px solid rgba(0,0,0,0.2)';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
        
        // Prevent map events when clicking the button
        L.DomEvent.disableClickPropagation(button);
        L.DomEvent.disableScrollPropagation(button);
        
        L.DomEvent.on(button, 'click', function(e) {
            L.DomEvent.preventDefault(e);
            getUserLocation();
        });
        
        return container;
    }
});

// Function to get user location
function getUserLocation() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by this browser.');
        return;
    }
    
    // Show loading state
    const button = document.querySelector('.leaflet-control-geolocation-button');
    if (button) {
        button.innerHTML = '⏳';
        button.style.color = '#666';
    }
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            
            showUserLocation(lat, lon, accuracy);
            
            // Reset button state
            if (button) {
                button.innerHTML = '📍';
                button.style.color = '#000';
            }
        },
        function(error) {
            let errorMessage = 'Error getting location: ';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'User denied the request for Geolocation.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Location information is unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'The request to get user location timed out.';
                    break;
                default:
                    errorMessage += 'An unknown error occurred.';
                    break;
            }
            alert(errorMessage);
            
            // Reset button state
            if (button) {
                button.innerHTML = '📍';
                button.style.color = '#000';
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
        }
    );
}

// Function to show user location on map
function showUserLocation(lat, lon, accuracy) {
    // Remove existing user location marker if it exists
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
    }
    
    // Create custom icon for user location
    const userLocationIcon = L.icon({
        iconUrl: 'img/location.svg',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });
    
    // Create marker for user location
    userLocationMarker = L.marker([lat, lon], {
        icon: userLocationIcon
    }).addTo(map);
    
    // Create popup content
    let popupContent = `
        <strong>Your Location</strong><br>
        <strong>Coordinates:</strong><br>
        Lat: ${lat.toFixed(6)}<br>
        Lon: ${lon.toFixed(6)}<br>
        <strong>Accuracy:</strong> ${Math.round(accuracy)} meters
    `;
    
    userLocationMarker.bindPopup(popupContent);
    
    // Optionally add accuracy circle
    if (accuracy < 1000) { // Only show circle if accuracy is reasonable
        const accuracyCircle = L.circle([lat, lon], {
            radius: accuracy,
            color: '#136AEC',
            fillColor: '#136AEC',
            fillOpacity: 0.1,
            weight: 2
        }).addTo(map);
        
        // Remove circle when user location marker is removed
        userLocationMarker.accuracyCircle = accuracyCircle;
    }
    
    // Center map on user location with appropriate zoom
    let zoomLevel = 16;
    if (accuracy > 1000) {
        zoomLevel = 14;
    } else if (accuracy > 500) {
        zoomLevel = 15;
    }
    
    map.setView([lat, lon], zoomLevel);
    
    // Show popup
    userLocationMarker.openPopup();
}

// Add geolocation control to map
userLocationControl = new L.Control.GeolocationControl({ position: 'topleft' }).addTo(map);

// Optional: Watch user location for continuous tracking
let watchId = null;
let isWatching = false;

// Function to start/stop watching user location
function toggleLocationWatch() {
    if (isWatching) {
        // Stop watching
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        isWatching = false;
    } else {
        // Start watching
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                function(position) {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    const accuracy = position.coords.accuracy;
                    
                    showUserLocation(lat, lon, accuracy);
                },
                function(error) {
                    console.error('Error watching location:', error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000 // 1 minute
                }
            );
            isWatching = true;
        }
    }
}

// Cleanup function to remove user location marker
function removeUserLocation() {
    if (userLocationMarker) {
        if (userLocationMarker.accuracyCircle) {
            map.removeLayer(userLocationMarker.accuracyCircle);
        }
        map.removeLayer(userLocationMarker);
        userLocationMarker = null;
    }
}

// Optional: Add keyboard shortcut (Ctrl+L) to get location
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        getUserLocation();
    }
});