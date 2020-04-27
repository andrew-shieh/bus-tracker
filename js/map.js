
const MAP_API_KEY = keys.google_maps;
const BUS_API_KEY = keys.open_511;

const patternUrl = `http://api.511.org/transit/patterns?api_key=${BUS_API_KEY}&operator_id=SC&format=json`;
const stopUrl = `http://api.511.org/transit/stops?api_key=${BUS_API_KEY}&operator_id=SC&format=json`;
const realtimeUrl = `http://api.511.org/transit/VehicleMonitoring?api_key=${BUS_API_KEY}&agency=SC&format=json`;

// blue, green, yellow, orange, red, darkred
const TRAFFIC_COLOR = ['#1E90FF', '#32CD32', '#FFD700', '#FF8C00', '#FF0000', '#800000']

// lazy pattern checker
const PATTERN_REF = {
  '22East': '207762',
  '22West': '207764',
  'Rapid 522East': '209180',
  'Rapid 522West': '209182'
};


async function getBusStops(line, direction) {
	const stopRes = await fetch(stopUrl + `&line_id=${encodeURIComponent(line.trim())}`);
	const stopJson = await stopRes.json();
	const patternRes = await fetch(patternUrl + `&line_id=${encodeURIComponent(line.trim())}`);
	const patternJson = await patternRes.json();

	let allStops = {};
	for (const stop of stopJson.Contents.dataObjects.ScheduledStopPoint) {
		allStops[stop.id] = {
			name: stop.Name,
		  lat: parseFloat(stop.Location.Latitude),
			lng: parseFloat(stop.Location.Longitude)
	  };
	}

  let busStops = [];
	for (const pattern of patternJson.journeyPatterns) {
		if (pattern.serviceJourneyPatternRef === PATTERN_REF[line+direction]) {
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

async function getBusInfo(line, direction) {
	const posRes = await fetch(realtimeUrl);
  const posJson = await posRes.json();

  let busList = [];
  let busDelay = {};

  let busTimesTotal = {};
  let busTimesCount = {};
  for (const bus of posJson.Siri.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity) {
    let busInfo = bus.MonitoredVehicleJourney;
    if (busInfo.LineRef === line && busInfo.DirectionRef === direction) {
      busList.push({
        name: line,
        lat: parseFloat(busInfo.VehicleLocation.Latitude),
        lng: parseFloat(busInfo.VehicleLocation.Longitude)
      });
      if (busInfo.OnwardCalls) {
        for (const stop of busInfo.OnwardCalls.OnwardCall) {
          if (stop.AimedArrivalTime && stop.ExpectedArrivalTime) {
            let diff = new Date(stop.ExpectedArrivalTime) - new Date(stop.AimedArrivalTime);
            busTimesTotal[stop.StopPointName] = (busTimesTotal[stop.StopPointName] + diff) || diff;
            busTimesCount[stop.StopPointName] = (busTimesCount[stop.StopPointName] + 1) || 1;
          }
        };
      }
    };
  }

  for (const stop in busTimesCount) {
    busDelay[stop] = busTimesTotal[stop]*1.0 / busTimesCount[stop];
  }

  return [busList, busDelay];
}


async function addMarkers(arr, icon) {
  let createdMarkers = [];
  for (const item of arr) {
		let marker = new google.maps.Marker({
      position: {lat: item.lat, lng: item.lng},
			icon: icon,
			map: map
		});
    let infowindow = new google.maps.InfoWindow({
      content: item.name
    });
    marker.addListener('mouseover', () => infowindow.open(map, marker));
    marker.addListener('mouseout', () => infowindow.close());
    createdMarkers.push(marker);
  };
  return createdMarkers;
}


async function addSegments(stopArr, delayArr) {
  let busSegments = [];
  for (let i = 1; i < stopArr.length; i++) {
    let color = TRAFFIC_COLOR[0];
    if (stopArr[i].name in delayArr) {
      if (delayArr[stopArr[i].name] <= 0) {
        color = TRAFFIC_COLOR[1];
      } else if (delayArr[stopArr[i].name] <= 10000) {
        color = TRAFFIC_COLOR[2];
      } else if (delayArr[stopArr[i].name] <= 20000) {
        color = TRAFFIC_COLOR[3];
      } else if (delayArr[stopArr[i].name] <= 30000) {
        color = TRAFFIC_COLOR[4];
      } else {
        color = TRAFFIC_COLOR[5];
      }
    }
    let segment = new google.maps.Polyline({
      path: [stopArr[i-1], stopArr[i]],
      strokeColor: color,
      strokeOpacity: 1.0,
      strokeWeight: 3,
      map: map
    });
    busSegments.push(segment);
  };
  return busSegments;
};


async function removeFromMap(arr) {
  if (arr) {
    for (const item of arr) {
      item.setMap(null);
    };
    arr.length = 0;
  }
};





document.getElementById('settings').onsubmit = function() {
  let agency = document.getElementById('agency').value;
  let line = document.getElementById('line').value;
  let direction = document.getElementById('direction').value;
  refreshMap(agency, line, direction);
  return false;
};


var stopList;
var stopDelay;
var busList;
var stopMarkers;
var busMarkers;
var busSegments;
async function refreshMap(agency, line, direction) {
  removeFromMap(stopMarkers);
  removeFromMap(busMarkers);
  removeFromMap(busSegments);

	stopList = await getBusStops(line, direction);
  let busInfo = await getBusInfo(line, direction);
  busList = busInfo[0];
  stopDelay = busInfo[1];
	stopMarkers = await addMarkers(stopList, 'assets/stop.png');
	busMarkers = await addMarkers(busList, 'assets/bus.png');
  busSegments = await addSegments(stopList, stopDelay);
};





var script = document.createElement('script');
script.src = `https://maps.googleapis.com/maps/api/js?key=${MAP_API_KEY}&callback=initMap`;
script.defer = true;
script.async = true;


var map;
async function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
          center: {lat: 37.3848873, lng: -122.0247555},
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
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

  refreshMap('VTA', '22', 'East');
}

document.head.appendChild(script);
