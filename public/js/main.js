function AposMap(optionsArg) {
  var self = this;
  var options = {
    instance: 'mapLocation'
  };
  $.extend(options, optionsArg);
  AposSnippets.call(self, options);

  function findExtraFields($el, data, callback) {
    //grab the value of the extra fields and toss them into the data object before carrying on
    data.address = $el.find('[name="address"]').val();
    data.locType = $el.find('[name="locType"]').val();
    data.hours = $el.find('[name="hours"]').val();
    data.descr = $el.find('[name="descr"]').val();
    callback();
  }

  self.afterPopulatingEditor = function($el, snippet, callback) {
    $el.find('[name=address]').val(snippet.address);
    $el.find('[name="locType"]').val(snippet.locType);
    $el.find('[name="hours"]').val(snippet.hours);
    $el.find('[name="descr"]').val(snippet.descr);
    callback();
  };

  self.beforeInsert = function($el, data, callback) {
    findExtraFields($el, data, callback);
  };

  self.beforeUpdate = function($el, data, callback) {
    findExtraFields($el, data, callback);
  };
}

// a meaty constructor that fires up our googlemap:
var AposGoogleMap = function(items, mapOptions) {
  var self = this;
  self.items = items;
  self.mapOptions = mapOptions;
  self.markers = [];
  self.infoBoxes = [];
  self.map;

  this.setup = function(callback) {
    callback();
  }

  // set up the actual map
  this.googleMap = function() {
    var mapCenter = new google.maps.LatLng(39.952335, -75.163789);
    var mapZoom = 12;
    var mapEl = 'map-canvas';

    var map = new google.maps.Map(document.getElementById(mapEl), {
      zoom: mapZoom,
      center: mapCenter,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    });

    self.map = map;

    var mapStyles = self.mapOptions.styles;

    if(mapStyles) map.setOptions({styles:mapStyles});

    // loop through the items getting passed in from our template 
    // and create a marker / info box for each
    for(i in self.items) {
      var marker = self.generateMarker(self.items[i], map);
      self.markers[i] = marker;

      var infoBox = self.generateInfoBox(self.items[i], map);
      self.infoBoxes[i] = infoBox;

      $('.apos-location#'+self.items[i]._id).on('click', (function(marker, i) {
        return function() {
          for(b in self.infoBoxes) { self.infoBoxes[b].close(); }
          self.infoBoxes[i].open(map, self.markers[i]);
        }
      })(marker, i));

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
    var markerHTML = document.createElement('DIV');
        markerHTML.innerHTML = '<div class="map-marker '+item.locType+'"></div>';
    var coords = new google.maps.LatLng(item.coords.lat, item.coords.lng);

    var marker = new RichMarker({
      position: coords,
      draggable: false,
      visible: true,
      clickable: true,
      map: map,
      content: markerHTML
    });

    return marker;
  }

  this.generateInfoBox = function(item, map)
  {
    var boxMarkup = document.createElement("div");

    // THIS SHOULD BECOME SOME SORT OF TEMPLATE IF POSSIBLE
    // IT WOULD BE GREAT IF WE COULD KEEP IT IN THE VIEWS FOLDER FOR THIS MODULE
    boxMarkup.innerHTML = '' +
    '<div class="map-location-info">'+
      '<div class="location-image"></div>' +
      '<div class="location-content">' +
        '<h5 class="location-type">'+item.locType+'</h5>' +
        '<h2 class="location-title">'+item.title+'</h2>' +
        '<p>'+item.address+'</p>'+
        '<p>'+item.descr+'</p>'+
        '<p>'+item.hours+'</p>'+
        '<a class="more-button" href="'+window.location.pathname+'/'+item.slug+'">Learn More</a>' +
      '</div>' +
    '</div>';

    var boxOptions = {
      content: boxMarkup,
      disableAutoPan: false,
      pixelOffset: new google.maps.Size(40,-105),
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

AposGoogleMapSidebar = function() {
  // $('.apos-location').each(function(){
  //   gmap.
  // })

}