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
