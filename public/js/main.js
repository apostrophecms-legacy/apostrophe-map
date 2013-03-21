function AposMap(optionsArg) {
  var self = this;
  var options = {
    instance: 'mapLocation'
  };
  apos.log('*** I am in AposMap');
  $.extend(options, optionsArg);
  AposSnippets.call(self, options);

  /*self.beforeUpdate = function($el, data, callback) {
    console.log(data);
  };*/

  self.beforeInsert = function($el, data, callback) {
    // return callback();
    // alert(data);
    console.log('#####################################');
    console.log(data);
  };


}
