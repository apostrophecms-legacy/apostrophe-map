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
  self._locTypes = options.locTypes || [ { name: 'general', label: 'General' }];

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

// id is a separate parameter because it's tough to set a property of an object
// in a nunjucks template, and we generate the id there. You are responsible for
// supplying a div with that id and a suitable width and height

var AposGoogleMap = function(items, id, mapOptions) {
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
      var center = self.mapOptions.center;
      mapCenter = new google.maps.LatLng(center.lat, center.lng);
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
    var mapEl = $('#' + id)[0];

    var map = new google.maps.Map(mapEl, {
      zoom: mapZoom,
      center: mapCenter,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    });

    self.map = map;

    var mapStyles = self.mapOptions.styles;

    if(mapStyles) map.setOptions({styles:mapStyles});

    map.setOptions({scrollwheel: false, mapTypeControl: false});

    var bounds;
    if (!mapZoom) {
      // Auto-zoom
      bounds = new google.maps.LatLngBounds();
    }

    // loop through the items getting passed in from our template
    // and create a marker / info box for each. To avoid convoluted
    // code just call a nested function in a loop and pass it 'i' so that
    // it's safe to write boring, simple event handlers there that use 'i'
    var i;
    for (i in self.items) {
      setUpItem(i);
    }

    function setUpItem(i) {
      var item = self.items[i];
      if (item.coords) {
        if (!mapZoom) {
          // Auto-zoom
          bounds.extend(new google.maps.LatLng(item.coords.lat, item.coords.lng));
        }
      } else {
        // Ignore ungeocoded points
        return;
      }
      var marker = self.generateMarker(self.items[i], self.map);
      self.markers[i] = marker;

      var selector = '.apos-location[data-location-id="' + self.items[i]._id + '"]';
      $('.apos-location[data-location-id="' + self.items[i]._id + '"]').click(function() {
        self.activateInfoBox(i);
        return false;
      });
      // attach a click listener to the marker that opens our info box
      google.maps.event.addListener(marker, 'click', function() {
        self.activateInfoBox(i);
      });
    }

    if (!mapZoom) {
      //Auto zoom
      self.map.fitBounds(bounds);
    }

    //expose the markers so we can get at them later for filtering and such
    window.mapInfoBoxes = self.infoBoxes;
    window.mapMarkers = self.markers;
  };

  self.activateInfoBox = function(i) {
    var b;
    for (b in self.markers) {
      if (self.infoBoxes[b]) {
        self.infoBoxes[b].close();
      }
      self.markers[b].content.firstChild.className = self.markers[b].content.firstChild.className.replace(' active', '');
    }
    if (!self.infoBoxes[i]) {
      var infoBox = self.generateInfoBox(self.items[i], self.map);
      self.infoBoxes[i] = infoBox;
    }
    self.infoBoxes[i].open(self.map, self.markers[i]);
    self.markers[i].content.firstChild.className += " active";
  };

  // Find the locType mentioned first in the tags of the item, otherwise
  // the first one defined, otherwise 'general'

  self.getLocType = function(item) {
    // This information was pushed into browserland with apos.pushGlobalData
    var locTypes = apos.data.aposMap.locTypes;
    var locTypeTag = _.find(item.tags || [], function(tag) {
      return _.find(locTypes, function(locType) {
        return locType.name === tag;
      });
    });
    var locType;
    if (locTypeTag) {
      locType = _.find(locTypes, function(locType) {
        return locType.name === locTypeTag;
      });
    }
    if (!locType) {
      locType = locTypes[0];
    }
    if (!locType) {
      locType = { name: 'general', label: 'General' };
    }
    return locType;
  };

  // Return a CSS-friendly version of the locType name

  self.getCssClass = function(item) {
    return apos.cssName(self.getLocType(item).name);
  };

  self.generateMarker = function(item, map)
  {
    var markerHTML = document.createElement('DIV');
        markerHTML.innerHTML = '<div class="apos-map-marker '+self.getCssClass(item)+'"></div>';
    var coords = new google.maps.LatLng(item.coords.lat, item.coords.lng);

    var marker = new RichMarker({
      position: coords,
      draggable: false,
      visible: true,
      clickable: true,
      map: map,
      content: markerHTML
    });

    marker.locTypes = item.tags;
    return marker;
  };

  // IMPORTANT: if you want more properties to be visible here, make sure
  // you override the aposMapPruneLocations function to include them.
  // You can do that in your server-side extension of the map module.
  // See map/index.js for the original. Pruning is necessary to avoid
  // sending a zillion megabytes per page to the browser

  self.generateInfoBox = function(item, map)
  {
    var $box = apos.fromTemplate('.apos-map-location-info-box');

    var image = apos.getFirstImage(item, 'thumbnail');
    if (image) {
      var url = apos.filePath(image, { size: 'one-third' });
      $box.find('[data-image]').attr('src', url);
    } else {
      // Don't show a broken image
      $box.find('[data-image]').remove();
      $box.addClass('no-img');
    }
    $box.find('[data-loc-type]').text(item.locType);
    $box.find('[data-title]').text(item.title);
    $box.find('[data-address]').text(item.address);
    $box.find('[data-descr]').text(item.descr);
    $box.find('[data-hours]').text(item.hours);
    if (item.url) {
      $box.find('[data-url]').attr('href', item.url);

    var boxOptions = {
      // Wants the actual DOM element, not jQuery
      content: $box[0],
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
    $(function() {
      self.googleMap();
    });
  });
};

