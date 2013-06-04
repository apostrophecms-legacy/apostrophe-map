function AposMap(optionsArg) {
  var self = this;
  var options = {
    instance: 'mapLocation',
    name: 'map'
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

AposMap.addWidgetType = function(options) {
  if (!options) {
    options = {};
  }
  _.defaults(options, {
    name: 'map',
    label: 'Locations',
    action: '/apos-map',
    defaultLimit: 5
  });
  AposSnippets.addWidgetType(options);
};


