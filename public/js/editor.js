// JavaScript which enables editing of this module's content belongs here.

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

