// Initialize the map
//const map = L.map('map').setView([49.006889, 8.403653], 18); //Karlsruhe
const map = L.map('map').setView([48.77797, 8.44038], 15); 

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

// Function to create a custom POI layer
function createPOILayer(keyword, iconUrl) {
    let layerGroup = L.layerGroup();
    let isActive = false;

    function updatePOIs() {
        if (!isActive) return;

        const bounds = map.getBounds();
        const query = `
            [out:json];
            (
              node["amenity"="${keyword}"](${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()});
            );
            out body;
        `;

        fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                console.log(`Received data for ${keyword}:`, data);
                layerGroup.clearLayers();
                
                if (data.elements.length === 0) {
                    console.log(`No ${keyword} found in this area`);
                    return;
                }

                data.elements.forEach(e => {
                    let marker = L.marker([e.lat, e.lon], {
                        icon: L.icon({
                            iconUrl: iconUrl,
                            iconSize: [32, 32]
                        })
                    }).bindPopup(keyword);
                    layerGroup.addLayer(marker);
                    console.log(`Added marker for ${keyword} at ${e.lat}, ${e.lon}`);
                });
            })
            .catch(error => console.error('Error fetching data:', error));
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
            layerGroup.clearLayers();
        }
    };
}


// Create POI layers
const bbqLayer = createPOILayer('bbq', 'img/BBQ.png');
const fountainLayer = createPOILayer('drinking_water', 'img/Fountain.png');
const shelterLayer = createPOILayer("shelter","img/Hut.png")


// Define base maps
var baseMaps = {
    "OSM": osm,
    "Topo": openTopoMap,
    "Satellite": googleSat,
    "Google": googleTerrain
};

var overlayMaps = {
    "BBQ Places": bbqLayer.layer,
    "Fountains": fountainLayer.layer,
    "Shelters": shelterLayer.layer
};  


// Add layer control
var layerControl = L.control.layers(baseMaps, overlayMaps).addTo(map);

// Add scale control
L.control.scale().addTo(map);

// Event listeners for layer activation/deactivation
map.on('overlayadd', function(e) {
    if (e.name === "BBQ Places") bbqLayer.activate();
    if (e.name === "Fountains") fountainLayer.activate();
    if (e.name === "Shelters") shelterLayer.activate();
});

map.on('overlayremove', function(e) {
    if (e.name === "BBQ Places") bbqLayer.deactivate();
    if (e.name === "Fountains") fountainLayer.deactivate();
    if (e.name === "Shelters") shelterLayer.deactivate();
});
