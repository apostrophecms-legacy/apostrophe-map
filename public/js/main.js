function AposMap(optionsArg) {
  var self = this;
  var options = {
    instance: 'mapLocation'
  };
  $.extend(options, optionsArg);
  AposSnippets.call(self, options);

  /*self.beforeUpdate = function($el, data, callback) {
    console.log(data);
  };*/

  self.beforeInsert = function($el, data, callback) {
    //grab the value of the address field and toss it into the data object before carrying on
    data.address = $el.find('[name="address"]').val();
    callback();
  };
}


// a meaty constructor that fires up our googlemap
var AposGoogleMap = function(items) {
  var self = this;
  self.items = items;
  self.markers = [];

  this.setup = function(callback) {
    // alert('hi hi hi');
    callback();
  }

  this.googleMap = function() {
    var mapCenter = new google.maps.LatLng(39.952335, -75.163789)
      , mapZoom = 12
      , mapEl = 'map-canvas';

    var mapStyles;

    var map = new google.maps.Map(document.getElementById(mapEl), {
      zoom: mapZoom,
      center: mapCenter,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    });

    if(mapStyles) map.setOptions({styles:mapStyles});

    for(i in self.items) {
      var marker = self.generateMarker(self.items[i], map);
      self.markers[i] = marker;
    }
  }

  this.generateMarker = function(item, map)
  {
    var coords = new google.maps.LatLng(item.coords.lat, item.coords.lng);
    var marker = new google.maps.Marker({
      position: coords,
      draggable: false,
      visible: true,
      clickable: true,
      map: map
    });

    // icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAB5JREFUeNrswTEBAAAAwqD1T+1vBqAAAADgTQABBgAOLgABLbg5rgAAAABJRU5ErkJggg=='
    return marker;
  }


  //call setup and feed it the google map load listener
  self.setup(function() {
    google.maps.event.addDomListener(window, 'load', self.googleMap)
  });
}