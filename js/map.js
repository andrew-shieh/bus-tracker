
const MAP_API_KEY = keys.google_maps;
const BUS_API_KEY = keys.open_511;

const patternUrl = `http://api.511.org/transit/patterns?api_key=${BUS_API_KEY}&operator_id=SC&line_id=Rapid%20522&format=json`;
const stopUrl = `http://api.511.org/transit/stops?api_key=${BUS_API_KEY}&operator_id=SC&line_id=Rapid%20522&format=json`;
const realtimeUrl = `http://api.511.org/transit/VehicleMonitoring?api_key=${BUS_API_KEY}&agency=SC&line=Rapid%20522&format=json`;
const busInfoUrl = `http://api.511.org/transit/StopMonitoring?api_key=${BUS_API_KEY}&agency=SC&format=json`;


var busStops = [];
var busPositions = [];
var busCongestion = [];

async function getBusStops(line) {
	const stopRes = await fetch(stopUrl);
	const stopJson = await stopRes.json();
	const patternRes = await fetch(patternUrl);
	const patternJson = await patternRes.json();

	let allStops = {};
	for (const stop of stopJson.Contents.dataObjects.ScheduledStopPoint) {
		allStops[stop.id] = {
			name: stop.Name,
		  lat: parseFloat(stop.Location.Latitude),
			lng: parseFloat(stop.Location.Longitude)
	  };
	}

	for (const pattern of patternJson.journeyPatterns) {
		if (pattern.serviceJourneyPatternRef === line) {
			for (const stop of pattern.PointsInSequence.StopPointInJourneyPattern) {
				if (stop.ScheduledStopPointRef in allStops) {
          let stopInfo = allStops[stop.ScheduledStopPointRef];
          stopInfo['order'] = stop.Order;
          busStops.push(stopInfo);
				}
			}
			for (const stop of pattern.PointsInSequence.TimingPointInJourneyPattern) {
				if (stop.ScheduledStopPointRef in allStops) {
          let stopInfo = allStops[stop.ScheduledStopPointRef];
          stopInfo['order'] = stop.Order;
          busStops.push(stopInfo);
				}
			}
		}
	}
  busStops.sort((first, second) => first.order - second.order)
	return busStops;
}

var busList = [];
var stopList = [];
async function getBusInfo(line, direction) {
	const posRes = await fetch(realtimeUrl);
	const posJson = await posRes.json();

  if (busList.length == 0) {
    for (const bus of posJson.Siri.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity) {
      let busInfo = bus.MonitoredVehicleJourney;
      if (busInfo.LineRef === line && busInfo.DirectionRef === direction) {
        busPositions.push({
          name: line,
          lat: parseFloat(busInfo.VehicleLocation.Latitude),
          lng: parseFloat(busInfo.VehicleLocation.Longitude)
        });
      };
    }
  } else {
  }
	return busPositions;

}


async function addMarkers(arr, icon, map) {
  let createdMarkers = [];
  for (const item of arr) {
		let marker = new google.maps.Marker({
      position: {lat: item.lat, lng: item.lng},
			icon: icon,
			map: map
		});
    let infowindow = new google.maps.InfoWindow({content: item.name});
    marker.addListener('mouseover', () => infowindow.open(map, marker));
    marker.addListener('mouseout', () => infowindow.close());
    createdMarkers.push(marker);
  };
}


async function removeMarkers(arr) {
  for (const item of arr) {
    item.setMap(null);
  };
  arr.length = 0;
};






var script = document.createElement('script');
script.src = `https://maps.googleapis.com/maps/api/js?key=${MAP_API_KEY}&callback=initMap`;
script.defer = true;
script.async = true;


async function initMap() {
  var map = new google.maps.Map(document.getElementById('map'), {
          center: {lat: 37.3848873, lng: -122.0247555},
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: true,
          styles: [
						{
							"featureType": "administrative",
							"elementType": "geometry",
							"stylers": [
								{
									"visibility": "off"
								}
							]
						},
						{
							"featureType": "administrative.land_parcel",
							"elementType": "labels",
							"stylers": [
								{
									"visibility": "off"
								}
							]
						},
						{
							"featureType": "poi",
							"stylers": [
								{
									"visibility": "off"
								}
							]
						},
						{
							"featureType": "poi",
							"elementType": "labels.text",
							"stylers": [
								{
									"visibility": "off"
								}
							]
						},
						{
							"featureType": "road",
							"elementType": "labels.icon",
							"stylers": [
								{
									"visibility": "off"
								}
							]
						},
						{
							"featureType": "road.local",
							"elementType": "labels",
							"stylers": [
								{
									"visibility": "off"
								}
							]
						},
						{
							"featureType": "transit",
							"stylers": [
								{
									"visibility": "off"
								}
							]
						}
					]
        });

	var stopArr = await getBusStops('209180');
	var busArr = await getBusInfo('Rapid 522', 'West');
	var stopMarkers = await addMarkers(stopArr, 'assets/stop.png', map);
	var busMarkers = await addMarkers(busArr, 'assets/bus.png', map);

	console.log(stopArr);
	console.log(busArr);
}

document.head.appendChild(script);
