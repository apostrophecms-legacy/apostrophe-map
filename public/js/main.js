function AposMap(optionsArg) {
  var self = this;
  var options = {
    instance: 'mapLocation'
  };
  $.extend(options, optionsArg);
  AposSnippets.call(self, options);

  function findAddress($el, data, callback) {
    //grab the value of the address field and toss it into the data object before carrying on
    data.address = $el.find('[name="address"]').val();
    callback();
  }

  self.afterPopulatingEditor = function($el, snippet, callback) {
    $el.find('[name=address]').val(snippet.address);
    callback();
  };

  self.beforeInsert = function($el, data, callback) {
    findAddress($el, data, callback);
  };

  self.beforeUpdate = function($el, data, callback) {
    findAddress($el, data, callback);
  };
}

// a meaty constructor that fires up our googlemap:
var AposGoogleMap = function(items) {
  var self = this;
  self.items = items;
  self.markers = [];
  self.infoBoxes = [];

  this.setup = function(callback) {
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

    // loop through the items getting passed in from our template 
    // and create a marker / info box for each
    for(i in self.items) {
      var marker = self.generateMarker(self.items[i], map);
      self.markers[i] = marker;

      var infoBox = self.generateInfoBox(self.items[i], map);
      self.infoBoxes[i] = infoBox;

      // attach a click listener to the marker that opens our info box
      google.maps.event.addListener(marker, 'click', (function(marker, i) {
        return function() {
          for(b in self.infoBoxes) { self.infoBoxes[b].close(); }
          self.infoBoxes[i].open(map, self.markers[i]);
        }
      })(marker, i));
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

  this.generateInfoBox = function(item, map)
  {
    var boxMarkup = document.createElement("div");

    //i would like this to eventually become some sort of template
    boxMarkup.innerHTML = '' +
    '<div class="map-location-info">'+
      '<div class="location-content">' +
        '<h2 class="location-title">'+item.title+'</h2>' +
        '<a class="more-button" href="'+window.location+'/'+item.slug+'">Learn More</a>' +
      '</div>' +
    '</div>';

    var boxOptions = {
      content: boxMarkup,
      disableAutoPan: false,
      pixelOffset: new google.maps.Size(30,-35),
      boxStyle: {
        width: "280px"
       },
      closeBoxMargin: "0px 0px 0px 0px",
      closeBoxURL: "http://www.google.com/intl/en_us/mapfiles/close.gif",
      infoBoxClearance: new google.maps.Size(1, 1),
      pane: "floatPane",
      enableEventPropagation: false
    };

    return new InfoBox(boxOptions);
  }

  //call setup and feed it the google map load listener
  self.setup(function() {
    google.maps.event.addDomListener(window, 'load', self.googleMap)
  });
}