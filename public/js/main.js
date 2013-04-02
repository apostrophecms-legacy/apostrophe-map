// Constructor name must be AposMapLocations to be
// automatically found if instance name is mapLocation

function AposMapLocations(optionsArg) {
  var self = this;
  var options = {
    instance: 'mapLocation'
  };
  // Accept data pushed with apos.pushGlobalData() and req.pushData() as options
  $.extend(options, apos.data.aposMap || {}, true);
  $.extend(options, optionsArg, true);
  AposSnippets.call(self, options);

  function findExtraFields($el, data, callback) {
    //grab the value of the extra fields and toss them into the data object before carrying on
    data.address = $el.find('[name="address"]').val();
    data.hours = $el.find('[name="hours"]').val();
    data.descr = $el.find('[name="descr"]').val();
    callback();
  }

  self.afterPopulatingEditor = function($el, snippet, callback) {
    $el.find('[name=address]').val(snippet.address);
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

AposMapLocations.addWidgetType = function(options) {
  if (!options) {
    options = {};
  }
  _.defaults(options, {
    name: 'map',
    label: 'Locations',
    action: '/apos-map-location',
    defaultLimit: 5
  });
  AposSnippets.addWidgetType(options);
};

// a meaty constructor that fires up our googlemap. if mapOptions.center is not
// set to an object with lat and lng properties, the center is
// determined from the items. If there are no items... welcome to Philadelphia!

var AposGoogleMap = function(items, mapOptions) {
  var self = this;
  self.items = items;
  self.mapOptions = mapOptions;
  self.markers = [];
  self.infoBoxes = [];

  self.setup = function(callback) {
    callback();
  };

  // set up the actual map
  self.googleMap = function() {
    var lat = 0.0;
    var lng = 0.0;
    var mapCenter;
    if (self.mapOptions.center) {
      mapCenter = new google.maps.latLng(center.lat, center.lng);
    }
    if (!mapCenter) {
      // Auto-center
      var valid = 0;
      _.each(self.items, function(item) {
        if (item.coords) {
          lat += item.coords.lat;
          lng += item.coords.lng;
          valid++;
        }
      });
      if (valid) {
        mapCenter = new google.maps.LatLng(lat / valid, lng / valid);
      } else {
        mapCenter = new google.maps.LatLng(39.952335, -75.163789);
      }
    }

    var mapZoom = self.mapOptions.zoom;
    var mapEl = 'map-canvas';

    var map = new google.maps.Map(document.getElementById(mapEl), {
      zoom: mapZoom,
      center: mapCenter,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    });

    self.map = map;

    var mapStyles = self.mapOptions.styles;

    if(mapStyles) map.setOptions({styles:mapStyles});

    var bounds;
    if (!mapZoom) {
      // Auto-zoom
      bounds = new google.maps.LatLngBounds();
    }
    // loop through the items getting passed in from our template
    // and create a marker / info box for each
    var i;
    for (i in self.items) {
      var item = self.items[i];
      if (item.coords) {
        if (!mapZoom) {
          // Auto-zoom
          bounds.extend(new google.maps.LatLng(item.coords.lat, item.coords.lng));
        }
      }
      var marker = self.generateMarker(self.items[i], map);
      self.markers[i] = marker;

      var infoBox = self.generateInfoBox(self.items[i], map);
      self.infoBoxes[i] = infoBox;

      $('.apos-location#'+self.items[i]._id).on('click', (function(marker, i) {
        return function() {
          for(var b in self.infoBoxes) { self.infoBoxes[b].close(); }
          self.infoBoxes[i].open(map, self.markers[i]);
        };
      })(marker, i));

      // attach a click listener to the marker that opens our info box
      google.maps.event.addListener(marker, 'click', (function(marker, i) {
        return function() {
          var b;
          for(b in self.infoBoxes) { self.infoBoxes[b].close(); }
          for(b in self.markers) {
            self.markers[b].content.firstChild.className = self.markers[b].content.firstChild.className.replace(' active', '');
           }
          self.infoBoxes[i].open(map, self.markers[i]);
          marker.content.firstChild.className += " active";
        };
      })(marker, i));
    }

    if (!mapZoom) {
      //Auto zoom
      self.map.fitBounds(bounds);
    }
  };

  // Find the locType mentioned first in the tags of the item, otherwise
  // the first one defined, otherwise 'general'

  self.getLocType = function(item) {
    var names = _.map(self._locTypes, function(locType) { return locType.name; });
    var locType = _.find(item.tags, function(tag) {
      return _.has(names, tag);
    });
    if (!locType) {
      locType = self._locTypes[0];
    }
    if (!locType) {
      locType = { name: 'general', label: 'General' };
    }
    return locType;
  };

  // Return a CSS-friendly version of the locType name

  self.getCssClass = function(item) {
    return apos.cssName(self.getLocType(item));
  };

  self.generateMarker = function(item, map)
  {
    var markerHTML = document.createElement('DIV');
        markerHTML.innerHTML = '<div class="map-marker '+self.getCssClass(item)+'"></div>';
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
  };

  self.generateInfoBox = function(item, map)
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
      pixelOffset: new google.maps.Size(10,-137),
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
  };

  //call setup and feed it the google map load listener
  self.setup(function() {
    google.maps.event.addDomListener(window, 'load', self.googleMap);
  });
};

