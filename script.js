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
    { name: 'Shelter', key: 'amenity', value: 'shelter', additionalTags: ['shelter_type~"basic_hut|lean_to|weather_shelter|rock_shelter"'], icon: 'img/Hut.png' },
    { name: 'Public Toilets', key: 'amenity', value: 'toilets', icon: 'img/toilet.png' },
    { name: 'Beach Volleyball', key: 'leisure', value: 'pitch', additionalTags: ['sport=beachvolleyball'], icon: 'img/volleyball.png' },
    { name: 'Second Hand Shops', key: 'shop', value: 'second_hand', icon: 'img/secondhand.png' },
    { name: 'Firepit', key: 'leisure', value: 'firepit', icon: 'img/firepit.png' },
    { name: 'Tankstellen', key: 'amenity', value: 'fuel', icon: 'img/fuel_station.png', showOpeningHours: true }
];

// Add a counter to POIs displayed 
let totalPOICount = 0;
let globalMessageControl = null;
let displayedPOICount = 0;

function updateGlobalMessage() {
    if (totalPOICount > 200) {
        showGlobalMessage(`Showing ${displayedPOICount} of ${totalPOICount} POIs. Zoom in to see more.`);
    } else if (totalPOICount > 0) {
        showGlobalMessage(`Showing ${displayedPOICount} POIs.`);
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

    function updatePOIs() {
        if (!isActive) return;
        displayedPOICount = 0;
    
        const bounds = map.getBounds();
        let tagFilters = `["${poiType.key}"="${poiType.value}"]`;
        
        if (poiType.additionalTags) {
            tagFilters += poiType.additionalTags.map(tag => {
                const [key, value] = tag.split(/[=~]/);
                return `["${key}"${tag.includes('~') ? '~' : '='}${value}]`;
            }).join('');
        }
    
        let query = `
            [out:json][timeout:25];
            (
              node${tagFilters}(${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
              way${tagFilters}(${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
            );
            out center;
        `;
    
        fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                console.log(`Received data for ${poiType.name}:`, data);
                
                totalPOICount -= localPOICount;
                displayedPOICount -= layerGroup.getLayers().length;
                
                layerGroup.clearLayers();
                
                localPOICount = data.elements.length;
                totalPOICount += localPOICount;
    
                const remainingSlots = Math.max(0, 200 - displayedPOICount);
                const limit = Math.min(localPOICount, remainingSlots);
                const elements = data.elements.slice(0, limit);
    
                elements.forEach(e => {
                    let lat = e.lat || e.center.lat;
                    let lon = e.lon || e.center.lon;
                    
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
                    
                    // Add opening hours if this POI type should show them
                    if (poiType.showOpeningHours && e.tags && e.tags.opening_hours) {
                        const status = getCurrentStatus(e.tags.opening_hours);
                        const formattedHours = formatOpeningHours(e.tags.opening_hours);
                        popupContent += `<br><br>${status}<br><strong>Opening Hours:</strong><br>${formattedHours}`;
                    } else if (poiType.showOpeningHours) {
                        popupContent += `<br><br><span style="color: gray;">Opening hours not available</span>`;
                    }
                    
                    let marker = L.marker([lat, lon], {
                        icon: L.icon({
                            iconUrl: poiType.icon,
                            iconSize: [32, 32]
                        })
                    }).bindPopup(popupContent);
                    layerGroup.addLayer(marker);
                });
                
                displayedPOICount += layerGroup.getLayers().length;
                updateGlobalMessage();
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                showMessage(`Error fetching ${poiType.name}`);
            });
    }

    map.on('moveend', updatePOIs);

    return {
        layer: layerGroup,
        activate: function() {
            isActive = true;
            updatePOIs();
        },
        deactivate: function() {
            isActive = false;
            totalPOICount -= localPOICount;
            displayedPOICount -= layerGroup.getLayers().length;
            localPOICount = 0;
            layerGroup.clearLayers();
            updateGlobalMessage();
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