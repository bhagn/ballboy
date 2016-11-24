'use strict';

(function() {

  function Controller($scope) {

    function loadOptions(data) {
      $scope.options = data.bbOptions;
      $scope.$digest();
    }

    function saveSettings() {
      chrome.storage.sync.set({
        'bbOptions': $scope.options
      }, function() {
        console.log('Saved settings');
      });
    }

    chrome.storage.sync.get({
      'bbOptions': {
        notification: 'system',
        favouriteTeam: '',
        testInterval: 15,
        odiInterval: 5,
        t20Interval: 1
      }
    }, loadOptions);

    $scope.saveSettings = saveSettings;

  }

  Controller.$inject = ['$scope'];

  angular.module('ballboyOptions', [])
    .controller('OptionsController', Controller);
})();
