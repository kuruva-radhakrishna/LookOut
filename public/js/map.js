
mapboxgl.accessToken = mapToken;
console.log(mapToken);
const map = new mapboxgl.Map({
  container: "map", // container ID
  center: listing.geometry.coordinates || [ 79.3624701068439, 15.5180327493179 ], // starting position [lng, lat]. Note that lat must be set between -90 and 90
  zoom: 9, // starting zoom
});

console.log(listing.geometry.coordinates);

const marker1 = new mapboxgl.Marker()
        .setLngLat(listing.geometry.coordinates)
        .setPopup(
          new mapboxgl.Popup({offset: 25})
        .setHTML(`<h6>${listing.place}</h6><p>Exact location will be provide after booking</p>`)
        .setMaxWidth("600px"))
        .addTo(map);